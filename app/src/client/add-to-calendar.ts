// Boutons « Ajouter à mon calendrier » (.ics) et « Google Agenda ».
// Le nom, le fuseau, le téléphone et l'adresse viennent des paramètres Admin (eventContext).
import { eventContext } from '../data/settings';
import { downloadIcs, googleCalendarUrl, type CalendarEvent } from '../ui/calendar-export';
import { h, icon } from '../ui/dom';

export function addToCalendar(ev: CalendarEvent, opts: { hint?: boolean } = {}): HTMLElement {
  const ctx = eventContext();
  return h('div', { class: 'cal-actions-wrap' },
    h('div', { class: 'cal-actions' },
      h('button', { class: 'btn btn-outline btn-sm', onclick: () => downloadIcs(ev, ctx) },
        icon('calendar', 18), 'Ajouter à mon calendrier'),
      h('a', { class: 'btn btn-outline btn-sm', href: googleCalendarUrl(ev, ctx), target: '_blank', rel: 'noopener noreferrer' },
        'Google Agenda')
    ),
    opts.hint
      ? h('p', { class: 'muted', style: 'font-size:13px' },
          'Si vous annulez ce rendez-vous, pensez à le retirer de votre calendrier : il n’est pas supprimé automatiquement.')
      : null
  );
}
