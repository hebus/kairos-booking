// État éphémère du parcours client (en mémoire : perdu au rechargement, volontairement).
import type { Slot } from '../data/types';

export const draft: {
  day?: string;
  slot?: Slot;
  /** Rendez-vous qui vient d'être confirmé (écran de confirmation). */
  done?: { day: string; start: string; name: string; createdProfile: boolean };
  /** Où revenir après l'édition du profil. */
  returnTo?: string;
  flash?: string;
} = {};

export function resetDraft(): void {
  delete draft.day;
  delete draft.slot;
  delete draft.done;
  delete draft.returnTo;
}

export function setFlash(message: string): void {
  draft.flash = message;
}

/** Lit puis efface le message (affiché une seule fois). */
export function takeFlash(): string | undefined {
  const f = draft.flash;
  delete draft.flash;
  return f;
}
