import { describe, expect, it } from 'vitest';
import { validateSettings } from '../admin/settings';
import { DEFAULT_SETTINGS, eventContext, formatAddress, rowToSettings, settingsToRow } from './settings';

const filled = {
  ...DEFAULT_SETTINGS,
  companyName: 'Angel, Éveilleuse d’âmes',
  phone: '06 12 34 56 78',
  street: '12 rue des Lilas',
  complement: '2e étage',
  zip: '75011',
  city: 'Paris'
};

describe('paramètres de la société', () => {
  it('formate l’adresse sur une ligne, en ignorant les parties vides', () => {
    expect(formatAddress(filled)).toBe('12 rue des Lilas, 2e étage, 75011 Paris');
    expect(formatAddress({ ...filled, complement: '' })).toBe('12 rue des Lilas, 75011 Paris');
    expect(formatAddress({ ...filled, street: '', complement: '', zip: '', city: 'Paris' })).toBe('Paris');
    expect(formatAddress(DEFAULT_SETTINGS)).toBe('');
  });
  it('envoie null pour les champs facultatifs vides', () => {
    const row = settingsToRow({ ...DEFAULT_SETTINGS, phone: '  ', street: '' });
    expect(row.phone).toBeNull();
    expect(row.address_street).toBeNull();
    expect(row.company_name).toBe(DEFAULT_SETTINGS.companyName);
  });
  it('fait l’aller-retour ligne ↔ paramètres', () => {
    expect(rowToSettings(settingsToRow(filled))).toEqual(filled);
  });
  it('retombe sur les valeurs par défaut si la ligne est incomplète', () => {
    const s = rowToSettings({});
    expect(s.companyName).toBe(DEFAULT_SETTINGS.companyName);
    expect(s.includeAddress).toBe(true);
    expect(s.timezone).toBe('Europe/Paris');
  });
  it('construit le contexte calendrier : adresse seulement si activée', () => {
    expect(eventContext(filled).location).toBe('12 rue des Lilas, 2e étage, 75011 Paris');
    expect(eventContext({ ...filled, includeAddress: false }).location).toBeUndefined();
    expect(eventContext(DEFAULT_SETTINGS).phone).toBeUndefined();
    expect(eventContext(filled).phone).toBe('06 12 34 56 78');
  });
  it('valide nom obligatoire et téléphone facultatif mais bien formé', () => {
    expect(validateSettings(filled)).toEqual({ name: false, phone: false });
    expect(validateSettings({ ...filled, companyName: '  ' }).name).toBe(true);
    expect(validateSettings({ ...filled, phone: '' }).phone).toBe(false);
    expect(validateSettings({ ...filled, phone: '123' }).phone).toBe(true);
  });
});
