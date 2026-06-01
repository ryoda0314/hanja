// データ生成パイプライン
// =====================================================================
// 公開データから、アプリにバンドルする辞書 JSON を生成する。
//   入力（scripts/.cache/ に配置。下記 prepare 手順参照）:
//     - kengdic.tsv             … Korean/English 辞書（surface, hanja, gloss）MPL2.0/LGPL/CC-BY-SA
//     - Unihan_Readings.txt     … kDefinition（漢字の意味・英語）
//     - Unihan_IRGSources.txt   … kTotalStrokes（画数）
//     - kyujitai.json           … 旧字体↔新字体 対応（npm: kyujitai, MIT）
//     - src/data/curated-*.json … 手作業キュレーション（音訓・日本語訳）。生成データより優先。
//   出力:
//     - public/data/words.json       … 漢字語リスト {hangul, hanja, hanjaJp?, gloss}
//     - public/data/hanja-chars.json … 漢字テーブル {char, jp?, readings:[{eum,hun?}], meaning, strokes}
//
// prepare（ソース取得。raw.githubusercontent はこの環境で不通のため codeload を使用）:
//   mkdir -p scripts/.cache
//   curl -L -o /tmp/k.zip https://codeload.github.com/garfieldnate/kengdic/zip/refs/heads/master
//   unzip -j /tmp/k.zip '*/kengdic.tsv' -d scripts/.cache
//   curl -L -o /tmp/uh.zip https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip
//   unzip -j /tmp/uh.zip Unihan_Readings.txt Unihan_IRGSources.txt -d scripts/.cache
//   curl -L -o scripts/.cache/kyujitai.json https://unpkg.com/kyujitai@1.3.0/data/kyujitai.json
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
const seen = new Set();
for (let i = 1; i < kengLines.length; i++) {
  const c = kengLines[i].split("\t");
  if (c.length < 4) continue;
  const hangul = c[1];
  const hanja = c[2];
  let gloss = c[3];
  if (!isHangul(hangul) || !isHanja(hanja)) continue;
  if (cp(hangul).length !== cp(hanja).length) continue; // 1音節=1漢字（真の한자어）
  const key = `${hangul}|${hanja}`;
  if (seen.has(key)) continue;
  seen.add(key);
  gloss = gloss && gloss !== "\\N" ? gloss.trim() : "";
  kengWords.push({ hangul, hanja, gloss });
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

const allChars = new Set([...eumCount.keys(), ...curatedCharMap.keys()]);
const charTable = [];
for (const ch of allChars) {
  if (curatedCharMap.has(ch)) {
    charTable.push(curatedCharMap.get(ch)); // 手作業データ（音訓＋日本語）を優先
    continue;
  }
  const dist = eumCount.get(ch);
  const readings = dist
    ? [...dist.entries()]
        .sort((a, b) => b[1] - a[1])
        .filter(([, n], idx) => idx === 0 || n >= 2) // 主読み＋出現2回以上の異音
        .map(([eum]) => ({ eum }))
    : [];
  const strokes = strokeMap.has(ch) ? parseInt(strokeMap.get(ch).split(" ")[0], 10) : 0;
  charTable.push({
    char: ch,
    readings,
    meaning: shortDef(defMap.get(ch)),
    strokes: Number.isFinite(strokes) ? strokes : 0,
  });
}
// 各漢字に日本の新字体（字形が異なる場合のみ）を付与。
for (const c of charTable) {
  const jp = kyuToShin.get(c.char);
  if (jp && jp !== c.char) c.jp = jp;
}
charTable.sort((a, b) => (a.strokes || 99) - (b.strokes || 99) || a.char.localeCompare(b.char));

// --- 5) 漢字語リスト生成（gloss 必須・curated 優先でマージ） ------------------
const curatedWords = JSON.parse(fs.readFileSync(CURATED_WORDS, "utf8"));
const wordMap = new Map(); // key -> {hangul,hanja,gloss}
for (const w of kengWords) {
  if (!w.gloss) continue; // 意味のある語だけ
  wordMap.set(`${w.hangul}|${w.hanja}`, w);
}
for (const w of curatedWords) {
  wordMap.set(`${w.hangul}|${w.hanja}`, w); // 手作業の日本語訳を優先
}
const words = [...wordMap.values()].sort((a, b) => a.hangul.localeCompare(b.hangul));
// 各語に日本の新字体表記（字形が異なる場合のみ）を付与。
for (const w of words) {
  const jp = toShinjitai(w.hanja);
  if (jp !== w.hanja) w.hanjaJp = jp;
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
