// 文で出会う の例文を、ことのあめ の査読済みライブラリから書き出す
// =====================================================================
// 姉妹アプリ ことのあめ の Supabase から、査読を通った文（pl_sentences の status = approved）の韓国語と日本語訳を読み、
// scripts/.cache/sentences.json に書く。そのあと scripts/build-sentences.mjs で印を付ける。
//
// 読むのは公開の値だけ：NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY（ことのあめ がブラウザに配っている鍵。
// 査読済みの文は、この鍵で誰でも読める）。書き込みは一切しない。
// 音声は ことのあめ の公開バケットにある（pl-audio/Kore/ko/<文の SHA-256>.wav、src/lib/audio.ts）。その場所の頭を audioBase として残し、
// アプリは文から場所を求めて鳴らす（無ければ端末の声）。
//
// 実行（ことのね のフォルダで）:
//   node --env-file=<ことのあめ のリポジトリ>/.env.local scripts/export-sentences.mjs
//   node scripts/build-sentences.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, ".cache", "sentences.json");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("\n[!] NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY が要ります（ことのあめ の .env.local を --env-file で渡す）。\n");
  process.exit(1);
}

const PAGE = 1000;
const rows = [];
for (let offset = 0; ; offset += PAGE) {
  const res = await fetch(
    `${url}/rest/v1/pl_sentences?select=key,ko,ja&status=eq.approved&order=key.asc&limit=${PAGE}&offset=${offset}`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) {
    console.error(`[!] 読めませんでした: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const page = await res.json();
  rows.push(...page);
  if (page.length < PAGE) break;
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify({
    exportedAt: new Date().toISOString(),
    audioBase: `${url}/storage/v1/object/public/pl-audio/Kore/ko/`,
    sentences: rows.map((r) => ({ id: r.key, ko: r.ko, ja: r.ja })),
  })
);
console.log(`査読済みの文 ${rows.length} 件 → scripts/.cache/sentences.json`);
