// 集めた語と字の読み出し（Dexie の useLiveQuery）を、画面をまたいで覚えておく。
// 前に読んだ結果を最初の描画から使うので、タブを移っても一瞬空にならず、戻ったときにスクロール位置も戻る
// （中身の高さが先にそろうため）。中身はすぐに端末の最新の結果に入れ替わる。
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";
import { db, type CollectedChar, type CollectedWord } from "../db";

const last: { words?: CollectedWord[]; chars?: CollectedChar[] } = {};

/** 集めた語（新しい順）。 */
export function useWords(): CollectedWord[] | undefined {
  const words = useLiveQuery(() => db.words.orderBy("addedAt").reverse().toArray(), [], last.words);
  useEffect(() => {
    if (words) last.words = words;
  }, [words]);
  return words;
}

/** 集めた字（その字が入った語の数つき）。 */
export function useChars(): CollectedChar[] | undefined {
  const chars = useLiveQuery(() => db.chars.toArray(), [], last.chars);
  useEffect(() => {
    if (chars) last.chars = chars;
  }, [chars]);
  return chars;
}
