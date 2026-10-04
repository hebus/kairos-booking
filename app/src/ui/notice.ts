import { configured } from '../data/supabase';
import { h } from './dom';

/** Bandeau affiché quand les variables Supabase sont absentes (dégradation propre). */
export function missingConfig(): HTMLElement | null {
  if (configured) return null;
  return h(
    'div',
    { class: 'banner error', role: 'alert' },
    'Service indisponible : la configuration Supabase est absente. Définissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY au build.'
  );
}

export function banner(message: string, kind: '' | 'warn' | 'error' = ''): HTMLElement {
  return h('div', { class: ('banner ' + kind).trim(), role: kind === 'error' ? 'alert' : 'status' }, message);
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Une erreur est survenue. Réessayez.';
}
