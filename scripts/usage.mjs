// ことのね の使われ方を見る（管理者だけ。ことのあめ の Supabase の kn_days を service role で読む。supabase/usage.sql）。
//   node --env-file=../../polylinga/.env.local scripts/usage.mjs [日数=14]
// 人数は「端末の数」。同じ人でも、Safari と ホーム画面のアプリ（iPhone は記録が別）や、別の端末は別に数える。
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が要ります（ことのあめ の .env.local を --env-file で）。");
  process.exit(1);
}
const days = Number(process.argv[2] ?? 14);

const rows = [];
for (let from = 0; ; from += 1000) {
  const res = await fetch(`${url}/rest/v1/kn_days?select=device,day,opens,collects,reads,standalone&order=day.asc`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` },
  });
  if (!res.ok) {
    console.error(`読めませんでした（${res.status}）：${(await res.text()).slice(0, 200)}`);
    process.exit(1);
  }
  const page = await res.json();
  rows.push(...page);
  if (page.length < 1000) break;
}

const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // 日本の日付
const shift = (day, n) => new Date(Date.parse(day) + n * 86400e3).toISOString().slice(0, 10);
const first = new Map();
for (const r of rows) if (!first.has(r.device)) first.set(r.device, r.day);
const active = (n) => new Set(rows.filter((r) => r.day > shift(today, -n)).map((r) => r.device)).size;
const home = (n) => new Set(rows.filter((r) => r.day > shift(today, -n) && r.standalone).map((r) => r.device)).size;

console.log(`ことのね の使われ方（${today} まで・人数は端末の数）\n`);
console.log(`  これまでに使った端末  ${first.size}`);
console.log(`  きょう                ${active(1)}`);
console.log(`  この7日               ${active(7)}（ホーム画面から ${home(7)}）`);
console.log(`  この30日              ${active(30)}（ホーム画面から ${home(30)}）\n`);
console.log("  日付        端末  はじめて  ホーム画面から  開いた  あつめた  読めた");
for (let i = days - 1; i >= 0; i--) {
  const day = shift(today, -i);
  const list = rows.filter((r) => r.day === day);
  const sum = (k) => list.reduce((a, r) => a + r[k], 0);
  const fresh = list.filter((r) => first.get(r.device) === day).length;
  const pad = (v, n) => String(v).padStart(n);
  console.log(
    `  ${day}  ${pad(list.length, 4)}  ${pad(fresh, 8)}  ${pad(list.filter((r) => r.standalone).length, 14)}  ${pad(sum("opens"), 6)}  ${pad(sum("collects"), 8)}  ${pad(sum("reads"), 6)}`
  );
}
