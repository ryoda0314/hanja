// データ生成パイプライン
// =====================================================================
// 公開データから、アプリにバンドルする辞書 JSON を生成する。
//   入力（scripts/.cache/ に配置。下記 prepare 手順参照）:
//     - kengdic.tsv             … Korean/English 辞書（surface, hanja, gloss）MPL2.0/LGPL/CC-BY-SA
//     - Unihan_Readings.txt     … kDefinition（漢字の意味・英語）, kHangul（韓国の標準の読み・基礎漢字の印）,
//                                 kJapanese（日本語の音読み・訓読み）
//     - Unihan_IRGSources.txt   … kTotalStrokes（画数）
//     - kyujitai.json           … 旧字体↔新字体 対応（npm: kyujitai, MIT）
//     - krdict/*.xml            … 한국어기초사전（国立国語院、CC BY-SA 2.0 KR）。語の日本語の対訳を取る
//     - jmdict/jmdict-eng-*.json … JMdict（EDRDG、CC BY-SA 4.0。jmdict-simplified の JSON）。日本語にも同じ漢字の語があるか
//     - src/data/curated-*.json … 手作業キュレーション（音訓・日本語訳）。生成データより優先。
//   出力:
//     - public/data/words.json       … 漢字語リスト {hangul, hanja, hanjaJp?, gloss, lv?}（lv: 한국어기초사전 の等級 1〜4）
//     - public/data/hanja-chars.json … 漢字テーブル
//         {char, jp?, readings:[{eum,hun?}], meaning, strokes, edu?, on?, kun?}
//
// prepare（ソース取得。raw.githubusercontent はこの環境で不通のため codeload を使用）:
//   mkdir -p scripts/.cache
//   curl -L -o /tmp/k.zip https://codeload.github.com/garfieldnate/kengdic/zip/refs/heads/master
//   unzip -j /tmp/k.zip '*/kengdic.tsv' -d scripts/.cache
//   curl -L -o /tmp/uh.zip https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip
//   unzip -j /tmp/uh.zip Unihan_Readings.txt Unihan_IRGSources.txt -d scripts/.cache
//   curl -L -o scripts/.cache/kyujitai.json https://unpkg.com/kyujitai@1.3.0/data/kyujitai.json
//   mkdir -p scripts/.cache/krdict
//   for n in 5000 10000 15000 20000 25000 30000 35000 40000 45000 50000 51947; do
//     curl -L -o scripts/.cache/krdict/$n.xml https://github.com/spellcheck-ko/korean-dict-nikl-krdict/raw/master/$n.xml
//   done
//   mkdir -p scripts/.cache/jmdict
//   curl -L -o /tmp/jm.tgz "https://github.com/scriptin/jmdict-simplified/releases/download/3.6.2%2B20261019180022/jmdict-eng-3.6.2%2B20261019180022.json.tgz"
//   tar -xzf /tmp/jm.tgz -C scripts/.cache/jmdict
//
// 実行: node scripts/build-data.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CACHE = path.join(__dirname, ".cache");
const OUT = path.join(ROOT, "public", "data");
const CURATED_CHARS = path.join(ROOT, "src", "data", "curated-chars.json");
const CURATED_WORDS = path.join(ROOT, "src", "data", "curated-words.json");

const isHangul = (s) => /^[가-힣]+$/.test(s);
const isHanja = (s) => /^\p{Script=Han}+$/u.test(s);
const cp = (cps) => Array.from(cps);

function read(file) {
  const p = path.join(CACHE, file);
  if (!fs.existsSync(p)) {
    console.error(`\n[!] 入力が見つかりません: ${p}\n    ファイル先頭の prepare 手順でソースを scripts/.cache に配置してください。\n`);
    process.exit(1);
  }
  return fs.readFileSync(p, "utf8");
}

