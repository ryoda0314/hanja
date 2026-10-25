-- ことのね の使われ方の数（何人が使っているか）。ことのあめ の Supabase（旧アプリとも共有）に、ことのね の表として置く。
-- 名前はすべて kn_ で始める（ことのあめ は pl_、旧アプリの表には触れない）。
--
-- 送られるのは、端末ごとの番号（その端末で作った乱数。人とは結びつかない）と、日ごとの回数（開いた・あつめた・読めた）と、
-- ホーム画面から開いたかどうかだけ。集めた語・文・名前・メールは送らない。
-- 表は外から読めず書けず、kn_ping だけが今日の行を足して数える。見るのは Supabase の画面（kn_stats）か
-- ことのね の scripts/usage.mjs（service role で読む）。
--
-- 当て方（ことのあめ のリポジトリで）：
--   node --env-file=.env.local scripts/migrate.mjs ../作成したもの/hanjaatume/supabase/usage.sql
-- 外すとき：drop view public.kn_stats; drop function public.kn_ping(uuid, text, boolean); drop table public.kn_days;

create table if not exists public.kn_days (
  device uuid not null,
  day date not null,
  opens int not null default 0,
  collects int not null default 0,
  reads int not null default 0,
  -- その日、ホーム画面のアイコンから開いたことがある
  standalone boolean not null default false,
  primary key (device, day)
);
create index if not exists kn_days_day on public.kn_days (day);

alter table public.kn_days enable row level security;
revoke all on table public.kn_days from public, anon, authenticated;

-- 今日の行に一つ数える。知らない種類は数えない。だれでも呼べるので、一日の端末の数と回数に天井を付ける
-- （番号を変えて呼び続けられても、表が際限なく大きくならないように）。
create or replace function public.kn_ping(p_device uuid, p_kind text, p_standalone boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  if p_device is null or p_kind not in ('open', 'collect', 'read') then
    return;
  end if;
  if not exists (select 1 from kn_days where device = p_device and day = today)
     and (select count(*) from kn_days where day = today) >= 20000 then
    return;
  end if;
  insert into kn_days as d (device, day, opens, collects, reads, standalone)
  values (
    p_device,
    today,
    (p_kind = 'open')::int,
    (p_kind = 'collect')::int,
    (p_kind = 'read')::int,
    coalesce(p_standalone, false)
  )
  on conflict (device, day) do update set
    opens = least(d.opens + excluded.opens, 1000),
    collects = least(d.collects + excluded.collects, 1000),
    reads = least(d.reads + excluded.reads, 1000),
    standalone = d.standalone or excluded.standalone;
end;
$$;

revoke all on function public.kn_ping(uuid, text, boolean) from public;
grant execute on function public.kn_ping(uuid, text, boolean) to anon, authenticated;

-- 日ごとのまとめ（Supabase の画面の Table Editor で見る）。端末の数・はじめて来た端末・ホーム画面から開いた端末・回数。
create or replace view public.kn_stats with (security_invoker = true) as
select
  day,
  count(*) as devices,
  count(*) filter (where day = first_day) as new_devices,
  count(*) filter (where standalone) as from_home,
  sum(opens) as opens,
  sum(collects) as collects,
  sum(reads) as reads
from (select *, min(day) over (partition by device) as first_day from public.kn_days) d
group by day
order by day desc;

revoke all on public.kn_stats from public, anon, authenticated;
