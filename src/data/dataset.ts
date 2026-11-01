// 辞書データの読込とインデックス構築。
//
// 2段構え:
//   ① curated-*.json（手作業データ・小）を import で即時ロード → テストや初期表示の土台。
//   ② public/data/*.json（kengdic+Unihan 由来の全データ・大）を起動時に fetch してマージ。
//
// charMap / hangulToWords / charToWords は永続的な Map インスタンスで、
// rebuildIndexes() が中身を入れ替える（参照は保たれるので各モジュールの import が有効なまま）。

import curatedCharsJson from "./curated-chars.json";
import curatedWordsJson from "./curated-words.json";
import type { ScriptPref } from "../prefs";
import type { HanjaCharData, WordData } from "./types";

const curatedChars = curatedCharsJson as HanjaCharData[];
const curatedWords = curatedWordsJson as WordData[];

/**
 * 文字列を漢字（CJK統合漢字）1文字ずつに分解する。CJK以外は除外。
 * 互換漢字（年 U+F98E など、読み別の重複コード）は NFC で統合漢字にそろえる（辞書データと同じ扱い）。
 */
export function splitHanja(hanja: string): string[] {
  return Array.from(hanja.normalize("NFC")).filter((ch) => /\p{Script=Han}/u.test(ch));
}

/** 漢字1文字 → 辞書エントリ。 */
export const charMap: Map<string, HanjaCharData> = new Map();
/** ハングル表記 → 語データ（同音異義に備えて配列）。 */
export const hangulToWords: Map<string, WordData[]> = new Map();
/** 漢字1文字 → その字を含む語の一覧（逆引き。組み合わせ・発見で使用）。 */
export const charToWords: Map<string, WordData[]> = new Map();
/** 漢字表記 → 語データ（樂 の 락/악 のように読みが分かれる語もあるので配列）。 */
export const hanjaToWords: Map<string, WordData[]> = new Map();
/** 日本の字（新字体）→ 韓国の字（旧字体）。学 → [學]。漢字で打った語を引くときに使う。 */
export const jpToKo: Map<string, string[]> = new Map();
/** 全語リスト（参照用）。中身は rebuildIndexes で入れ替える。 */
export const seedWords: WordData[] = [];
/** 語（ハングル|漢字）から、全語リストの中の番号へ。 */
const numbers: Map<string, number> = new Map();

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function rebuildIndexes(charList: HanjaCharData[], wordList: WordData[]): void {
  charMap.clear();
  jpToKo.clear();
  for (const c of charList) {
    charMap.set(c.char, c);
    if (c.jp && c.jp !== c.char) push(jpToKo, c.jp, c.char);
  }

  hangulToWords.clear();
  hanjaToWords.clear();
  charToWords.clear();
  numbers.clear();
  seedWords.length = 0;
  for (const w of wordList) {
    numbers.set(`${w.hangul}|${w.hanja.normalize("NFC")}`, seedWords.length);
    seedWords.push(w);
    push(hanjaToWords, w.hanja, w);

    const byHangul = hangulToWords.get(w.hangul);
    if (byHangul) byHangul.push(w);
    else hangulToWords.set(w.hangul, [w]);

    for (const ch of new Set(splitHanja(w.hanja))) {
      const byChar = charToWords.get(ch);
      if (byChar) byChar.push(w);
      else charToWords.set(ch, [w]);
    }
  }
}

// 起動直後は curated データで初期化（テスト環境ではこれだけで動く）。
rebuildIndexes(curatedChars, curatedWords);

let fullLoaded = false;

/**
 * public/data/*.json（全データ）を取得してインデックスを再構築する。
 * 取得に失敗した場合は curated データのまま継続する（オフライン耐性）。読めたら true。
 * ブラウザ実行時にアプリ起動で一度だけ呼ぶ。
 */
export async function initFullDataset(): Promise<boolean> {
  if (fullLoaded) return true;
  const baseRaw = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
  const base = baseRaw.endsWith("/") ? baseRaw : baseRaw + "/";
  try {
    const [chars, wordsText] = await Promise.all([
      fetch(`${base}data/hanja-chars.json`).then((r) => r.json() as Promise<HanjaCharData[]>),
      fetch(`${base}data/words.json`).then((r) => r.text()),
    ]);
    rebuildIndexes(chars, JSON.parse(wordsText) as WordData[]);
    version = versionOf(wordsText);
    fullLoaded = true;
  } catch (e) {
    console.warn("全データの読込に失敗しました。収録語のみで動作します。", e);
  }
  return fullLoaded;
}

let version = "";

/** words.json の中身から作る短い名前（FNV-1a）。番号の指す語は版ごとに違うので、同じ版どうしでだけ受け渡す。 */
export function versionOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${text.length.toString(36)}-${(h >>> 0).toString(36)}`;
}

/** 全データ（words.json）の版（みんなの雨で、語の番号に添える）。全データを読めていなければ ""。 */
export function wordsVersion(): string {
  return version;
}

/**
 * 全データ（words.json）の中での語の番号（みんなの雨で、語の代わりに送る）。辞書に無い語や、全データを読めていない
 * とき（番号が words.json と合わない）は undefined。
 */
export function wordNumber(hangul: string, hanja: string): number | undefined {
  return fullLoaded ? numbers.get(`${hangul}|${hanja.normalize("NFC")}`) : undefined;
}

/** wordNumber の逆。 */
export function wordByNumber(n: number): WordData | undefined {
  return fullLoaded ? seedWords[n] : undefined;
}

/** 漢字1文字の辞書エントリを取得（未収録なら undefined）。 */
export function getCharData(char: string): HanjaCharData | undefined {
  return charMap.get(char);
}

/** 日本の字（新字体）で書いた表記。字形が同じ字や辞書に無い字はそのまま。例: 會社 → 会社 */
export function jpForm(hanja: string): string {
  return Array.from(hanja.normalize("NFC"))
    .map((c) => charMap.get(c)?.jp ?? c)
    .join("");
}

/** 字1字を、字形の設定に合わせて。日本の字なら新字体（學 → 学）、韓国の字・両方なら韓国の字のまま。 */
export function glyphOf(char: string, script: ScriptPref): string {
  return script === "ja" ? (charMap.get(char)?.jp ?? char) : char;
}

/** 基礎漢字（1800字）の辞書エントリ。全データの読込後に中身がそろう。 */
export function eduChars(): HanjaCharData[] {
  return [...charMap.values()].filter((c) => c.edu);
}
