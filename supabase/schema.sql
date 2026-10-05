-- ============================================================
-- Prise de rendez-vous — schéma (idempotent : peut être rejoué)
-- À coller dans Supabase > SQL Editor, puis exécuter dans l'ordre :
--   1) schema.sql   2) functions.sql   3) policies.sql
-- ============================================================

-- ---------- Admin ----------
-- Alimentée à la main : insert into public.admins values ('<uuid du compte admin>');
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- ---------- Réglages (une seule ligne) ----------
create table if not exists public.settings (
  id boolean primary key default true check (id),
  slot_minutes int not null default 60 check (slot_minutes between 5 and 480),
  timezone text not null default 'Europe/Paris'
);
insert into public.settings (id) values (true) on conflict do nothing;

-- Paramètres de la société (page Admin « Paramètres »). Lecture publique : ces informations
-- sont affichées aux clients et ajoutées à leur événement calendrier.
alter table public.settings
  add column if not exists company_name text not null default 'Angel, Éveilleuse d’âmes'
    check (char_length(btrim(company_name)) between 1 and 100),
  add column if not exists phone text
    check (phone is null or (phone ~ '^[0-9 +().-]{8,24}$' and length(regexp_replace(phone, '\D', '', 'g')) >= 8)),
  add column if not exists address_street text check (char_length(address_street) <= 160),
  add column if not exists address_complement text check (char_length(address_complement) <= 160),
  add column if not exists address_zip text check (char_length(address_zip) <= 16),
  add column if not exists address_city text check (char_length(address_city) <= 80),
  add column if not exists include_address_in_event boolean not null default true;

-- Fuseaux autorisés : mêmes règles d'heure d'été que celles du fichier .ics généré par l'appli.
alter table public.settings drop constraint if exists settings_timezone_check;
alter table public.settings add constraint settings_timezone_check
  check (timezone in ('Europe/Paris', 'Europe/Brussels', 'Europe/Zurich'));

-- ---------- Semaine type (0 = dimanche … 6 = samedi, comme JS getDay()) ----------
create table if not exists public.weekly_availability (
  weekday smallint primary key check (weekday between 0 and 6),
  worked boolean not null default false,
  mode text not null default 'full' check (mode in ('full', 'slots')),
  start_time time not null default '09:00',
  end_time time not null default '18:00',
  check (end_time > start_time)
);
insert into public.weekly_availability (weekday, worked)
select d, d between 1 and 5 from generate_series(0, 6) d
on conflict do nothing;

-- Créneaux explicites (mode 'slots') : chaque plage est un créneau réservable tel quel.
create table if not exists public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null references public.weekly_availability(weekday) on delete cascade,
  start_time time not null,
  end_time time not null,
  check (end_time > start_time),
  unique (weekday, start_time)
);

-- ---------- Jours bloqués ----------
create table if not exists public.blocked_days (
  day date primary key
);

-- ---------- Rendez-vous ----------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  start_time time not null,
  end_time time not null,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 60),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 60),
  phone text not null check (
    phone ~ '^[0-9 +().-]{8,24}$' and length(regexp_replace(phone, '\D', '', 'g')) >= 8
  ),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  seen_by_admin boolean not null default true,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (end_time > start_time)
);

-- Anti double réservation : un seul rendez-vous confirmé par créneau.
create unique index if not exists appointments_slot_uq
  on public.appointments (day, start_time) where status = 'confirmed';
create index if not exists appointments_client_idx on public.appointments (client_id);
create index if not exists appointments_day_idx on public.appointments (day, start_time);

-- ---------- Notifications push de l'admin ----------
-- Un abonnement par appareil (endpoint). Lu par l'Edge Function notify-admin (service_role).
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ---------- Realtime ----------
-- Replica identity par défaut (clé primaire seule) : les événements DELETE ne
-- contiennent que l'id, jamais de données personnelles.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appointments'
  ) then
    alter publication supabase_realtime add table public.appointments;
  end if;
end $$;
