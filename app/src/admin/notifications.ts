// Section « Notifications » des Paramètres : active le push sur l'appareil courant.
import { disablePush, enablePush, getPushState, type PushState } from '../data/push';
import { fill, h } from '../ui/dom';
import { banner, errorMessage } from '../ui/notice';

const HELP: Record<Exclude<PushState, 'off' | 'on'>, string> = {
  unconfigured: 'Les notifications ne sont pas configurées sur ce site (clé VAPID absente).',
  unsupported: 'Cet appareil ne permet pas les notifications. Sur iPhone, utilisez « Ajouter à l’écran d’accueil » dans Safari, puis ouvrez l’appli installée.',
  denied: 'Les notifications sont bloquées pour ce site : autorisez-les dans les réglages du navigateur.'
};

export function notificationsSection(): HTMLElement {
  const body = h('div', { style: 'display:flex;flex-direction:column;gap:12px;align-items:flex-start' });
  let state: PushState | null = null;
  let error = '';
  let busy = false;

  async function toggle(): Promise<void> {
    busy = true; error = ''; draw();
    try {
      if (state === 'on') await disablePush(); else await enablePush();
    } catch (e) {
      error = errorMessage(e);
    }
    busy = false;
    await refresh();
  }

  function draw(): void {
    fill(body,
      state === null ? h('p', { class: 'muted', role: 'status' }, 'Chargement…') : null,
      state && state !== 'on' && state !== 'off' ? banner(HELP[state], 'warn') : null,
      error ? banner(error, 'error') : null,
      state === 'on' || state === 'off'
        ? h('button', {
            class: 'btn ' + (state === 'on' ? 'btn-outline' : 'btn-dark'),
            type: 'button', disabled: busy, onclick: () => void toggle()
          }, state === 'on' ? 'Désactiver sur cet appareil' : 'Activer sur cet appareil')
        : null,
      state === 'on' ? h('p', { class: 'muted', style: 'font-size:14px' }, 'Cet appareil est prévenu à chaque réservation et annulation.') : null
    );
  }

  async function refresh(): Promise<void> {
    try { state = await getPushState(); } catch { state = 'unsupported'; }
    draw();
  }

  draw();
  void refresh();
  return h('section', { class: 'sec' },
    h('div', {}, h('h2', {}, 'Notifications'),
      h('p', { class: 'muted', style: 'font-size:14px' }, 'Recevez une notification sur votre téléphone quand un client réserve ou annule.')),
    body);
}
