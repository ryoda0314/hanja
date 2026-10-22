// 文で出会う の例文データを作る
// =====================================================================
// 姉妹アプリ ことのあめ の例文（韓国語＋日本語訳）から漢字語が入った文を選び、どこにどの漢字語があるかの印を付けて
// public/data/sentences.json に書き出す。
//
//   入力（どちらか）:
//     - scripts/.cache/sentences.json … scripts/export-sentences.mjs で書き出した、ことのあめ の査読済みの文（音声あり）
//     - --kotonoame <dir>              … ことのあめ のリポジトリ。scripts/seed-data.json と scripts/library/work/*.done.json
//                                        （AI の下書き。捨てた下書き drop は除く。査読前の文も含む）
//   照らし合わせ:
//     - public/data/words.json / hanja-chars.json（build-data.mjs の出力）
//     - scripts/sentences/decisions.json … 日本語訳で裏の取れない語を、人が確かめて決めたもの
//   出力:
//     - public/data/sentences.json   {source, audioBase, sentences: [{ko, ja, w: [[start, end, 漢字], …]}]}
//     - scripts/sentences/review.json … まだ決めていない語（出てくる数の多い順、例文つき）。決めたら decisions.json へ。
//
// 印の付け方:
//   1. 語節（ハングルの続き）の頭から、辞書にある2音節以上の語のうち最も長いものを探す（助詞・語尾は後ろに付く）。
//      残りの頭にも2音節以上の語があれば続けて探す（여자친구 → 여자・친구）。
//   2. 固有語の取り違え（고양이 の 고양、여기、일어나다 の 일어 …）は decisions.json の skip で先に外す。
//   3. 日本語訳に字が出てくる候補があれば、出てくる字の多い語を選ぶ（수업 → 授業、내일 → 來日 の 日）。
//   4. 訳に字が出てこない語（친구 親舊＝友達 など）は decisions.json の決定に従う。決まっていなければ印を付けず review.json へ。
//
// 実行: node scripts/build-sentences.mjs [--kotonoame <dir>]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "public", "data");
const DECISIONS = path.join(__dirname, "sentences", "decisions.json");
const REVIEW = path.join(__dirname, "sentences", "review.json");
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
// 同じ文は一つに（下書きと手書きで重なることがある）。
const seen = new Set();
const sentences = input.list
  .map((s) => ({ ko: String(s.ko ?? "").trim(), ja: String(s.ja ?? "").trim() }))
  .filter((s) => s.ko && s.ja && !seen.has(s.ko) && seen.add(s.ko));
console.log(`文: ${sentences.length}（${input.source}）`);

// --- 2) 辞書 -----------------------------------------------------------------
const decisions = fs.existsSync(DECISIONS) ? readJson(DECISIONS) : { words: {}, skip: {}, exclude: [] };
const decided = decisions.words ?? {};
const skipExact = new Set(decisions.skip?.exact ?? []);
const skipPrefix = decisions.skip?.prefix ?? [];
// 例文では選ばない漢字表記。除いた結果、候補の無くなった読みは辞書に無いものとして、より短い語を探す（거절당 → 거절）。
const excluded = new Set(decisions.exclude ?? []);

const words = readJson(path.join(DATA, "words.json"));
const chars = readJson(path.join(DATA, "hanja-chars.json"));
const jpOf = new Map(chars.map((c) => [c.char, c.jp ?? c.char]));
const byHangul = new Map();
for (const w of words) {
  if (Array.from(w.hangul).length < 2 || excluded.has(w.hanja)) continue;
  if (!byHangul.has(w.hangul)) byHangul.set(w.hangul, []);
  byHangul.get(w.hangul).push(w);
}
const maxLen = Math.max(...[...byHangul.keys()].map((k) => k.length));

// --- 3) 印を付ける -----------------------------------------------------------
/** 語節の頭から、辞書にある最も長い語（2音節以上）。 */
function headWord(text) {
  for (let len = Math.min(maxLen, text.length); len >= 2; len--) {
    const head = text.slice(0, len);
    if (byHangul.has(head)) return head;
  }
  return null;
}

/** 日本語訳に、候補の日本の字がいくつ出てくるか。 */
function overlap(hanja, ja) {
  return Array.from(hanja).filter((c) => ja.includes(jpOf.get(c) ?? c)).length;
}

const pending = new Map(); // まだ決めていない語 hangul -> {count, examples}
const stats = { marked: 0, byJa: 0, byDecision: 0, skipped: 0, pending: 0 };

function choose(hangul, ja) {
  const cands = byHangul.get(hangul);
  const scored = cands
    .map((w) => ({ w, hit: overlap(w.hanja, ja) }))
    .sort((a, b) => b.hit - a.hit || a.w.hanja.localeCompare(b.w.hanja));
  if (scored[0].hit > 0) {
    stats.byJa++;
    return scored[0].w.hanja;
  }
  if (hangul in decided) {
    const d = decided[hangul];
    if (d === null) {
      stats.skipped++;
      return null;
    }
    if (!cands.some((w) => w.hanja === d)) throw new Error(`decisions.json: ${hangul} の ${d} は辞書にありません`);
    stats.byDecision++;
    return d;
  }
  stats.pending++;
  return undefined;
}

const out = [];
for (const s of sentences) {
  const marks = [];
  for (const m of s.ko.matchAll(/[가-힣]+/g)) {
    const run = m[0];
    if (skipExact.has(run) || skipPrefix.some((p) => run.startsWith(p))) continue;
    let at = 0;
    while (at < run.length - 1) {
      const hangul = headWord(run.slice(at));
      if (!hangul) break;
      const hanja = choose(hangul, s.ja);
      if (hanja) marks.push([m.index + at, m.index + at + hangul.length, hanja]);
      else if (hanja === undefined) {
        const p = pending.get(hangul) ?? { count: 0, examples: [] };
        p.count++;
        if (p.examples.length < 3) p.examples.push(`${s.ko}｜${s.ja}`);
        pending.set(hangul, p);
      }
      at += hangul.length;
    }
  }
  if (marks.length) {
    stats.marked += marks.length;
    out.push({ ko: s.ko, ja: s.ja, w: marks });
  }
}

// --- 4) 出力 -----------------------------------------------------------------
fs.writeFileSync(
  path.join(DATA, "sentences.json"),
  JSON.stringify({ source: input.source, audioBase: input.audioBase, sentences: out })
);
const review = [...pending.entries()]
  .sort((a, b) => b[1].count - a[1].count)
  .map(([hangul, p]) => ({
    hangul,
    candidates: byHangul.get(hangul).map((w) => `${w.hanja} ${w.gloss}`),
    count: p.count,
    examples: p.examples,
  }));
fs.mkdirSync(path.dirname(REVIEW), { recursive: true });
fs.writeFileSync(REVIEW, JSON.stringify(review, null, 1) + "\n");

const size = fs.statSync(path.join(DATA, "sentences.json")).size;
console.log(`印の付いた文: ${out.length} 文・${stats.marked} 語（日本語訳で ${stats.byJa}・決定で ${stats.byDecision}）`);
console.log(`外した語: ${stats.skipped}・まだ決めていない語: ${review.length} 種類（${stats.pending} か所）→ scripts/sentences/review.json`);
console.log(`public/data/sentences.json ${(size / 1024).toFixed(0)}KB`);
