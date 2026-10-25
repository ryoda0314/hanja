// ことのね のために書いた文を、例文データに足す前に確かめる。
//   - words に書いた語が、印の付け方（mark.mjs）でその語として拾えるか（長い語の一部や、語節の途中になっていないか）
//   - words の漢字表記が辞書にあるか
//   - ほかの語で、日本語訳からも decisions.json からも漢字表記の決まらない語（words に足す）
//   - 同じ文・長すぎる文・ことのあめ と違う文体（ことのあめ の文は くだけた話しことば。-요・-니다 で終わらない）
//   --targets <json>：[{hangul, hanja, need}] を渡すと、語ごとに足りない文の数も出す。
//   --show：文ごとに、印を付けた語と漢字表記（どう決まったか）も出す。
//
// 実行: node scripts/sentences/check.mjs <文の json> [--targets <json>] [--show]
//   文の json: {sentences: [{ko, ja, words: {ハングル: 漢字}}]}（scripts/sentences/kotonone.json と同じ形）

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMarker } from "./mark.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const file = process.argv[2];
if (!file) {
  console.error("実行: node scripts/sentences/check.mjs <文の json> [--targets <json>]");
  process.exit(1);
}
const t = process.argv.indexOf("--targets");
const targets = t !== -1 ? readJson(process.argv[t + 1]) : null;
const show = process.argv.includes("--show");

const marker = createMarker({
  words: readJson(path.join(ROOT, "public", "data", "words.json")),
  chars: readJson(path.join(ROOT, "public", "data", "hanja-chars.json")),
  decisions: readJson(path.join(__dirname, "decisions.json")),
});
// すでにある文（例文データ・ことのね の文）。同じ文を書いていないか。kotonone.json そのものを確かめるときは、その文を除いて比べる。
const existing = new Set(readJson(path.join(ROOT, "public", "data", "sentences.json")).sentences.map((s) => s.ko));
const ownFile = path.join(__dirname, "kotonone.json");
const checkingOwn = path.resolve(file) === ownFile;
for (const s of fs.existsSync(ownFile) ? readJson(ownFile).sentences : []) {
  if (checkingOwn) existing.delete(s.ko);
  else existing.add(s.ko);
}

const sentences = readJson(file).sentences;
const errors = [];
const warnings = [];
const covered = new Map(); // hangul|hanja -> 文の数
const seen = new Set();
sentences.forEach((s, i) => {
  const at = `#${i + 1}「${s.ko}」`;
  if (!s.ko?.trim() || !s.ja?.trim()) return errors.push(`${at} ko と ja が要ります`);
  if (seen.has(s.ko) || existing.has(s.ko)) errors.push(`${at} 同じ文がもうあります`);
  seen.add(s.ko);
  const length = Array.from(s.ko.replace(/[\s.,!?~…]/g, "")).length;
  if (length > 28) warnings.push(`${at} 長い（${length}音節）`);
  if (/(요|니다)[.!?~]*$/.test(s.ko.trim())) warnings.push(`${at} ことのあめ と同じ くだけた話しことば（반말）に`);
  let result;
  try {
    result = marker.mark(s);
  } catch (e) {
    return errors.push(`${at} ${e.message}`);
  }
  if (show)
    console.log(`${at}｜${s.ja}
    ${result.found.map((f) => `${f.hangul}=${f.hanja ?? (f.hanja === null ? "×" : "?")}(${f.by})`).join(" ") || "印なし"}`);
  for (const [hangul, hanja] of Object.entries(s.words ?? {})) {
    if (!result.found.some((f) => f.hangul === hangul && f.by === "own"))
      errors.push(`${at} ${hangul} が語として拾えません（長い語の一部か、語節の途中。拾えた語: ${result.found.map((f) => f.hangul).join("・") || "なし"}）`);
    else if (hanja) covered.set(`${hangul}|${hanja}`, (covered.get(`${hangul}|${hanja}`) ?? 0) + 1);
  }
  const pending = result.found.filter((f) => f.by === "pending").map((f) => f.hangul);
  if (pending.length)
    warnings.push(
      `${at} 漢字表記の決まらない語: ${pending
        .map((h) => `${h}（${marker.byHangul.get(h).map((w) => w.hanja).join("/")}）`)
        .join("・")} → words に足す（固有語なら null）`
    );
});

for (const e of errors) console.log(`✗ ${e}`);
for (const w of warnings) console.log(`△ ${w}`);
console.log(`\n${sentences.length} 文：だめ ${errors.length}・気になる ${warnings.length}`);
if (targets) {
  const short = targets
    .map((x) => ({ ...x, have: covered.get(`${x.hangul}|${x.hanja}`) ?? 0 }))
    .filter((x) => x.have < x.need);
  console.log(`狙った語 ${targets.length} 語のうち、足りない語 ${short.length} 語`);
  for (const x of short) console.log(`  ${x.hangul}（${x.hanja}）${x.have}/${x.need}`);
}
process.exit(errors.length ? 1 : 0);
