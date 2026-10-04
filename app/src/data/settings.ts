// Paramètres de la société : lus publiquement (nom, téléphone, adresse), modifiés par l'admin.
// Dernière valeur connue gardée en localStorage pour l'affichage immédiat / hors-ligne.
import { BRAND, TIMEZONE } from '../config';
import type { EventContext } from '../ui/calendar-export';
import { check, clientDb, need } from './supabase';

export interface CompanySettings {
  companyName: string;
  phone: string;
  street: string;
  complement: string;
  zip: string;
  city: string;
  includeAddress: boolean;
  timezone: string;
}

export const TIMEZONES = ['Europe/Paris', 'Europe/Brussels', 'Europe/Zurich'] as const;

export const DEFAULT_SETTINGS: CompanySettings = {
  companyName: BRAND.company,
  phone: '',
  street: '',
  complement: '',
  zip: '',
  city: '',
  includeAddress: true,
  timezone: TIMEZONE
};

export const SETTINGS_COLUMNS =
  'company_name, phone, address_street, address_complement, address_zip, address_city, include_address_in_event, timezone';

type Row = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function rowToSettings(row: Row): CompanySettings {
  return {
    companyName: str(row.company_name) || DEFAULT_SETTINGS.companyName,
    phone: str(row.phone),
    street: str(row.address_street),
    complement: str(row.address_complement),
    zip: str(row.address_zip),
    city: str(row.address_city),
    includeAddress: row.include_address_in_event !== false,
    timezone: str(row.timezone) || DEFAULT_SETTINGS.timezone
  };
}

/** Champs facultatifs vides → null en base. */
export function settingsToRow(s: CompanySettings): Row {
  const opt = (v: string): string | null => (v.trim() === '' ? null : v.trim());
  return {
    company_name: s.companyName.trim(),
    phone: opt(s.phone),
    address_street: opt(s.street),
    address_complement: opt(s.complement),
    address_zip: opt(s.zip),
    address_city: opt(s.city),
    include_address_in_event: s.includeAddress,
    timezone: s.timezone
  };
}

/** « 12 rue des Lilas, 2e étage, 75011 Paris » (vide si rien n'est renseigné). */
export function formatAddress(s: CompanySettings): string {
  const cityLine = `${s.zip.trim()} ${s.city.trim()}`.trim();
  return [s.street.trim(), s.complement.trim(), cityLine].filter(Boolean).join(', ');
}

export function eventContext(s: CompanySettings = current): EventContext {
  const address = formatAddress(s);
  return {
    company: s.companyName,
    timezone: s.timezone,
    phone: s.phone || undefined,
    location: s.includeAddress && address ? address : undefined
  };
}

// ---------- Cache ----------
const CACHE_KEY = 'rdv:settings';

function readCache(): CompanySettings | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? rowToSettings(JSON.parse(raw) as Row) : null;
  } catch {
    return null;
  }
}

function writeCache(s: CompanySettings): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settingsToRow(s)));
  } catch {
    /* navigation privée / quota */
  }
}

let current: CompanySettings = readCache() ?? DEFAULT_SETTINGS;

/** Dernière valeur connue (jamais d'attente réseau). */
export const getSettings = (): CompanySettings => current;

export function setSettings(s: CompanySettings): void {
  current = s;
  writeCache(s);
}

/** Lecture publique (sans session). */
export async function loadPublicSettings(): Promise<CompanySettings> {
  const res = await need(clientDb).from('settings').select(SETTINGS_COLUMNS).eq('id', true).single();
  const s = rowToSettings(check<Row>(res as { data: Row; error: null }));
  setSettings(s);
  return s;
}