// --- 1) kengdic からクリーンな한자어を抽出 -----------------------------------
console.log("kengdic.tsv を解析中…");
const kengLines = read("kengdic.tsv").split("\n");
/** @type {{hangul:string,hanja:string,gloss:string}[]} */
const kengWords = [];
const seen = new Map();
for (let i = 1; i < kengLines.length; i++) {
  const c = kengLines[i].split("\t");
  if (c.length < 4) continue;
  const hangul = c[1];
  // kengdic は読み別の互換漢字（年 U+F98E =연 など、見た目は同じ別コード）を使うことがある。
  // NFC で統合漢字にそろえ、同じ字が図鑑で2枚になったり組み合わせで別の字扱いになったりしないようにする。
  const hanja = c[2].normalize("NFC");
  let gloss = c[3];
  if (!isHangul(hangul) || !isHanja(hanja)) continue;
  if (cp(hangul).length !== cp(hanja).length) continue; // 1音節=1漢字（真の한자어）
  const key = `${hangul}|${hanja}`;
  gloss = gloss && gloss !== "\\N" ? gloss.trim() : "";
  // 同じ語が意味なしの行と意味ありの行で並ぶことがある（會議 회의 など）：意味のある行を残す。
  const prev = seen.get(key);
  if (prev) {
    if (!prev.gloss && gloss) prev.gloss = gloss;
    continue;
  }
  const entry = { hangul, hanja, gloss };
  seen.set(key, entry);
  kengWords.push(entry);
}
console.log(`  クリーンな한자어: ${kengWords.length} 語`);

// --- 2) 整列読みから漢字ごとの eum（音）を集計 -------------------------------
// 全クリーン語（gloss 有無を問わず）を使い、字ごとの読み分布を作る。
const eumCount = new Map(); // char -> Map<eum, count>
for (const w of kengWords) {
  const hc = cp(w.hanja);
  const hg = cp(w.hangul);
  for (let i = 0; i < hc.length; i++) {
    const ch = hc[i];
    const eum = hg[i];
    if (!eumCount.has(ch)) eumCount.set(ch, new Map());
    const m = eumCount.get(ch);
    m.set(eum, (m.get(eum) ?? 0) + 1);
  }
}

// --- 3) Unihan から意味（英語）と画数を取得 ----------------------------------
console.log("Unihan を解析中…");
function parseUnihan(file, field) {
  const out = new Map(); // char -> value(first occurrence)
  const lines = read(file).split("\n");
  for (const line of lines) {
    if (!line || line[0] === "#") continue;
    const t = line.split("\t");
    if (t.length < 3 || t[1] !== field) continue;
    const code = parseInt(t[0].replace("U+", ""), 16);
    const ch = String.fromCodePoint(code);
    if (!out.has(ch)) out.set(ch, t[2].trim());
  }
  return out;
}
const defMap = parseUnihan("Unihan_Readings.txt", "kDefinition");
const strokeMap = parseUnihan("Unihan_IRGSources.txt", "kTotalStrokes");
const hangulMap = parseUnihan("Unihan_Readings.txt", "kHangul"); // "락:0E 악:0N" … 読み:出典
const japaneseMap = parseUnihan("Unihan_Readings.txt", "kJapanese"); // "ガク カク まなぶ" … 音はカタカナ、訓はひらがな

/** kHangul の読み（出典の印つき）。E は 교육용 기초 한자（中高の基礎漢字1800字）の読み。 */
function koreanReadings(ch) {
  const v = hangulMap.get(ch);
  if (!v) return [];
  return v.split(" ").map((tok) => {
    const [eum, src = ""] = tok.split(":");
    return { eum, edu: src.includes("E") };
  });
}

/** 日本語の音読み・訓読み（各3つまで。kJapanese はよく使う読みが先に並ぶ）。 */
function japaneseReadings(ch) {
  const toks = (japaneseMap.get(ch) ?? "").split(" ").filter(Boolean);
  const on = toks.filter((t) => /^[゠-ヿ]+$/.test(t)).slice(0, 3);
  const kun = toks.filter((t) => /^[぀-ゟ]+$/.test(t)).slice(0, 3);
  return { on, kun };
}

