import { describe, expect, it } from 'vitest';
import { buildIcs, googleCalendarUrl } from './calendar-export';

const ev = { id: 'abc-123', day: '2026-10-05', start: '09:00', end: '10:00' };
const now = new Date('2026-10-04T11:00:00Z');

describe('export calendrier', () => {
  it('génère un .ics valide avec fuseau, UID stable et rappel', () => {
    const ics = buildIcs(ev, now);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:abc-123@kairos-booking');
    expect(ics).toContain('DTSTAMP:20261004T110000Z');
    expect(ics).toContain('DTSTART;TZID=Europe/Paris:20261005T090000');
    expect(ics).toContain('DTEND;TZID=Europe/Paris:20261005T100000');
    expect(ics).toContain('TRIGGER:-PT1H');
    expect(ics).toContain('BEGIN:VTIMEZONE');
  });
  it('échappe les virgules du nom de la société', () => {
    expect(buildIcs(ev, now)).toContain('SUMMARY:Rendez-vous — Angel\\, Éveilleuse d’âmes');
  });
  it('n’utilise que des fins de ligne CRLF', () => {
    expect(buildIcs(ev, now).replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });
  it('construit le lien Google Agenda', () => {
    const url = new URL(googleCalendarUrl(ev));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('dates')).toBe('20261005T090000/20261005T100000');
    expect(url.searchParams.get('ctz')).toBe('Europe/Paris');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
  });
});
