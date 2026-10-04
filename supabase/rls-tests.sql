-- ============================================================
-- Tests RLS / RPC — à coller dans Supabase > SQL Editor (rôle postgres).
-- Crée de faux utilisateurs, vérifie les règles, puis ROLLBACK : aucune trace.
-- Succès = aucune exception ; la dernière ligne renvoie « OK ». (L'éditeur Supabase
-- n'affiche pas les RAISE NOTICE, d'où le select final.)
-- ============================================================
begin;

create or replace function pg_temp.act_as(p_uid uuid, p_role text default 'authenticated')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', p_role)::text, true);
  perform set_config('role', p_role, true);
end $$;

create or replace function pg_temp.act_as_postgres()
returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function pg_temp.ensure(p_cond boolean, p_msg text)
returns void language plpgsql as $$
begin
  if not coalesce(p_cond, false) then raise exception 'ECHEC : %', p_msg; end if;
end $$;

do $$
declare
  admin_id  uuid := '00000000-0000-0000-0000-0000000000a1';
  client_a  uuid := '00000000-0000-0000-0000-0000000000c1';
  client_b  uuid := '00000000-0000-0000-0000-0000000000c2';
  today_d   date := public.local_today();  -- lu en postgres : local_today() n'est pas exécutable par anon/authenticated
  monday    date;
  sunday    date;
  appt_id   uuid;
  n         int;
  failed    boolean;