// --- 3.5) 旧字体（韓国漢字）→ 新字体（日本漢字）マップ ------------------------
// kyujitai.json の "kyuji" は [新字体, 旧字体, IVS] の配列。
console.log("旧字体→新字体マップを構築中…");
const kyuToShin = new Map();
{
  const kj = JSON.parse(read("kyujitai.json"));
  for (const e of kj.kyuji || []) {
    if (!Array.isArray(e) || e.length < 2) continue;
    const [shin, kyu] = e;
    if (cp(shin).length === 1 && cp(kyu).length === 1 && shin !== kyu) {
      if (!kyuToShin.has(kyu)) kyuToShin.set(kyu, shin);
    }
  }
}
/** 韓国漢字（旧字体）表記 → 日本漢字（新字体）表記。同形ならそのまま返す。 */
const toShinjitai = (s) => cp(s).map((c) => kyuToShin.get(c) ?? c).join("");
console.log(`  旧→新 対応: ${kyuToShin.size} 字`);

// kDefinition は "to learn; study; school" のように長い。先頭2句までに短縮。
function shortDef(def) {
  if (!def) return "";
  return def
    .split(";")
    .slice(0, 2)
    .map((s) => s.trim())
    .filter(Boolean)
    .join("; ");
}

// --- 4) 漢字テーブル生成（curated 優先でマージ） -----------------------------
const curatedChars = JSON.parse(fs.readFileSync(CURATED_CHARS, "utf8"));
const curatedCharMap = new Map(curatedChars.map((c) => [c.char, c]));

/**
 * 字の読みの並び。韓国の標準の読み（kHangul、基礎漢字の読みを先頭）のうち辞書の語に出てくるもの、
 * 続いて辞書で2回以上出てくるほかの読み（年→연 のような頭音法則の形など）。kHangul が無い字は出現数の順。
 */
function readingsFor(ch) {
  const dist = eumCount.get(ch) ?? new Map();
  const std = koreanReadings(ch);
  const ordered = [...std.filter((r) => r.edu), ...std.filter((r) => !r.edu)]
    .filter((r) => r.edu || dist.has(r.eum))
    .map((r) => r.eum);
  const byCount = [...dist.entries()].sort((a, b) => b[1] - a[1]);
  for (const [eum, n] of byCount) {
    if (ordered.includes(eum) || ordered.includes(withoutSaisiot(eum))) continue;
    if (ordered.length === 0 || n >= 2) ordered.push(eum);
  }
  return ordered.map((eum) => ({ eum }));
}

/** 사이시옷で付いた받침ㅅを外した音節（등굣길 の 굣 → 교）。ㅅ받침でなければそのまま。 */
function withoutSaisiot(syllable) {
  const code = syllable.codePointAt(0) - 0xac00;
  if (code < 0 || code > 11171 || code % 28 !== 19) return syllable;
  return String.fromCodePoint(0xac00 + code - 19);
}

