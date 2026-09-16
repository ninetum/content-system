-- ============================================================
-- ระบบบริหารคอนเทนต์ (Content Hub) — โครงสร้างฐานข้อมูล Supabase
-- วิธีใช้: Supabase Dashboard → SQL Editor → วางทั้งไฟล์ → Run
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- เพจ & ช่อง ----------
create table if not exists public.channels (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  platform   text not null default 'facebook',
  handle     text default '',
  followers  integer default 0,
  active     boolean default true,
  note       text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- คลังสไตล์ ----------
create table if not exists public.styles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  emoji      text default '✨',
  tone       text default '',
  audience   text default '',
  cta        text default '',
  prompt     text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- แกลลอรี่ ----------
create table if not exists public.media_assets (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  url        text not null,
  kind       text default 'image',          -- image | video
  tags       text[] default '{}',
  size_kb    integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- คอนเทนต์ ----------
create table if not exists public.contents (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text default '',
  pillar       text default '',
  style_id     uuid references public.styles(id) on delete set null,
  hashtags     text[] default '{}',
  channel_ids  uuid[] default '{}',
  media_ids    uuid[] default '{}',
  status       text default 'draft',        -- draft|pending|approved|scheduled|published|rejected
  scheduled_at timestamptz,
  published_at timestamptz,
  note         text default '',
  author       text default '',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists contents_status_idx    on public.contents (status);
create index if not exists contents_scheduled_idx on public.contents (scheduled_at);

-- ---------- ผลลัพธ์รายโพสต์ ----------
create table if not exists public.content_stats (
  id          uuid primary key default gen_random_uuid(),
  content_id  uuid references public.contents(id) on delete cascade,
  channel_id  uuid references public.channels(id) on delete cascade,
  views       integer default 0,
  likes       integer default 0,
  comments    integer default 0,
  shares      integer default 0,
  clicks      integer default 0,
  recorded_at timestamptz default now(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists stats_content_idx on public.content_stats (content_id);

-- ---------- ประวัติการทำงาน ----------
create table if not exists public.activity_log (
  id         uuid primary key default gen_random_uuid(),
  content_id uuid references public.contents(id) on delete cascade,
  action     text not null,
  actor      text default '',
  note       text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- ใบสั่งงานตัดต่อ (โรงตัดคลิป) ----------
create table if not exists public.edit_jobs (
  id          uuid primary key default gen_random_uuid(),
  content_id  uuid references public.contents(id) on delete set null,
  title       text not null,
  source      text default '',
  aspect      text default '9:16',
  target_sec  integer default 45,
  cut_silence boolean default true,
  silence_ms  integer default 400,
  subtitle    boolean default true,
  sub_style   text default '',
  bilingual   boolean default false,
  bgm         boolean default true,
  bgm_mood    text default '',
  sfx         boolean default true,
  transition  text default '',
  note        text default '',
  status      text default 'รอเริ่มงาน',
  result_url  text default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- Row Level Security — เปิดทุกตาราง (บังคับ)
-- ============================================================
alter table public.channels      enable row level security;
alter table public.styles        enable row level security;
alter table public.media_assets  enable row level security;
alter table public.contents      enable row level security;
alter table public.content_stats enable row level security;
alter table public.activity_log  enable row level security;
alter table public.edit_jobs     enable row level security;

-- นโยบายเริ่มต้น: เฉพาะผู้ใช้ที่ล็อกอินแล้ว (authenticated) เท่านั้นที่เข้าถึงได้
-- ถ้ายังไม่ได้ทำระบบล็อกอิน ให้เปลี่ยน 'authenticated' เป็น 'anon' ชั่วคราว
-- แต่อย่าปล่อยแบบนั้นตอนใช้งานจริง เพราะใครก็แก้ข้อมูลได้
do $$
declare t text;
begin
  foreach t in array array['channels','styles','media_assets','contents','content_stats','activity_log','edit_jobs']
  loop
    execute format('drop policy if exists %I on public.%I;', t || '_rw', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true);',
      t || '_rw', t);
  end loop;
end $$;

-- ============================================================
-- อัปเดต updated_at อัตโนมัติ
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['channels','styles','media_assets','contents','content_stats','activity_log','edit_jobs']
  loop
    execute format('drop trigger if exists %I on public.%I;', t || '_touch', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at();',
      t || '_touch', t);
  end loop;
end $$;
