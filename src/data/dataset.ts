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
import type { HanjaCharData, WordData } from "./types";

const curatedChars = curatedCharsJson as HanjaCharData[];
const curatedWords = curatedWordsJson as WordData[];

/** 文字列を漢字（CJK統合漢字）1文字ずつに分解する。CJK以外は除外。 */
export function splitHanja(hanja: string): string[] {
  return Array.from(hanja).filter((ch) => /\p{Script=Han}/u.test(ch));
}

/** 漢字1文字 → 辞書エントリ。 */
export const charMap: Map<string, HanjaCharData> = new Map();
/** ハングル表記 → 語データ（同音異義に備えて配列）。 */
export const hangulToWords: Map<string, WordData[]> = new Map();
/** 漢字1文字 → その字を含む語の一覧（逆引き。組み合わせ・発見で使用）。 */
export const charToWords: Map<string, WordData[]> = new Map();
/** 全語リスト（参照用）。中身は rebuildIndexes で入れ替える。 */
export const seedWords: WordData[] = [];

function rebuildIndexes(charList: HanjaCharData[], wordList: WordData[]): void {
  charMap.clear();
  for (const c of charList) charMap.set(c.char, c);

  hangulToWords.clear();
  charToWords.clear();
  seedWords.length = 0;
  for (const w of wordList) {
    seedWords.push(w);

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
 * 取得に失敗した場合は curated データのまま継続する（オフライン耐性）。
 * ブラウザ実行時にアプリ起動で一度だけ呼ぶ。
 */
export async function initFullDataset(): Promise<void> {
  if (fullLoaded) return;
  const baseRaw = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
  const base = baseRaw.endsWith("/") ? baseRaw : baseRaw + "/";
  try {
    const [chars, words] = await Promise.all([
      fetch(`${base}data/hanja-chars.json`).then((r) => r.json() as Promise<HanjaCharData[]>),
      fetch(`${base}data/words.json`).then((r) => r.json() as Promise<WordData[]>),
    ]);
    rebuildIndexes(chars, words);
    fullLoaded = true;
  } catch (e) {
    console.warn("全データの読込に失敗しました。収録語のみで動作します。", e);
  }
}

/** 漢字1文字の辞書エントリを取得（未収録なら undefined）。 */
export function getCharData(char: string): HanjaCharData | undefined {
  return charMap.get(char);
}
