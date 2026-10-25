// 文で出会う の例文：姉妹アプリ ことのあめ の文（韓国語＋日本語訳）に、漢字語の印を付けたもの
// （scripts/build-sentences.mjs が public/data/sentences.json に書く）。
// 辞書と違って起動時には読まず、使う画面が開いたときに一度だけ読む。

import { hanjaToWords, splitHanja } from "./dataset";
import { commonRank } from "./resolver";
import type { WordData } from "./types";

/** 文の中の漢字語の印。start / end は ko の中の位置（UTF-16）。 */
export interface SentenceMark {
  start: number;
  end: number;
  hangul: string;
  hanja: string;
}

export interface Sentence {
  /** 例文データの中の番号（出した文を覚えておくため）。 */
  id: number;
  ko: string;
  ja: string;
  marks: SentenceMark[];
}

export interface SentenceData {
  list: Sentence[];
  /** 語（hangul|hanja）→ その語が出てくる文の番号。 */
  byWord: Map<string, number[]>;
  /** 字 → その字の入った語が出てくる文の番号。 */
  byChar: Map<string, number[]>;
  /** 音声の置き場所の頭（ことのあめ の公開バケット）。下書きから作ったデータでは null。 */
  audioBase: string | null;
}

interface SentenceFile {
  audioBase?: string | null;
  sentences: { ko: string; ja: string; w: [number, number, string][] }[];
}

const key = (hangul: string, hanja: string) => `${hangul}|${hanja}`;

function push(map: Map<string, number[]>, k: string, id: number) {
  const list = map.get(k);
  if (!list) map.set(k, [id]);
  else if (list[list.length - 1] !== id) list.push(id);
}

/** 書き出した JSON を、画面で使う形と索引にする。 */
export function parseSentences(file: SentenceFile): SentenceData {
  const byWord = new Map<string, number[]>();
  const byChar = new Map<string, number[]>();
  const list = file.sentences.map((s, id) => {
    const marks = s.w.map(([start, end, hanja]) => ({ start, end, hangul: s.ko.slice(start, end), hanja }));
    for (const m of marks) {
      push(byWord, key(m.hangul, m.hanja), id);
      for (const c of splitHanja(m.hanja)) push(byChar, c, id);
    }
    return { id, ko: s.ko, ja: s.ja, marks };
  });
  return { list, byWord, byChar, audioBase: file.audioBase ?? null };
}

let loading: Promise<SentenceData | null> | null = null;

/** 例文を読む（一度だけ）。読めなければ null（オフラインでまだ保存していないときなど）。 */
export function loadSentences(): Promise<SentenceData | null> {
  if (!loading) {
    const baseRaw = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
    const base = baseRaw.endsWith("/") ? baseRaw : baseRaw + "/";
    loading = fetch(`${base}data/sentences.json`)
      .then((r) => (r.ok ? (r.json() as Promise<SentenceFile>) : null))
      .then((f) => (f ? parseSentences(f) : null))
      .catch(() => {
        loading = null; // 次に開いたときにもう一度
        return null;
      });
  }
  return loading;
}

/** 印の語を、辞書の語として引く（意味つき）。辞書に無ければ意味なしで返す。 */
export function wordOf(m: Pick<SentenceMark, "hangul" | "hanja">): WordData {
  return (
    (hanjaToWords.get(m.hanja) ?? []).find((w) => w.hangul === m.hangul) ?? { hangul: m.hangul, hanja: m.hanja, gloss: "" }
  );
}

/** 印の語が、学ぶ人にとって何か：集めた語（また出会った）／集めた字だけで読める語／まだの語。 */
export type MarkStatus = "owned" | "readable" | "new";

export function markStatus(
  m: Pick<SentenceMark, "hangul" | "hanja">,
  collected: Set<string>,
  owned: Set<string>
): MarkStatus {
  if (owned.has(key(m.hangul, m.hanja))) return "owned";
  const chars = splitHanja(m.hanja);
  return chars.length > 0 && chars.every((c) => collected.has(c)) ? "readable" : "new";
}

const NONE: ReadonlySet<string> = new Set();

/** 語の等級（한국어기초사전 の 초급 1・중급 2・고급 3。等級の無い語は字幕での頻度から。ほとんど使わない語は 4）。 */
export type LevelOf = (m: Pick<SentenceMark, "hangul" | "hanja">) => number;

/** 辞書から語の等級を引く（resolver の commonRank）。 */
export const dictLevel: LevelOf = (m) => {
  const w = hanjaToWords.get(m.hanja)?.find((x) => x.hangul === m.hangul);
  return w ? Math.min(commonRank(w), 4) : 4;
};

/** この等級の語を何語集めたら、その等級の文をふつうに出すか。 */
const ENOUGH = 30;

/**
 * 学ぶ人の段階：集めた語が30語以上ある、いちばん上の等級（無ければ 1＝초급）。
 * 集めた語に 중급 の語が増えてくれば、중급 のまだの語が入った文もふつうに降る。
 */
