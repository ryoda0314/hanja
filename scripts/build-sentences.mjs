// 文で出会う の例文データを作る
// =====================================================================
// 姉妹アプリ ことのあめ の例文（韓国語＋日本語訳）と、ことのね のために書いた文から漢字語が入った文を選び、
// どこにどの漢字語があるかの印を付けて public/data/sentences.json に書き出す。
//
//   入力（ことのあめ の文はどちらか）:
//     - scripts/.cache/sentences.json … scripts/export-sentences.mjs で書き出した、ことのあめ の査読済みの文（音声あり）
//     - --kotonoame <dir>              … ことのあめ のリポジトリ。scripts/seed-data.json と scripts/library/work/*.done.json
//                                        （AI の下書き。捨てた下書き drop は除く。査読前の文も含む）
//     - scripts/sentences/kotonone.json … ことのね のために書いた文 {ko, ja, words: {ハングル: 漢字}}。ことのあめ の文に
//                                        出てこない基礎の語（일본・건강・감사 …）のため。words は書いたときに狙った語の漢字表記
//   照らし合わせ:
//     - public/data/words.json / hanja-chars.json（build-data.mjs の出力）
//     - scripts/sentences/decisions.json … 日本語訳で裏の取れない語を、人が確かめて決めたもの
//   出力:
//     - public/data/sentences.json   {source, audioBase, sentences: [{ko, ja, w: [[start, end, 漢字], …]}]}
//     - scripts/sentences/review.json … まだ決めていない語（出てくる数の多い順、例文つき）。決めたら decisions.json へ。
//
// 印の付け方は scripts/sentences/mark.mjs。ことのね のために書いた文は、書き足す前に scripts/sentences/check.mjs で確かめる。
//
// 実行: node scripts/build-sentences.mjs [--kotonoame <dir>]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMarker } from "./sentences/mark.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "public", "data");
const DECISIONS = path.join(__dirname, "sentences", "decisions.json");
const REVIEW = path.join(__dirname, "sentences", "review.json");
const OWN = path.join(__dirname, "sentences", "kotonone.json");
const EXPORTED = path.join(__dirname, ".cache", "sentences.json");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// --- 1) 文を読む -----------------------------------------------------------
function fromKotonoame(dir) {
  const out = [];
  const seed = path.join(dir, "scripts", "seed-data.json");
  if (fs.existsSync(seed)) for (const s of readJson(seed).sentences ?? []) out.push({ ko: s.ko, ja: s.ja });
  const work = path.join(dir, "scripts", "library", "work");
  for (const f of fs.readdirSync(work).filter((f) => f.endsWith(".done.json")).sort()) {
    const d = readJson(path.join(work, f));
    for (const s of d.drafts ?? []) if (s.decision !== "drop") out.push({ ko: s.ko, ja: s.ja });
    for (const s of d.new ?? []) out.push({ ko: s.ko, ja: s.ja });
  }
  return { source: "kotonoame-work", audioBase: null, list: out };
}

const arg = process.argv.indexOf("--kotonoame");
let input;
if (arg !== -1) {
  input = fromKotonoame(path.resolve(process.argv[arg + 1]));
} else if (fs.existsSync(EXPORTED)) {
  const d = readJson(EXPORTED);
  input = { source: "kotonoame-approved", audioBase: d.audioBase ?? null, list: d.sentences };
} else {
  console.error(
    "\n[!] 文が見つかりません。scripts/export-sentences.mjs で書き出すか、--kotonoame <ことのあめ のリポジトリ> を渡してください。\n"
  );
  process.exit(1);
}
const own = fs.existsSync(OWN) ? readJson(OWN).sentences : [];
// 同じ文は一つに（下書きと手書きで重なることがある。ことのあめ の文を先に）。
const seen = new Set();
const sentences = [...input.list, ...own]
  .map((s) => ({ ko: String(s.ko ?? "").trim(), ja: String(s.ja ?? "").trim(), words: s.words }))
  .filter((s) => s.ko && s.ja && !seen.has(s.ko) && seen.add(s.ko));
console.log(`文: ${sentences.length}（${input.source} ${input.list.length}・ことのね ${own.length}）`);

// --- 2) 印を付ける -----------------------------------------------------------
const decisions = fs.existsSync(DECISIONS) ? readJson(DECISIONS) : { words: {}, skip: {}, exclude: [] };
const marker = createMarker({
  words: readJson(path.join(DATA, "words.json")),
  chars: readJson(path.join(DATA, "hanja-chars.json")),
  decisions,
});

const pending = new Map(); // まだ決めていない語 hangul -> {count, examples}
const stats = { marked: 0, own: 0, ja: 0, decision: 0, skipped: 0, pending: 0 };
const out = [];
for (const s of sentences) {
  const { marks, found } = marker.mark(s);
  for (const f of found) {
    if (f.hanja === null) stats.skipped++;
    else stats[f.by]++;
    if (f.by !== "pending") continue;
    const p = pending.get(f.hangul) ?? { count: 0, examples: [] };
    p.count++;
    if (p.examples.length < 3) p.examples.push(`${s.ko}｜${s.ja}`);
    pending.set(f.hangul, p);
  }
  if (marks.length) {
    stats.marked += marks.length;
    out.push({ ko: s.ko, ja: s.ja, w: marks });
  }
}

// --- 3) 出力 -----------------------------------------------------------------
fs.writeFileSync(
  path.join(DATA, "sentences.json"),
  JSON.stringify({ source: own.length ? `${input.source}+kotonone` : input.source, audioBase: input.audioBase, sentences: out })
);
const review = [...pending.entries()]
  .sort((a, b) => b[1].count - a[1].count)
  .map(([hangul, p]) => ({
    hangul,
    candidates: marker.byHangul.get(hangul).map((w) => `${w.hanja} ${w.gloss}`),
    count: p.count,
    examples: p.examples,
  }));
fs.mkdirSync(path.dirname(REVIEW), { recursive: true });
fs.writeFileSync(REVIEW, JSON.stringify(review, null, 1) + "\n");

const size = fs.statSync(path.join(DATA, "sentences.json")).size;
console.log(
  `印の付いた文: ${out.length} 文・${stats.marked} 語（書いた文の表記で ${stats.own}・日本語訳で ${stats.ja}・決定で ${stats.decision}）`
);
console.log(`外した語: ${stats.skipped}・まだ決めていない語: ${review.length} 種類（${stats.pending} か所）→ scripts/sentences/review.json`);
console.log(`public/data/sentences.json ${(size / 1024).toFixed(0)}KB`);
