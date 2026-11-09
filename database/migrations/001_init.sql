-- ============================================================================
-- CALORIA — initial schema for Supabase PostgreSQL
-- Run this file in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run: tables/indexes use IF NOT EXISTS, policies use guards.
-- ============================================================================

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  username text,
  first_name text,
  last_name text,
  photo_url text,
  age integer check (age is null or age between 14 and 100),
  height numeric(5,1) check (height is null or height between 100 and 250),
  weight numeric(5,1) check (weight is null or weight between 30 and 300),
  target_weight numeric(5,1) check (target_weight is null or target_weight between 30 and 300),
  sex text check (sex is null or sex in ('male','female','other')),
  activity_level text check (
    activity_level is null or activity_level in ('sedentary','light','moderate','active','very_active')
  ),
  goal text check (goal is null or goal in ('lose','maintain','gain')),
  timezone text not null default 'Asia/Omsk',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_telegram_id_idx on public.users (telegram_id);

-- ---------------------------------------------------------------------------
-- FOOD PRODUCTS
-- ---------------------------------------------------------------------------
create table if not exists public.food_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_normalized text not null,
  search_text text not null default '',
  calories numeric(7,2) not null default 0 check (calories >= 0 and calories <= 2000),
  protein numeric(6,2) not null default 0 check (protein >= 0 and protein <= 100),
  fat numeric(6,2) not null default 0 check (fat >= 0 and fat <= 100),
  carbohydrates numeric(6,2) not null default 0 check (carbohydrates >= 0 and carbohydrates <= 100),
  source text not null default 'reference',
  source_id text,
  category text not null default 'Прочее',
  emoji text not null default '🍽️',
  aliases text[] not null default '{}',
  default_serving_grams numeric(6,1) not null default 100,
  piece_grams numeric(6,1),
  usage_count integer not null default 0,
  created_by uuid references public.users(id) on delete cascade,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (piece_grams is null or piece_grams > 0),
  check (default_serving_grams > 0)
);

create index if not exists food_products_name_trgm_idx
  on public.food_products using gin (name_normalized gin_trgm_ops);
create index if not exists food_products_search_trgm_idx
  on public.food_products using gin (search_text gin_trgm_ops);
create index if not exists food_products_public_idx
  on public.food_products (is_public, usage_count desc);
create index if not exists food_products_created_by_idx
  on public.food_products (created_by) where created_by is not null;
create unique index if not exists food_products_source_uq
  on public.food_products (source, source_id) where source_id is not null;
create unique index if not exists food_products_public_name_uq
  on public.food_products (name_normalized) where created_by is null;

-- ---------------------------------------------------------------------------
-- FOOD ENTRIES (diary)
-- ---------------------------------------------------------------------------
create table if not exists public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid references public.food_products(id) on delete set null,
  product_name_snapshot text not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  amount_grams numeric(7,1) not null check (amount_grams > 0 and amount_grams <= 5000),
  calories numeric(8,1) not null default 0 check (calories >= 0),
  protein numeric(7,1) not null default 0 check (protein >= 0),
  fat numeric(7,1) not null default 0 check (fat >= 0),
  carbohydrates numeric(7,1) not null default 0 check (carbohydrates >= 0),
  consumed_at timestamptz not null,
  entry_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists food_entries_user_date_idx
  on public.food_entries (user_id, entry_date desc);
create index if not exists food_entries_user_consumed_idx
  on public.food_entries (user_id, consumed_at desc);
create index if not exists food_entries_product_idx
  on public.food_entries (product_id) where product_id is not null;

-- ---------------------------------------------------------------------------
-- WEIGHT HISTORY
-- ---------------------------------------------------------------------------
create table if not exists public.weight_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  weight numeric(5,1) not null check (weight between 20 and 400),
  recorded_on date not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, recorded_on)
);

create index if not exists weight_history_user_date_idx
  on public.weight_history (user_id, recorded_on desc);

-- ---------------------------------------------------------------------------
-- BODY MEASUREMENTS
-- ---------------------------------------------------------------------------
create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  recorded_on date not null,
  waist numeric(5,1) check (waist is null or waist between 20 and 300),
  hips numeric(5,1) check (hips is null or hips between 20 and 300),
  chest numeric(5,1) check (chest is null or chest between 20 and 300),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, recorded_on)
);

create index if not exists body_measurements_user_date_idx
  on public.body_measurements (user_id, recorded_on desc);

-- ---------------------------------------------------------------------------
-- PROGRESS PHOTOS (optional, compressed data URL)
-- ---------------------------------------------------------------------------
create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  recorded_on date not null,
  data_url text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists progress_photos_user_date_idx
  on public.progress_photos (user_id, recorded_on desc);

