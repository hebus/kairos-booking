// Export d'un rendez-vous vers le calendrier de l'utilisateur : fichier .ics (universel) et lien Google Agenda.
// Logique pure (sans DOM) pour rester testable ; seul downloadIcs touche au navigateur.
import { BRAND, TIMEZONE } from '../config';

export interface CalendarEvent {
  id: string; // UID stable : réimporter le même rendez-vous met l'événement à jour
  day: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
}

const compactDate = (day: string): string => day.replace(/-/g, '');
const compactTime = (hhmm: string): string => hhmm.replace(':', '') + '00';
const stamp = (day: string, hhmm: string): string => `${compactDate(day)}T${compactTime(hhmm)}`;

export const eventTitle = (): string => `Rendez-vous — ${BRAND.company}`;
const DESCRIPTION = 'Rendez-vous réservé en ligne.';

/** Échappement des textes ICS (RFC 5545 §3.3.11). */
function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

const VTIMEZONE_PARIS = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Paris',
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

/** Contenu du fichier .ics (fins de ligne CRLF). `now` est injectable pour les tests. */
export function buildIcs(ev: CalendarEvent, now: Date = new Date()): string {
  const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kairos//Prise de rendez-vous//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...VTIMEZONE_PARIS,
    'BEGIN:VEVENT',
    `UID:${ev.id}@kairos-booking`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${TIMEZONE}:${stamp(ev.day, ev.start)}`,
    `DTEND;TZID=${TIMEZONE}:${stamp(ev.day, ev.end)}`,
    `SUMMARY:${escapeText(eventTitle())}`,
    `DESCRIPTION:${escapeText(DESCRIPTION)}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(eventTitle())}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return lines.join('\r\n') + '\r\n';
}

export function googleCalendarUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle(),
    dates: `${stamp(ev.day, ev.start)}/${stamp(ev.day, ev.end)}`,
    ctz: TIMEZONE,
    details: DESCRIPTION
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Télécharge le .ics (navigateur uniquement). */
export function downloadIcs(ev: CalendarEvent): void {
  const blob = new Blob([buildIcs(ev)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rendez-vous-${ev.day}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
