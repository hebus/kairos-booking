// Stockage navigateur du client : profil + dernier état connu de « Mes rendez-vous »
// (affiché hors-ligne ou pendant le chargement). La source de vérité reste Supabase.
import type { Appointment } from './types';
import { isValidProfile, type Profile } from '../ui/format';

const PROFILE_KEY = 'rdv:profile';
const CACHE_KEY = 'rdv:appointments';

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* navigation privée / quota : l'app reste utilisable sans cache */
  }
}

export function getProfile(): Profile | null {
  const v = read(PROFILE_KEY);
  if (v && typeof v === 'object') {
    const p = v as Partial<Profile>;
    const profile = { first: String(p.first ?? ''), last: String(p.last ?? ''), phone: String(p.phone ?? '') };
    if (isValidProfile(profile)) return profile;
  }
  return null;
}

export function saveProfile(p: Profile): void {
  write(PROFILE_KEY, { first: p.first.trim(), last: p.last.trim(), phone: p.phone.trim() });
}

export function getCachedAppointments(): Appointment[] {
  const v = read(CACHE_KEY);
  return Array.isArray(v) ? (v as Appointment[]) : [];
}

export function setCachedAppointments(list: Appointment[]): void {
  write(CACHE_KEY, list);
}