export function learnerLevel(owned: Iterable<string>, levelOf: LevelOf = dictLevel): number {
  const counts = [0, 0, 0, 0, 0];
  for (const k of owned) {
    const [hangul, hanja] = k.split("|");
    counts[levelOf({ hangul, hanja })]++;
  }
  let level = 1;
  for (let lv = 2; lv <= 4; lv++) if (counts[lv] >= ENOUGH) level = lv;
  return level;
}

export interface ScoreOptions {
  /** ふりかえりどきの集めた語（hangul|hanja）。 */
  due?: ReadonlySet<string>;
  /** 学ぶ人の段階（learnerLevel）。 */
  level?: number;
  levelOf?: LevelOf;
}

/**
 * 文の点：集めた語ほど高く（また出会う）、読める語、知っている字の入った語の順。
 * ふりかえりどきの集めた語（due）はもう少し高く、文の中でまた出会いやすくする。
 * まだ読めない語が学ぶ人の段階より上の等級なら、上の分だけ下げる（はじめたばかりの人に 고급 の語の文を降らせない）。
 */
export function sentenceScore(
  s: Sentence,
  collected: Set<string>,
  owned: Set<string>,
  { due = NONE, level = 1, levelOf = dictLevel }: ScoreOptions = {}
): number {
  let score = 0;
  for (const m of s.marks) {
    const status = markStatus(m, collected, owned);
    if (status === "owned") score += due.has(key(m.hangul, m.hanja)) ? 5 : 3;
    else if (status === "readable") score += 2;
    else {
      if (splitHanja(m.hanja).some((c) => collected.has(c))) score += 1;
      score -= Math.max(0, levelOf(m) - level);
    }
  }
  return score;
}

export interface RainOptions {
  /** ひと雨の文の数。 */
  size?: number;
  /** ふりかえりどきの集めた語（hangul|hanja）。 */
  due?: ReadonlySet<string>;
  levelOf?: LevelOf;
  random?: () => number;
}

/**
 * ひと雨ぶんの文を選ぶ。まだ出していない文を混ぜてから点の高い順に並べ、上のほうから size 文。
 * 点が同じなら毎回違う文になる。出していない文が足りなければ、出した文もまた使う。
 * 点は、集めた語から求めた学ぶ人の段階に合わせる（sentenceScore）。
 */
export function pickRain(
  list: readonly Sentence[],
  collected: Set<string>,
  owned: Set<string>,
  seen: Set<number>,
  { size = 4, due = NONE, levelOf = dictLevel, random = Math.random }: RainOptions = {}
): Sentence[] {
  const level = learnerLevel(owned, levelOf);
  let pool = list.filter((s) => !seen.has(s.id));
  if (pool.length < size) pool = [...list];
  // 混ぜる（Fisher–Yates）→ 点で安定に並べる。上位から少しだけ散らして選ぶ。
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const scored = pool
    .map((s) => ({ s, score: sentenceScore(s, collected, owned, { due, level, levelOf }) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(size * 4, 16));
  const out: Sentence[] = [];
  const used = new Map<string, number>();
  for (const { s } of scored) {
    // 同じ語ばかりの雨にならないよう、ひと雨で同じ語は2文まで。もう出た語だけの文は後回し。
    const keys = s.marks.map((m) => key(m.hangul, m.hanja));
    if (keys.some((k) => (used.get(k) ?? 0) >= 2) || !keys.some((k) => !used.has(k))) continue;
    out.push(s);
    for (const k of new Set(keys)) used.set(k, (used.get(k) ?? 0) + 1);
    if (out.length === size) break;
  }
  // 足りなければ、同じ語2文までは守って足し、それでも足りなければ何でも。
  for (const capped of [true, false]) {
    for (const { s } of scored) {
      if (out.length === size) break;
      if (out.includes(s)) continue;
      const keys = s.marks.map((m) => key(m.hangul, m.hanja));
      if (capped && keys.some((k) => (used.get(k) ?? 0) >= 2)) continue;
      out.push(s);
      for (const k of new Set(keys)) used.set(k, (used.get(k) ?? 0) + 1);
    }
  }
  return out;
}

/** 文を、印の語とそれ以外の切れ目に分ける（描くため）。 */
export function segments(s: Pick<Sentence, "ko" | "marks">): ({ text: string } | { text: string; mark: SentenceMark })[] {
  const out: ({ text: string } | { text: string; mark: SentenceMark })[] = [];
  let at = 0;
  for (const m of [...s.marks].sort((a, b) => a.start - b.start)) {
    if (m.start < at) continue;
    if (m.start > at) out.push({ text: s.ko.slice(at, m.start) });
    out.push({ text: s.ko.slice(m.start, m.end), mark: m });
    at = m.end;
  }
  if (at < s.ko.length) out.push({ text: s.ko.slice(at) });
  return out;
}

/** 音声の場所（ことのあめ の公開バケット：文の SHA-256）。置き場所が無いか、計算できない環境では null。 */
export async function audioUrl(base: string | null, ko: string): Promise<string | null> {
  if (!base || typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ko));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${base}${hex}.wav`;
  } catch {
    return null;
  }
}
