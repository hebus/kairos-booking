// API côté Client. Seule couche (avec admin.ts) à parler à Supabase.
// Identité : connexion anonyme créée à la première écriture ; les lectures sans compte restent possibles.
import { check, clientDb, need } from './supabase';
import { hhmm, type Profile } from '../ui/format';
import { setCachedAppointments } from './profile-store';
import type { Appointment, Slot } from './types';

let signingIn: Promise<string> | null = null;

/** Retourne l'uid, en créant une session anonyme si nécessaire. */
export function ensureUser(): Promise<string> {
  signingIn ??= (async () => {
    const db = need(clientDb);
    const { data } = await db.auth.getSession();
    if (data.session) return data.session.user.id;
    const res = await db.auth.signInAnonymously();
    if (res.error || !res.data.user) {
      signingIn = null;
      throw new Error('Connexion impossible. Réessayez dans un instant.');
    }
    return res.data.user.id;
  })();
  return signingIn;
}

async function hasSession(): Promise<boolean> {
  const { data } = await need(clientDb).auth.getSession();
  return Boolean(data.session);
}

/** Jours ayant au moins un créneau libre sur [from, to] (YYYY-MM-DD). */
export async function getOpenDays(from: string, to: string): Promise<Set<string>> {
  const res = await need(clientDb).rpc('open_days', { p_from: from, p_to: to });
  return new Set(check<string[]>(res as { data: string[]; error: null }));
}

export async function getSlots(day: string): Promise<Slot[]> {
  const res = await need(clientDb).rpc('available_slots', { p_day: day });
  const rows = check<{ slot_start: string; slot_end: string }[]>(
    res as { data: { slot_start: string; slot_end: string }[]; error: null }
  );
  return rows.map((r) => ({ start: hhmm(r.slot_start), end: hhmm(r.slot_end) }));
}

export async function book(day: string, start: string, profile: Profile): Promise<Appointment> {
  await ensureUser();
  const res = await need(clientDb).rpc('book_appointment', {
    p_day: day,
    p_start: start,
    p_first: profile.first,
    p_last: profile.last,
    p_phone: profile.phone
  });
  return check<Appointment>(res as { data: Appointment; error: null });
}

/** Rendez-vous confirmés du client (RLS : uniquement les siens). Vide sans session. */
export async function myAppointments(): Promise<Appointment[]> {
  if (!(await hasSession())) return [];
  const res = await need(clientDb)
    .from('appointments')
    .select('*')
    .eq('status', 'confirmed')
    .order('day')
    .order('start_time');
  const list = check<Appointment[]>(res as { data: Appointment[]; error: null });
  setCachedAppointments(list);
  return list;
}

export async function cancel(id: string): Promise<void> {
  const res = await need(clientDb).rpc('cancel_my_appointment', { p_id: id });
  check(res);
}

/** Met à jour le profil côté serveur : répercuté sur les rendez-vous à venir. */
export async function pushProfile(profile: Profile): Promise<void> {
  if (!(await hasSession())) return; // pas encore de rendez-vous : rien à synchroniser
  const res = await need(clientDb).rpc('update_my_profile', {
    p_first: profile.first.trim(),
    p_last: profile.last.trim(),
    p_phone: profile.phone.trim()
  });
  check(res);
}

/**
 * Écoute les changements (INSERT/UPDATE filtrés par RLS ; les DELETE n'exposent que l'id).
 * Pas de filtre côté canal : les événements DELETE ne supportent pas les filtres.
 * Le callback doit simplement recharger la liste.
 */
export async function subscribeMine(onChange: () => void): Promise<() => void> {
  if (!(await hasSession())) return () => {};
  const db = need(clientDb);
  const channel = db
    .channel('mine-' + Math.random().toString(36).slice(2))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, onChange)
    .subscribe();
  return () => {
    void db.removeChannel(channel);
  };
}
