// ハングルの漢字語を「漢字 + 意味 + 構成漢字の読み」に解決する。
//   ① 種語彙（バンドルデータ）から照合
//   ② （将来）国立国語院 Open API でオンライン解決 ← Phase 2 で追加
//   ③ 漢字テーブルで各構成字の音訓を付与
// 現状は ①③ のみ。オンライン解決は resolveOnline() のスタブとして用意。

import { charMap, hangulToWords, splitHanja } from "./dataset";
import type { ResolvedWord, WordData } from "./types";

/** WordData に構成漢字とその読みを付与して ResolvedWord にする。 */
export function enrich(word: WordData, source: ResolvedWord["source"]): ResolvedWord {
  const chars = splitHanja(word.hanja);
  const charData = chars
    .map((ch) => charMap.get(ch))
    .filter((c): c is NonNullable<typeof c> => c != null);
  return { ...word, chars, charData, source };
}

/**
 * ハングル語をローカルの種語彙から解決する。見つからなければ null。
 * 同音異義語が複数ある場合は最初の1件を返す（UI 側で候補提示する拡張余地あり）。
 */
export function resolveLocal(hangul: string): ResolvedWord | null {
  const trimmed = hangul.trim();
  const matches = hangulToWords.get(trimmed);
  if (!matches || matches.length === 0) return null;
  return enrich(matches[0], "seed");
}

/** ローカルの全候補を返す（同音異義語対応）。 */
export function resolveLocalAll(hangul: string): ResolvedWord[] {
  const matches = hangulToWords.get(hangul.trim()) ?? [];
  return matches.map((w) => enrich(w, "seed"));
}

/**
 * オンライン辞書（国立国語院 Open API）による解決のスタブ。
 * Phase 2 で実装予定。現状は常に null を返す。
 */
export async function resolveOnline(_hangul: string): Promise<ResolvedWord | null> {
  return null;
}

/**
 * ユーザーが手入力した漢字表記から ResolvedWord を作る（辞書に無い語の手動登録用）。
 */
export function resolveManual(hangul: string, hanja: string, gloss: string): ResolvedWord {
  return enrich({ hangul: hangul.trim(), hanja: hanja.trim(), gloss: gloss.trim() }, "manual");
}
