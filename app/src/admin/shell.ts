// Coque Admin : garde d'accès (session + table admins), menu à 3 onglets, connexion.
import { getSession, isAdmin, signIn, signOut } from '../data/admin';
import { configured } from '../data/supabase';
import { h, icon, type IconName } from '../ui/dom';
import { banner, errorMessage, missingConfig } from '../ui/notice';
import type { Cleanup, RenderFn } from '../router';

export type AdminTab = 'rendez-vous' | 'gerer' | 'disponibilites' | 'jours-bloques' | 'parametres' | 'qr-code';

// Onglets de la version large ; « Gérer » n'existe qu'en mobile (menu d'accès aux réglages).
const TABS: { id: AdminTab; label: string; icon?: IconName }[] = [
  { id: 'rendez-vous', label: 'Rendez-vous' },
  { id: 'disponibilites', label: 'Disponibilités' },
  { id: 'jours-bloques', label: 'Jours bloqués' },
  { id: 'parametres', label: 'Paramètres' },
  { id: 'qr-code', label: 'QR code', icon: 'qr' }
];

export function adminRoute(
  active: AdminTab,
  build: (main: HTMLElement) => Cleanup | Promise<Cleanup>
): RenderFn {
  return async (root) => {
    if (!configured) {
      root.append(h('main', { class: 'login' }, missingConfig()));
      return;
    }
    let allowed = false;
    try {
      allowed = (await getSession()) !== null && (await isAdmin());
    } catch {
      allowed = false;
    }
    if (!allowed) {
      renderLogin(root);
      return;
    }

    const main = h('div', { class: 'admin-main' });
    root.append(
      h('div', { class: 'admin', 'data-page': active },
        h('nav', { class: 'tabs', 'aria-label': 'Administration' },
          ...TABS.map((t) =>
            h('a', {
              class: 'tab' + (t.id === active ? ' is-active' : ''),
              href: '#/admin/' + t.id,
              'aria-current': t.id === active ? 'page' : null,
              ...(t.icon ? { 'aria-label': t.label, title: t.label } : {})
            }, t.icon ? icon(t.icon, 22) : t.label)
          ),
          h('span', { class: 'spacer' }),
          h('button', {
            class: 'btn btn-outline btn-sm',
            onclick: async () => { await signOut(); location.reload(); }
          }, 'Se déconnecter')
        ),
        // Mobile : plus d'onglets, un retour vers le parent (Gérer, ou Rendez-vous depuis Gérer).
        active === 'rendez-vous'
          ? null
          : h('a', {
              class: 'back-link',
              href: '#/admin/' + (active === 'gerer' ? 'rendez-vous' : 'gerer')
            }, icon('chevron-left', 22, 2.2), 'Retour'),
        main
      )
    );
    return build(main);
  };
}

function renderLogin(root: HTMLElement): void {
  const email = h('input', { type: 'email', autocomplete: 'username', required: true });
  const password = h('input', { type: 'password', autocomplete: 'current-password', required: true });
  const errorBox = h('div');
  const submit = h('button', { class: 'btn btn-dark btn-block', type: 'submit' }, 'Se connecter');
  const form = h('form', { class: 'form' },
    h('label', { class: 'field' }, 'Email', email),
    h('label', { class: 'field' }, 'Mot de passe', password),
    errorBox,
    submit
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submit.setAttribute('disabled', '');
    errorBox.replaceChildren();
    try {
      await signIn(email.value.trim(), password.value);
      if (!(await isAdmin())) {
        await signOut();
        throw new Error('Ce compte n’a pas accès à l’administration.');
      }
      location.reload(); // session admin prête : le hash est conservé, la route est ré-évaluée
    } catch (err) {
      errorBox.replaceChildren(banner(errorMessage(err), 'error'));
      submit.removeAttribute('disabled');
    }
  });
  root.append(
    h('main', { class: 'login' },
      h('div', { style: 'display:flex;flex-direction:column;gap:6px' },
        h('div', { class: 'eyebrow' }, 'Administration'),
        h('h1', {}, 'Connexion')
      ),
      form
    )
  );
  email.focus();
}
