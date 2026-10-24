// 端末内保存（IndexedDB）の定義と収集ロジック。
// Dexie を使い、Web ブラウザでも Capacitor の WebView でも同じコードで永続化する。
// アカウント不要・オフライン完結（クラウド同期は将来の拡張）。書き出し・読み込みで端末を移せる。

import Dexie, { type EntityTable } from "dexie";
import type { ResolvedWord } from "./data/types";
import { hanjaToWords, splitHanja } from "./data/dataset";
import { metUpdate, readUpdate, type WordProgress } from "./data/stage";

/** ユーザーが集めた漢字語1件。覚え具合の出来事（WordProgress）も持つ（前の版の語には無い）。 */
export interface CollectedWord extends WordProgress {
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
  word: Pick<CollectedWord, "hangul" | "hanja" | "hanjaJp" | "gloss" | "source"> & Omit<WordProgress, "addedAt">,
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
    ...progressOf(word),
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
  const added = await db.transaction("rw", db.words, db.chars, () => putWord(word, Date.now()));
  if (added) void askPersist();
  return added;
}

let persistAsked = false;

/** 集めた語をブラウザに消されにくくするよう頼む（語を集めたときに一度だけ。対応していなければ何もしない）。 */
async function askPersist(): Promise<void> {
  if (persistAsked || typeof navigator === "undefined" || !navigator.storage?.persist) return;
  persistAsked = true;
  try {
    if (!(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* 頼めなくても、集めた語はそのまま */
  }
}

/** 覚え具合の出来事だけを取り出す（数でないものは捨てる）。 */
function progressOf(w: Partial<WordProgress>): Omit<WordProgress, "addedAt"> {
  const out: Omit<WordProgress, "addedAt"> = {};
  for (const k of ["metDays", "lastMetAt", "readDays", "lastReadAt", "missedAt"] as const) {
    const v = w[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/** 辞書から集めた語のうち、意味がいまの辞書と違う語（辞書を作り直して意味が日本語になったときなど）。手で登録した語はそのまま。 */
export function staleGlosses(
  words: Pick<CollectedWord, "id" | "hangul" | "hanja" | "gloss" | "source">[],
  lookup: (w: { hangul: string; hanja: string }) => string | undefined
): { id: number; gloss: string }[] {
  const out: { id: number; gloss: string }[] = [];
  for (const w of words) {
    if (w.source !== "seed") continue;
    const gloss = lookup(w);
    if (gloss && gloss !== w.gloss) out.push({ id: w.id, gloss });
  }
  return out;
}

/** 集めた語の意味を、読み込んだ辞書の意味にそろえる（起動して辞書を読んだあとに一度）。 */
export async function refreshGlosses(): Promise<number> {
  return db.transaction("rw", db.words, async () => {
    const updates = staleGlosses(await db.words.toArray(), (w) =>
      hanjaToWords.get(w.hanja)?.find((d) => d.hangul === w.hangul)?.gloss
    );
    for (const u of updates) await db.words.update(u.id, { gloss: u.gloss });
    return updates.length;
  });
}

/** 文で出会う で、集めた語にまた出会った（集めた日とは別の日に、一日一度だけ数える）。 */
export async function recordMet(keys: { hangul: string; hanja: string }[], at = Date.now()): Promise<void> {
  await db.transaction("rw", db.words, async () => {
    for (const k of keys) {
      const w = await db.words.get({ hangul: k.hangul, hanja: k.hanja.normalize("NFC") });
      const update = w ? metUpdate(w, at) : null;
      if (w && update) await db.words.update(w.id, update);
    }
  });
}

/** 漢字からハングルを読めた（ok）・答えを見た（!ok）。読めた日は一日一度だけ数える。 */
export async function recordRead(key: { hangul: string; hanja: string }, ok: boolean, at = Date.now()): Promise<void> {
  await db.transaction("rw", db.words, async () => {
    const w = await db.words.get({ hangul: key.hangul, hanja: key.hanja.normalize("NFC") });
    if (w) await db.words.update(w.id, readUpdate(w, ok, at));
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

// --- 書き出し・読み込み（端末を移す・消える前に残す） -------------------------

/** 書き出しファイルの1語（覚え具合の出来事も）。字の集計は読み込み時に語から作り直すので持たない。 */
export type BackupWord = Pick<CollectedWord, "hangul" | "hanja" | "gloss" | "source" | "addedAt"> & Omit<WordProgress, "addedAt">;

const BACKUP_APP = "kotonone";

/** 集めた語をすべて、読み込み直せる JSON 文字列にする。 */
export async function exportBackup(): Promise<string> {
  const words = await db.words.orderBy("addedAt").toArray();
  return JSON.stringify(
    {
      app: BACKUP_APP,
      version: 1,
      exportedAt: new Date().toISOString(),
      words: words.map((w) => ({
        hangul: w.hangul,
        hanja: w.hanja,
        gloss: w.gloss,
        source: w.source,
        addedAt: w.addedAt,
        ...progressOf(w),
      })),
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
      ...progressOf(w as Partial<WordProgress>),
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
