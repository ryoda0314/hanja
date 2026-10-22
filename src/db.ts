// 端末内保存（IndexedDB）の定義と収集ロジック。
// Dexie を使い、Web ブラウザでも Capacitor の WebView でも同じコードで永続化する。
// アカウント不要・オフライン完結（クラウド同期は将来の拡張）。書き出し・読み込みで端末を移せる。

import Dexie, { type EntityTable } from "dexie";
import type { ResolvedWord } from "./data/types";
import { splitHanja } from "./data/dataset";

/** ユーザーが集めた漢字語1件。 */
export interface CollectedWord {
  id: number;
  hangul: string;
  hanja: string;
  /** 日本の新字体表記（字形が異なる場合のみ）。表示は辞書の字から作り直す（jpForm）。 */
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
  /** この漢字を含む語を集めた延べ回数（根の深さ）。 */
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

const STORES = {
  // &[hangul+hanja] で同一語の重複登録を防ぐ。*chars で構成漢字から逆引き可能。
  words: "++id, &[hangul+hanja], hangul, *chars, addedAt",
  chars: "char, count, firstAddedAt, lastAddedAt",
};

db.version(1).stores(STORES);

// v2: 辞書データの互換漢字（年 U+F98E など読み別の重複コード）を統合漢字にそろえたのに合わせ、
// 保存済みの語も NFC にそろえ、重なった語は古い方を残し、字の集計を語から作り直す。
db.version(2)
  .stores(STORES)
  .upgrade(async (tx) => {
    const words = tx.table<CollectedWord, number>("words");
    const kept = new Map<string, CollectedWord>();
    const dropped: number[] = [];
    for (const w of (await words.toArray()).sort((a, b) => a.addedAt - b.addedAt)) {
      const hanja = w.hanja.normalize("NFC");
      const key = `${w.hangul}|${hanja}`;
      if (kept.has(key)) {
        dropped.push(w.id);
        continue;
      }
      kept.set(key, { ...w, hanja, hanjaJp: w.hanjaJp?.normalize("NFC"), chars: splitHanja(hanja) });
    }
    await words.bulkDelete(dropped);
    await words.bulkPut([...kept.values()]);
    const chars = tx.table<CollectedChar, string>("chars");
    await chars.clear();
    await chars.bulkAdd(tallyChars([...kept.values()]));
  });

/** 語の一覧から字ごとの集計（その字が入った語の数・最初と最後の日時）を作る。 */
export function tallyChars(words: Pick<CollectedWord, "chars" | "addedAt">[]): CollectedChar[] {
  const map = new Map<string, CollectedChar>();
  for (const w of words) {
    for (const ch of new Set(w.chars)) {
      const c = map.get(ch);
      if (c) {
        c.count++;
        c.firstAddedAt = Math.min(c.firstAddedAt, w.addedAt);
        c.lastAddedAt = Math.max(c.lastAddedAt, w.addedAt);
      } else {
        map.set(ch, { char: ch, count: 1, firstAddedAt: w.addedAt, lastAddedAt: w.addedAt });
      }
    }
  }
  return [...map.values()];
}

/** 既に同じ語（ハングル+漢字）を登録済みか。 */
export async function hasWord(hangul: string, hanja: string): Promise<boolean> {
  const found = await db.words.get({ hangul, hanja: hanja.normalize("NFC") });
  return found != null;
}

/** 語を1件入れ、構成漢字の集計を進める（トランザクション内で呼ぶ）。同じ語があれば false。 */
async function putWord(
  word: Pick<CollectedWord, "hangul" | "hanja" | "hanjaJp" | "gloss" | "source">,
  at: number
): Promise<boolean> {
  const hanja = word.hanja.normalize("NFC");
  if (await hasWord(word.hangul, hanja)) return false;
  const chars = splitHanja(hanja);
  await db.words.add({
    hangul: word.hangul,
    hanja,
    hanjaJp: word.hanjaJp,
    gloss: word.gloss,
    chars,
    source: word.source,
    addedAt: at,
  } as CollectedWord);

  // 構成漢字ごとに収集状態を更新（重複字は1語につき1回だけ数える）。
  for (const ch of new Set(chars)) {
    const existing = await db.chars.get(ch);
    if (existing) {
      await db.chars.update(ch, {
        count: existing.count + 1,
        firstAddedAt: Math.min(existing.firstAddedAt, at),
        lastAddedAt: Math.max(existing.lastAddedAt, at),
      });
    } else {
      await db.chars.add({ char: ch, count: 1, firstAddedAt: at, lastAddedAt: at });
    }
  }
  return true;
}

/**
 * 解決済みの漢字語を1件追加する。
 * 同時に構成漢字の図鑑収集状態（count / 日時）を更新する。
 * すでに同じ語が存在する場合は false を返す（何もしない）。
 */
export async function addWord(word: ResolvedWord): Promise<boolean> {
  return db.transaction("rw", db.words, db.chars, () => putWord(word, Date.now()));
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

// --- 書き出し・読み込み（端末を移す・消える前に残す） -------------------------

/** 書き出しファイルの1語。字の集計は読み込み時に語から作り直すので持たない。 */
export type BackupWord = Pick<CollectedWord, "hangul" | "hanja" | "gloss" | "source" | "addedAt">;

const BACKUP_APP = "kotonone";

/** 集めた語をすべて、読み込み直せる JSON 文字列にする。 */
export async function exportBackup(): Promise<string> {
  const words = await db.words.orderBy("addedAt").toArray();
  return JSON.stringify(
    {
      app: BACKUP_APP,
      version: 1,
      exportedAt: new Date().toISOString(),
      words: words.map(({ hangul, hanja, gloss, source, addedAt }) => ({ hangul, hanja, gloss, source, addedAt })),
    },
    null,
    1
  );
}

/** 書き出しファイルの中身を読む。形が違えば null（どこも書き換えない）。 */
export function parseBackup(text: string): BackupWord[] | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const { app, words } = data as { app?: unknown; words?: unknown };
  if (app !== BACKUP_APP || !Array.isArray(words)) return null;
  const out: BackupWord[] = [];
  for (const w of words) {
    if (typeof w !== "object" || w === null) return null;
    const { hangul, hanja, gloss, source, addedAt } = w as Record<string, unknown>;
    if (typeof hangul !== "string" || typeof hanja !== "string" || !hangul.trim() || !hanja.trim()) return null;
    out.push({
      hangul: hangul.trim(),
      hanja: hanja.trim(),
      gloss: typeof gloss === "string" ? gloss : "",
      source: source === "seed" || source === "api" || source === "manual" ? source : "manual",
      addedAt: typeof addedAt === "number" && Number.isFinite(addedAt) ? addedAt : Date.now(),
    });
  }
  return out;
}

/** 書き出した語を足す。持っている語はそのまま（上書きしない）。 */
export async function restoreWords(words: BackupWord[]): Promise<{ added: number; skipped: number }> {
  let added = 0;
  await db.transaction("rw", db.words, db.chars, async () => {
    for (const w of [...words].sort((a, b) => a.addedAt - b.addedAt)) {
      if (await putWord(w, w.addedAt)) added++;
    }
  });
  return { added, skipped: words.length - added };
}

export { db };
