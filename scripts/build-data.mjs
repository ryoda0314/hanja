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
//     - freq/ko_full.txt        … FrequencyWords（OpenSubtitles 2018 の韓国語字幕の語の頻度、CC BY-SA 4.0）。語をよく使うか
//     - src/data/curated-*.json … 手作業キュレーション（音訓・日本語訳）。生成データより優先。
//   出力:
//     - public/data/words.json       … 漢字語リスト {hangul, hanja, hanjaJp?, gloss, lv?, fq?}（lv: 한국어기초사전 の等級 1〜4、
//                                      fq: 字幕の韓国語で100万語あたり何回使うか。2音節以上の語だけ）
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
//   mkdir -p scripts/.cache/freq
//   curl -L -o scripts/.cache/freq/ko_full.txt https://cdn.jsdelivr.net/gh/hermitdave/FrequencyWords@master/content/2018/ko/ko_full.txt
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
// kyujitai.json に無い対応：常用漢字表で一つにまとめた旧字体（豫→予、辯・辨・瓣→弁）、韓国でよく使う異体字（畵→画、旣→既、
// 戱→戯、凉→涼、峯→峰、歎→嘆、飜→翻）、日本でふだん使う形（囊→嚢、軀→躯、瀆→涜、俠→侠、繫→繋、寃→冤）。
const EXTRA_SHIN = {
  豫: "予", 辯: "弁", 辨: "弁", 瓣: "弁", 畵: "画", 旣: "既", 戱: "戯", 凉: "涼", 峯: "峰", 歎: "嘆", 飜: "翻",
  囊: "嚢", 軀: "躯", 瀆: "涜", 俠: "侠", 繫: "繋", 寃: "冤",
};
for (const [kyu, shin] of Object.entries(EXTRA_SHIN)) if (!kyuToShin.has(kyu)) kyuToShin.set(kyu, shin);
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

