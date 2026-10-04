-- ============================================================
-- Fonctions (RPC) — source de vérité unique des règles de réservation
-- Idempotent. À exécuter après schema.sql.
-- ============================================================

-- Date du jour dans le fuseau du lieu (settings.timezone).
create or replace function public.local_today()
returns date
language sql stable security definer set search_path = ''
as $$
  select (now() at time zone (select timezone from public.settings where id))::date
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
$$;

-- Créneaux réellement réservables pour un jour donné :
-- jour futur, travaillé, non bloqué, créneau non déjà pris.
create or replace function public.available_slots(p_day date)
returns table (slot_start time, slot_end time)
language sql stable security definer set search_path = ''
as $$
  with cfg as (select slot_minutes from public.settings where id),
  wa as (
    select * from public.weekly_availability
    where weekday = extract(dow from p_day)::smallint and worked
  ),
  cand as (
    -- Mode « journée entière » : créneaux générés toutes les slot_minutes
    select (wa.start_time + g * cfg.slot_minutes * interval '1 minute')::time as s,
           (wa.start_time + (g + 1) * cfg.slot_minutes * interval '1 minute')::time as e
    from wa cross join cfg
    cross join lateral generate_series(0, 1439 / cfg.slot_minutes) g
    where wa.mode = 'full'
      and (g + 1) * cfg.slot_minutes <= extract(epoch from (wa.end_time - wa.start_time)) / 60
    union all
    -- Mode « créneaux » : plages explicites
    select s.start_time, s.end_time
    from wa join public.availability_slots s on s.weekday = wa.weekday
    where wa.mode = 'slots'
  )
  select c.s, c.e
  from cand c
  where p_day > public.local_today()
    and not exists (select 1 from public.blocked_days b where b.day = p_day)
    and not exists (
      select 1 from public.appointments a
      where a.day = p_day and a.start_time = c.s and a.status = 'confirmed'
    )
  order by c.s
$$;

-- Jours ayant au moins un créneau libre (pour griser le calendrier client).
create or replace function public.open_days(p_from date, p_to date)
returns setof date
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'range_invalid' using errcode = 'P0001';
  end if;
  return query
    select d::date
    from generate_series(p_from, p_to, interval '1 day') d
    where exists (select 1 from public.available_slots(d::date));
end $$;

-- Réservation (le client ne peut pas écrire directement dans appointments).
create or replace function public.book_appointment(
  p_day date, p_start time, p_first text, p_last text, p_phone text
)
returns public.appointments
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_end time;
  v_row public.appointments;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  select slot_end into v_end from public.available_slots(p_day) where slot_start = p_start;
  if v_end is null then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  if (select count(*) from public.appointments
      where client_id = v_uid and status = 'confirmed' and day >= public.local_today()) >= 10 then
    raise exception 'quota_exceeded' using errcode = 'P0001';
  end if;

  insert into public.appointments (client_id, day, start_time, end_time, first_name, last_name, phone)
  values (v_uid, p_day, p_start, v_end, btrim(p_first), btrim(p_last), btrim(p_phone))
  returning * into v_row;
  return v_row;
exception
  when unique_violation then
    raise exception 'slot_unavailable' using errcode = 'P0001';
end $$;

-- Annulation par le client : l'admin est averti (seen_by_admin = false).
create or replace function public.cancel_my_appointment(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.appointments
  set status = 'cancelled', cancelled_at = now(), seen_by_admin = false
  where id = p_id
    and client_id = (select auth.uid())
    and status = 'confirmed'
    and day >= public.local_today();
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end $$;

-- Mise à jour du profil : répercutée sur les rendez-vous à venir (vus par l'admin).
create or replace function public.update_my_profile(p_first text, p_last text, p_phone text)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_count int;
begin
  if (select auth.uid()) is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  update public.appointments
  set first_name = btrim(p_first), last_name = btrim(p_last), phone = btrim(p_phone)
  where client_id = (select auth.uid())
    and status = 'confirmed'
    and day >= public.local_today();
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Enregistrement atomique de la semaine type (admin uniquement).
-- p_days : [{weekday, worked, mode, start_time, end_time, slots:[{start_time,end_time}]}]
create or replace function public.save_availability(p_days jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  d record;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  for d in
    select * from jsonb_to_recordset(p_days)
      as x(weekday smallint, worked boolean, mode text, start_time time, end_time time, slots jsonb)
  loop
    insert into public.weekly_availability (weekday, worked, mode, start_time, end_time)
    values (d.weekday, d.worked, d.mode, d.start_time, d.end_time)
    on conflict (weekday) do update
      set worked = excluded.worked, mode = excluded.mode,
          start_time = excluded.start_time, end_time = excluded.end_time;

    delete from public.availability_slots where weekday = d.weekday;
    insert into public.availability_slots (weekday, start_time, end_time)
    select d.weekday, s.start_time, s.end_time
    from jsonb_to_recordset(coalesce(d.slots, '[]'::jsonb)) as s(start_time time, end_time time);
  end loop;
end $$;

-- Droits d'exécution : tout est refusé par défaut, puis ouvert au strict nécessaire.
revoke execute on function
  public.local_today(), public.is_admin(), public.available_slots(date),
  public.open_days(date, date),
  public.book_appointment(date, time, text, text, text),
  public.cancel_my_appointment(uuid),
  public.update_my_profile(text, text, text),
  public.save_availability(jsonb)
from public, anon, authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.available_slots(date) to anon, authenticated;
grant execute on function public.open_days(date, date) to anon, authenticated;
grant execute on function public.book_appointment(date, time, text, text, text) to authenticated;
grant execute on function public.cancel_my_appointment(uuid) to authenticated;
grant execute on function public.update_my_profile(text, text, text) to authenticated;
grant execute on function public.save_availability(jsonb) to authenticated;
