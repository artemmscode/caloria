-- ============================================================================
-- CALORIA — full database setup for Supabase SQL Editor.
-- Generated from database/migrations/*.sql. Run this file once.
-- Safe to re-run: tables/indexes use IF NOT EXISTS and seeds use ON CONFLICT.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 001_init.sql
-- ----------------------------------------------------------------------------

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
  timezone text not null default 'Europe/Moscow',
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
  timezone text not null default 'Europe/Moscow',
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
  values (new.id, coalesce(new.timezone, 'Europe/Moscow'))
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


-- ----------------------------------------------------------------------------
-- 002_seed_foods.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- CALORIA — curated reference food database (values per 100 g)
-- Generated from backend/src/database/seedFoods.js
-- Values are rounded public reference data, not brand-specific exact values.
-- Re-run safely: duplicates are ignored.
-- ============================================================================

insert into public.food_products (
  name, name_normalized, search_text, calories, protein, fat, carbohydrates,
  source, source_id, category, emoji, aliases, default_serving_grams, piece_grams, is_public
) values
  ('Банан', 'банан', 'банан бананы бананчик', 89, 1.1, 0.3, 22.8, 'reference', 'ref-банан', 'Фрукты', '🍌', array['бананы', 'бананчик']::text[], 120, 120, true),
  ('Яблоко', 'яблоко', 'яблоко яблоки яблочко', 52, 0.3, 0.2, 13.8, 'reference', 'ref-яблоко', 'Фрукты', '🍎', array['яблоки', 'яблочко']::text[], 180, 180, true),
  ('Апельсин', 'апельсин', 'апельсин апельсины', 47, 0.9, 0.1, 11.8, 'reference', 'ref-апельсин', 'Фрукты', '🍊', array['апельсины']::text[], 150, 150, true),
  ('Груша', 'груша', 'груша груши', 57, 0.4, 0.1, 15.2, 'reference', 'ref-груша', 'Фрукты', '🍐', array['груши']::text[], 170, 170, true),
  ('Клубника', 'клубника', 'клубника земляника', 32, 0.7, 0.3, 7.7, 'reference', 'ref-клубника', 'Фрукты', '🍓', array['земляника']::text[], 100, null, true),
  ('Виноград', 'виноград', 'виноград', 69, 0.7, 0.2, 18.1, 'reference', 'ref-виноград', 'Фрукты', '🍇', '{}'::text[], 100, null, true),
  ('Киви', 'киви', 'киви', 61, 1.1, 0.5, 14.7, 'reference', 'ref-киви', 'Фрукты', '🥝', '{}'::text[], 90, 90, true),
  ('Черника', 'черника', 'черника', 57, 0.7, 0.3, 14.5, 'reference', 'ref-черника', 'Фрукты', '🫐', '{}'::text[], 100, null, true),
  ('Арбуз', 'арбуз', 'арбуз', 30, 0.6, 0.2, 7.6, 'reference', 'ref-арбуз', 'Фрукты', '🍉', '{}'::text[], 100, null, true),
  ('Авокадо', 'авокадо', 'авокадо авокады', 160, 2, 14.7, 8.5, 'reference', 'ref-авокадо', 'Фрукты', '🥑', array['авокады']::text[], 150, 150, true),
  ('Огурец', 'огурец', 'огурец огурцы', 15, 0.7, 0.1, 3.6, 'reference', 'ref-огурец', 'Овощи', '🥒', array['огурцы']::text[], 100, 120, true),
  ('Помидор', 'помидор', 'помидор томат томаты помидоры', 18, 0.9, 0.2, 3.9, 'reference', 'ref-помидор', 'Овощи', '🍅', array['томат', 'томаты', 'помидоры']::text[], 100, 110, true),
  ('Морковь', 'морковь', 'морковь морковка', 41, 0.9, 0.2, 9.6, 'reference', 'ref-морковь', 'Овощи', '🥕', array['морковка']::text[], 80, 80, true),
  ('Брокколи', 'брокколи', 'брокколи брокколи', 34, 2.8, 0.4, 6.6, 'reference', 'ref-брокколи', 'Овощи', '🥦', array['брокколи']::text[], 100, null, true),
  ('Кабачок', 'кабачок', 'кабачок кабачки цукини', 17, 1.2, 0.3, 3.1, 'reference', 'ref-кабачок', 'Овощи', '🥒', array['кабачки', 'цукини']::text[], 100, null, true),
  ('Перец болгарский', 'перец болгарский', 'перец болгарский перец сладкий перец перцы', 31, 1, 0.3, 6, 'reference', 'ref-перец-болгарский', 'Овощи', '🫑', array['перец', 'сладкий перец', 'перцы']::text[], 120, 120, true),
  ('Капуста белокочанная', 'капуста белокочанная', 'капуста белокочанная капуста', 25, 1.3, 0.1, 5.8, 'reference', 'ref-капуста-белокочанная', 'Овощи', '🥬', array['капуста']::text[], 100, null, true),
  ('Картофель отварной', 'картофель отварной', 'картофель отварной картошка картофель', 87, 2, 0.1, 20.1, 'reference', 'ref-картофель-отварной', 'Овощи', '🥔', array['картошка', 'картофель']::text[], 150, 150, true),
  ('Шпинат', 'шпинат', 'шпинат шпинат', 23, 2.9, 0.4, 3.6, 'reference', 'ref-шпинат', 'Овощи', '🥬', array['шпинат']::text[], 100, null, true),
  ('Свёкла отварная', 'свекла отварная', 'свекла отварная свекла свекла', 44, 1.7, 0.2, 9.6, 'reference', 'ref-свёкла-отварная', 'Овощи', '🍠', array['свекла', 'свёкла']::text[], 100, null, true),
  ('Рис отварной', 'рис отварной', 'рис отварной рис', 130, 2.7, 0.3, 28.2, 'reference', 'ref-рис-отварной', 'Крупы', '🍚', array['рис']::text[], 150, null, true),
  ('Гречка отварная', 'гречка отварная', 'гречка отварная гречка гречневая каша', 110, 4.2, 1.1, 21.3, 'reference', 'ref-гречка-отварная', 'Крупы', '🍚', array['гречка', 'гречневая каша']::text[], 150, null, true),
  ('Овсянка на воде', 'овсянка на воде', 'овсянка на воде овсянка овсяная каша геркулес', 88, 3, 1.5, 15, 'reference', 'ref-овсянка-на-воде', 'Крупы', '🥣', array['овсянка', 'овсяная каша', 'геркулес']::text[], 200, null, true),
  ('Паста отварная', 'паста отварная', 'паста отварная макароны паста спагетти', 158, 5.8, 0.9, 30.9, 'reference', 'ref-паста-отварная', 'Крупы', '🍝', array['макароны', 'паста', 'спагетти']::text[], 180, null, true),
  ('Хлеб пшеничный', 'хлеб пшеничный', 'хлеб пшеничный хлеб белый хлеб батон', 265, 9, 3.2, 49, 'reference', 'ref-хлеб-пшеничный', 'Хлеб', '🍞', array['хлеб', 'белый хлеб', 'батон']::text[], 30, 30, true),
  ('Хлеб ржаной', 'хлеб ржаной', 'хлеб ржаной черный хлеб черный хлеб ржаной', 250, 8.5, 3.3, 48, 'reference', 'ref-хлеб-ржаной', 'Хлеб', '🍞', array['чёрный хлеб', 'черный хлеб', 'ржаной']::text[], 30, 30, true),
  ('Мюсли без сахара', 'мюсли без сахара', 'мюсли без сахара мюсли гранола', 360, 10, 7, 64, 'reference', 'ref-мюсли-без-сахара', 'Крупы', '🥣', array['мюсли', 'гранола']::text[], 100, null, true),
  ('Кукуруза отварная', 'кукуруза отварная', 'кукуруза отварная кукуруза', 96, 3.4, 1.5, 21, 'reference', 'ref-кукуруза-отварная', 'Овощи', '🌽', array['кукуруза']::text[], 120, null, true),
  ('Яйцо куриное', 'яйцо куриное', 'яйцо куриное яйцо яйца яиц яичко', 155, 12.6, 10.6, 1.1, 'reference', 'ref-яйцо-куриное', 'Белок', '🥚', array['яйцо', 'яйца', 'яиц', 'яичко']::text[], 55, 55, true),
  ('Куриная грудка отварная', 'куриная грудка отварная', 'куриная грудка отварная курица куриная грудка куриное филе грудка', 165, 31, 3.6, 0, 'reference', 'ref-куриная-грудка-отварная', 'Белок', '🍗', array['курица', 'куриная грудка', 'куриное филе', 'грудка']::text[], 150, null, true),
  ('Куриное бедро', 'куриное бедро', 'куриное бедро бедро куриное бедро', 209, 26, 10.9, 0, 'reference', 'ref-куриное-бедро', 'Белок', '🍗', array['бедро', 'куриное бедро']::text[], 150, null, true),
  ('Индейка филе', 'индейка филе', 'индейка филе индейка филе индейки', 135, 29, 1.8, 0, 'reference', 'ref-индейка-филе', 'Белок', '🦃', array['индейка', 'филе индейки']::text[], 150, null, true),
  ('Говядина тушёная', 'говядина тушеная', 'говядина тушеная говядина мясо', 250, 26, 15, 0, 'reference', 'ref-говядина-тушёная', 'Белок', '🥩', array['говядина', 'мясо']::text[], 150, null, true),
  ('Лосось', 'лосось', 'лосось семга семга лосось красная рыба', 208, 20, 13, 0, 'reference', 'ref-лосось', 'Рыба', '🐟', array['семга', 'сёмга', 'лосось', 'красная рыба']::text[], 150, null, true),
  ('Тунец консервированный', 'тунец консервированный', 'тунец консервированный тунец', 116, 25.5, 0.8, 0, 'reference', 'ref-тунец-консервированный', 'Рыба', '🐟', array['тунец']::text[], 100, null, true),
  ('Треска', 'треска', 'треска треска белая рыба', 82, 18, 0.7, 0, 'reference', 'ref-треска', 'Рыба', '🐟', array['треска', 'белая рыба']::text[], 150, null, true),
  ('Креветки', 'креветки', 'креветки креветка креветки', 99, 24, 0.3, 0.2, 'reference', 'ref-креветки', 'Рыба', '🦐', array['креветка', 'креветки']::text[], 100, null, true),
  ('Тофу', 'тофу', 'тофу тофу соевый творог', 76, 8, 4.8, 1.9, 'reference', 'ref-тофу', 'Белок', '🧊', array['тофу', 'соевый творог']::text[], 150, null, true),
  ('Фасоль отварная', 'фасоль отварная', 'фасоль отварная фасоль красная фасоль', 127, 8.7, 0.5, 22.8, 'reference', 'ref-фасоль-отварная', 'Белок', '🫘', array['фасоль', 'красная фасоль']::text[], 150, null, true),
  ('Чечевица отварная', 'чечевица отварная', 'чечевица отварная чечевица', 116, 9, 0.4, 20, 'reference', 'ref-чечевица-отварная', 'Белок', '🫘', array['чечевица']::text[], 150, null, true),
  ('Нут отварной', 'нут отварной', 'нут отварной нут турецкий горох', 164, 8.9, 2.6, 27.4, 'reference', 'ref-нут-отварной', 'Белок', '🫘', array['нут', 'турецкий горох']::text[], 150, null, true),
  ('Творог 2%', 'творог 2', 'творог 2 творог', 104, 18, 2, 3.3, 'reference', 'ref-творог-2-', 'Молочное', '🥛', array['творог']::text[], 150, null, true),
  ('Творог 5%', 'творог 5', 'творог 5 жирный творог', 121, 17, 5, 3, 'reference', 'ref-творог-5-', 'Молочное', '🥛', array['жирный творог']::text[], 150, null, true),
  ('Молоко 2,5%', 'молоко 2 5', 'молоко 2 5 молоко', 52, 2.9, 2.5, 4.7, 'reference', 'ref-молоко-2-5-', 'Молочное', '🥛', array['молоко']::text[], 200, null, true),
  ('Кефир 1%', 'кефир 1', 'кефир 1 кефир', 40, 3, 1, 4, 'reference', 'ref-кефир-1-', 'Молочное', '🥛', array['кефир']::text[], 200, null, true),
  ('Йогурт натуральный', 'йогурт натуральный', 'йогурт натуральный йогурт греческий йогурт', 66, 4.3, 3.2, 4.5, 'reference', 'ref-йогурт-натуральный', 'Молочное', '🥣', array['йогурт', 'греческий йогурт']::text[], 150, null, true),
  ('Сыр твёрдый', 'сыр твердый', 'сыр твердый сыр твердый сыр твердый сыр', 380, 25, 30, 2, 'reference', 'ref-сыр-твёрдый', 'Молочное', '🧀', array['сыр', 'твёрдый сыр', 'твердый сыр']::text[], 30, 30, true),
  ('Сметана 20%', 'сметана 20', 'сметана 20 сметана', 206, 2.8, 20, 3.2, 'reference', 'ref-сметана-20-', 'Молочное', '🥛', array['сметана']::text[], 20, null, true),
  ('Масло сливочное', 'масло сливочное', 'масло сливочное сливочное масло масло', 717, 0.9, 81, 0.1, 'reference', 'ref-масло-сливочное', 'Жиры', '🧈', array['сливочное масло', 'масло']::text[], 10, null, true),
  ('Масло оливковое', 'масло оливковое', 'масло оливковое оливковое масло', 884, 0, 100, 0, 'reference', 'ref-масло-оливковое', 'Жиры', '🫒', array['оливковое масло']::text[], 10, null, true),
  ('Миндаль', 'миндаль', 'миндаль миндаль', 579, 21, 50, 21.6, 'reference', 'ref-миндаль', 'Орехи', '🌰', array['миндаль']::text[], 30, null, true),
  ('Грецкий орех', 'грецкий орех', 'грецкий орех грецкие орехи орехи', 654, 15, 65, 14, 'reference', 'ref-грецкий-орех', 'Орехи', '🌰', array['грецкие орехи', 'орехи']::text[], 30, null, true),
  ('Арахисовая паста', 'арахисовая паста', 'арахисовая паста арахисовая паста паста из арахиса', 588, 25, 50, 20, 'reference', 'ref-арахисовая-паста', 'Орехи', '🥜', array['арахисовая паста', 'паста из арахиса']::text[], 20, null, true),
  ('Семена чиа', 'семена чиа', 'семена чиа чиа', 486, 16.5, 30.7, 42.1, 'reference', 'ref-семена-чиа', 'Орехи', '🌱', array['чиа']::text[], 15, null, true),
  ('Омлет', 'омлет', 'омлет омлет', 154, 10.6, 11.2, 1.4, 'reference', 'ref-омлет', 'Блюда', '🍳', array['омлет']::text[], 150, null, true),
  ('Сырники', 'сырники', 'сырники сырники', 220, 14, 8, 24, 'reference', 'ref-сырники', 'Блюда', '🥞', array['сырники']::text[], 150, null, true),
  ('Блинчики', 'блинчики', 'блинчики блины блинчики', 227, 6, 9, 30, 'reference', 'ref-блинчики', 'Блюда', '🥞', array['блины', 'блинчики']::text[], 120, null, true),
  ('Борщ', 'борщ', 'борщ борщ', 50, 1.5, 2.5, 5, 'reference', 'ref-борщ', 'Блюда', '🍲', array['борщ']::text[], 300, null, true),
  ('Суп куриный', 'суп куриный', 'суп куриный куриный суп суп', 40, 3, 1.5, 3, 'reference', 'ref-суп-куриный', 'Блюда', '🍲', array['куриный суп', 'суп']::text[], 300, null, true),
  ('Плов', 'плов', 'плов плов', 180, 6, 6, 26, 'reference', 'ref-плов', 'Блюда', '🍚', array['плов']::text[], 250, null, true),
  ('Оливье', 'оливье', 'оливье салат оливье оливье', 180, 4, 14, 10, 'reference', 'ref-оливье', 'Блюда', '🥗', array['салат оливье', 'оливье']::text[], 150, null, true),
  ('Пицца Маргарита', 'пицца маргарита', 'пицца маргарита пицца маргарита', 266, 11, 10, 33, 'reference', 'ref-пицца-маргарита', 'Блюда', '🍕', array['пицца', 'маргарита']::text[], 150, null, true),
  ('Шаурма', 'шаурма', 'шаурма шаурма шаверма', 215, 10, 12, 18, 'reference', 'ref-шаурма', 'Блюда', '🌯', array['шаурма', 'шаверма']::text[], 250, null, true),
  ('Бургер', 'бургер', 'бургер бургер гамбургер', 295, 17, 14, 24, 'reference', 'ref-бургер', 'Блюда', '🍔', array['бургер', 'гамбургер']::text[], 220, null, true),
  ('Картофель фри', 'картофель фри', 'картофель фри фри картошка фри', 312, 3.4, 15, 41, 'reference', 'ref-картофель-фри', 'Блюда', '🍟', array['фри', 'картошка фри']::text[], 100, null, true),
  ('Ролл Филадельфия', 'ролл филадельфия', 'ролл филадельфия роллы суши филадельфия', 190, 7, 9, 20, 'reference', 'ref-ролл-филадельфия', 'Блюда', '🍣', array['роллы', 'суши', 'филадельфия']::text[], 200, null, true),
  ('Хумус', 'хумус', 'хумус хумус', 166, 7.9, 9.6, 14.3, 'reference', 'ref-хумус', 'Блюда', '🥣', array['хумус']::text[], 50, null, true),
  ('Шоколад тёмный 70%', 'шоколад темный 70', 'шоколад темный 70 шоколад темный шоколад темный шоколад', 598, 7.8, 42.6, 45.9, 'reference', 'ref-шоколад-тёмный-70-', 'Сладкое', '🍫', array['шоколад', 'темный шоколад', 'тёмный шоколад']::text[], 20, null, true),
  ('Печенье овсяное', 'печенье овсяное', 'печенье овсяное печенье овсяное печенье', 450, 6, 18, 65, 'reference', 'ref-печенье-овсяное', 'Сладкое', '🍪', array['печенье', 'овсяное печенье']::text[], 20, 20, true),
  ('Мороженое', 'мороженое', 'мороженое мороженое', 207, 3.5, 11, 24, 'reference', 'ref-мороженое', 'Сладкое', '🍦', array['мороженое']::text[], 100, null, true),
  ('Мёд', 'мед', 'мед мед мед', 304, 0.3, 0, 82.4, 'reference', 'ref-мёд', 'Сладкое', '🍯', array['мед', 'мёд']::text[], 15, null, true),
  ('Сахар', 'сахар', 'сахар сахар', 387, 0, 0, 100, 'reference', 'ref-сахар', 'Сладкое', '🧂', array['сахар']::text[], 5, null, true),
  ('Кола', 'кола', 'кола кола coca cola кока кола', 42, 0, 0, 10.6, 'reference', 'ref-кола', 'Напитки', '🥤', array['кола', 'coca cola', 'кока кола']::text[], 330, null, true),
  ('Апельсиновый сок', 'апельсиновый сок', 'апельсиновый сок сок апельсиновый апельсиновый сок', 45, 0.7, 0.2, 10.4, 'reference', 'ref-апельсиновый-сок', 'Напитки', '🧃', array['сок апельсиновый', 'апельсиновый сок']::text[], 200, null, true),
  ('Кофе чёрный', 'кофе черный', 'кофе черный кофе черный кофе черный кофе', 2, 0.1, 0, 0, 'reference', 'ref-кофе-чёрный', 'Напитки', '☕', array['кофе', 'черный кофе', 'чёрный кофе']::text[], 200, null, true),
  ('Чай без сахара', 'чай без сахара', 'чай без сахара чай', 1, 0, 0, 0, 'reference', 'ref-чай-без-сахара', 'Напитки', '🍵', array['чай']::text[], 200, null, true),
  ('Соевый соус', 'соевый соус', 'соевый соус соевый соус', 53, 8, 0, 4.9, 'reference', 'ref-соевый-соус', 'Соусы', '🧂', array['соевый соус']::text[], 15, null, true),
  ('Кетчуп', 'кетчуп', 'кетчуп кетчуп', 101, 1.2, 0.2, 25, 'reference', 'ref-кетчуп', 'Соусы', '🍅', array['кетчуп']::text[], 15, null, true),
  ('Майонез', 'майонез', 'майонез майонез', 680, 1, 75, 2.6, 'reference', 'ref-майонез', 'Соусы', '🥚', array['майонез']::text[], 15, null, true)
on conflict do nothing;


-- ----------------------------------------------------------------------------
-- 003_verify_schema.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- CALORIA — schema compatibility check
--
-- Run this AFTER 001_init.sql and 002_seed_foods.sql.
--
-- Why: `create table if not exists` is safe, but it does NOT change an existing
-- table. If you reuse a Supabase project that already contains e.g. a `users`
-- table from another application, the migration would silently keep the old
-- structure and CALORIA would fail at runtime. This script fails loudly instead.
--
-- If it reports a mismatch: use a dedicated Supabase project, or rename/drop the
-- conflicting tables after backing up the other application's data.
-- ============================================================================

do $$
declare
  missing_list text;
begin
  select string_agg(m.table_name || '.' || m.column_name, ', ' order by m.table_name, m.column_name)
    into missing_list
  from (
    select e.table_name, e.column_name
    from (values
      ('users', 'id'),
      ('users', 'telegram_id'),
      ('users', 'username'),
      ('users', 'first_name'),
      ('users', 'last_name'),
      ('users', 'photo_url'),
      ('users', 'age'),
      ('users', 'height'),
      ('users', 'weight'),
      ('users', 'target_weight'),
      ('users', 'sex'),
      ('users', 'activity_level'),
      ('users', 'goal'),
      ('users', 'timezone'),
      ('users', 'onboarding_completed'),
      ('users', 'created_at'),
      ('users', 'updated_at'),

      ('food_products', 'id'),
      ('food_products', 'name'),
      ('food_products', 'name_normalized'),
      ('food_products', 'search_text'),
      ('food_products', 'calories'),
      ('food_products', 'protein'),
      ('food_products', 'fat'),
      ('food_products', 'carbohydrates'),
      ('food_products', 'source'),
      ('food_products', 'source_id'),
      ('food_products', 'category'),
      ('food_products', 'emoji'),
      ('food_products', 'aliases'),
      ('food_products', 'default_serving_grams'),
      ('food_products', 'piece_grams'),
      ('food_products', 'usage_count'),
      ('food_products', 'created_by'),
      ('food_products', 'is_public'),
      ('food_products', 'created_at'),
      ('food_products', 'updated_at'),

      ('food_entries', 'id'),
      ('food_entries', 'user_id'),
      ('food_entries', 'product_id'),
      ('food_entries', 'product_name_snapshot'),
      ('food_entries', 'meal_type'),
      ('food_entries', 'amount_grams'),
      ('food_entries', 'calories'),
      ('food_entries', 'protein'),
      ('food_entries', 'fat'),
      ('food_entries', 'carbohydrates'),
      ('food_entries', 'consumed_at'),
      ('food_entries', 'entry_date'),
      ('food_entries', 'created_at'),
      ('food_entries', 'updated_at'),

      ('weight_history', 'id'),
      ('weight_history', 'user_id'),
      ('weight_history', 'weight'),
      ('weight_history', 'recorded_on'),
      ('weight_history', 'recorded_at'),
      ('weight_history', 'created_at'),
      ('weight_history', 'updated_at'),

      ('body_measurements', 'id'),
      ('body_measurements', 'user_id'),
      ('body_measurements', 'recorded_on'),
      ('body_measurements', 'waist'),
      ('body_measurements', 'hips'),
      ('body_measurements', 'chest'),
      ('body_measurements', 'note'),
      ('body_measurements', 'created_at'),
      ('body_measurements', 'updated_at'),

      ('progress_photos', 'id'),
      ('progress_photos', 'user_id'),
      ('progress_photos', 'recorded_on'),
      ('progress_photos', 'data_url'),
      ('progress_photos', 'note'),
      ('progress_photos', 'created_at'),

      ('user_goals', 'id'),
      ('user_goals', 'user_id'),
      ('user_goals', 'calories'),
      ('user_goals', 'protein'),
      ('user_goals', 'fat'),
      ('user_goals', 'carbohydrates'),
      ('user_goals', 'water_ml'),
      ('user_goals', 'updated_at'),

      ('reminder_settings', 'id'),
      ('reminder_settings', 'user_id'),
      ('reminder_settings', 'reminders_enabled'),
      ('reminder_settings', 'morning_enabled'),
      ('reminder_settings', 'breakfast_enabled'),
      ('reminder_settings', 'lunch_enabled'),
      ('reminder_settings', 'dinner_enabled'),
      ('reminder_settings', 'evening_enabled'),
      ('reminder_settings', 'water_enabled'),
      ('reminder_settings', 'morning_time'),
      ('reminder_settings', 'breakfast_time'),
      ('reminder_settings', 'lunch_time'),
      ('reminder_settings', 'dinner_time'),
      ('reminder_settings', 'evening_time'),
      ('reminder_settings', 'quiet_start'),
      ('reminder_settings', 'quiet_end'),
      ('reminder_settings', 'water_interval_hours'),
      ('reminder_settings', 'timezone'),
      ('reminder_settings', 'created_at'),
      ('reminder_settings', 'updated_at'),

      ('notification_logs', 'id'),
      ('notification_logs', 'user_id'),
      ('notification_logs', 'notification_type'),
      ('notification_logs', 'dedupe_key'),
      ('notification_logs', 'scheduled_at'),
      ('notification_logs', 'sent_at'),
      ('notification_logs', 'status'),
      ('notification_logs', 'created_at'),

      ('water_logs', 'id'),
      ('water_logs', 'user_id'),
      ('water_logs', 'log_date'),
      ('water_logs', 'amount_ml'),
      ('water_logs', 'goal_ml'),
      ('water_logs', 'created_at'),
      ('water_logs', 'updated_at'),

      ('favorites', 'id'),
      ('favorites', 'user_id'),
      ('favorites', 'product_id'),
      ('favorites', 'created_at'),

      ('bot_pending_entries', 'id'),
      ('bot_pending_entries', 'user_id'),
      ('bot_pending_entries', 'payload'),
      ('bot_pending_entries', 'expires_at'),
      ('bot_pending_entries', 'created_at')
    ) as e(table_name, column_name)
    left join information_schema.columns c
      on c.table_schema = 'public'
     and c.table_name = e.table_name
     and c.column_name = e.column_name
    where c.column_name is null
  ) m;

  if missing_list is not null then
    raise exception
      'CALORIA schema mismatch. Missing columns: %. '
      'This database may belong to another application. Use a dedicated Supabase project, '
      'or rename/drop the conflicting tables after backing up their data.', missing_list;
  end if;

  raise notice 'CALORIA schema check passed: all required tables and columns exist.';
end $$;
