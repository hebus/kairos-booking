// Dates et téléphones. Les dates de la base sont des chaînes « YYYY-MM-DD » et les
// heures « HH:MM(:SS) », sans fuseau : on évite tout passage par Date + UTC.

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
/** Ordre d'affichage lundi → dimanche, en indices JS getDay(). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const monthName = (m: number): string => MONTHS[m] ?? '';
export const dayName = (dow: number): string => DAYS[dow] ?? '';

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const pad = (n: number): string => String(n).padStart(2, '0');

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** « lundi 5 octobre » */
export function formatDay(iso: string): string {
  const d = parseIso(iso);
  return `${dayName(d.getDay())} ${d.getDate()} ${monthName(d.getMonth())}`;
}

/** « 09:00:00 » → « 09:00 » */
export function hhmm(time: string): string {
  return time.slice(0, 5);
}

export function formatMonth(year: number, month: number): string {
  return `${monthName(month)} ${year}`;
}

export function digitsOf(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Mêmes règles que la contrainte SQL : 8 à 24 caractères autorisés, 8 chiffres minimum. */
export function isValidPhone(phone: string): boolean {
  const p = phone.trim();
  return /^[0-9 +().-]{8,24}$/.test(p) && digitsOf(p).length >= 8;
}

export interface Profile {
  first: string;
  last: string;
  phone: string;
}

export function isValidProfile(p: Profile): boolean {
  return (
    p.first.trim().length >= 1 &&
    p.first.trim().length <= 60 &&
    p.last.trim().length >= 1 &&
    p.last.trim().length <= 60 &&
    isValidPhone(p.phone)
  );
}

export function fullName(first: string, last: string): string {
  return `${first} ${last}`.trim();
}
