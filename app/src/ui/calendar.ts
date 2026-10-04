// Calendrier mensuel partagé (client : choix du jour ; admin : jours bloqués).
import { h, icon } from './dom';
import { WEEKDAY_INITIALS, dayName, formatMonth, monthName, toIso } from './format';

export interface CellState {
  disabled: boolean;
  selected?: boolean;
  /** Style « bloqué » (admin) : pastille foncée. */
  blocked?: boolean;
  /** Complément d'étiquette pour les lecteurs d'écran (ex. « indisponible »). */
  note?: string;
}

export interface CalendarOptions {
  today: Date;
  monthsAhead: number; // nombre de mois navigables après le mois courant
  cell: (iso: string) => CellState;
  onPick: (iso: string) => void;
  /** Appelé à chaque changement de mois (et au premier rendu) : charger les données puis refresh(). */
  onRange?: (firstIso: string, lastIso: string) => void | Promise<void>;
}

export interface Calendar {
  el: HTMLElement;
  refresh: () => void;
}

export function createCalendar(opts: CalendarOptions): Calendar {
  let offset = 0;
  const el = h('div', { class: 'cal' });

  function monthDate(): Date {
    return new Date(opts.today.getFullYear(), opts.today.getMonth() + offset, 1);
  }

  function render(): void {
    const base = monthDate();
    const y = base.getFullYear();
    const m = base.getMonth();
    const count = new Date(y, m + 1, 0).getDate();
    const lead = (base.getDay() + 6) % 7; // lundi en premier

    const prev = h(
      'button',
      { class: 'cal-nav', 'aria-label': 'Mois précédent', disabled: offset === 0, onclick: () => move(-1) },
      icon('chevron-left')
    );
    const next = h(
      'button',
      { class: 'cal-nav', 'aria-label': 'Mois suivant', disabled: offset >= opts.monthsAhead, onclick: () => move(1) },
      icon('chevron-right')
    );

    const grid = h('div', { class: 'cal-grid' });
    for (const w of WEEKDAY_INITIALS) grid.appendChild(h('div', { class: 'cal-dow' }, w));
    for (let i = 0; i < lead; i++) grid.appendChild(h('div'));
    for (let d = 1; d <= count; d++) {
      const date = new Date(y, m, d);
      const iso = toIso(date);
      const st = opts.cell(iso);
      const label = `${dayName(date.getDay())} ${d} ${monthName(m)}${st.note ? ', ' + st.note : ''}`;
      const cls = 'cal-day' + (st.selected ? ' is-selected' : '') + (st.blocked ? ' is-blocked' : '') + (st.disabled ? ' is-off' : '');
      grid.appendChild(
        h('div', { class: 'cal-cell' }, h(
          'button',
          {
            class: cls,
            disabled: st.disabled,
            'aria-pressed': st.selected || st.blocked ? 'true' : 'false',
            'aria-label': label,
            onclick: () => opts.onPick(iso)
          },
          String(d)
        ))
      );
    }

    el.replaceChildren(
      h('div', { class: 'cal-head' }, prev, h('div', { class: 'cal-title' }, formatMonth(y, m)), next),
      grid
    );
  }

  function range(): Promise<void> | void {
    const base = monthDate();
    const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return opts.onRange?.(toIso(base), toIso(last));
  }

  function move(delta: number): void {
    offset = Math.min(Math.max(offset + delta, 0), opts.monthsAhead);
    render();
    void range();
  }

  render();
  void range();
  return { el, refresh: render };
}