-- ---------------------------------------------------------------------------
-- GOALS
-- ---------------------------------------------------------------------------
create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  calories integer not null check (calories between 1000 and 6000),
  protein numeric(6,1) not null check (protein between 0 and 500),
  fat numeric(6,1) not null check (fat between 0 and 300),
  carbohydrates numeric(6,1) not null check (carbohydrates between 0 and 1000),
  water_ml integer not null default 2000 check (water_ml between 500 and 8000),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- REMINDER SETTINGS
-- ---------------------------------------------------------------------------
create table if not exists public.reminder_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  reminders_enabled boolean not null default true,
  morning_enabled boolean not null default true,
  breakfast_enabled boolean not null default true,
  lunch_enabled boolean not null default true,
  dinner_enabled boolean not null default true,
  evening_enabled boolean not null default true,
  water_enabled boolean not null default false,
  morning_time time not null default '09:00',
  breakfast_time time not null default '10:00',
  lunch_time time not null default '13:30',
  dinner_time time not null default '19:00',
  evening_time time not null default '21:00',
  quiet_start time not null default '22:00',
  quiet_end time not null default '08:00',
  water_interval_hours integer not null default 3 check (water_interval_hours between 1 and 12),
  timezone text not null default 'Asia/Omsk',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reminder_settings_enabled_idx
  on public.reminder_settings (reminders_enabled) where reminders_enabled = true;

-- ---------------------------------------------------------------------------
-- NOTIFICATION LOGS (at-most-once delivery)
-- ---------------------------------------------------------------------------
create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  notification_type text not null check (
    notification_type in ('morning','breakfast','lunch','dinner','evening','water','summary')
  ),
  dedupe_key text not null,
  scheduled_at timestamptz,
  sent_at timestamptz,
  status text not null default 'sent' check (status in ('sent','failed','skipped')),
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists notification_logs_user_created_idx
  on public.notification_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- WATER LOGS
-- ---------------------------------------------------------------------------
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  log_date date not null,
  amount_ml integer not null default 0 check (amount_ml between 0 and 10000),
  goal_ml integer not null default 2000 check (goal_ml between 500 and 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index if not exists water_logs_user_date_idx
  on public.water_logs (user_id, log_date desc);

-- ---------------------------------------------------------------------------
-- FAVORITES
-- ---------------------------------------------------------------------------
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.food_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists favorites_user_idx on public.favorites (user_id);

-- ---------------------------------------------------------------------------
-- BOT PENDING ENTRIES (explicit confirmation before saving)
-- ---------------------------------------------------------------------------
create table if not exists public.bot_pending_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists bot_pending_entries_expires_idx
  on public.bot_pending_entries (expires_at);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users','food_products','food_entries','weight_history',
    'body_measurements','user_goals','reminder_settings','water_logs'
  ] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name, table_name
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Default reminder settings on user creation
-- ---------------------------------------------------------------------------
create or replace function public.create_default_reminders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.reminder_settings (user_id, timezone)
  values (new.id, coalesce(new.timezone, 'Asia/Omsk'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists users_create_default_reminders on public.users;
create trigger users_create_default_reminders
after insert on public.users
for each row execute function public.create_default_reminders();

-- ---------------------------------------------------------------------------
-- Denormalized food usage counter (non-critical, called by backend)
-- ---------------------------------------------------------------------------
create or replace function public.increment_food_usage(food_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.food_products
  set usage_count = usage_count + 1
  where id = any(food_ids);
$$;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- The Mini App never talks to Supabase directly: all queries go through the
-- backend with the service_role key (which bypasses RLS). Deny-by-default RLS
-- protects user rows if an anon key is ever exposed. Public food rows are
-- readable, but only the backend can write.
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.food_products enable row level security;
alter table public.food_entries enable row level security;
alter table public.weight_history enable row level security;
alter table public.body_measurements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.user_goals enable row level security;
alter table public.reminder_settings enable row level security;
alter table public.notification_logs enable row level security;
alter table public.water_logs enable row level security;
alter table public.favorites enable row level security;
alter table public.bot_pending_entries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'food_products'
      and policyname = 'food_products_public_read'
  ) then
    create policy food_products_public_read
      on public.food_products for select
      to anon, authenticated
      using (is_public = true);
  end if;
end;
$$;

revoke all on public.users from anon, authenticated;
revoke all on public.food_entries from anon, authenticated;
revoke all on public.weight_history from anon, authenticated;
revoke all on public.body_measurements from anon, authenticated;
revoke all on public.progress_photos from anon, authenticated;
revoke all on public.user_goals from anon, authenticated;
revoke all on public.reminder_settings from anon, authenticated;
revoke all on public.notification_logs from anon, authenticated;
revoke all on public.water_logs from anon, authenticated;
revoke all on public.favorites from anon, authenticated;
revoke all on public.bot_pending_entries from anon, authenticated;
