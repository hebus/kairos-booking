// Création / modification du profil (localStorage) ; la modification est répercutée sur Supabase.
import { pushProfile } from '../data/booking';
import { getProfile, saveProfile } from '../data/profile-store';
import { h, icon } from '../ui/dom';
import { isValidProfile, type Profile } from '../ui/format';
import { banner, errorMessage } from '../ui/notice';
import { go, type RenderFn } from '../router';
import { draft, setFlash } from './draft';

export const renderProfile: RenderFn = (root) => {
  const existing = getProfile();
  const target = (): string => draft.returnTo ?? '/';
  const leave = (): void => {
    const to = target();
    delete draft.returnTo;
    go(to);
  };

  const first = h('input', { type: 'text', autocomplete: 'given-name', maxlength: 60, value: existing?.first });
  const last = h('input', { type: 'text', autocomplete: 'family-name', maxlength: 60, value: existing?.last });
  const phone = h('input', { type: 'tel', autocomplete: 'tel', maxlength: 24, value: existing?.phone });
  const errorBox = h('div');
  const cta = h('button', { class: 'btn btn-dark btn-block', disabled: true },
    existing ? 'Enregistrer les modifications' : 'Créer mon profil');

  const read = (): Profile => ({ first: first.value, last: last.value, phone: phone.value });
  const refresh = (): void => { cta.toggleAttribute('disabled', !isValidProfile(read())); };
  for (const i of [first, last, phone]) i.addEventListener('input', refresh);
  refresh();

  cta.addEventListener('click', async () => {
    const p = read();
    if (!isValidProfile(p)) return;
    cta.setAttribute('disabled', '');
    errorBox.replaceChildren();
    saveProfile(p); // local d'abord : le profil est utilisable même si la synchro échoue
    try {
      await pushProfile(p);
      setFlash(existing
        ? 'Profil mis à jour. Le professionnel voit vos nouvelles informations.'
        : 'Profil créé. Il sera utilisé pour vos prochaines réservations.');
      leave();
    } catch (e) {
      errorBox.replaceChildren(banner(`Profil enregistré sur cet appareil, mais pas chez le professionnel : ${errorMessage(e)}`, 'warn'));
      refresh();
    }
  });

  const form = h('form', { class: 'form' },
    h('label', { class: 'field' }, 'Prénom', first),
    h('label', { class: 'field' }, 'Nom', last),
    h('label', { class: 'field' }, 'Numéro de téléphone', phone)
  );
  form.addEventListener('submit', (e) => e.preventDefault());

  root.append(
    h('main', { class: 'client' },
      h('div', { class: 'client-pad' }, h('button', { class: 'back', onclick: leave }, icon('chevron-left'), 'Retour')),
      h('div', { class: 'client-body' },
        h('div', { style: 'display:flex;flex-direction:column;gap:4px' },
          h('h1', {}, existing ? 'Mon profil' : 'Créer mon profil'),
          h('p', { class: 'muted', style: 'font-size:15px' }, existing
            ? 'Vos modifications sont aussi mises à jour chez le professionnel, y compris pour vos rendez-vous à venir.'
            : 'Il sera utilisé automatiquement pour vos prochaines réservations.')
        ),
        form,
        errorBox
      ),
      h('div', { class: 'cta-bar' }, cta)
    )
  );
};
