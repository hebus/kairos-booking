import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Faux si les variables ne sont pas injectées au build : l'UI affiche alors un message clair. */
export const configured = Boolean(url && key);

function make(storageKey: string): SupabaseClient | null {
  if (!url || !key) return null;
  return createClient(url, key, {
    // Deux sessions distinctes : un admin connecté par email ne doit jamais écraser
    // l'identité anonyme du « client » dans le même navigateur (et inversement).
    auth: { persistSession: true, autoRefreshToken: true, storageKey, detectSessionInUrl: false }
  });
}

export const clientDb = make('rdv-client-auth');
export const adminDb = make('rdv-admin-auth');

export function need(db: SupabaseClient | null): SupabaseClient {
  if (!db) throw new Error('Service non configuré (variables Supabase absentes).');
  return db;
}

interface PgError {
  message?: string;
  code?: string;
}

/** Convertit une réponse Supabase en valeur ou en Error au message français. */
export function check<T>({ data, error }: { data: T; error: PgError | null }): T {
  if (!error) return data;
  const msg = error.message ?? '';
  if (msg.includes('slot_unavailable')) throw new Error('Ce créneau vient d’être pris. Choisissez-en un autre.');
  if (msg.includes('quota_exceeded')) throw new Error('Vous avez atteint le nombre maximum de rendez-vous à venir.');
  if (msg.includes('not_found')) throw new Error('Ce rendez-vous est introuvable ou ne peut plus être annulé.');
  if (msg.includes('auth_required')) throw new Error('Connexion impossible. Réessayez dans un instant.');
  if (msg.includes('forbidden') || error.code === '42501') throw new Error('Action non autorisée.');
  if (error.code === '23514') throw new Error('Informations invalides : vérifiez le nom et le téléphone.');
  if (error.code === '23505') throw new Error('Cette valeur existe déjà.');
  if (/failed to fetch|network/i.test(msg)) throw new Error('Réseau indisponible. Vérifiez votre connexion.');
  throw new Error('Une erreur est survenue. Réessayez.');
}