function strokesOf(ch) {
  const n = strokeMap.has(ch) ? parseInt(strokeMap.get(ch).split(" ")[0], 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

const allChars = new Set([...eumCount.keys(), ...curatedCharMap.keys()]);
const charTable = [];
for (const ch of allChars) {
  const generated = readingsFor(ch);
  const curated = curatedCharMap.get(ch);
  if (curated) {
    // 手作業データ（音訓＋日本語）を優先し、辞書に出てくるほかの読みを後ろに足す。
    const extra = generated.filter((g) => !curated.readings.some((r) => r.eum === g.eum));
    charTable.push({ ...curated, readings: [...curated.readings, ...extra] });
    continue;
  }
  charTable.push({ char: ch, readings: generated, meaning: shortDef(defMap.get(ch)), strokes: strokesOf(ch) });
}

// 基礎漢字（1800字）の印。辞書が異体字で収録している字（強→强、晚→晩 など）は、読みと意味の
// 書き出しが同じ字に印を移す。辞書の語に出てこない字は、読みだけの項目として足す（手入力で集められる）。
const charIndex = new Map(charTable.map((c) => [c.char, c]));
const firstDef = (ch) => (defMap.get(ch) ?? "").split(/[;,] ?/)[0];
const usage = (ch) => [...(eumCount.get(ch)?.values() ?? [])].reduce((a, b) => a + b, 0);
let eduMoved = 0;
let eduAdded = 0;
for (const ch of hangulMap.keys()) {
  const eduEum = koreanReadings(ch).filter((r) => r.edu).map((r) => r.eum);
  if (eduEum.length === 0) continue;
  if (charIndex.has(ch)) {
    charIndex.get(ch).edu = true;
    continue;
  }
  const variant = charTable
    .filter(
      (c) =>
        !koreanReadings(c.char).some((r) => r.edu) &&
        firstDef(c.char) !== "" &&
        firstDef(c.char) === firstDef(ch) &&
        c.readings.some((r) => eduEum.includes(r.eum))
    )
    .sort((a, b) => usage(b.char) - usage(a.char))[0];
  if (variant) {
    variant.edu = true;
    eduMoved++;
    continue;
  }
  const entry = {
    char: ch,
    readings: eduEum.map((eum) => ({ eum })),
    meaning: shortDef(defMap.get(ch)),
    strokes: strokesOf(ch),
    edu: true,
  };
  charTable.push(entry);
  charIndex.set(ch, entry);
  eduAdded++;
}
console.log(`  基礎漢字: ${charTable.filter((c) => c.edu).length} 字（異体字へ移した印 ${eduMoved}・読みだけ足した字 ${eduAdded}）`);

// 各漢字に日本の新字体（字形が異なる場合のみ）と日本語の音訓を付与。
for (const c of charTable) {
  const jp = kyuToShin.get(c.char);
  if (jp && jp !== c.char) c.jp = jp;
  const { on, kun } = japaneseReadings(c.char);
  if (on.length) c.on = on;
  if (kun.length) c.kun = kun;
}
charTable.sort((a, b) => (a.strokes || 99) - (b.strokes || 99) || a.char.localeCompare(b.char));

// --- 4.5) 한국어기초사전 の日本語の対訳 -------------------------------------
// 漢字語（原語＝漢字の見出し）ごとに、日本語の対訳を「よみ【表記】」の形で、はじめの意味から順に4つまで
// （同じ表記は一度）。表記はふだんの意味の行に、よみは漢字を伏せている間（まだ集めていない語）に出す。
console.log("한국어기초사전 を解析中…");
const KRDICT = path.join(CACHE, "krdict");
if (!fs.existsSync(KRDICT)) {
  console.error(`\n[!] 入力が見つかりません: ${KRDICT}\n    ファイル先頭の prepare 手順でソースを scripts/.cache に配置してください。\n`);
  process.exit(1);
}
const unescapeXml = (v) =>
  v.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** 対訳一つを「よみ【表記】」にそろえる（よみ・表記が複数なら最初のもの、送り仮名の括弧は外す、閉じ忘れの】は補う）。 */
function jaItem(raw) {
  let s = raw.trim().replace(/\s*【+/, "【").replace(/】+/g, "】").replace(/（([ぁ-ゖ]+)）/g, "$1");
  if (s.includes("【") && !s.includes("】")) s += "】";
  const m = s.match(/^([^【】、]+)【([^【】]+)】$/);
  if (!m) return s.replace(/、/g, "・");
  const reading = m[1].split("・")[0];
  const written = m[2].split("・")[0];
  return reading === written ? written : `${reading}【${written}】`;
}

const jaGloss = new Map(); // hangul|hanja -> "よみ【表記】、…"
// 学ぶ順の目安（한국어기초사전 の語彙等級）：1 초급・2 중급・3 고급・4 等級なし。同音語や読める語の並びで、よく使う語を先に。
const LEVELS = { 초급: 1, 중급: 2, 고급: 3, 없음: 4 };
const levelOf = new Map(); // hangul|hanja -> 1..4
{
  const itemsByKey = new Map();
  for (const file of fs.readdirSync(KRDICT).filter((f) => f.endsWith(".xml")).sort((a, b) => parseInt(a) - parseInt(b))) {
    const xml = fs.readFileSync(path.join(KRDICT, file), "utf8");
    for (const block of xml.split("<LexicalEntry ").slice(1)) {
      const form = block.match(/<Lemma>\s*<feat att="writtenForm" val="([^"]*)"/)?.[1];
      const origin = block.match(/<feat att="origin" val="([^"]*)"/)?.[1];
      if (!form || !origin) continue;
      const hangul = unescapeXml(form);
      const hanja = unescapeXml(origin).normalize("NFC");
      if (!isHangul(hangul) || !isHanja(hanja) || cp(hangul).length !== cp(hanja).length) continue;
      const key = `${hangul}|${hanja}`;
      const level = LEVELS[block.match(/<feat att="vocabularyLevel" val="([^"]*)"/)?.[1]] ?? 4;
      levelOf.set(key, Math.min(levelOf.get(key) ?? 4, level));
      const items = itemsByKey.get(key) ?? [];
      // はじめの3つの意味まで
      for (const sense of block.split("<Sense ").slice(1, 4)) {
        for (const eq of sense.split("<Equivalent>").slice(1)) {
          if (!eq.includes('att="language" val="일본어"')) continue;
          const lemma = unescapeXml(eq.match(/att="lemma" val="([^"]*)"/)?.[1] ?? "");
          for (const raw of lemma.split("。")) {
            const item = raw.trim() ? jaItem(raw) : "";
            if (item) items.push(item);
          }
        }
      }
      itemsByKey.set(key, items);
    }
  }
  const written = (item) => item.match(/【(.+)】$/)?.[1] ?? item;
  for (const [key, items] of itemsByKey) {
    const seenWritten = new Set();
    const kept = [];
    for (const item of items) {
      if (seenWritten.has(written(item))) continue;
      seenWritten.add(written(item));
      kept.push(item);
      if (kept.length === 4) break;
    }
    if (kept.length) jaGloss.set(key, kept.join("、"));
  }
}
console.log(`  日本語の対訳のある漢字語: ${jaGloss.size} 語`);

