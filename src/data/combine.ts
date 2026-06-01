// 組み合わせ・発見機能のロジック。
// 「集めた漢字だけで作れる実在の漢字語」を逆引きインデックスから列挙する。
// 造語の自動生成は行わず、種語彙（将来はオンライン辞書キャッシュ）に存在する語のみを対象とする。

import { charToWords, hangulToWords, seedWords, splitHanja } from "./dataset";
import { enrich } from "./resolver";
import type { ResolvedWord, WordData } from "./types";

/** 発見結果。alreadyOwned = すでに単語帳に持っている語かどうか。 */
export interface DiscoverResult extends ResolvedWord {
  alreadyOwned: boolean;
}

/**
 * 収集済み漢字の集合から、それらの漢字「だけ」で構成できる実在の漢字語を列挙する。
 *
 * @param collectedChars 収集済みの漢字（1文字）の集合
 * @param ownedHangul    すでに単語帳に持っている語のハングル集合（発見対象から除外/印付けに使用）
 * @param onlyNew        true の場合、まだ持っていない語のみを返す（＝発見すべき新語）
 */
export function discoverWords(
  collectedChars: Set<string>,
  ownedHangul: Set<string>,
  onlyNew = false
): DiscoverResult[] {
  // 収集漢字を1つでも含む語だけを候補にすることで全件走査を避ける。
  const candidates = new Set<WordData>();
  for (const ch of collectedChars) {
    for (const w of charToWords.get(ch) ?? []) candidates.add(w);
  }

  const results: DiscoverResult[] = [];
  for (const w of candidates) {
    const chars = splitHanja(w.hanja);
    // 構成漢字がすべて収集済みであること。
    const formable = chars.length > 0 && chars.every((c) => collectedChars.has(c));
    if (!formable) continue;

    const alreadyOwned = ownedHangul.has(w.hangul);
    if (onlyNew && alreadyOwned) continue;

    results.push({ ...enrich(w, "seed"), alreadyOwned });
  }

  // 構成漢字が多い語を上に（達成感が大きい組み合わせを優先）、次に画数の少ない順。
  results.sort((a, b) => b.chars.length - a.chars.length || a.hangul.localeCompare(b.hangul));
  return results;
}

/**
 * 任意の漢字列が実在の漢字語かどうかをチェックする（自由組み合わせチェッカー）。
 * 種語彙に同じ漢字表記の語があれば、その語を返す。
 */
export function checkWordExists(chars: string[]): ResolvedWord | null {
  if (chars.length === 0) return null;
  const hanja = chars.join("");
  const found = seedWords.find((w) => w.hanja === hanja);
  return found ? enrich(found, "seed") : null;
}

/** ハングル表記が実在語かどうか（種語彙基準）。 */
export function isRealWord(hangul: string): boolean {
  return hangulToWords.has(hangul.trim());
}
