// Coque Admin : garde d'accès (session + table admins), menu à 3 onglets, connexion.
import { getSession, isAdmin, signIn, signOut } from '../data/admin';
import { configured } from '../data/supabase';
import { h } from '../ui/dom';
import { banner, errorMessage, missingConfig } from '../ui/notice';
import type { Cleanup, RenderFn } from '../router';

export type AdminTab = 'rendez-vous' | 'disponibilites' | 'jours-bloques';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'rendez-vous', label: 'Rendez-vous' },
  { id: 'disponibilites', label: 'Disponibilités' },
  { id: 'jours-bloques', label: 'Jours bloqués' }
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

    const main = h('div', { style: 'display:flex;flex-direction:column;gap:32px' });
    root.append(
      h('div', { class: 'admin' },
        h('nav', { class: 'tabs', 'aria-label': 'Administration' },
          ...TABS.map((t) =>
            h('a', {
              class: 'tab' + (t.id === active ? ' is-active' : ''),
              href: '#/admin/' + t.id,
              'aria-current': t.id === active ? 'page' : null
            }, t.label)
          ),
          h('span', { class: 'spacer' }),
          h('button', {
            class: 'btn btn-outline btn-sm',
            onclick: async () => { await signOut(); location.reload(); }
          }, 'Se déconnecter')
        ),
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
