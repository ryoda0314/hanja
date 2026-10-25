// 読んでみる：集めた字だけでできた、まだ習っていない語を、字の音からハングルで読む。
// 答え合わせは点数を付けず、どの音節が違ったかと、字のふだんの音とこの語での音が違うところ（來 래 → 내일 の 내）、
// そのわけ（語のはじめの ㄹ は ㄴ に）を示すだけ。

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
 * 字をふだんの音と違う音で読むわけ。
 * initial    語のはじめの ㄹ・ㄴ（頭音法則。來 래 → 내일、女 녀 → 여자）
 * inside     語の中でも、語のはじめと同じ形（不利益 불이익 の 이）。語が合わさった語に多い
 * afterVowel 母音や ㄴ のあとの 렬・률 は 열・율（比率 비율）
 * beforeDJ   ㄷ・ㅈ の前で ㄹ が落ちる（不足 부족）
 * saisiot    ㅅ を書き足す（數字 숫자・回數 횟수。ごくわずかな語だけ）
 * other      語によって読みが変わる字（音樂 음악 の 樂、自轉車 자전거 の 車）
 */
export type VariantRule = "initial" | "inside" | "afterVowel" | "beforeDJ" | "saisiot" | "other";

export interface ReadingNote {
  char: string;
  /** 字のふだんの音（辞書の最初の読み）。 */
  usual: string;
  /** この語での音。 */
  here: string;
  rule: VariantRule;
}

/** 音節を 初声・中声・終声 の番号に。ハングルの音節でなければ null。 */
function jamo(s: string | undefined) {
  const code = (s?.codePointAt(0) ?? 0) - 0xac00;
  if (code < 0 || code > 11171) return null;
  return { lead: Math.floor(code / 588), vowel: Math.floor((code % 588) / 28), tail: code % 28 };
}

const syllable = (lead: number, vowel: number, tail: number) => String.fromCodePoint(0xac00 + (lead * 21 + vowel) * 28 + tail);

/** 初声（ㄴ ㄷ ㄹ ㅇ ㅈ）・終声（ㄴ ㄹ ㅅ）・中声（ㅕ ㅠ）の番号。 */
const LEAD = { n: 2, d: 3, r: 5, none: 11, j: 12 };
const TAIL = { n: 4, r: 8, s: 19 };
const VOWEL = { yeo: 6, yu: 17 };
/** ㅣ と、ㅣ から始まる母音（ㅑ ㅒ ㅕ ㅖ ㅛ ㅠ）。この前の語のはじめの ㄹ・ㄴ は落ちる。 */
const I_LIKE = new Set([2, 3, 6, 7, 12, 17, 20]);

/**
 * 語のはじめで読む形（頭音法則）。ㄹ は ㅣ・ㅑ・ㅕ・ㅛ・ㅠ の前で落ち（력 → 역）、ほかの母音の前では ㄴ に（래 → 내）。
 * ㄴ は ㅣ・ㅑ・ㅕ・ㅛ・ㅠ の前で落ちる（녀 → 여）。形が変わらなければ null。
 */
export function initialForm(s: string): string | null {
  const j = jamo(s);
  if (!j) return null;
  if (j.lead === LEAD.r) return syllable(I_LIKE.has(j.vowel) ? LEAD.none : LEAD.n, j.vowel, j.tail);
  if (j.lead === LEAD.n && I_LIKE.has(j.vowel)) return syllable(LEAD.none, j.vowel, j.tail);
  return null;
}

/** 語の i 番目の音節を、ふだんの音 usual でなく読むわけ。 */
export function variantRule(usual: string, syllables: readonly string[], i: number): VariantRule {
  const here = syllables[i];
  const u = jamo(usual);
  const h = jamo(here);
  if (!u || !h) return "other";
  if (initialForm(usual) === here) {
    if (i === 0) return "initial";
    const prev = jamo(syllables[i - 1]);
    const ryeol = u.lead === LEAD.r && (u.vowel === VOWEL.yeo || u.vowel === VOWEL.yu) && u.tail === TAIL.r;
    if (ryeol && prev && (prev.tail === 0 || prev.tail === TAIL.n)) return "afterVowel";
    return "inside";
  }
  const sameOpen = h.lead === u.lead && h.vowel === u.vowel;
  const next = jamo(syllables[i + 1]);
  if (sameOpen && u.tail === TAIL.r && h.tail === 0 && next && (next.lead === LEAD.d || next.lead === LEAD.j)) return "beforeDJ";
  if (sameOpen && u.tail === 0 && h.tail === TAIL.s) return "saisiot";
  return "other";
}

/**
 * この語で、字のふだんの音（辞書の最初の読み）と違う音で読む字と、そのわけ。
 * 來日（내일）なら 來 はふだん 래、語のはじめなので 내。字の音を足しても読めないところの手がかりにする。
 */
export function readingNotes(hangul: string, hanja: string): ReadingNote[] {
  const chars = splitHanja(hanja);
  const syllables = Array.from(hangul);
  if (chars.length !== syllables.length) return [];
  const out: ReadingNote[] = [];
  chars.forEach((c, i) => {
    const usual = getCharData(c)?.readings[0]?.eum;
    if (usual && usual !== syllables[i] && !out.some((o) => o.char === c))
      out.push({ char: c, usual, here: syllables[i], rule: variantRule(usual, syllables, i) });
  });
  return out;
}

/** 字のふだんの音をつなげた読み（來日 なら 래일）。字の音どおりに読んだのに、この語では違ったかを見るため。 */
export function usualReading(hanja: string): string {
  return splitHanja(hanja)
    .map((c) => getCharData(c)?.readings[0]?.eum ?? "")
    .join("");
}

/**
 * 次に読んでみる語を選ぶ。読みやすい順に並んだ語の上から20語のうち、まだ出していない語をひとつ。
 * 毎回同じ順にならないよう、その中から無作為に選ぶ。prefer に合う語（学ぶ人の段階に合う語）があれば、その中から。
 */
export function pickToRead<T>(
  pool: readonly T[],
  skip: (w: T) => boolean,
  random: () => number = Math.random,
  prefer?: (w: T) => boolean
): T | null {
  const open = pool.filter((w) => !skip(w));
  const fit = prefer ? open.filter(prefer) : open;
  const top = (fit.length ? fit : open).slice(0, 20);
  return top.length ? top[Math.floor(random() * top.length)] : null;
}