/** 音節の 初声・中声・終声 の番号。 */
const jamoOf = (s) => {
  const code = s.codePointAt(0) - 0xac00;
  return { lead: Math.floor(code / 588), vowel: Math.floor((code % 588) / 28), tail: code % 28 };
};
const LEAD_N = 2;
const LEAD_D = 3;
const LEAD_R = 5;
const LEAD_NONE = 11;
const LEAD_J = 12;
const TAIL_R = 8;
/** ㅣ と、ㅣ から始まる母音（ㅑ ㅒ ㅕ ㅖ ㅛ ㅠ）。 */
const I_LIKE = new Set([2, 3, 6, 7, 12, 17, 20]);
const withoutTail = (s) => String.fromCodePoint(s.codePointAt(0) - jamoOf(s).tail);
/** 語のはじめで読む形（頭音法則：래→내、력→역、녀→여）。変わらなければ null。src/data/reading.ts の initialForm と同じ。 */
function initialForm(s) {
  const j = jamoOf(s);
  const at = (lead) => String.fromCodePoint(0xac00 + (lead * 21 + j.vowel) * 28 + j.tail);
  if (j.lead === LEAD_R) return at(I_LIKE.has(j.vowel) ? LEAD_NONE : LEAD_N);
  if (j.lead === LEAD_N && I_LIKE.has(j.vowel)) return at(LEAD_NONE);
  return null;
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

// 英語の意味の言葉（JMdict の語選びと、한국어기초사전 の固有語の見出しと同じ語かを見るのに使う）。
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

// 한국어기초사전 は、字をふだんと違う音で読むところに ▽ を付ける（六▽月 유월、十▽月 시월、困難▽ 곤란）。
// また kengdic と別の異体字で書くことがある（映畫 と 映畵、強 と 强）。kengdic の書き方でも引けるようにする。
const KR_VARIANT = { 強: "强", 畫: "畵", 絕: "絶", 祕: "秘", 礙: "碍", 戲: "戱", 豐: "豊", 鄰: "隣", 隷: "隸", 裡: "裏", 冤: "寃", 霸: "覇" };
const jaGloss = new Map(); // hangul|hanja -> "よみ【表記】、…"
// 学ぶ順の目安（한국어기초사전 の語彙等級）：1 초급・2 중급・3 고급・4 等級なし。同音語や読める語の並びで、よく使う語を先に。
const LEVELS = { 초급: 1, 중급: 2, 고급: 3, 없음: 4 };
const levelOf = new Map(); // hangul|hanja -> 1..4
const krWords = new Map(); // hangul|hanja -> {hangul, hanja, level}（한국어기초사전 の見出し。▽ を外した書き方のまま）
const krNative = new Map(); // hangul -> 等級（漢字の見出しの無い語：여기・동안。同じ綴りの漢字語と、字幕での使われ方を分け合う）
const krHeads = new Set(); // 한국어기초사전 の見出し（どの語源でも。1音節の語も）
{
  const itemsByKey = new Map();
  for (const file of fs.readdirSync(KRDICT).filter((f) => f.endsWith(".xml")).sort((a, b) => parseInt(a) - parseInt(b))) {
    const xml = fs.readFileSync(path.join(KRDICT, file), "utf8");
    for (const block of xml.split("<LexicalEntry ").slice(1)) {
      const form = block.match(/<Lemma>\s*<feat att="writtenForm" val="([^"]*)"/)?.[1];
      const origin = block.match(/<feat att="origin" val="([^"]*)"/)?.[1];
      if (!form) continue;
      const hangul = unescapeXml(form);
      const level = LEVELS[block.match(/<feat att="vocabularyLevel" val="([^"]*)"/)?.[1]] ?? 4;
      if (isHangul(hangul)) krHeads.add(hangul);
      if (!origin || !/\p{Script=Han}/u.test(origin)) {
        if (isHangul(hangul)) krNative.set(hangul, Math.min(krNative.get(hangul) ?? 4, level));
        continue;
      }
      // 하다・되다 の付く語（복잡하다 の原語は「複雜 하다」）：語の部分（복잡 複雜）に、その語の等級を付ける。
      const derived = hangul.match(/^(.+?)(하다|되다|스럽다|롭다|히)$/);
      const derivedOrigin = unescapeXml(origin).replace(/▽/g, "").normalize("NFC").match(/^([\p{Script=Han}/]+)\s*(하다|되다|스럽다|롭다|히)$/u);
      if (derived && derivedOrigin && derived[2] === derivedOrigin[2]) {
        for (const hanja of derivedOrigin[1].split("/")) {
          if (!isHanja(hanja) || cp(hanja).length !== cp(derived[1]).length) continue;
          const variant = cp(hanja).map((c) => KR_VARIANT[c] ?? c).join("");
          for (const key of new Set([`${derived[1]}|${hanja}`, `${derived[1]}|${variant}`])) {
            levelOf.set(key, Math.min(levelOf.get(key) ?? 4, level));
          }
        }
        continue;
      }
      // 書き方が二つ以上ある語は / で並ぶ（連絡/聯絡、計劃/計畫）。どの書き方でも引けるように。
      const forms = unescapeXml(origin)
        .replace(/▽/g, "")
        .normalize("NFC")
        .split("/")
        .map((h) => h.trim())
        .filter((h) => isHangul(hangul) && isHanja(h) && cp(hangul).length === cp(h).length);
      if (forms.length === 0) continue;
      const found = [];
      // はじめの3つの意味まで
      for (const sense of block.split("<Sense ").slice(1, 4)) {
        for (const eq of sense.split("<Equivalent>").slice(1)) {
          if (!eq.includes('att="language" val="일본어"')) continue;
          const lemma = unescapeXml(eq.match(/att="lemma" val="([^"]*)"/)?.[1] ?? "");
          for (const raw of lemma.split("。")) {
            const item = raw.trim() ? jaItem(raw) : "";
            if (item) found.push(item);
          }
        }
      }
      const group = forms.map((h) => `${hangul}|${h}`);
      for (const hanja of forms) {
        const own = krWords.get(`${hangul}|${hanja}`);
        krWords.set(`${hangul}|${hanja}`, { hangul, hanja, level: Math.min(own?.level ?? 4, level), group });
        const variant = cp(hanja).map((c) => KR_VARIANT[c] ?? c).join("");
        for (const key of new Set([`${hangul}|${hanja}`, `${hangul}|${variant}`])) {
          levelOf.set(key, Math.min(levelOf.get(key) ?? 4, level));
          itemsByKey.set(key, [...(itemsByKey.get(key) ?? []), ...found]);
        }
      }
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
let words = [...wordMap.values()].sort((a, b) => a.hangul.localeCompare(b.hangul));
for (const w of words) {
  const lv = levelOf.get(`${w.hangul}|${w.hanja}`);
  if (lv) w.lv = lv;
}

// 한국어기초사전 にあって kengdic に無い語（동물・초등학교・한국인、입장 の 入場 …）。
// - 同じハングルの語があり、日本語の対訳の表記がその語の日本の字と同じなら、同じ語の書き方の違いか写しの誤り
//   （기념일 の 紀念日 と 記念日、기간 の 其間 と 期間）。その語に等級と対訳を移す。
// - 無ければ、等級のある語（초급〜고급・2音節以上）で、日本語の対訳があり、どの字にも日本語の読みのある語を足す。
//   足した語と1字だけ違う、等級の無い kengdic の語は、写し違いとして外す（백만 の 白萬 と 百萬）。
{
  const byHangul = new Map();
  for (const w of words) (byHangul.get(w.hangul) ?? byHangul.set(w.hangul, []).get(w.hangul)).push(w);
  const writtenOf = (gloss) => {
    const first = gloss.split("、")[0];
    return first.match(/【(.+)】$/)?.[1] ?? first;
  };
  // 書き方が二つある語（沙果/砂果）は一つの語：どれかの書き方が辞書にあれば足さない。
  const inWords = (key) => {
    const [hangul, hanja] = key.split("|");
    return wordMap.has(key) || wordMap.has(`${hangul}|${cp(hanja).map((c) => KR_VARIANT[c] ?? c).join("")}`);
  };
  const missing = [...krWords.values()].filter((k) => !k.group.some(inWords) && jaGloss.has(`${k.hangul}|${k.hanja}`));
  // 先に、書き方の違う同じ語へ等級を移す（あとで、等級の無い語を写し違いとして外すときに残るように）。
  let merged = 0;
  const rest = [];
  for (const k of missing) {
    const gloss = jaGloss.get(`${k.hangul}|${k.hanja}`);
    const same = (byHangul.get(k.hangul) ?? []).find((w) => toShinjitai(w.hanja) === writtenOf(gloss));
    if (!same) {
      rest.push(k);
      continue;
    }
    if (!same.lv || k.level < same.lv) same.lv = k.level;
    if (!jaGloss.has(`${same.hangul}|${same.hanja}`)) same.gloss = gloss;
    merged++;
  }
  const added = [];
  const addedKeys = new Set();
  const shadowed = new Set();
  for (const k of rest) {
    const gloss = jaGloss.get(`${k.hangul}|${k.hanja}`);
    if (k.level > 3 || cp(k.hangul).length < 2 || k.group.some((key) => addedKeys.has(key))) continue;
    if (!cp(k.hanja).every((ch) => charIndex.has(ch) && japaneseMap.has(ch))) continue;
    const w = { hangul: k.hangul, hanja: k.hanja, gloss, lv: k.level };
    added.push(w);
    addedKeys.add(`${k.hangul}|${k.hanja}`);
    for (const other of byHangul.get(k.hangul) ?? []) {
      const a = cp(other.hanja);
      const b = cp(k.hanja);
      if (!other.lv && a.length === b.length && a.filter((c, i) => c !== b[i]).length === 1) shadowed.add(other);
    }
  }
  words = [...words.filter((w) => !shadowed.has(w)), ...added].sort((a, b) => a.hangul.localeCompare(b.hangul));
  console.log(
    `  한국어기초사전 の語：書き方の違う同じ語に等級を移した ${merged} 語・足した ${added.length} 語・写し違いとして外した ${shadowed.size} 語` +
      `（${[...shadowed].map((w) => `${w.hangul} ${w.hanja}`).join("、")}）`
  );
}

// 読みの合わない語を除く。kengdic には、ハングルと漢字が別の語の組（휴지 と 休職）や字の取り違え（화구 を 怜具）が混じる。
// 音節ごとに、字の韓国の標準の読み（kHangul・手作業データ）か、その語のはじめの形（頭音法則）・사이시옷・ㄷ ㅈ の前で ㄹ が
// 落ちた形（不足 부족）か、한국어기초사전 のどれかの語でその字をその音で読んでいるかを見る。한국어기초사전 の語と手作業の語は残す。
{
  const attested = new Set();
  for (const key of levelOf.keys()) {
    const [hangul, hanja] = key.split("|");
    const hg = cp(hangul);
    cp(hanja).forEach((ch, i) => attested.add(`${ch}|${hg[i]}`));
  }
  const standard = (ch) => [...koreanReadings(ch).map((r) => r.eum), ...(curatedCharMap.get(ch)?.readings.map((r) => r.eum) ?? [])];
  const readable = (ch, syllables, i) => {
    const s = syllables[i];
    const std = standard(ch);
    if (std.length === 0 || attested.has(`${ch}|${s}`)) return true;
    const fits = (x) => std.includes(x) || std.some((r) => initialForm(r) === x);
    if (fits(s) || fits(withoutSaisiot(s))) return true;
    const next = syllables[i + 1] ? jamoOf(syllables[i + 1]).lead : -1;
    return (next === LEAD_D || next === LEAD_J) && std.some((r) => jamoOf(r).tail === TAIL_R && withoutTail(r) === s);
  };
  const curatedKeys = new Set(curatedWords.map((w) => `${w.hangul}|${w.hanja}`));
  const kept = words.filter(
    (w) => w.lv || curatedKeys.has(`${w.hangul}|${w.hanja}`) || cp(w.hanja).every((ch, i) => readable(ch, cp(w.hangul), i))
  );
  console.log(`  読みの合わない語を除いた: ${words.length - kept.length} 語`);
  words = kept;
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

// --- 5.6) 字の韓国語の音を、よく使う順に -----------------------------------------
// kHangul の並びは、使う多さの順とは限らない（車 は 거・차、更 は 갱・경、茶 は 다・차）。語で使う多さが、いまの一つ目の
// 倍以上の読みを先頭に出す。多さは、学ぶ順の目安で重みを付けて数える（초급 の語は 4、중급 3、고급 2、ほか 1。학습자 が
// 出会う 녹차・홍차 の 차 を、다방・다기 の 다 より先に）。語のはじめの形（來 の 내）は元の音（래）と一組に数え、一組の中の
// 並びは変えない。사이시옷 の形（찻잔 の 찻）は元の音に数える。標準の読みでなく、語にも出てこなくなった読み（除いた語だけの
// 読み）は外す。手作業データの字はそのまま。
{
  const WEIGHT = { 1: 4, 2: 3, 3: 2 };
  const used = new Map(); // 字 -> Map(音 -> 重みを付けた語の数)
  for (const w of words) {
    const hg = cp(w.hangul);
    cp(w.hanja).forEach((ch, i) => {
      const counts = used.get(ch) ?? used.set(ch, new Map()).get(ch);
      const listed = charIndex.get(ch)?.readings.some((r) => r.eum === hg[i]);
      const eum = listed ? hg[i] : withoutSaisiot(hg[i]);
      counts.set(eum, (counts.get(eum) ?? 0) + (WEIGHT[w.lv] ?? 1));
    });
  }
  let moved = 0;
  let removed = 0;
  for (const c of charTable) {
    if (curatedCharMap.has(c.char)) continue;
    const counts = used.get(c.char) ?? new Map();
    const std = new Set(koreanReadings(c.char).map((r) => r.eum));
    const readings = c.readings.filter((r, i) => i === 0 || std.has(r.eum) || counts.has(r.eum));
    removed += c.readings.length - readings.length;
    const groups = [];
    for (const r of readings) {
      const group = groups.find((g) => g.some((x) => initialForm(x.eum) === r.eum || initialForm(r.eum) === x.eum));
      if (group) group.push(r);
      else groups.push([r]);
    }
    const n = (g) => g.reduce((sum, r) => sum + (counts.get(r.eum) ?? 0), 0);
    const best = groups.reduce((a, g) => (n(g) > n(a) ? g : a), groups[0]);
    if (best !== groups[0] && n(best) >= 4 && n(best) >= 2 * n(groups[0])) {
      groups.splice(groups.indexOf(best), 1);
      groups.unshift(best);
      moved++;
    }
    c.readings = groups.flat();
  }
  console.log(`  韓国語の音の並びを、よく使う順に直した字: ${moved} 字（外した読み ${removed}）`);
}

// --- 5.7) 語をよく使うか（字幕の韓国語での頻度） -----------------------------------
// FrequencyWords の韓国語（映画・ドラマの字幕 約630万語）は、語節（회사에・공부했어）ごとの数。語尾・助詞を外して語に
// まとめる（사고가 は 思考家 でなく 사고＋가）。
// - 助詞の付かない語節そのものは、等級のある語のときだけ数える（하지・위해 は 하다・위하다 の形で、夏至・危害 ではない）。
// - 語節が 한국어기초사전 の固有語そのもの（하지만・고양이）なら分けない。外すと別の見出しが残る形（일＋이야、고양이＋가）は
//   その語。하다・되다 の形と同じ綴りの語（하지 夏至・하자 瑕疵・하게）は数えない。
// - 同じ綴りの語どうしは、等級の重みで分け合う（사고 は 事故 に多く、思考 に少し）。한국어기초사전 の固有語（여기）も
//   分け合う相手。
// fq は100万語あたりの回数（2音節以上の語だけ）。
{
  const lines = read("freq/ko_full.txt").split("\n");
  const PARTICLES = (
    "가 이 은 는 을 를 에 에서 에게 한테 께 의 도 만 로 으로 와 과 랑 이랑 하고 까지 부터 보다 처럼 마다 밖에 야 아 이야 " +
    "이에요 예요 이다 이지 지 이라 라 이나 나 든 이든 요 이요 이고 고 인데 인가 이네 네 이니 이었 였 이었어 였어 이잖아 잖아 이래 래 이냐 냐"
  ).split(" ");
  const VERBAL = (
    "하다 해 해요 했 했어 했어요 했다 했지 한 할 하는 하고 해서 하면 하지 하자 할게 할래 합니다 해라 하세요 하셨 하네 하니 하게 " +
    "해야 하려고 되다 돼 돼요 됐 됐어 되 된 될 되는 됩니다 되면 되고 되지 시키 시켜 시켰어 적 적인 적으로 적이 스럽 스러워 스러운 롭 로운"
  ).split(" ");
  const SUFFIXES = [...new Set([...PARTICLES, ...VERBAL])].sort((a, b) => b.length - a.length);
  const byHangul = new Map();
  for (const w of words) {
    if (cp(w.hangul).length < 2) continue;
    (byHangul.get(w.hangul) ?? byHangul.set(w.hangul, []).get(w.hangul)).push(w);
  }
  const graded = (h) => byHangul.get(h)?.some((w) => w.lv && w.lv <= 3);
  /** 語節の、語の部分（語尾・助詞を外す。二つ重なることもある：에서＋는）。 */
  const stemOf = (token) => {
    if (krNative.has(token)) return null;
    for (const a of SUFFIXES) {
      if (token.length <= a.length || !token.endsWith(a)) continue;
      const rest = token.slice(0, -a.length);
      if (byHangul.has(rest)) return rest;
      if (krHeads.has(rest)) return null;
      for (const b of PARTICLES) {
        const stem = rest.slice(0, -b.length);
        if (rest.length > b.length + 1 && rest.endsWith(b) && byHangul.has(stem)) return stem;
      }
    }
    return null;
  };
  // 하다・되다 の形（하지・하자・하게 …）。この綴りの漢字語（夏至・瑕疵）は、字幕では動詞の形と見分けられない。
  const VERB_FORMS = new Set(
    ["하", "되"].flatMap((v) => "지 자 게 고 면 기 니 는 다 여 나 네 세 라 려 도 서 야 며 듯 든".split(" ").map((e) => v + e))
  );
  let total = 0;
  const count = new Map();
  for (const line of lines) {
    const [token, n] = line.trim().split(" ");
    const times = Number(n);
    if (!token || !times) continue;
    total += times;
    if (!isHangul(token)) continue;
    const stem = byHangul.has(token) && graded(token) ? token : stemOf(token);
    if (stem && !VERB_FORMS.has(stem)) count.set(stem, (count.get(stem) ?? 0) + times);
  }
  const WEIGHT = { 1: 1000, 2: 300, 3: 100, 4: 3 };
  const weight = (lv) => WEIGHT[lv] ?? 1;
  // 手作業の語（동생 同生 など、한국어기초사전 が漢字の見出しを付けていない語）は、その固有語の見出しと同じ語。
  const curatedKeys = new Set(curatedWords.map((w) => `${w.hangul}|${w.hanja}`));
  let common = 0;
  for (const [hangul, list] of byHangul) {
    const same = list.some((w) => curatedKeys.has(`${w.hangul}|${w.hanja}`));
    // 固有語は、同じ綴りのまれな漢字語よりずっと多く使われる（여기・동안）。
    const native = krNative.has(hangul) && !same ? weight(krNative.get(hangul)) * 10 : 0;
    const sum = list.reduce((a, w) => a + weight(w.lv), native);
    for (const w of list) {
      w.fq = Math.round((((count.get(hangul) ?? 0) * weight(w.lv)) / sum / total) * 1e6 * 10) / 10;
      if ((w.lv && w.lv <= 3) || w.fq >= 1) common++;
    }
  }
  console.log(`  字幕 ${total} 語節。よく使う語（等級のある語か、100万語に1回以上）: ${common} 語`);
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
