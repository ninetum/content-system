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
returns trigger language plpgsql
set search_path = ''          -- ล็อก search_path กันการสวม schema (ตาม security linter ของ Supabase)
as $$
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

-- ============================================================
-- โทเคนสำหรับโพสต์ผ่าน API (Facebook / Instagram / LINE ฯลฯ)
-- ============================================================
-- ตารางนี้ "ไม่มี policy" โดยตั้งใจ — เปิด RLS ไว้แต่ไม่สร้าง policy ใด ๆ
-- ผลคือหน้าเว็บ (anon/authenticated) อ่านไม่ได้เลยแม้แต่แถวเดียว
-- มีเพียง service_role (ที่อยู่ใน Edge Function ฝั่งเซิร์ฟเวอร์) เท่านั้นที่เข้าถึงได้
create table if not exists public.channel_credentials (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid references public.channels(id) on delete cascade,
  platform    text not null,                 -- facebook | instagram | line
  external_id text not null,                 -- Page ID / IG User ID / LINE channel id
  access_token text not null,
  expires_at  timestamptz,                   -- page token แบบไม่หมดอายุให้เว้นว่าง
  note        text default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.channel_credentials enable row level security;
-- ไม่สร้าง policy โดยเจตนา = หน้าเว็บอ่านไม่ได้

drop trigger if exists channel_credentials_touch on public.channel_credentials;
create trigger channel_credentials_touch before update on public.channel_credentials
  for each row execute function public.touch_updated_at();

-- เก็บผลการยิง API ไว้ตรวจย้อนหลัง (โพสต์สำเร็จ/ล้มเหลว เพราะอะไร)
create table if not exists public.publish_results (
  id           uuid primary key default gen_random_uuid(),
  content_id   uuid references public.contents(id) on delete cascade,
  channel_id   uuid references public.channels(id) on delete set null,
  platform     text default '',
  ok           boolean default false,
  external_post_id text default '',
  error        text default '',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table public.publish_results enable row level security;
drop policy if exists publish_results_read on public.publish_results;
create policy publish_results_read on public.publish_results
  for select to authenticated using (true);
-- เขียนได้เฉพาะ service_role (Edge Function) เท่านั้น

drop trigger if exists publish_results_touch on public.publish_results;
create trigger publish_results_touch before update on public.publish_results
  for each row execute function public.touch_updated_at();

-- ============================================================
-- คอลัมน์เพิ่มสำหรับ worker ตัดต่อบนเครื่อง (รันซ้ำได้ ไม่พัง)
-- ============================================================
alter table public.edit_jobs add column if not exists error       text default '';
alter table public.edit_jobs add column if not exists claimed_at  timestamptz;
alter table public.edit_jobs add column if not exists finished_at timestamptz;
alter table public.edit_jobs add column if not exists worker      text default '';
alter table public.edit_jobs add column if not exists log_tail    text default '';

create index if not exists edit_jobs_status_idx on public.edit_jobs (status);

-- ============================================================
-- สินค้า / ลิงก์ติดตามผล / ยอดขาย — ส่วนที่ทำให้วัดเป็น "เงิน" ได้
-- ============================================================

create table if not exists public.products (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sku        text default '',
  price      numeric(12,2) default 0,      -- ราคาขาย
  cost       numeric(12,2) default 0,      -- ต้นทุน (ไว้คิดกำไร)
  url        text default '',              -- ลิงก์หน้าสินค้า/ร้าน
  image_url  text default '',
  active     boolean default true,
  note       text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- คอนเทนต์ชิ้นนี้ขายสินค้าตัวไหนบ้าง
alter table public.contents add column if not exists product_ids uuid[] default '{}';

-- ลิงก์สั้นติดตามผล: 1 โพสต์ x 1 ช่อง = 1 ลิงก์ จะได้รู้ว่าคลิกมาจากไหน
create table if not exists public.tracked_links (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,          -- ตัวย่อในลิงก์ เช่น a7xk2p
  content_id uuid references public.contents(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  target_url text not null,                 -- ปลายทางจริงที่จะพาไป
  label      text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tracked_links_code_idx    on public.tracked_links (code);
create index if not exists tracked_links_content_idx on public.tracked_links (content_id);

-- ทุกครั้งที่มีคนกดลิงก์ บันทึก 1 แถว (ไม่เก็บ IP — เก็บแค่ที่มาและชนิดเครื่อง)
create table if not exists public.link_clicks (
  id         uuid primary key default gen_random_uuid(),
  link_id    uuid references public.tracked_links(id) on delete cascade,
  referer    text default '',
  user_agent text default '',
  created_at timestamptz default now()
);

create index if not exists link_clicks_link_idx on public.link_clicks (link_id);

-- ยอดขายที่เกิดจากคอนเทนต์ (กรอกเอง หรือให้ระบบอื่นยิงเข้ามาทีหลัง)
create table if not exists public.sales (
  id          uuid primary key default gen_random_uuid(),
  content_id  uuid references public.contents(id) on delete set null,
  channel_id  uuid references public.channels(id) on delete set null,
  product_id  uuid references public.products(id) on delete set null,
  qty         integer default 1,
  amount      numeric(12,2) default 0,      -- ยอดขายรวม
  cost_amount numeric(12,2) default 0,      -- ต้นทุนรวม
  ad_spend    numeric(12,2) default 0,      -- ค่าแอดที่ลงไปกับคอนเทนต์นี้
  source      text default 'กรอกเอง',
  note        text default '',
  sold_at     timestamptz default now(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists sales_content_idx on public.sales (content_id);

-- ---------- RLS ----------
alter table public.products      enable row level security;
alter table public.tracked_links enable row level security;
alter table public.link_clicks   enable row level security;
alter table public.sales         enable row level security;

do $$
declare t text;
begin
  foreach t in array array['products','tracked_links','sales']
  loop
    execute format('drop policy if exists %I on public.%I;', t || '_rw', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true);',
      t || '_rw', t);
  end loop;
end $$;

-- คลิก: หน้าเว็บอ่านได้ (ไว้ทำรายงาน) แต่เขียนได้เฉพาะ service_role ที่อยู่ใน Edge Function
drop policy if exists link_clicks_read on public.link_clicks;
create policy link_clicks_read on public.link_clicks for select to authenticated using (true);

do $$
declare t text;
begin
  foreach t in array array['products','tracked_links','link_clicks','sales']
  loop
    execute format('drop trigger if exists %I on public.%I;', t || '_touch', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at();',
      t || '_touch', t);
  end loop;
end $$;
