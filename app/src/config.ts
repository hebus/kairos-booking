// Identité affichée. Pour réutiliser l'appli pour une autre société, ne modifier que ce fichier.
export const BRAND = {
  app: 'Kairos',
  company: 'Angel, Éveilleuse d’âmes'
} as const;

/** Fuseau du lieu. Doit correspondre à settings.timezone en base ; l'export calendrier (.ics) ne définit que Europe/Paris. */
export const TIMEZONE = 'Europe/Paris';
