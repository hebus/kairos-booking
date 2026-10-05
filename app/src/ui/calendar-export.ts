// Export d'un rendez-vous vers le calendrier de l'utilisateur : fichier .ics (universel) et lien Google Agenda.
// Logique pure (sans DOM) pour rester testable ; seul downloadIcs touche au navigateur.

export interface CalendarEvent {
  id: string; // UID stable : réimporter le même rendez-vous met l'événement à jour
  day: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
}

/** Informations de la société et du lieu, issues des paramètres Admin. */
export interface EventContext {
  company: string;
  timezone: string; // Europe/Paris, Europe/Brussels ou Europe/Zurich (mêmes règles d'heure d'été)
  phone?: string;
  location?: string; // adresse déjà formatée ; absente si non renseignée ou désactivée
}

const compactDate = (day: string): string => day.replace(/-/g, '');
const compactTime = (hhmm: string): string => hhmm.replace(':', '') + '00';
const stamp = (day: string, hhmm: string): string => `${compactDate(day)}T${compactTime(hhmm)}`;

export const eventTitle = (ctx: EventContext): string => `Rendez-vous — ${ctx.company}`;

/** Description en plusieurs lignes : mention + contact téléphonique si renseigné. */
export function eventDescription(ctx: EventContext): string {
  const lines = ['Rendez-vous réservé en ligne.'];
  if (ctx.phone) lines.push(`Contact : ${ctx.phone}`);
  return lines.join('\n');
}

/** Échappement des textes ICS (RFC 5545 §3.3.11). */
function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Paris, Bruxelles et Zurich partagent les mêmes règles : seul le TZID change. */
function vtimezone(tzid: string): string[] {
  return [
    'BEGIN:VTIMEZONE',
    `TZID:${tzid}`,
    'BEGIN:STANDARD',
    'DTSTART:19701025T030000',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'TZNAME:CET',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700329T020000',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'TZNAME:CEST',
    'END:DAYLIGHT',
    'END:VTIMEZONE'
  ];
}

/** Contenu du fichier .ics (fins de ligne CRLF). `now` est injectable pour les tests. */
export function buildIcs(ev: CalendarEvent, ctx: EventContext, now: Date = new Date()): string {
  const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kairos//Prise de rendez-vous//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...vtimezone(ctx.timezone),
    'BEGIN:VEVENT',
    `UID:${ev.id}@kairos-booking`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${ctx.timezone}:${stamp(ev.day, ev.start)}`,
    `DTEND;TZID=${ctx.timezone}:${stamp(ev.day, ev.end)}`,
    `SUMMARY:${escapeText(eventTitle(ctx))}`,
    `DESCRIPTION:${escapeText(eventDescription(ctx))}`,
    ...(ctx.location ? [`LOCATION:${escapeText(ctx.location)}`] : []),
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(eventTitle(ctx))}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(eventTitle(ctx))}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return lines.join('\r\n') + '\r\n';
}

export function googleCalendarUrl(ev: CalendarEvent, ctx: EventContext): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle(ctx),
    dates: `${stamp(ev.day, ev.start)}/${stamp(ev.day, ev.end)}`,
    ctz: ctx.timezone,
    details: eventDescription(ctx)
  });
  if (ctx.location) params.set('location', ctx.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Télécharge le .ics (navigateur uniquement). */
export function downloadIcs(ev: CalendarEvent, ctx: EventContext): void {
  const blob = new Blob([buildIcs(ev, ctx)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rendez-vous-${ev.day}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
