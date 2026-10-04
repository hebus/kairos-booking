// Carte « Où et comment nous joindre » : adresse et téléphone de la société (null si rien n'est renseigné).
import { formatAddress, getSettings } from '../data/settings';
import { h, icon } from '../ui/dom';

export function contactCard(): HTMLElement | null {
  const s = getSettings();
  const address = formatAddress(s);
  if (!address && !s.phone) return null;
  return h('div', { class: 'card contact' },
    h('div', { class: 'contact-title' }, s.companyName),
    address ? h('div', { class: 'contact-row' }, icon('map-pin', 18), h('span', {}, address)) : null,
    s.phone
      ? h('a', { class: 'contact-row contact-link', href: 'tel:' + s.phone.replace(/\s/g, '') }, icon('phone', 18), s.phone)
      : null
  );
}
