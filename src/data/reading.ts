// 読んでみる：集めた字だけでできた、まだ習っていない語を、字の音からハングルで読む。
// 答え合わせは点数を付けず、どの音節が違ったかと、字のふだんの音とこの語での音が違うところ（年 년 → 연금 の 연）を示すだけ。

import { getCharData, splitHanja } from "./dataset";

/** 音節ごとに合っているか（答えの長さで返す。打った読みが短ければ、足りない音節は違う扱い）。空白は無視する。 */
export function compareSyllables(typed: string, answer: string): boolean[] {
  const mine = Array.from(typed.replace(/\s+/g, ""));
  return Array.from(answer).map((s, i) => mine[i] === s);
}

/** 打った読みが答えと同じか（空白は無視する）。 */
export function isSameReading(typed: string, answer: string): boolean {
  return typed.replace(/\s+/g, "") === answer;
}

/**
 * この語で、字のふだんの音（辞書の最初の読み）と違う音で読む字。
 * 年金（연금）なら 年 はふだん 년、この語では 연。字の音を足しても読めないところの手がかりにする。
 */
export function readingNotes(hangul: string, hanja: string): { char: string; usual: string; here: string }[] {
  const chars = splitHanja(hanja);
  const syllables = Array.from(hangul);
  if (chars.length !== syllables.length) return [];
  const out: { char: string; usual: string; here: string }[] = [];
  chars.forEach((c, i) => {
    const usual = getCharData(c)?.readings[0]?.eum;
    if (usual && usual !== syllables[i] && !out.some((o) => o.char === c)) out.push({ char: c, usual, here: syllables[i] });
  });
  return out;
}

/**
 * 次に読んでみる語を選ぶ。読みやすい順に並んだ語の上から20語のうち、まだ出していない語をひとつ。
 * 毎回同じ順にならないよう、その中から無作為に選ぶ。
 */
export function pickToRead<T>(pool: readonly T[], skip: (w: T) => boolean, random: () => number = Math.random): T | null {
  const top = pool.filter((w) => !skip(w)).slice(0, 20);
  return top.length ? top[Math.floor(random() * top.length)] : null;
}
