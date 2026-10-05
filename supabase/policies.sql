-- ============================================================
-- Droits + RLS (idempotent). À exécuter après schema.sql et functions.sql.
-- Les connexions anonymes ont le rôle `authenticated` : l'admin est reconnu
-- uniquement par public.is_admin() (table admins), jamais par le rôle.
-- ============================================================

-- Tout refuser d'abord, puis ouvrir colonne par colonne.
revoke all on public.push_subscriptions, public.admins, public.settings, public.weekly_availability,
  public.availability_slots, public.blocked_days, public.appointments
from anon, authenticated;

alter table public.admins enable row level security;               -- aucune policy : inaccessible
alter table public.settings enable row level security;
alter table public.weekly_availability enable row level security;
alter table public.availability_slots enable row level security;
alter table public.blocked_days enable row level security;
alter table public.appointments enable row level security;
alter table public.push_subscriptions enable row level security;

-- ---------- Configuration : lecture publique, écriture admin ----------
grant select on public.settings, public.weekly_availability,
  public.availability_slots, public.blocked_days to anon, authenticated;
grant insert, update, delete on public.weekly_availability,
  public.availability_slots, public.blocked_days to authenticated;
grant update (slot_minutes, timezone, company_name, phone, address_street, address_complement,
  address_zip, address_city, include_address_in_event) on public.settings to authenticated;

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);
drop policy if exists settings_admin_update on public.settings;
create policy settings_admin_update on public.settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists wa_read on public.weekly_availability;
create policy wa_read on public.weekly_availability for select using (true);
drop policy if exists wa_admin_write on public.weekly_availability;
create policy wa_admin_write on public.weekly_availability for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists slots_read on public.availability_slots;
create policy slots_read on public.availability_slots for select using (true);
drop policy if exists slots_admin_write on public.availability_slots;
create policy slots_admin_write on public.availability_slots for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists blocked_read on public.blocked_days;
create policy blocked_read on public.blocked_days for select using (true);
drop policy if exists blocked_admin_write on public.blocked_days;
create policy blocked_admin_write on public.blocked_days for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- Rendez-vous ----------
-- Lecture : le client ne voit que les siens, l'admin voit tout.
-- Écriture : uniquement via les RPC (clients) ; l'admin peut supprimer et marquer « lu ».
grant select on public.appointments to authenticated;
grant update (seen_by_admin) on public.appointments to authenticated;
grant delete on public.appointments to authenticated;

drop policy if exists appt_select on public.appointments;
create policy appt_select on public.appointments for select to authenticated
  using (client_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists appt_admin_update on public.appointments;
create policy appt_admin_update on public.appointments for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists appt_admin_delete on public.appointments;
create policy appt_admin_delete on public.appointments for delete to authenticated
  using ((select public.is_admin()));

-- ---------- Notifications push : chaque admin gère ses propres appareils ----------
grant select, insert, update, delete on public.push_subscriptions to authenticated;
drop policy if exists push_admin_own on public.push_subscriptions;
create policy push_admin_own on public.push_subscriptions for all to authenticated
  using (public.is_admin() and user_id = (select auth.uid()))
  with check (public.is_admin() and user_id = (select auth.uid()));