// --- 4.6) JMdict（EDRDG、CC BY-SA 4.0）：日本語にも同じ漢字の語があれば、その語を意味に -------------
// 한국어기초사전 に無い語（まれな語・専門語・四字熟語など）のため。同じ漢字の語がいくつかあれば、
// kengdic の英語の意味といちばん重なる語を選ぶ。1字の語は、英語の意味が重なるときだけ（取り違えが多い）。
console.log("JMdict を解析中…");
const JMDICT = path.join(CACHE, "jmdict");
const jmFile = fs.existsSync(JMDICT) ? fs.readdirSync(JMDICT).find((f) => /^jmdict-eng-.*\.json$/.test(f)) : undefined;
if (!jmFile) {
  console.error(`\n[!] 入力が見つかりません: ${JMDICT}/jmdict-eng-*.json\n    ファイル先頭の prepare 手順でソースを scripts/.cache に配置してください。\n`);
  process.exit(1);
}
const STOP = new Set(
  "a an the of to and or in on for with by be is are as at from into that this it its one's someone something sth sb oneself person thing things kind sort way etc also very being have has get make do".split(" ")
);
const stem = (w) => w.replace(/ies$/, "y").replace(/(ing|ed|es|s|ly)$/, "");
/** 英語の意味の言葉（小文字・語尾をそろえる。短い語やつなぎの語は除く）。 */
const enWords = (s) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length >= 3 && !STOP.has(w))
      .map(stem)
      .filter((w) => w.length >= 3)
  );
