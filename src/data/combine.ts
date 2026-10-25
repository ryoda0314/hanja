// 組み合わせ・発見機能のロジック。
// 「集めた漢字だけで読める実在の漢字語」と「あと1字で読める語」を逆引きインデックスから列挙する。
// 造語の自動生成は行わず、辞書（将来はオンライン辞書キャッシュ）に存在する語のみを対象とする。

import { charMap, charToWords, hangulToWords, hanjaToWords, splitHanja } from "./dataset";
import { commonRank, enrich, isRare } from "./resolver";
import type { ResolvedWord, WordData } from "./types";

/** 語を一意に表すキー。同音異義語（사기 詐欺 / 사기 士氣）を別の語として扱うため漢字表記も含める。 */
export function wordKey(w: { hangul: string; hanja: string }): string {
  return `${w.hangul}|${w.hanja.normalize("NFC")}`;
}

/** 発見結果。alreadyOwned = すでに単語帳に持っている語かどうか。 */
export interface DiscoverResult extends ResolvedWord {
  alreadyOwned: boolean;
}

/** 集めた字を1つでも含む語（全件走査を避けるための候補）。ほとんど使わない語は覚えても使わないので、入れない。 */
function candidatesFor(collectedChars: Iterable<string>): Set<WordData> {
  const candidates = new Set<WordData>();
  for (const ch of collectedChars) {
    for (const w of charToWords.get(ch) ?? []) if (!isRare(w)) candidates.add(w);
  }
  return candidates;
}

/** 構成漢字がすべて基礎漢字（1800字）か。よく使う語ほどそうなりやすい。 */
function allBasic(w: WordData): boolean {
  return splitHanja(w.hanja).every((c) => charMap.get(c)?.edu);
}

/** 1字だけの語（家 가）は字そのものなので、2字以上の語のあとに回す。 */
function easeLength(w: WordData): number {
  const n = splitHanja(w.hanja).length;
  return n === 1 ? 99 : n;
}

/** 読みやすい順：1字語は最後 → よく使う語（等級・字幕での頻度） → 字数の少ない語 → 基礎漢字だけでできた語 → 가나다順。 */
export function byEase(a: WordData, b: WordData): number {
  return (
    Number(easeLength(a) === 99) - Number(easeLength(b) === 99) ||
    commonRank(a) - commonRank(b) ||
    (b.fq ?? 0) - (a.fq ?? 0) ||
    easeLength(a) - easeLength(b) ||
    Number(allBasic(b)) - Number(allBasic(a)) ||
    a.hangul.localeCompare(b.hangul, "ko")
  );
}

/**
 * 収集済み漢字の集合から、それらの漢字「だけ」で構成できる実在の漢字語を列挙する（読みやすい順）。
 * 1字だけの語（家 가）は字そのものなので含めない（読める語は、字の組み合わせで読める語）。
 *
 * @param collectedChars 収集済みの漢字（1文字）の集合
 * @param owned          すでに単語帳に持っている語のキー（wordKey）の集合
 * @param onlyNew        true の場合、まだ持っていない語のみを返す（＝発見すべき新語）
 */
export function discoverWords(
  collectedChars: Set<string>,
  owned: Set<string>,
  onlyNew = false
): DiscoverResult[] {
  const results: DiscoverResult[] = [];
  for (const w of candidatesFor(collectedChars)) {
    const chars = splitHanja(w.hanja);
    // 2字以上で、構成漢字がすべて収集済みであること。
    const formable = chars.length > 1 && chars.every((c) => collectedChars.has(c));
    if (!formable) continue;

    const alreadyOwned = owned.has(wordKey(w));
    if (onlyNew && alreadyOwned) continue;

    results.push({ ...enrich(w, "seed"), alreadyOwned });
  }
  results.sort(byEase);
  return results;
}

/** あと1字で読める語と、その足りない字。 */
export interface NearResult {
  word: WordData;
  missing: string;
}

/** 足りない字が1種類だけの、まだ持っていない語（読みやすい順）。次に覚える字の手がかりにする。 */
export function nearWords(collectedChars: Set<string>, owned: Set<string>): NearResult[] {
  const out: NearResult[] = [];
  for (const w of candidatesFor(collectedChars)) {
    if (owned.has(wordKey(w)) || splitHanja(w.hanja).length < 2) continue;
    const missing = [...new Set(splitHanja(w.hanja))].filter((c) => !collectedChars.has(c));
    if (missing.length === 1) out.push({ word: w, missing: missing[0] });
  }
  out.sort((a, b) => byEase(a.word, b.word));
  return out;
}

/**
 * この語をあつめると新しく読めるようになる語（読みやすい順）。語の中のはじめての字が鍵になるので、
 * 知っている字だけの語なら空。あつめる語そのものと、持っている語は含めない。
 */
export function unlockedBy(
  word: { hangul: string; hanja: string },
  collectedChars: Set<string>,
  owned: Set<string>
): WordData[] {
  const chars = new Set(splitHanja(word.hanja));
  const fresh = [...chars].filter((c) => !collectedChars.has(c));
  if (fresh.length === 0) return [];
  const after = new Set([...collectedChars, ...chars]);
  const self = wordKey(word);
  const out = new Map<string, WordData>();
  for (const c of fresh) {
    for (const w of charToWords.get(c) ?? []) {
      const key = wordKey(w);
      if (key === self || owned.has(key) || out.has(key) || isRare(w)) continue;
      const parts = splitHanja(w.hanja);
      if (parts.length > 1 && parts.every((x) => after.has(x))) out.set(key, w);
    }
  }
  return [...out.values()].sort(byEase);
}

/**
 * 次に出会うと読める語が増える字。よく使う語（한국어기초사전 の 초급〜고급）が多く増える字から、同じなら増える語数、
 * 基礎漢字の順。まれな語ばかり増える字（的・性・化 の付いた語）より、学ぶ人がよく出会う語の増える字を先に。
 */
export function unlockers(near: NearResult[]): { char: string; count: number }[] {
  const counts = new Map<string, { count: number; common: number }>();
  for (const n of near) {
    const c = counts.get(n.missing) ?? { count: 0, common: 0 };
    c.count++;
    if (commonRank(n.word) <= 3) c.common++;
    counts.set(n.missing, c);
  }
  return [...counts.entries()]
    .sort(
      ([a, x], [b, y]) =>
        y.common - x.common ||
        y.count - x.count ||
        Number(Boolean(charMap.get(b)?.edu)) - Number(Boolean(charMap.get(a)?.edu)) ||
        a.localeCompare(b)
    )
    .map(([char, { count }]) => ({ char, count }));
}

/** 並べた漢字とまったく同じ表記の実在語（読みが複数ある語もあるので全部）。 */
export function findWordsByHanja(chars: string[]): ResolvedWord[] {
  if (chars.length === 0) return [];
  return (hanjaToWords.get(chars.join("").normalize("NFC")) ?? []).map((w) => enrich(w, "seed"));
}

/**
 * 任意の漢字列が実在の漢字語かどうかをチェックする（自由組み合わせチェッカー）。
 * 種語彙に同じ漢字表記の語があれば、その語を返す。
 */
export function checkWordExists(chars: string[]): ResolvedWord | null {
  return findWordsByHanja(chars)[0] ?? null;
}

/** ハングル表記が実在語かどうか（種語彙基準）。 */
export function isRealWord(hangul: string): boolean {
  return hangulToWords.has(hangul.trim());
}
