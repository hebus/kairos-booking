// Semaine type : jours travaillés, « journée entière » (début/fin) ou créneaux explicites.
import { loadAvailability, saveAvailability, type Availability } from '../data/admin';
import type { DayConfig, DayMode } from '../data/types';
import { fill, h, icon } from '../ui/dom';
import { capitalize, dayName } from '../ui/format';
import { banner, errorMessage } from '../ui/notice';
import type { Cleanup } from '../router';

const DURATIONS = [15, 30, 45, 60, 90, 120];

export function summarize(d: DayConfig): string {
  if (!d.worked) return 'Fermé';
  if (d.mode === 'full') return `Journée entière · ${d.start_time} – ${d.end_time}`;
  const n = d.slots.length;
  if (n === 0) return 'Aucun créneau défini';
  return `${n} créneau${n > 1 ? 'x' : ''} · ${d.slots.map((s) => `${s.start_time}–${s.end_time}`).join(', ')}`;
}

/** Retourne un message d'erreur lisible ou null si la semaine est cohérente. */
export function validate(days: DayConfig[]): string | null {
  for (const d of days) {
    if (!d.worked) continue;
    const label = capitalize(dayName(d.weekday));
    if (d.mode === 'full' && d.end_time <= d.start_time) return `${label} : l’heure de fin doit suivre l’heure de début.`;
    if (d.mode === 'slots') {
      if (d.slots.length === 0) return `${label} : ajoutez au moins un créneau ou choisissez « Journée entière ».`;
      const starts = new Set<string>();
      for (const s of d.slots) {
        if (!s.start_time || !s.end_time || s.end_time <= s.start_time) return `${label} : chaque créneau doit finir après son début.`;
        if (starts.has(s.start_time)) return `${label} : deux créneaux commencent à ${s.start_time}.`;
        starts.add(s.start_time);
      }
    }
  }
  return null;
}

