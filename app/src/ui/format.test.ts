import { describe, expect, it } from 'vitest';
import { capitalize, formatDay, hhmm, isValidPhone, isValidProfile, parseIso, toIso } from './format';

describe('dates', () => {
  it('formate un jour en français', () => {
    expect(formatDay('2026-10-05')).toBe('lundi 5 octobre');
    expect(capitalize(formatDay('2026-12-25'))).toBe('Vendredi 25 décembre');
  });
  it('fait l’aller-retour ISO sans décalage de fuseau', () => {
    expect(toIso(parseIso('2026-03-29'))).toBe('2026-03-29');
    expect(toIso(parseIso('2026-10-25'))).toBe('2026-10-25');
  });
  it('tronque les heures', () => {
    expect(hhmm('09:30:00')).toBe('09:30');
  });
});

describe('téléphone et profil', () => {
  it('accepte les formats courants', () => {
    expect(isValidPhone('06 12 34 56 78')).toBe(true);
    expect(isValidPhone('+33 6 12 34 56 78')).toBe(true);
  });
  it('refuse trop court ou caractères invalides', () => {
    expect(isValidPhone('0612')).toBe(false);
    expect(isValidPhone('abcdefghij')).toBe(false);
  });
  it('valide un profil complet', () => {
    expect(isValidProfile({ first: 'Camille', last: 'Martin', phone: '06 12 34 56 78' })).toBe(true);
    expect(isValidProfile({ first: ' ', last: 'Martin', phone: '06 12 34 56 78' })).toBe(false);
  });
});
