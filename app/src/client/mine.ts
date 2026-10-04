// « Mes rendez-vous » : à venir (annulables) et passés. Synchronisé en direct avec Supabase.
import { cancel, myAppointments, subscribeMine } from '../data/booking';
import { getCachedAppointments } from '../data/profile-store';
import { configured } from '../data/supabase';
import type { Appointment } from '../data/types';
import { emptyState, fill, h, icon } from '../ui/dom';
import { capitalize, formatDay, hhmm, toIso } from '../ui/format';
import { banner, errorMessage, missingConfig } from '../ui/notice';
import { go, type RenderFn } from '../router';
import { addToCalendar } from './add-to-calendar';

export const renderMine: RenderFn = (root) => {
  const todayIso = toIso(new Date());
  let list: Appointment[] = getCachedAppointments();
  let asking: string | null = null;
  let notice = '';
  let error = '';
  let loading = configured;
  let disposed = false;
  let unsubscribe: () => void = () => {};

  const body = h('div', { class: 'client-body' });
  root.append(
    h('main', { class: 'client' },
      h('div', { class: 'client-pad' }, h('button', { class: 'back', onclick: () => go('/') }, icon('chevron-left'), 'Retour')),
      body
    )
  );

  async function reload(): Promise<void> {
    try {
      const next = await myAppointments();
      if (disposed) return;
      // Un rendez-vous supprimé par l'admin disparaît ici sans action du client.
      list = next;
      error = '';
    } catch (e) {
      if (!disposed) error = errorMessage(e);
    }
    loading = false;
    render();
  }

  function card(a: Appointment, past: boolean): HTMLElement {
    const main = h('div', { class: 'appt-main' },
      h('div', {},
        h('div', { class: 'appt-day' + (past ? ' muted' : '') }, capitalize(formatDay(a.day))),
        h('div', { class: past ? 'muted' : 'appt-ok', style: 'font-size:14px' }, past ? 'Terminé' : 'Confirmé')
      ),
      h('div', { class: 'time-pill' + (past ? ' past' : '') }, hhmm(a.start_time))
    );
    const parts: (Node | null)[] = [main];
    if (!past) {
      parts.push(addToCalendar({ id: a.id, day: a.day, start: hhmm(a.start_time), end: hhmm(a.end_time) }));
      const label = `Annuler le rendez-vous du ${formatDay(a.day)} à ${hhmm(a.start_time)}`;
      if (asking === a.id) {
        parts.push(h('div', { class: 'confirm-box' },
          h('span', { style: 'font-size:15px;font-weight:600' }, 'Annuler ce rendez-vous ? Le professionnel en sera averti.'),
          h('div', { class: 'row-gap' },
            h('button', { class: 'btn btn-outline btn-sm', onclick: () => { asking = null; render(); } }, 'Garder'),
            h('button', { class: 'btn btn-danger btn-sm', onclick: () => void doCancel(a) }, 'Annuler')
          )
        ));
      } else {
        parts.push(h('button', { class: 'link-btn danger', style: 'align-self:flex-start', 'aria-label': label,
          onclick: () => { asking = a.id; notice = ''; render(); } }, 'Annuler ce rendez-vous'));
      }
    }
    return h('div', { class: 'card appt-card' }, ...parts);
  }

  async function doCancel(a: Appointment): Promise<void> {
    asking = null;
    try {
      await cancel(a.id);
      notice = `Rendez-vous du ${formatDay(a.day)} à ${hhmm(a.start_time)} annulé. Le professionnel en a été averti.`;
      error = '';
    } catch (e) {
      error = errorMessage(e);
    }
    await reload();
  }

  function render(): void {
    const upcoming = list.filter((a) => a.day >= todayIso);
    const past = list.filter((a) => a.day < todayIso).reverse();
    fill(body,
      h('h1', {}, 'Mes rendez-vous'),
      missingConfig(),
      notice ? banner(notice) : null,
      error ? banner(error, 'error') : null,
      loading && list.length === 0 ? h('p', { class: 'muted', role: 'status' }, 'Chargement…') : null,
      !loading && upcoming.length === 0
        ? emptyState({
            icon: 'calendar-empty',
            title: 'Aucun rendez-vous',
            text: 'Les rendez-vous que vous réservez apparaissent ici.',
            action: h('button', { class: 'btn btn-dark', onclick: () => go('/') }, 'Prendre rendez-vous')
          })
        : null,
      upcoming.length > 0
        ? h('div', { style: 'display:flex;flex-direction:column;gap:12px' },
            h('h2', {}, `À venir · ${upcoming.length}`), ...upcoming.map((a) => card(a, false)))
        : null,
      past.length > 0
        ? h('div', { style: 'display:flex;flex-direction:column;gap:12px' },
            h('h2', {}, 'Passés'), ...past.map((a) => card(a, true)))
        : null
    );
  }

  render();
  if (configured) {
    void reload();
    void subscribeMine(() => void reload()).then((un) => {
      if (disposed) un();
      else unsubscribe = un;
    });
  }
  return () => {
    disposed = true;
    unsubscribe();
  };
};