const jmByKanji = new Map(); // 表記 -> [{ reading, en }]
{
  const jm = JSON.parse(fs.readFileSync(path.join(JMDICT, jmFile), "utf8"));
  for (const e of jm.words) {
    for (const k of e.kanji) {
      const applies = (x) => x.appliesToKanji.includes("*") || x.appliesToKanji.includes(k.text);
      const reading = e.kana.find(applies)?.text;
      if (!reading) continue;
      const en = e.sense
        .filter(applies)
        .flatMap((s) => s.gloss.map((g) => g.text))
        .join(" ");
      (jmByKanji.get(k.text) ?? jmByKanji.set(k.text, []).get(k.text)).push({ reading, en: enWords(en) });
    }
  }
}

/** 日本語にも同じ漢字の語があれば「よみ【表記】」。無いか、取り違えが疑わしければ undefined。 */
function jmdictGloss(w) {
  const jp = toShinjitai(w.hanja);
  const mine = enWords(w.gloss);
  let best;
  for (const written of new Set([jp, jp.replace(/(.)\1/gu, "$1々")])) {
    for (const c of jmByKanji.get(written) ?? []) {
      const shared = [...mine].filter((x) => c.en.has(x)).length;
      if (!best || shared > best.shared) best = { reading: c.reading, written, shared };
    }
  }
  if (!best || (cp(w.hanja).length === 1 && best.shared === 0)) return undefined;
  return `${best.reading}【${best.written}】`;
}

// --- 5) 漢字語リスト生成（意味のある語だけ） ---------------------------------
// 意味は 한국어기초사전 の日本語訳 → 手作業の日本語訳 → JMdict の同じ漢字の語 → kengdic の英語 の順。
// kengdic に英語の意味が無い語は、한국어기초사전 にあるときだけ入れる。
const curatedWords = JSON.parse(fs.readFileSync(CURATED_WORDS, "utf8"));
const wordMap = new Map(); // key -> {hangul,hanja,gloss}
let fromJmdict = 0;
for (const w of kengWords) {
  const key = `${w.hangul}|${w.hanja}`;
  let gloss = jaGloss.get(key);
  if (!gloss && w.gloss) {
    gloss = jmdictGloss(w);
    if (gloss) fromJmdict++;
    else gloss = w.gloss;
  }
  if (gloss) wordMap.set(key, { hangul: w.hangul, hanja: w.hanja, gloss });
}
console.log(`  JMdict の同じ漢字の語を意味にした語: ${fromJmdict} 語`);
for (const w of curatedWords) {
  const key = `${w.hangul}|${w.hanja}`;
  wordMap.set(key, { ...w, gloss: jaGloss.get(key) ?? w.gloss });
}
const words = [...wordMap.values()].sort((a, b) => a.hangul.localeCompare(b.hangul));
for (const w of words) {
  const lv = levelOf.get(`${w.hangul}|${w.hanja}`);
  if (lv) w.lv = lv;
}
const jaCount = words.filter((w) => /[ぁ-ゖァ-ヺ一-鿿]/.test(w.gloss)).length;
console.log(`  日本語の意味: ${jaCount} / ${words.length} 語`);
// 各語に日本の新字体表記（字形が異なる場合のみ）を付与。
for (const w of words) {
  const jp = toShinjitai(w.hanja);
  if (jp !== w.hanja) w.hanjaJp = jp;
}

