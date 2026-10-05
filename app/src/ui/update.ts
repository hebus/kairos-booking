// Détection d'une nouvelle version publiée : compare __APP_VERSION__ (compilé) à version.json (en ligne).
import { h } from './dom';

const CHECK_EVERY_MS = 10 * 60 * 1000;

async function latestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null; // en développement, le fichier n'existe pas
    const data = (await res.json()) as { version?: unknown };
    return typeof data.version === 'string' ? data.version : null;
  } catch {
    return null; // hors ligne : on réessaiera
  }
}

function showBanner(): void {
  if (document.getElementById('update-banner')) return;
  document.body.append(
    h('div', { id: 'update-banner', class: 'update-banner', role: 'status' },
      h('span', {}, 'Une nouvelle version est disponible.'),
      h('button', { class: 'btn btn-sm', type: 'button', onclick: () => location.reload() }, 'Actualiser'))
  );
}

/** Vérifie au retour au premier plan et toutes les 10 minutes ; affiche un bandeau si une nouvelle version existe. */
export function watchForUpdates(): void {
  let found = false;
  const check = async (): Promise<void> => {
    if (found || document.visibilityState !== 'visible') return;
    const latest = await latestVersion();
    if (latest && latest !== __APP_VERSION__) {
      found = true;
      showBanner();
    }
  };
  document.addEventListener('visibilitychange', () => void check());
  window.addEventListener('online', () => void check());
  setInterval(() => void check(), CHECK_EVERY_MS);
  void check();
}
