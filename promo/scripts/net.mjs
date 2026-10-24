// 冒頭の「字のつながり」の網を、アプリの辞書から作る（src/net.json）。
//   字：下の CHARS。語：その字だけでできる辞書の語すべて（2字以上。アプリの discoverWords と同じ決まり）。
//   網の輪の並びは、同じ語に並ぶ字どうしが近くに来るよう探す（會・社・員 は冒頭の三つの札から移るので上に固定）。
//   node scripts/net.mjs        字を変えたら走らせ直す
import { readFileSync, writeFileSync } from "node:fs";

const APP = "..";
/** 網の字（日本の字で書く）。 */
const CHARS = "会社員学生先校大中国語韓日本人外民時間電話";
/** 冒頭ですでに組み上がっている語（會・社・員 の5語）。 */
const FIRST = ["회사", "사회", "회원", "사원", "회사원"];
/** 一つずつ見せる語（この順）。残りは混ぜて一気に（線が輪のあちこちに走るように）。 */
const SLOW = ["학생", "선생", "시간", "전화", "한국어", "일본어", "대한민국"];

const words = JSON.parse(readFileSync(`${APP}/public/data/words.json`, "utf8"));
const chars = JSON.parse(readFileSync(`${APP}/public/data/hanja-chars.json`, "utf8"));
const byChar = new Map(chars.map((c) => [c.char, c]));
const fromJp = new Map(chars.filter((c) => c.jp).map((c) => [c.jp, c.char]));

const keys = [...CHARS].map((c) => fromJp.get(c) ?? c);
for (const k of keys) if (!byChar.has(k)) throw new Error(`辞書に無い字: ${k}`);
const set = new Set(keys);
const jp = (hanja) => [...hanja].map((c) => byChar.get(c)?.jp ?? c).join("");

const found = words.filter((w) => [...w.hanja].length > 1 && [...w.hanja].every((c) => set.has(c)));
const pick = (list) =>
  list.map((ko) => {
    const w = found.filter((x) => x.hangul === ko).sort((a, b) => (a.lv ?? 5) - (b.lv ?? 5))[0];
    if (!w) throw new Error(`網の字だけでは読めない語: ${ko}`);
    return w;
  });
const first = pick(FIRST);
const slow = pick(SLOW);
/** 決まった種で混ぜる（何度走らせても同じ並び）。 */
const seeded = (s) => () => {
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const mixRandom = seeded(7);
const rest = found
  .filter((w) => !first.includes(w) && !slow.includes(w))
  .sort((a, b) => a.hangul.localeCompare(b.hangul, "ko"));
for (let i = rest.length - 1; i > 0; i--) {
  const j = Math.floor(mixRandom() * (i + 1));
  [rest[i], rest[j]] = [rest[j], rest[i]];
}
const ordered = [...first, ...slow, ...rest];

// 輪の並び：語の中で隣り合う字の組を、輪の上でも近くに（組の数 × 輪の上の隔たり の和を小さく）。
const N = keys.length;
const weight = new Map();
for (const w of ordered) {
  const cs = [...w.hanja];
  for (let i = 1; i < cs.length; i++) {
    if (cs[i - 1] === cs[i]) continue;
    const k = [cs[i - 1], cs[i]].sort().join("");
    weight.set(k, (weight.get(k) ?? 0) + 1);
  }
}
const fixed = new Map([
  ["會", N - 1],
  ["社", 0],
  ["員", 1],
]);
const random = seeded(20261024);
const cost = (at) => {
  let sum = 0;
  for (const [k, n] of weight) {
    const d = Math.abs(at.get(k[0]) - at.get(k[1]));
    sum += n * Math.min(d, N - d);
  }
  return sum;
};
const free = keys.filter((k) => !fixed.has(k));
const slots = Array.from({ length: N }, (_, i) => i).filter((i) => ![...fixed.values()].includes(i));
let best = null;
for (let restart = 0; restart < 40; restart++) {
  const order = [...free].sort(() => random() - 0.5);
  const at = new Map([...fixed, ...order.map((k, i) => [k, slots[i]])]);
  let now = cost(at);
  for (let step = 0; step < 6000; step++) {
    const a = free[Math.floor(random() * free.length)];
    const b = free[Math.floor(random() * free.length)];
    if (a === b) continue;
    const pa = at.get(a);
    at.set(a, at.get(b));
    at.set(b, pa);
    const next = cost(at);
    const temp = 2 * (1 - step / 6000);
    if (next <= now || random() < Math.exp((now - next) / Math.max(temp, 1e-6))) now = next;
    else {
      at.set(b, at.get(a));
      at.set(a, pa);
    }
  }
  if (!best || now < best.cost) best = { cost: now, at: new Map(at) };
}
const ring = [...best.at.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);

const out = {
  note: "scripts/net.mjs が作る。字とその字だけでできる辞書の語（アプリの辞書 public/data のとおり）。",
  chars: ring.map((k) => ({ key: k, jp: jp(k), eum: byChar.get(k).readings[0].eum, on: byChar.get(k).on?.[0] ?? "" })),
  words: ordered.map((w) => ({ ko: w.hangul, hanja: w.hanja, jp: jp(w.hanja), lv: w.lv ?? null })),
  first: first.length,
  slow: slow.length,
};
writeFileSync("src/net.json", `${JSON.stringify(out, null, 1)}\n`);
console.log(`  網：${N}字で ${ordered.length}語（輪の並び ${out.chars.map((c) => c.jp).join("")}、隔たりの和 ${best.cost}）`);