// --- 5.5) 字の音読みを、よく使う順に -------------------------------------------
// Unihan kJapanese の並びは、使う多さの順とは限らない（體 は テイ・タイ、腦 は ドウ・ノウ）。日本語の対訳のうち、韓国語の
// 語と同じ漢字の語（체육 の たいいく【体育】）の よみ を字ごとの音読みに分け（連濁・促音も見る）、いちばん多く使われる
// 音読みが、いまの一つ目の倍以上（2語以上）使われていれば先頭に出す。
{
  const kata2hira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const VOICED = { か: "が", き: "ぎ", く: "ぐ", け: "げ", こ: "ご", さ: "ざ", し: "じ", す: "ず", せ: "ぜ", そ: "ぞ", た: "だ", ち: "ぢ", つ: "づ", て: "で", と: "ど", は: "ば", ひ: "び", ふ: "ぶ", へ: "べ", ほ: "ぼ" };
  const SEMI = { は: "ぱ", ひ: "ぴ", ふ: "ぷ", へ: "ぺ", ほ: "ぽ" };
  /** 語の中での音読みの形（連濁・半濁音、末の く・つ・ち・き の促音）。 */
  const shapes = (r) => {
    const out = new Set([r]);
    if (VOICED[r[0]]) out.add(VOICED[r[0]] + r.slice(1));
    if (SEMI[r[0]]) out.add(SEMI[r[0]] + r.slice(1));
    for (const v of [...out]) if (/[くつちき]$/.test(v)) out.add(`${v.slice(0, -1)}っ`);
    return [...out];
  };
  const allOn = (ch) => (japaneseMap.get(ch) ?? "").split(" ").filter((t) => /^[゠-ヿ]+$/.test(t));
  /** よみ を字の並びの音読みに分ける（字ごとの音読み。分けられなければ null）。 */
  const segment = (chars, reading) => {
    const memo = new Map();
    const go = (i, at) => {
      if (i === chars.length) return at === reading.length ? [] : null;
      const key = `${i}:${at}`;
      if (memo.has(key)) return memo.get(key);
      let found = null;
      for (const on of allOn(chars[i])) {
        for (const shape of shapes(kata2hira(on))) {
          const rest = reading.startsWith(shape, at) ? go(i + 1, at + shape.length) : null;
          if (rest) {
            found = [on, ...rest];
            break;
          }
        }
        if (found) break;
      }
      memo.set(key, found);
      return found;
    };
    return go(0, 0);
  };
  const used = new Map(); // 字 -> Map(音読み -> 語の数)
  for (const w of words) {
    const chars = cp(w.hanja);
    if (chars.length < 2) continue;
    const jp = w.hanjaJp ?? w.hanja;
    for (const m of w.gloss.matchAll(/([ぁ-ゖー]+)【([^【】]+)】/g)) {
      if (m[2] !== jp) continue;
      const seg = segment(chars, m[1]);
      if (!seg) continue;
      chars.forEach((ch, i) => {
        const counts = used.get(ch) ?? used.set(ch, new Map()).get(ch);
        counts.set(seg[i], (counts.get(seg[i]) ?? 0) + 1);
      });
    }
  }
  let moved = 0;
  for (const c of charTable) {
    const counts = used.get(c.char);
    if (!counts || !c.on?.length) continue;
    const [best, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best === c.on[0] || n < 2 || n < 2 * (counts.get(c.on[0]) ?? 0)) continue;
    c.on = [best, ...c.on.filter((x) => x !== best)].slice(0, 3);
    moved++;
  }
  console.log(`  音読みの並びを、よく使う順に直した字: ${moved} 字`);
}

// --- 6) 出力 ----------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "words.json"), JSON.stringify(words));
fs.writeFileSync(path.join(OUT, "hanja-chars.json"), JSON.stringify(charTable));

console.log("\n生成完了:");
console.log(`  public/data/words.json        ${words.length} 語`);
console.log(`  public/data/hanja-chars.json  ${charTable.length} 字`);
const wSize = fs.statSync(path.join(OUT, "words.json")).size;
const cSize = fs.statSync(path.join(OUT, "hanja-chars.json")).size;
console.log(`  サイズ: words ${(wSize / 1024 / 1024).toFixed(2)}MB / chars ${(cSize / 1024).toFixed(0)}KB`);
