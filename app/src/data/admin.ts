// API côté Admin : session email/mot de passe, toutes les écritures passent par la RLS (is_admin()).
import type { Session } from '@supabase/supabase-js';
import { adminDb, check, need } from './supabase';
import { WEEK_ORDER, hhmm } from '../ui/format';
import { SETTINGS_COLUMNS, rowToSettings, setSettings, settingsToRow, type CompanySettings } from './settings';
import type { Appointment, DayConfig } from './types';

export async function getSession(): Promise<Session | null> {
  const { data } = await need(adminDb).auth.getSession();
  return data.session;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await need(adminDb).auth.signInWithPassword({ email, password });
  if (error) throw new Error('Email ou mot de passe incorrect.');
}

export async function signOut(): Promise<void> {
  await need(adminDb).auth.signOut();
}

/** Vrai seulement si le compte connecté figure dans la table admins. */
export async function isAdmin(): Promise<boolean> {
  const res = await need(adminDb).rpc('is_admin');
  return check<boolean>(res as { data: boolean; error: null }) === true;
}

// ---------- Rendez-vous ----------
export async function listAppointments(): Promise<Appointment[]> {
  const res = await need(adminDb).from('appointments').select('*').order('day').order('start_time');
  return check<Appointment[]>(res as { data: Appointment[]; error: null });
}

export async function deleteAppointment(id: string): Promise<void> {
  check(await need(adminDb).from('appointments').delete().eq('id', id));
}

export async function markSeen(id: string): Promise<void> {
  check(await need(adminDb).from('appointments').update({ seen_by_admin: true }).eq('id', id));
}

export function subscribeAppointments(onChange: () => void): () => void {
  const db = need(adminDb);
  const channel = db
    .channel('admin-appointments')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, onChange)
    .subscribe();
  return () => {
    void db.removeChannel(channel);
  };
}

// ---------- Disponibilités ----------
export interface Availability {
  days: DayConfig[]; // ordre d'affichage lundi → dimanche
  slotMinutes: number;
}

export async function loadAvailability(): Promise<Availability> {
  const db = need(adminDb);
  const [wa, slots, settings] = await Promise.all([
    db.from('weekly_availability').select('*'),
    db.from('availability_slots').select('*').order('start_time'),
    db.from('settings').select('slot_minutes').eq('id', true).single()
  ]);
  const week = check<Record<string, unknown>[]>(wa as { data: Record<string, unknown>[]; error: null });
  const ranges = check<Record<string, unknown>[]>(slots as { data: Record<string, unknown>[]; error: null });
  const st = check<{ slot_minutes: number }>(settings as { data: { slot_minutes: number }; error: null });
  const days = WEEK_ORDER.map((weekday): DayConfig => {
    const row = week.find((r) => r.weekday === weekday);
    return {
      weekday,
      worked: Boolean(row?.worked),
      mode: row?.mode === 'slots' ? 'slots' : 'full',
      start_time: hhmm(String(row?.start_time ?? '09:00')),
      end_time: hhmm(String(row?.end_time ?? '18:00')),
      slots: ranges
        .filter((r) => r.weekday === weekday)
        .map((r) => ({ start_time: hhmm(String(r.start_time)), end_time: hhmm(String(r.end_time)) }))
    };
  });
  return { days, slotMinutes: st.slot_minutes };
}

export async function saveAvailability(a: Availability): Promise<void> {
  const db = need(adminDb);
  check(await db.rpc('save_availability', { p_days: a.days }));
  check(await db.from('settings').update({ slot_minutes: a.slotMinutes }).eq('id', true));
}

// ---------- Paramètres de la société ----------
export async function loadSettings(): Promise<CompanySettings> {
  const res = await need(adminDb).from('settings').select(SETTINGS_COLUMNS).eq('id', true).single();
  return rowToSettings(check<Record<string, unknown>>(res as { data: Record<string, unknown>; error: null }));
}

export async function saveSettings(s: CompanySettings): Promise<void> {
  check(await need(adminDb).from('settings').update(settingsToRow(s)).eq('id', true));
  setSettings(s); // l'aperçu local (titre, contact) reflète tout de suite la sauvegarde
}

// ---------- Jours bloqués ----------
export async function listBlocked(): Promise<string[]> {
  const res = await need(adminDb).from('blocked_days').select('day').order('day');
  return check<{ day: string }[]>(res as { data: { day: string }[]; error: null }).map((r) => r.day);
}

/** Supprime les jours bloqués strictement antérieurs à `todayIso` (ils n'ont plus d'effet). */
export async function purgePastBlocked(todayIso: string): Promise<void> {
  check(await need(adminDb).from('blocked_days').delete().lt('day', todayIso));
}

export async function blockDay(day: string): Promise<void> {
  check(await need(adminDb).from('blocked_days').insert({ day }));
}

export async function unblockDay(day: string): Promise<void> {
  check(await need(adminDb).from('blocked_days').delete().eq('day', day));
}
