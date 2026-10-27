-- ことのね の使われ方の数（何人が使っているか）。ことのあめ の Supabase（旧アプリとも共有）に、ことのね の表として置く。
-- 名前はすべて kn_ で始める（ことのあめ は pl_、旧アプリの表には触れない）。
--
-- 送られるのは、端末ごとの番号（その端末で作った乱数。人とは結びつかない）と、1時間ごとの回数（開いた・あつめた・読めた）と、
-- ホーム画面から開いたかどうかだけ。集めた語・文・名前・メールは送らない。
-- 表は外から読めず書けず、kn_ping だけがその時間の行を足して数える。
-- まとめは Supabase の中で数える（kn_summary：これまで・きょう・7日・30日の端末の数、kn_stats：日ごと、kn_hourly：時間ごと）。
-- 見るのは Supabase の画面か、ことのね の scripts/usage.mjs（service role で、このまとめだけを読む）。
--
-- 当て方（ことのあめ のリポジトリで。何度当ててもよい）：
--   node --env-file=.env.local scripts/migrate.mjs ../作成したもの/hanjaatume/supabase/usage.sql
-- 2026-10-26 に当てた最初の版（日ごとの kn_days に数える）を、この版で1時間ごと（kn_hours）に切り替える。kn_days の数は
-- そのまま残り、日ごとのまとめに足される。切り替える前の時間ごとの数は無い（日ごとにしか数えていなかった）。
-- 外すとき：drop view public.kn_summary, public.kn_stats, public.kn_hourly; drop function public.kn_ping(uuid, text, boolean);
--           drop table public.kn_hours, public.kn_days;

-- 最初の版の、日ごとの数（2026-10-26 から、この版を当てるまで）。
create table if not exists public.kn_days (
  device uuid not null,
  day date not null,
  opens int not null default 0,
  collects int not null default 0,
  reads int not null default 0,
  standalone boolean not null default false,
  primary key (device, day)
);
alter table public.kn_days enable row level security;
revoke all on table public.kn_days from public, anon, authenticated;

create table if not exists public.kn_hours (
  device uuid not null,
  -- 日本の時刻で、その時間の頭（13:00 なら 13:00〜13:59 の分）
  hour timestamp not null,
  opens int not null default 0,
  collects int not null default 0,
  reads int not null default 0,
  -- その時間に、ホーム画面のアイコンから開いたことがある
  standalone boolean not null default false,
  primary key (device, hour)
);
create index if not exists kn_hours_hour on public.kn_hours (hour);

alter table public.kn_hours enable row level security;
revoke all on table public.kn_hours from public, anon, authenticated;

-- その時間の行に一つ数える。知らない種類は数えない。だれでも呼べるので、1時間の端末の数と回数に天井を付ける
-- （番号を変えて呼び続けられても、表が際限なく大きくならないように）。天井は、話題になった1時間でも届かない高さに。
create or replace function public.kn_ping(p_device uuid, p_kind text, p_standalone boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  this_hour timestamp := date_trunc('hour', now() at time zone 'Asia/Tokyo');
begin
  if p_device is null or p_kind not in ('open', 'collect', 'read') then
    return;
  end if;
  if not exists (select 1 from kn_hours where device = p_device and hour = this_hour)
     and (select count(*) from kn_hours where hour = this_hour) >= 20000 then
    return;
  end if;
  insert into kn_hours as h (device, hour, opens, collects, reads, standalone)
  values (
    p_device,
    this_hour,
    (p_kind = 'open')::int,
    (p_kind = 'collect')::int,
    (p_kind = 'read')::int,
    coalesce(p_standalone, false)
  )
  on conflict (device, hour) do update set
    opens = least(h.opens + excluded.opens, 500),
    collects = least(h.collects + excluded.collects, 500),
    reads = least(h.reads + excluded.reads, 500),
    standalone = h.standalone or excluded.standalone;
end;
$$;

revoke all on function public.kn_ping(uuid, text, boolean) from public;
grant execute on function public.kn_ping(uuid, text, boolean) to anon, authenticated;

-- まとめ。最初の版のまとめ（kn_stats）とは列の型が違うので、消して作り直す（見え方の定義だけで、数は表に残る）。
drop view if exists public.kn_summary;
drop view if exists public.kn_stats;
drop view if exists public.kn_hourly;

-- 時間ごと（日本の時刻）。1時間ごとに数えはじめてからの分だけ。Supabase の画面では新しい順に出る。
create view public.kn_hourly with (security_invoker = true) as
select
  hour,
  count(*) as devices,
  count(*) filter (where standalone) as from_home,
  sum(opens)::bigint as opens,
  sum(collects)::bigint as collects,
  sum(reads)::bigint as reads
from public.kn_hours
group by hour
order by hour desc;

-- 日ごと。端末の数・はじめて来た端末・ホーム画面から開いた端末・回数（日ごとの kn_days と、時間ごとの kn_hours を合わせて）。
create view public.kn_stats with (security_invoker = true) as
with per_day as (
  select device, day, bool_or(standalone) as standalone,
         sum(opens) as opens, sum(collects) as collects, sum(reads) as reads
  from (
    select device, hour::date as day, opens, collects, reads, standalone from public.kn_hours
    union all
    select device, day, opens, collects, reads, standalone from public.kn_days
  ) u
  group by device, day
), firsts as (
  select device, min(day) as first_day from per_day group by device
)
select
  p.day,
  count(*) as devices,
  count(*) filter (where p.day = f.first_day) as new_devices,
  count(*) filter (where p.standalone) as from_home,
  sum(p.opens)::bigint as opens,
  sum(p.collects)::bigint as collects,
  sum(p.reads)::bigint as reads
from per_day p
join firsts f using (device)
group by p.day
order by p.day desc;

-- これまで・きょう・この7日・この30日の端末の数（同じ端末は1台。日本の日付で）。
create view public.kn_summary with (security_invoker = true) as
with u as (
  select device, hour::date as day, standalone from public.kn_hours
  union all
  select device, day, standalone from public.kn_days
), t as (
  select (now() at time zone 'Asia/Tokyo')::date as today
)
select
  count(distinct u.device) as devices_all,
  count(distinct u.device) filter (where u.day = t.today) as devices_today,
  count(distinct u.device) filter (where u.day > t.today - 7) as devices_7d,
  count(distinct u.device) filter (where u.day > t.today - 7 and u.standalone) as from_home_7d,
  count(distinct u.device) filter (where u.day > t.today - 30) as devices_30d,
  count(distinct u.device) filter (where u.day > t.today - 30 and u.standalone) as from_home_30d
from u
cross join t;

revoke all on public.kn_hourly from public, anon, authenticated;
revoke all on public.kn_stats from public, anon, authenticated;
revoke all on public.kn_summary from public, anon, authenticated;

-- 新しい表とまとめを、すぐ scripts/usage.mjs から読めるように（Supabase の API に作り直したことを知らせる）。
notify pgrst, 'reload schema';
