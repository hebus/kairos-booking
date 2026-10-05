// Jours bloqués : exceptions datées à la semaine type. Chaque clic est enregistré immédiatement.
import { blockDay, listBlocked, loadAvailability, purgePastBlocked, unblockDay } from '../data/admin';
import { createCalendar } from '../ui/calendar';
import { fill, h, icon } from '../ui/dom';
import { capitalize, formatDay, parseIso, toIso } from '../ui/format';
import { banner, errorMessage } from '../ui/notice';
import type { Cleanup } from '../router';

export function buildBlocked(main: HTMLElement): Cleanup {
  const today = new Date();
  const todayIso = toIso(today);
  const blocked = new Set<string>();
  let worked: boolean[] = [false, true, true, true, true, true, false]; // remplacé au chargement
  let error = '';
  let loading = true;
  let disposed = false;

  const side = h('div', { class: 'col-list', style: 'gap:12px' });
  const errorBox = h('div', { class: 'error-slot' });

  const calendar = createCalendar({
    today,
    monthsAhead: 5,
    cell: (iso) => {
      const isBlocked = blocked.has(iso);
      const closed = !worked[parseIso(iso).getDay()];
      const off = iso <= todayIso || closed;
      return {
        // Un jour déjà bloqué reste cliquable (pour le débloquer) tant qu'il est à venir.
        disabled: loading || (isBlocked ? iso <= todayIso : off),
        blocked: isBlocked,
        note: isBlocked ? 'bloqué' : off ? 'non réservable' : 'ouvert'
      };
    },
    onPick: (iso) => void toggle(iso)
  });

  async function toggle(iso: string): Promise<void> {
    try {
      if (blocked.has(iso)) {
        await unblockDay(iso);
        blocked.delete(iso);
      } else {
        await blockDay(iso);
        blocked.add(iso);
      }
      error = '';
    } catch (e) {
      error = errorMessage(e);
    }
    renderAll();
  }

  function renderAll(): void {
    calendar.refresh();
    const list = [...blocked].filter((d) => d >= todayIso).sort();
    errorBox.replaceChildren(...(error ? [banner(error, 'error')] : []));
    fill(side,
      h('h2', {}, `${list.length} jour${list.length > 1 ? 's' : ''} bloqué${list.length > 1 ? 's' : ''}`),
      list.length === 0 ? h('p', { class: 'muted' }, 'Aucun jour bloqué.') : null,
      h('div', { class: 'chips' }, ...list.map((d) =>
        h('div', { class: 'chip' },
          h('span', {}, capitalize(formatDay(d))),
          h('button', { 'aria-label': `Débloquer le ${formatDay(d)}`, onclick: () => void toggle(d) }, icon('x', 16, 2.4))
        ))),
      // Paysage : l'en-tête et la légende laissent la place au calendrier, ces textes passent dans cette colonne.
      h('p', { class: 'muted landscape-only' }, 'Les clients ne pourront pas réserver un jour bloqué, même s’il fait partie de la semaine type. Touchez une date pour la bloquer ou la débloquer.'),
      h('p', { class: 'muted landscape-only' }, 'Les jours passés et les jours fermés dans la semaine type sont grisés.')
    );
  }

  main.append(
    h('div', { class: 'admin-head' },
      h('div', {},
        h('div', { class: 'eyebrow' }, 'Administration'),
        h('h1', {}, 'Jours bloqués'),
        h('p', {}, 'Les clients ne pourront pas réserver un jour bloqué, même s’il fait partie de la semaine type. Cliquez sur une date pour la bloquer ou la débloquer.'))
    ),
    errorBox,
    h('div', { class: 'cols' },
      h('div', { class: 'panel-cal' }, calendar.el,
        h('p', { class: 'muted', style: 'font-size:13px;margin-top:8px' }, 'Les jours passés et les jours fermés dans la semaine type sont grisés.')),
      side
    )
  );
  renderAll();

  // Nettoyage des jours passés ; un échec n'empêche pas d'afficher la page (la liste filtre déjà les jours passés).
  purgePastBlocked(todayIso)
    .catch(() => undefined)
    .then(() => Promise.all([listBlocked(), loadAvailability()]))
    .then(([days, avail]) => {
      if (disposed) return;
      for (const d of days) blocked.add(d);
      worked = [0, 1, 2, 3, 4, 5, 6].map((w) => avail.days.find((d) => d.weekday === w)?.worked ?? false);
    })
    .catch((e) => { error = errorMessage(e); })
    .finally(() => {
      loading = false;
      if (!disposed) renderAll();
    });
  return () => { disposed = true; };
}
