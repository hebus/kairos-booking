// « Gérer » : menu mobile qui donne accès aux réglages (sur grand écran, les onglets font ce travail).
import { signOut } from '../data/admin';
import { h, icon, type IconName } from '../ui/dom';

const ITEMS: { href: string; icon: IconName; title: string; text: string }[] = [
  { href: '#/admin/disponibilites', icon: 'clock', title: 'Disponibilités', text: 'Jours travaillés et horaires ouverts' },
  { href: '#/admin/jours-bloques', icon: 'calendar', title: 'Jours bloqués', text: 'Congés, jours fériés, fermetures' },
  { href: '#/admin/parametres', icon: 'user', title: 'Paramètres', text: 'Nom, téléphone, adresse, fuseau' }
];

export function buildMenu(main: HTMLElement): void {
  main.append(
    h('div', { style: 'display:flex;flex-direction:column;gap:4px' },
      h('h1', {}, 'Gérer'), h('p', { class: 'muted' }, 'Réglages de votre activité.')),
    h('nav', { class: 'menu-list', 'aria-label': 'Réglages' },
      ...ITEMS.map((i) =>
        h('a', { class: 'menu-item', href: i.href },
          h('span', { class: 'menu-icon' }, icon(i.icon, 22)),
          h('span', { class: 'menu-text' }, h('strong', {}, i.title), h('span', {}, i.text)),
          icon('chevron-right', 20))
      )
    ),
    h('button', {
      class: 'btn btn-outline',
      onclick: async () => { await signOut(); location.reload(); }
    }, 'Se déconnecter')
  );
}
