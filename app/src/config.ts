// Identité affichée. Pour réutiliser l'appli pour une autre société, ne modifier que ce fichier.
export const BRAND = {
  app: 'Kairos',
  company: 'Angel, Éveilleuse d’âmes'
} as const;

/** Adresse encodée dans le QR code de l'Admin : une redirection qui reste valable si le site change d'adresse. */
export const QR_URL = 'https://hebus.github.io/qr-redirect/?r=angel-eveilleuse-d-ames';

/** Fuseau du lieu. Doit correspondre à settings.timezone en base ; l'export calendrier (.ics) ne définit que Europe/Paris. */
export const TIMEZONE = 'Europe/Paris';