begin
  -- Lundi de test : le premier lundi à venir SANS jour bloqué ni rendez-vous, pour que les
  -- données réelles de la base n'influencent pas les assertions (rien n'est supprimé).
  monday := date_trunc('week', today_d)::date + 7;
  while exists (select 1 from public.blocked_days where day = monday)
     or exists (select 1 from public.appointments where day = monday) loop
    monday := monday + 7;
  end loop;
  sunday := monday + 6;

  insert into auth.users (id, aud, role, email) values
    (admin_id, 'authenticated', 'authenticated', 'admin@test.local'),
    (client_a, 'authenticated', 'authenticated', 'a@test.local'),
    (client_b, 'authenticated', 'authenticated', 'b@test.local');
  insert into public.admins values (admin_id);
  -- Configuration connue : lundi en mode « journée entière » 09-12, créneaux 60 min.
  update public.settings set slot_minutes = 60 where id;
  update public.weekly_availability set worked = true, mode = 'full',
    start_time = '09:00', end_time = '12:00' where weekday = 1;
  update public.weekly_availability set worked = false where weekday = 0;

  -- 1. anon : configuration lisible, rendez-vous inaccessibles
  perform pg_temp.act_as(null, 'anon');
  select count(*) into n from public.weekly_availability;
  perform pg_temp.ensure(n = 7, 'anon doit lire la semaine type');
  failed := false;
  begin perform 1 from public.appointments; exception when insufficient_privilege then failed := true; end;
  perform pg_temp.ensure(failed, 'anon ne doit pas lire appointments');
  select count(*) into n from public.available_slots(monday);
  perform pg_temp.ensure(n = 3, 'lundi : 3 créneaux de 60 min (09, 10, 11)');
  select count(*) into n from public.available_slots(sunday);
  perform pg_temp.ensure(n = 0, 'dimanche fermé : 0 créneau');
  select count(*) into n from public.available_slots(today_d);
  perform pg_temp.ensure(n = 0, 'aujourd''hui non réservable');

  -- 2. client A réserve ; client B ne peut pas prendre le même créneau
  perform pg_temp.act_as(client_a);
  select id into appt_id from public.book_appointment(monday, '09:00', 'Alice', 'Martin', '06 12 34 56 78');
  perform pg_temp.ensure(appt_id is not null, 'A doit pouvoir réserver');
  select count(*) into n from public.available_slots(monday);
  perform pg_temp.ensure(n = 2, 'le créneau pris disparaît de la liste');

  perform pg_temp.act_as(client_b);
  failed := false;
  begin perform public.book_appointment(monday, '09:00', 'Bob', 'Durand', '06 98 76 54 32');
  exception when others then failed := sqlerrm = 'slot_unavailable'; end;
  perform pg_temp.ensure(failed, 'double réservation refusée (slot_unavailable)');
  failed := false;
  begin perform public.book_appointment(monday, '09:30', 'Bob', 'Durand', '06 98 76 54 32');
  exception when others then failed := sqlerrm = 'slot_unavailable'; end;
  perform pg_temp.ensure(failed, 'créneau hors grille refusé');

  -- 3. isolation : B ne voit pas le rendez-vous de A ; écriture directe interdite
  select count(*) into n from public.appointments;
  perform pg_temp.ensure(n = 0, 'B ne voit pas les rendez-vous de A');
  failed := false;
  begin
    insert into public.appointments (client_id, day, start_time, end_time, first_name, last_name, phone)
    values (client_b, monday, '10:00', '11:00', 'Bob', 'Durand', '06 98 76 54 32');
  exception when insufficient_privilege then failed := true; end;
  perform pg_temp.ensure(failed, 'insert direct dans appointments interdit');
  delete from public.appointments where id = appt_id;
  get diagnostics n = row_count;
  perform pg_temp.ensure(n = 0, 'B ne peut pas supprimer le rendez-vous de A');
  failed := false;
  begin insert into public.blocked_days values (monday);
  exception when insufficient_privilege or others then failed := true; end;
  perform pg_temp.ensure(failed, 'un client ne peut pas bloquer un jour');
  failed := false;
  begin perform public.save_availability('[]'::jsonb);
  exception when others then failed := sqlerrm = 'forbidden'; end;
  perform pg_temp.ensure(failed, 'save_availability refusé aux non-admins');

  -- 4. mise à jour du profil : répercutée sur les rendez-vous à venir
  perform pg_temp.act_as(client_a);
  select public.update_my_profile('Alicia', 'Martin-Dupont', '07 11 22 33 44') into n;
  perform pg_temp.ensure(n = 1, 'update_my_profile met à jour 1 rendez-vous');
  select count(*) into n from public.appointments where first_name = 'Alicia' and phone = '07 11 22 33 44';
  perform pg_temp.ensure(n = 1, 'le profil est répercuté');

  -- 5. admin : voit tout, bloque un jour, supprime
  perform pg_temp.act_as(admin_id);
  select count(*) into n from public.appointments where id = appt_id;
  perform pg_temp.ensure(n = 1, 'admin voit le rendez-vous d''un client');
  insert into public.blocked_days values (monday);
  select count(*) into n from public.available_slots(monday);
  perform pg_temp.ensure(n = 0, 'jour bloqué : aucun créneau');
  delete from public.blocked_days where day = monday;
  perform public.save_availability(jsonb_build_array(
    jsonb_build_object('weekday', 1, 'worked', true, 'mode', 'slots',
      'start_time', '09:00', 'end_time', '18:00',
      'slots', jsonb_build_array(
        jsonb_build_object('start_time', '14:00', 'end_time', '15:30'),
        jsonb_build_object('start_time', '16:00', 'end_time', '17:00')))));
  select count(*) into n from public.available_slots(monday);
  perform pg_temp.ensure(n = 2, 'mode créneaux : 2 plages explicites');

  -- 6. annulation par le client : le créneau redevient libre, l'admin est alerté
  perform pg_temp.act_as(client_a);
  perform public.cancel_my_appointment(appt_id);
  perform pg_temp.act_as(admin_id);
  select count(*) into n from public.appointments where id = appt_id and status = 'cancelled' and not seen_by_admin;
  perform pg_temp.ensure(n = 1, 'annulation visible par l''admin (non lue)');
  update public.appointments set seen_by_admin = true where id = appt_id;
  delete from public.appointments where id = appt_id;
  select count(*) into n from public.appointments where client_id in (client_a, client_b);
  perform pg_temp.ensure(n = 0, 'admin peut supprimer un rendez-vous');

  -- 7. paramètres de la société : lecture publique, écriture admin, contraintes
  perform pg_temp.act_as(null, 'anon');
  select count(*) into n from public.settings where company_name <> '';
  perform pg_temp.ensure(n = 1, 'anon lit les paramètres de la société');
  perform pg_temp.act_as(client_a);
  update public.settings set company_name = 'Pirate' where id;
  get diagnostics n = row_count;
  perform pg_temp.ensure(n = 0, 'un client ne peut pas modifier les paramètres');
  perform pg_temp.act_as(admin_id);
  update public.settings set company_name = 'Société Test', phone = '06 12 34 56 78',
    address_city = 'Paris', include_address_in_event = false where id;
  get diagnostics n = row_count;
  perform pg_temp.ensure(n = 1, 'admin peut modifier les paramètres');
  failed := false;
  begin update public.settings set timezone = 'Mars/Olympus' where id;
  exception when check_violation then failed := true; end;
  perform pg_temp.ensure(failed, 'fuseau horaire inconnu refusé');
  failed := false;
  begin update public.settings set phone = '123' where id;
  exception when check_violation then failed := true; end;
  perform pg_temp.ensure(failed, 'téléphone invalide refusé');
  failed := false;
  begin update public.settings set company_name = '   ' where id;
  exception when check_violation then failed := true; end;
  perform pg_temp.ensure(failed, 'nom de société vide refusé');

  perform pg_temp.act_as_postgres();
  raise notice 'OK — tous les tests RLS/RPC passent';
end $$;

rollback;

select 'OK — tous les tests RLS/RPC passent' as resultat;
