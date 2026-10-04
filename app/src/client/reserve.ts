// Réservation : confirmation directe si un profil existe, sinon formulaire (qui crée le profil).
import { book, myAppointments } from '../data/booking';
import { getProfile, saveProfile } from '../data/profile-store';
import { h, icon } from '../ui/dom';
import { capitalize, formatDay, fullName, isValidProfile, type Profile } from '../ui/format';
import { banner, errorMessage, missingConfig } from '../ui/notice';
import { go, type RenderFn } from '../router';
import { draft, resetDraft } from './draft';

function backButton(onclick: () => void): HTMLElement {
  return h('button', { class: 'back', onclick }, icon('chevron-left'), 'Retour');
}

function summary(day: string, start: string): HTMLElement {
  return h('div', { class: 'card soft' },
    h('div', { class: 'summary-day' }, capitalize(formatDay(day))),
    h('div', { class: 'summary-time' }, start)
  );
}

async function submit(profile: Profile, day: string, start: string, createProfile: boolean): Promise<void> {
  await book(day, start, profile);
  if (createProfile) saveProfile(profile);
  draft.done = { day, start, name: profile.first.trim(), createdProfile: createProfile };
  void myAppointments().catch(() => {}); // rafraîchit le cache (badge)
  go('/confirme');
}

export const renderReserve: RenderFn = (root) => {
  const day = draft.day;
  const slot = draft.slot;
  if (!day || !slot) {
    go('/');
    return;
  }
  const existing = getProfile();
  const errorBox = h('div');
  const showError = (e: unknown): void => errorBox.replaceChildren(banner(errorMessage(e), 'error'));

  if (existing) {
    const cta = h('button', { class: 'btn btn-dark btn-block' }, 'Confirmer le rendez-vous');
    cta.addEventListener('click', () => {
      cta.setAttribute('disabled', '');
      errorBox.replaceChildren();
      submit(existing, day, slot.start, false).catch((e) => { showError(e); cta.removeAttribute('disabled'); });
    });
    root.append(
      h('main', { class: 'client' },
        h('div', { class: 'client-pad' }, backButton(() => go('/'))),
        h('div', { class: 'client-body' },
          h('h1', {}, 'Confirmer le rendez-vous'),
          missingConfig(),
          summary(day, slot.start),
          h('div', { class: 'card', style: 'display:flex;flex-direction:column;gap:12px' },
            h('div', { class: 'muted', style: 'font-size:14px;font-weight:700' }, 'Réservé avec votre profil'),
            h('div', {},
              h('div', { style: 'font-size:18px;font-weight:700' }, fullName(existing.first, existing.last)),
              h('div', { class: 'muted', style: 'font-size:16px' }, existing.phone)
            ),
            h('button', { class: 'link-btn', style: 'align-self:flex-start', onclick: () => { draft.returnTo = '/reserver'; go('/profil'); } },
              'Modifier mon profil')
          ),
          errorBox
        ),
        h('div', { class: 'cta-bar' }, cta)
      )
    );
    return;
  }

  // Pas de profil : on collecte les coordonnées ; il sera créé après la réservation réussie.
  const first = h('input', { type: 'text', autocomplete: 'given-name', maxlength: 60 });
  const last = h('input', { type: 'text', autocomplete: 'family-name', maxlength: 60 });
  const phone = h('input', { type: 'tel', autocomplete: 'tel', maxlength: 24 });
  const cta = h('button', { class: 'btn btn-dark btn-block', disabled: true }, 'Confirmer et créer mon profil');
  const read = (): Profile => ({ first: first.value, last: last.value, phone: phone.value });
  const refresh = (): void => { cta.toggleAttribute('disabled', !isValidProfile(read())); };
  for (const i of [first, last, phone]) i.addEventListener('input', refresh);

  const form = h('form', { class: 'form' },
    h('label', { class: 'field' }, 'Prénom', first),
    h('label', { class: 'field' }, 'Nom', last),
    h('label', { class: 'field' }, 'Numéro de téléphone', phone)
  );
  form.addEventListener('submit', (e) => e.preventDefault());
  cta.addEventListener('click', () => {
    const p = read();
    if (!isValidProfile(p)) return;
    cta.setAttribute('disabled', '');
    errorBox.replaceChildren();
    submit(p, day, slot.start, true).catch((err) => { showError(err); refresh(); });
  });

  root.append(
    h('main', { class: 'client' },
      h('div', { class: 'client-pad' }, backButton(() => go('/'))),
      h('div', { class: 'client-body' },
        h('div', { style: 'display:flex;flex-direction:column;gap:4px' },
          h('h1', {}, 'Vos coordonnées'),
          h('p', { class: 'muted', style: 'font-size:15px' },
            'Elles seront transmises au professionnel et enregistrées sur cet appareil pour vos prochaines réservations.')
        ),
        missingConfig(),
        summary(day, slot.start),
        form,
        errorBox
      ),
      h('div', { class: 'cta-bar' }, cta)
    )
  );
  first.focus();
};

export const renderDone: RenderFn = (root) => {
  const done = draft.done;
  if (!done) {
    go('/');
    return;
  }
  root.append(
    h('main', { class: 'client' },
      h('div', { class: 'done' },
        h('div', { class: 'done-check' }, icon('check', 36, 2.6)),
        h('h1', {}, 'Rendez-vous confirmé'),
        h('p', { class: 'muted', style: 'font-size:16px' }, `Merci ${done.name}, nous vous attendons.`),
        h('div', { class: 'card soft' },
          h('div', { style: 'font-size:18px;font-weight:700' }, capitalize(formatDay(done.day))),
          h('div', { style: 'font-size:32px;font-weight:800;letter-spacing:-0.02em;color:var(--accent-ink)' }, done.start)
        ),
        done.createdProfile
          ? h('p', { style: 'font-size:14px;font-weight:600;color:var(--ok-ink)' },
              'Votre profil a été créé : il sera utilisé pour vos prochaines réservations.')
          : null,
        h('button', { class: 'btn btn-outline btn-block', onclick: () => { resetDraft(); go('/'); } }, 'Prendre un autre rendez-vous'),
        h('button', { class: 'link-btn', onclick: () => { resetDraft(); go('/rendez-vous'); } }, 'Voir mes rendez-vous')
      )
    )
  );
};
