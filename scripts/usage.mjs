// ことのね の使われ方を見る（管理者だけ）。数は Supabase の中でまとめたもの（kn_summary・kn_stats・kn_hourly。
// supabase/usage.sql）を、ことのあめ の service role で読む。行そのものは読まない（何千行を並び順の決まらないまま分けて読むと、
// 同じ行を二度読んだり読み落としたりして数がずれる）。
//   node --env-file=../../polylinga/.env.local scripts/usage.mjs [日数=14]        日ごと
//   node --env-file=../../polylinga/.env.local scripts/usage.mjs --hours [日付]     その日の1時間ごと（既定はきょう）
// 人数は「端末の数」で、人の数より多めに出る：同じ人でも、X の中のブラウザ・Safari・ホーム画面のアプリ（iPhone は記録が別）や、
// 別の端末は別に数える。時刻はすべて日本の時刻。
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が要ります（ことのあめ の .env.local を --env-file で）。");
  process.exit(1);
}

/** まとめを一つ読む。読めなければ理由を出して null（まとめがまだ無いときは、当てるものを案内する）。 */
async function get(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (res.ok) return res.json();
  const body = await res.text();
  console.error(`読めませんでした（${res.status}）：${body.slice(0, 200)}`);
  if (res.status === 404) console.error("まとめがまだ無いようです。supabase/usage.sql を当ててください（README の「使われ方の数」）。");
  process.exitCode = 1;
  return null;
}

const args = process.argv.slice(2);
const hourly = args.includes("--hours");
const rest = args.filter((a) => a !== "--hours");
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // 日本の日付
const shift = (day, n) => new Date(Date.parse(day) + n * 86400e3).toISOString().slice(0, 10);
const pad = (v, n) => String(v ?? 0).padStart(n);

if (hourly) {
  const day = rest[0] ?? today;
  const rows = await get(`kn_hourly?hour=gte.${day}T00:00:00&hour=lt.${shift(day, 1)}T00:00:00&order=hour.asc`);
  if (rows) {
    const at = new Map(rows.map((r) => [Number(r.hour.slice(11, 13)), r]));
    console.log(`ことのね の ${day} の1時間ごと（日本の時刻・人数は端末の数）\n`);
    console.log("  時     端末  ホーム画面から  開いた  あつめた  読めた");
    for (let h = 0; h < 24; h++) {
      const r = at.get(h) ?? {};
      console.log(`  ${pad(h, 2)}:00  ${pad(r.devices, 4)}  ${pad(r.from_home, 14)}  ${pad(r.opens, 6)}  ${pad(r.collects, 8)}  ${pad(r.reads, 6)}`);
    }
    console.log("\n  1時間ごとに数えはじめる前の時間は 0 と出ます（その分は日ごとの数にだけ入っています）。");
  }
} else {
  const days = Number(rest[0] ?? 14);
  const [summary] = (await get("kn_summary")) ?? [];
  const rows = await get(`kn_stats?day=gt.${shift(today, -days)}&order=day.asc`);
  if (summary && rows) {
    console.log(`ことのね の使われ方（${today} まで・人数は端末の数）\n`);
    console.log(`  これまでに使った端末  ${summary.devices_all}`);
    console.log(`  きょう                ${summary.devices_today}`);
    console.log(`  この7日               ${summary.devices_7d}（ホーム画面から ${summary.from_home_7d}）`);
    console.log(`  この30日              ${summary.devices_30d}（ホーム画面から ${summary.from_home_30d}）\n`);
    console.log("  日付        端末  はじめて  ホーム画面から  開いた  あつめた  読めた");
    const at = new Map(rows.map((r) => [r.day, r]));
    for (let i = days - 1; i >= 0; i--) {
      const day = shift(today, -i);
      const r = at.get(day) ?? {};
      console.log(`  ${day}  ${pad(r.devices, 4)}  ${pad(r.new_devices, 8)}  ${pad(r.from_home, 14)}  ${pad(r.opens, 6)}  ${pad(r.collects, 8)}  ${pad(r.reads, 6)}`);
    }
  }
}
