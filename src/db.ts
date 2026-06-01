// 端末内保存（IndexedDB）の定義と収集ロジック。
// Dexie を使い、Web ブラウザでも Capacitor の WebView でも同じコードで永続化する。
// アカウント不要・オフライン完結（クラウド同期は将来の拡張）。

import Dexie, { type EntityTable } from "dexie";
import type { ResolvedWord } from "./data/types";
import { splitHanja } from "./data/dataset";

/** ユーザーが集めた漢字語1件。 */
export interface CollectedWord {
  id: number;
  hangul: string;
  hanja: string;
  /** 日本の新字体表記（字形が異なる場合のみ）。 */
  hanjaJp?: string;
  gloss: string;
  /** 構成漢字（検索・図鑑連携のため multiEntry インデックス対象）。 */
  chars: string[];
  source: ResolvedWord["source"];
  /** 追加日時（epoch ミリ秒）。 */
  addedAt: number;
}

/** 図鑑における漢字1文字の収集状態。 */
export interface CollectedChar {
  /** 漢字1文字（主キー）。 */
  char: string;
  /** この漢字を含む語を集めた延べ回数（レベル感の指標）。 */
  count: number;
  /** 初めて収集した日時。 */
  firstAddedAt: number;
  /** 最後に収集した日時。 */
  lastAddedAt: number;
}

const db = new Dexie("hanjaatume") as Dexie & {
  words: EntityTable<CollectedWord, "id">;
  chars: EntityTable<CollectedChar, "char">;
};

db.version(1).stores({
  // &[hangul+hanja] で同一語の重複登録を防ぐ。*chars で構成漢字から逆引き可能。
  words: "++id, &[hangul+hanja], hangul, *chars, addedAt",
  chars: "char, count, firstAddedAt, lastAddedAt",
});

/** 既に同じ語（ハングル+漢字）を登録済みか。 */
export async function hasWord(hangul: string, hanja: string): Promise<boolean> {
  const found = await db.words.get({ hangul, hanja });
  return found != null;
}

/**
 * 解決済みの漢字語を1件追加する。
 * 同時に構成漢字の図鑑収集状態（count / 日時）を更新する。
 * すでに同じ語が存在する場合は false を返す（何もしない）。
 */
export async function addWord(word: ResolvedWord): Promise<boolean> {
  const now = Date.now();
  const chars = word.chars.length > 0 ? word.chars : splitHanja(word.hanja);

  return db.transaction("rw", db.words, db.chars, async () => {
    if (await hasWord(word.hangul, word.hanja)) return false;

    await db.words.add({
      hangul: word.hangul,
      hanja: word.hanja,
      hanjaJp: word.hanjaJp,
      gloss: word.gloss,
      chars,
      source: word.source,
      addedAt: now,
    } as CollectedWord);

    // 構成漢字ごとに収集状態を更新（重複字は1語につき1回だけ数える）。
    for (const ch of new Set(chars)) {
      const existing = await db.chars.get(ch);
      if (existing) {
        await db.chars.update(ch, {
          count: existing.count + 1,
          lastAddedAt: now,
        });
      } else {
        await db.chars.add({ char: ch, count: 1, firstAddedAt: now, lastAddedAt: now });
      }
    }
    return true;
  });
}

/**
 * 漢字語を1件削除する。構成漢字の count を減らし、0 になった漢字は図鑑から外す。
 */
export async function removeWord(id: number): Promise<void> {
  await db.transaction("rw", db.words, db.chars, async () => {
    const word = await db.words.get(id);
    if (!word) return;
    await db.words.delete(id);
    for (const ch of new Set(word.chars)) {
      const existing = await db.chars.get(ch);
      if (!existing) continue;
      if (existing.count <= 1) {
        await db.chars.delete(ch);
      } else {
        await db.chars.update(ch, { count: existing.count - 1 });
      }
    }
  });
}

export { db };
