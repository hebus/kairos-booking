import { describe, expect, it } from 'vitest';
import { buildIcs, googleCalendarUrl, type EventContext } from './calendar-export';

const ev = { id: 'abc-123', day: '2026-10-05', start: '09:00', end: '10:00' };
const now = new Date('2026-10-04T11:00:00Z');
const base: EventContext = { company: 'Angel, Éveilleuse d’âmes', timezone: 'Europe/Paris' };
const full: EventContext = { ...base, phone: '06 12 34 56 78', location: '12 rue des Lilas, 75011 Paris' };

describe('export calendrier', () => {
  it('génère un .ics valide avec fuseau, UID stable et rappel', () => {
    const ics = buildIcs(ev, base, now);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:abc-123@kairos-booking');
    expect(ics).toContain('DTSTAMP:20261004T110000Z');
    expect(ics).toContain('DTSTART;TZID=Europe/Paris:20261005T090000');
    expect(ics).toContain('DTEND;TZID=Europe/Paris:20261005T100000');
    expect(ics).toContain('TRIGGER:-PT1H');
    expect(ics).toContain('TZID:Europe/Paris');
  });
  it('échappe les virgules du nom de la société', () => {
    expect(buildIcs(ev, base, now)).toContain('SUMMARY:Rendez-vous — Angel\\, Éveilleuse d’âmes');
  });
  it('n’utilise que des fins de ligne CRLF', () => {
    expect(buildIcs(ev, full, now).replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });
  it('sans adresse ni téléphone : pas de LOCATION ni de contact', () => {
    const ics = buildIcs(ev, base, now);
    expect(ics).not.toContain('LOCATION:');
    expect(ics).not.toContain('Contact');
  });
  it('avec adresse et téléphone : LOCATION échappée et contact dans la description', () => {
    const ics = buildIcs(ev, full, now);
    expect(ics).toContain('LOCATION:12 rue des Lilas\\, 75011 Paris');
    expect(ics).toContain('DESCRIPTION:Rendez-vous réservé en ligne.\\nContact : 06 12 34 56 78');
  });
  it('utilise le fuseau des paramètres', () => {
    const ics = buildIcs(ev, { ...base, timezone: 'Europe/Brussels' }, now);
    expect(ics).toContain('TZID:Europe/Brussels');
    expect(ics).toContain('DTSTART;TZID=Europe/Brussels:20261005T090000');
  });
  it('construit le lien Google Agenda avec lieu et contact', () => {
    const url = new URL(googleCalendarUrl(ev, full));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('dates')).toBe('20261005T090000/20261005T100000');
    expect(url.searchParams.get('ctz')).toBe('Europe/Paris');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('location')).toBe('12 rue des Lilas, 75011 Paris');
    expect(url.searchParams.get('details')).toContain('Contact : 06 12 34 56 78');
  });
  it('Google Agenda sans adresse : pas de paramètre location', () => {
    expect(new URL(googleCalendarUrl(ev, base)).searchParams.has('location')).toBe(false);
  });
});