export function buildAvailability(main: HTMLElement): Cleanup {
  let data: Availability | null = null;
  let sel = 1; // lundi
  let status: { kind: '' | 'error'; text: string } | null = null;
  let saving = false;
  let disposed = false;

  const view = h('div', { style: 'display:flex;flex-direction:column;gap:32px' });
  main.append(view);

  const day = (): DayConfig | undefined => data?.days.find((d) => d.weekday === sel);
  const edit = (fn: (d: DayConfig) => void): void => {
    const d = day();
    if (d) fn(d);
    status = null;
    render();
  };

  function timeInput(label: string, value: string, onChange: (v: string) => void, aria?: string): HTMLElement {
    const input = h('input', { type: 'time', value, 'aria-label': aria ?? null });
    input.addEventListener('change', () => onChange(input.value));
    return aria ? input : h('label', { class: 'field' }, label, input);
  }

  function dayPanel(d: DayConfig): HTMLElement {
    const label = capitalize(dayName(d.weekday));
    const parts: (Node | null)[] = [
      h('div', { class: 'panel-head' },
        h('div', { style: 'display:flex;flex-direction:column;gap:4px;min-width:0' },
          h('h2', {}, label), h('p', { class: 'muted', style: 'font-size:15px' }, summarize(d))),
        // Mobile : la liste de la semaine est remplacée par un bandeau, l'interrupteur passe dans le panneau.
        h('button', {
          class: 'switch panel-switch', role: 'switch', 'aria-checked': d.worked ? 'true' : 'false',
          'aria-label': `${label} : jour travaillé`,
          onclick: () => edit((x) => { x.worked = !x.worked; })
        }))
    ];
    if (!d.worked) {
      parts.push(h('div', { class: 'card', style: 'display:flex;flex-direction:column;align-items:flex-start;gap:16px' },
        h('p', { class: 'muted' }, 'Ce jour n’est pas travaillé : aucun rendez-vous ne peut être pris.'),
        h('button', { class: 'btn btn-accent btn-sm', onclick: () => edit((x) => { x.worked = true; }) }, 'Ouvrir ce jour')));
      return h('div', { class: 'panel' }, ...parts);
    }

    const mode = (m: DayMode, text: string): HTMLElement =>
      h('button', { 'aria-pressed': d.mode === m ? 'true' : 'false', onclick: () => edit((x) => { x.mode = m; }) }, text);
    parts.push(h('div', { class: 'seg', role: 'group', 'aria-label': 'Type de disponibilité' },
      mode('full', 'Journée entière'), mode('slots', 'Créneaux')));

    if (d.mode === 'full') {
      const duration = h('select', {}, ...DURATIONS.map((m) =>
        h('option', { value: m, selected: m === data?.slotMinutes }, `${m} min`)));
      duration.addEventListener('change', () => {
        if (data) data.slotMinutes = Number(duration.value);
        status = null;
      });
      parts.push(
        h('div', { class: 'time-fields' },
          timeInput('Heure de début', d.start_time, (v) => edit((x) => { x.start_time = v; })),
          timeInput('Heure de fin', d.end_time, (v) => edit((x) => { x.end_time = v; }))),
        h('label', { class: 'field' }, 'Durée d’un créneau (tous les jours en « journée entière »)', duration)
      );
    } else {
      parts.push(h('div', { style: 'display:flex;flex-direction:column;gap:12px' },
        ...d.slots.map((s, i) =>
          h('div', { class: 'range-row' },
            timeInput('', s.start_time, (v) => edit(() => { s.start_time = v; }), `Début du créneau ${i + 1}`),
            h('span', { class: 'muted', style: 'font-weight:600' }, 'à'),
            timeInput('', s.end_time, (v) => edit(() => { s.end_time = v; }), `Fin du créneau ${i + 1}`),
            h('button', { class: 'icon-btn', 'aria-label': `Supprimer le créneau ${i + 1}`,
              onclick: () => edit((x) => { x.slots.splice(i, 1); }) }, icon('x', 18, 2))
          )),
        h('button', { class: 'add-range', onclick: () => edit((x) => {
          const last = x.slots[x.slots.length - 1];
          const start = last ? last.end_time : '09:00';
          const hour = Math.min(parseInt(start.slice(0, 2), 10) + 1, 23);
          x.slots.push({ start_time: start, end_time: `${String(hour).padStart(2, '0')}${start.slice(2)}` });
        }) }, icon('plus', 18, 2.4), 'Ajouter un créneau')
      ));
    }
    return h('div', { class: 'panel' }, ...parts);
  }

  async function save(): Promise<void> {
    if (!data) return;
    const problem = validate(data.days);
    if (problem) {
      status = { kind: 'error', text: problem };
      render();
      return;
    }
    saving = true;
    status = null;
    render();
    try {
      await saveAvailability(data);
      status = { kind: '', text: 'Disponibilités enregistrées.' };
    } catch (e) {
      status = { kind: 'error', text: errorMessage(e) };
    }
    saving = false;
    render();
  }

  function render(): void {
    if (!data) {
      view.replaceChildren(status ? banner(status.text, 'error') : h('p', { class: 'muted', role: 'status' }, 'Chargement…'));
      return;
    }
    const current = day();
    fill(view,
      h('div', { class: 'admin-head' },
        h('div', {}, h('div', { class: 'eyebrow' }, 'Administration'), h('h1', {}, 'Disponibilités'),
          h('p', {}, 'Choisissez les jours travaillés et les plages horaires ouvertes à la réservation.')),
        h('button', { class: 'btn btn-dark desktop-only', disabled: saving, onclick: () => void save() }, saving ? 'Enregistrement…' : 'Enregistrer')
      ),
      status ? h('div', { class: 'desktop-only' }, banner(status.text, status.kind)) : null,
      h('div', { class: 'day-strip', role: 'group', 'aria-label': 'Semaine type' },
        ...data.days.map((d) => {
          const name = capitalize(dayName(d.weekday));
          return h('button', {
            class: 'day-chip' + (d.weekday === sel ? ' is-active' : ''),
            'aria-pressed': d.weekday === sel ? 'true' : 'false',
            'aria-label': `${name}, ${d.worked ? 'travaillé' : 'fermé'}`,
            onclick: () => { sel = d.weekday; render(); }
          }, h('span', {}, name.slice(0, 3)), h('i', { class: 'dot' + (d.worked ? ' on' : '') }));
        })
      ),
      h('div', { class: 'cols' },
        h('div', { class: 'col-list' },
          h('h2', {}, 'Semaine type'),
          ...data.days.map((d) =>
            h('div', { class: 'day-row' + (d.weekday === sel ? ' is-active' : '') },
              h('button', {
                class: 'switch', role: 'switch', 'aria-checked': d.worked ? 'true' : 'false',
                'aria-label': `${capitalize(dayName(d.weekday))} : jour travaillé`,
                onclick: () => { d.worked = !d.worked; status = null; render(); }
              }),
              h('button', { class: 'day-pick', onclick: () => { sel = d.weekday; render(); } },
                h('strong', {}, capitalize(dayName(d.weekday))), h('span', {}, summarize(d))),
              icon('chevron-right', 20)
            ))
        ),
        current ? dayPanel(current) : null
      ),
      // Mobile : barre d'enregistrement fixée en bas de l'écran, avec le message d'état.
      h('div', { class: 'save-bar' },
        h('span', { class: 'save-status' + (status?.kind === 'error' ? ' is-error' : ''), role: 'status' },
          status ? status.text : 'Pensez à enregistrer vos modifications.'),
        h('button', { class: 'btn btn-dark', disabled: saving, onclick: () => void save() }, saving ? 'Enregistrement…' : 'Enregistrer'))
    );
  }

  render();
  loadAvailability()
    .then((a) => { if (!disposed) { data = a; render(); } })
    .catch((e) => { if (!disposed) { status = { kind: 'error', text: errorMessage(e) }; render(); } });
  return () => { disposed = true; };
}
