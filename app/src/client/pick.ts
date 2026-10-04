// Écran d'accueil client : calendrier → créneaux → « Continuer ».
import { BRAND } from '../config';
import { getOpenDays, getSlots, myAppointments } from '../data/booking';
import { getCachedAppointments } from '../data/profile-store';
import { configured } from '../data/supabase';
import type { Slot } from '../data/types';
import { createCalendar } from '../ui/calendar';
import { h, icon } from '../ui/dom';
import { formatDay, toIso } from '../ui/format';
import { banner, errorMessage, missingConfig } from '../ui/notice';
import { go, type RenderFn } from '../router';
import { draft, resetDraft, takeFlash } from './draft';

export const renderPick: RenderFn = (root) => {
  const today = new Date();
  const todayIso = toIso(today);
  const open = new Set<string>();
  let slots: Slot[] | null = null; // null = chargement
  let error = '';
  let disposed = false;

  const flash = takeFlash();
  if (draft.done) resetDraft();

  const upcomingCount = (): number =>
    getCachedAppointments().filter((a) => a.status === 'confirmed' && a.day >= todayIso).length;

  const badge = h('span', { class: 'count-badge', 'aria-hidden': 'true' });
  const mineBtn = h('button', { class: 'icon-btn', title: 'Mes rendez-vous', onclick: () => go('/rendez-vous') },
    icon('calendar'), badge);
  const updateBadge = (): void => {
    const n = upcomingCount();
    badge.textContent = String(n);
    badge.hidden = n === 0;
    mineBtn.setAttribute('aria-label', `Mes rendez-vous (${n} à venir)`);
  };
  updateBadge();

  const profileBtn = h('button', { class: 'icon-btn accent', 'aria-label': 'Mon profil', title: 'Mon profil', onclick: () => go('/profil') },
    icon('user'));

  const calendar = createCalendar({
    today,
    monthsAhead: 2,
    cell: (iso) => ({
      disabled: !open.has(iso),
      selected: draft.day === iso,
      note: open.has(iso) ? undefined : 'indisponible'
    }),
    onPick: (iso) => void pickDay(iso),
    onRange: async (from, to) => {
      try {
        const days = await getOpenDays(from, to);
        if (disposed) return;
        for (const d of days) open.add(d);
        calendar.refresh();
      } catch (e) {
        error = errorMessage(e);
        renderZone();
      }
    }
  });

  const zone = h('div', { class: 'slots-zone' });
  const errorBox = h('div');
  const cta = h('button', { class: 'btn btn-dark btn-block', onclick: () => go('/reserver') });

  async function pickDay(iso: string): Promise<void> {
    draft.day = iso;
    delete draft.slot;
    slots = null;
    error = '';
    calendar.refresh();
    renderZone();
    try {
      const list = await getSlots(iso);
      if (disposed || draft.day !== iso) return;
      slots = list;
    } catch (e) {
      error = errorMessage(e);
      slots = [];
    }
    renderZone();
  }

  function renderZone(): void {
    errorBox.replaceChildren(...(error ? [banner(error, 'error')] : []));
    if (!draft.day) {
      zone.replaceChildren(h('p', { class: 'muted' }, 'Sélectionnez un jour pour voir les créneaux disponibles.'));
    } else if (slots === null) {
      zone.replaceChildren(h('p', { class: 'muted', role: 'status' }, 'Chargement des créneaux…'));
    } else if (slots.length === 0) {
      zone.replaceChildren(h('p', { class: 'muted' }, 'Aucun créneau libre ce jour-là.'));
    } else {
      zone.replaceChildren(
        h('h2', {}, `Créneaux du ${formatDay(draft.day)}`),
        h('div', { class: 'slots' },
          ...slots.map((s) =>
            h('button', {
              class: 'slot' + (draft.slot?.start === s.start ? ' is-selected' : ''),
              'aria-pressed': draft.slot?.start === s.start ? 'true' : 'false',
              onclick: () => { draft.slot = s; renderZone(); }
            }, s.start)
          )
        )
      );
    }
    const ready = Boolean(draft.day && draft.slot);
    cta.toggleAttribute('disabled', !ready);
    cta.textContent = ready && draft.slot ? `Continuer · ${draft.slot.start}` : 'Choisissez un créneau';
  }

  renderZone();
  root.append(
    h('main', { class: 'client' },
      h('div', { class: 'client-top' },
        h('div', {},
          h('div', { class: 'eyebrow' }, BRAND.company),
          h('h1', {}, 'Prendre rendez-vous')),
        h('div', { class: 'client-actions' }, mineBtn, profileBtn)
      ),
      h('div', { class: 'client-pad' }, missingConfig(), flash ? banner(flash) : null),
      h('div', { class: 'client-pad' }, calendar.el),
      h('div', { class: 'client-pad' }, errorBox),
      h('div', { style: 'flex:1;margin-top:12px' }, zone),
      h('div', { class: 'cta-bar' }, cta)
    )
  );

  if (draft.day && configured) void pickDay(draft.day);
  if (configured) {
    void myAppointments().then(() => { if (!disposed) updateBadge(); }).catch(() => {});
  }
  return () => { disposed = true; };
};
