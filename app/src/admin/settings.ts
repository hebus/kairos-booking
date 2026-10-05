// Paramètres de la société : nom, téléphone, adresse, fuseau. Aperçu de l'événement calendrier en direct.
import { loadSettings, saveSettings } from '../data/admin';
import { TIMEZONES, formatAddress, type CompanySettings } from '../data/settings';
import { fill, h, icon } from '../ui/dom';
import { notificationsSection } from './notifications';
import { isValidPhone } from '../ui/format';
import { banner, errorMessage } from '../ui/notice';
import type { Cleanup } from '../router';

const ZONE_LABELS: Record<string, string> = {
  'Europe/Paris': 'Europe/Paris (heure de Paris)',
  'Europe/Brussels': 'Europe/Brussels (heure de Bruxelles)',
  'Europe/Zurich': 'Europe/Zurich (heure de Zurich)'
};

/** Erreurs de validation (mêmes règles que les contraintes SQL). */
export function validateSettings(s: CompanySettings): { name: boolean; phone: boolean } {
  return {
    name: s.companyName.trim() === '' || s.companyName.trim().length > 100,
    phone: s.phone.trim() !== '' && !isValidPhone(s.phone)
  };
}

export function buildSettings(main: HTMLElement): Cleanup {
  let s: CompanySettings | null = null;
  let status: { kind: '' | 'error'; text: string } | null = null;
  let saving = false;
  let dirty = false;
  let disposed = false;

  const root = h('div', { style: 'display:flex;flex-direction:column;gap:32px' });
  main.append(root);

  function field(label: string, opts: { hint?: string; type?: string; autocomplete?: string; placeholder?: string; get: () => string; set: (v: string) => void; maxlength?: number }): HTMLElement {
    const input = h('input', { type: opts.type ?? 'text', value: opts.get(), autocomplete: opts.autocomplete, placeholder: opts.placeholder, maxlength: opts.maxlength });
    input.addEventListener('input', () => { opts.set(input.value); dirty = true; status = null; refresh(); });
    return h('label', { class: 'field' }, h('span', {}, label, opts.hint ? h('span', { class: 'muted', style: 'font-weight:500' }, ' ' + opts.hint) : null), input);
  }

  // Éléments mis à jour sans reconstruire les champs (pour garder le focus en cours de saisie).
  const nameError = h('div', { class: 'field-error', role: 'alert', hidden: true }, 'Le nom de la société est obligatoire.');
  const phoneError = h('div', { class: 'field-error', role: 'alert', hidden: true }, 'Numéro invalide : 8 chiffres minimum, uniquement chiffres, espaces et + ( ) . -');
  const statusBox = h('div', { class: 'desktop-only' });
  // Grand écran : bouton dans l'en-tête. Mobile : barre fixée en bas de l'écran avec le message d'état.
  const saveBtn = h('button', { class: 'btn btn-dark desktop-only', onclick: () => void save() }, 'Enregistrer');
  const barBtn = h('button', { class: 'btn btn-dark', onclick: () => void save() }, 'Enregistrer');
  const barStatus = h('span', { class: 'save-status', role: 'status' });
  const saveBar = h('div', { class: 'save-bar' }, barStatus, barBtn);
  const preview = h('div', { class: 'event' });

  function refresh(): void {
    if (!s) return;
    const err = validateSettings(s);
    nameError.hidden = !err.name;
    phoneError.hidden = !err.phone;
    const blocked = err.name || err.phone || saving;
    const label = saving ? 'Enregistrement…' : dirty || !status ? 'Enregistrer' : 'Enregistré ✓';
    for (const b of [saveBtn, barBtn]) {
      b.toggleAttribute('disabled', blocked);
      b.textContent = label;
    }
    barStatus.textContent = status ? status.text : dirty ? 'Modifications non enregistrées.' : '';
    barStatus.classList.toggle('is-error', status?.kind === 'error');
    fill(statusBox, status ? banner(status.text, status.kind) : null);

    const address = formatAddress(s);
    const title = `Rendez-vous — ${s.companyName.trim() || '[nom de la société]'}`;
    fill(preview,
      h('div', {},
        h('div', { class: 'event-day' }, 'Lundi 5 octobre'),
        h('div', { class: 'event-title' }, title)),
      h('div', { class: 'event-row' }, icon('clock', 18), h('span', {}, '09:00 – 10:00')),
      h('div', { class: 'event-row' }, icon('map-pin', 18),
        address && s.includeAddress
          ? h('span', {}, address)
          : h('span', { class: 'muted', style: 'font-weight:500' }, address ? 'L’adresse n’apparaîtra pas dans l’événement' : 'Aucune adresse renseignée')),
      h('div', { class: 'event-row' }, icon('phone', 18),
        s.phone.trim() && !err.phone
          ? h('span', {}, s.phone.trim())
          : h('span', { class: 'muted', style: 'font-weight:500' }, 'Aucun numéro renseigné')),
      h('div', { class: 'event-row muted', style: 'font-size:14px;font-weight:500' }, icon('bell', 18), h('span', {}, 'Rappel 1 heure avant'))
    );
  }

  async function save(): Promise<void> {
    if (!s) return;
    const err = validateSettings(s);
    if (err.name || err.phone) return;
    saving = true;
    status = null;
    refresh();
    try {
      await saveSettings(s);
      dirty = false;
      status = { kind: '', text: 'Paramètres enregistrés.' };
    } catch (e) {
      status = { kind: 'error', text: errorMessage(e) };
    }
    saving = false;
    refresh();
  }

  function render(): void {
    if (!s) {
      fill(root, status ? banner(status.text, 'error') : h('p', { class: 'muted', role: 'status' }, 'Chargement…'));
      return;
    }
    const cur = s;
    const includeSwitch = h('button', {
      class: 'switch', role: 'switch', 'aria-checked': cur.includeAddress ? 'true' : 'false', 'aria-labelledby': 'lbl-include',
      onclick: () => {
        cur.includeAddress = !cur.includeAddress;
        includeSwitch.setAttribute('aria-checked', cur.includeAddress ? 'true' : 'false');
        dirty = true; status = null; refresh();
      }
    });
    const tz = h('select', {}, ...TIMEZONES.map((z) => h('option', { value: z, selected: z === cur.timezone }, ZONE_LABELS[z] ?? z)));
    tz.addEventListener('change', () => { cur.timezone = tz.value; dirty = true; status = null; refresh(); });

    fill(root,
      h('div', { class: 'admin-head' },
        h('div', {},
          h('div', { class: 'eyebrow' }, 'Administration'),
          h('h1', {}, 'Paramètres'),
          h('p', {}, 'Les informations de votre société, affichées aux clients et dans leur calendrier.')),
        saveBtn),
      statusBox,
      h('div', { class: 'cols' },
        h('div', { style: 'flex:1.4 1 480px;min-width:0;display:flex;flex-direction:column;gap:24px' },
          h('section', { class: 'sec' },
            h('div', {}, h('h2', {}, 'Société'),
              h('p', { class: 'muted', style: 'font-size:14px' }, 'Le nom apparaît en haut de l’écran client et dans le titre de l’événement calendrier.')),
            field('Nom de la société', { get: () => cur.companyName, set: (v) => { cur.companyName = v; }, maxlength: 100 }),
            nameError,
            field('Numéro de téléphone', { hint: '(facultatif)', type: 'tel', autocomplete: 'tel', placeholder: '06 12 34 56 78', get: () => cur.phone, set: (v) => { cur.phone = v; }, maxlength: 24 }),
            phoneError,
            h('p', { class: 'muted', style: 'font-size:14px' }, 'Affiché aux clients pour vous joindre, et ajouté à l’événement calendrier.')),
          h('section', { class: 'sec' },
            h('div', {}, h('h2', {}, 'Adresse'), h('p', { class: 'muted', style: 'font-size:14px' }, 'Facultative. Elle indique aux clients où se rendre.')),
            field('Adresse', { autocomplete: 'address-line1', get: () => cur.street, set: (v) => { cur.street = v; }, maxlength: 160 }),
            field('Complément', { hint: '(étage, code d’accès, parking…)', autocomplete: 'address-line2', get: () => cur.complement, set: (v) => { cur.complement = v; }, maxlength: 160 }),
            h('div', { class: 'time-fields' },
              field('Code postal', { autocomplete: 'postal-code', get: () => cur.zip, set: (v) => { cur.zip = v; }, maxlength: 16 }),
              field('Ville', { autocomplete: 'address-level2', get: () => cur.city, set: (v) => { cur.city = v; }, maxlength: 80 })),
            h('div', { class: 'switch-row' },
              includeSwitch,
              h('div', { style: 'display:flex;flex-direction:column;gap:2px;min-width:0' },
                h('span', { id: 'lbl-include', style: 'font-size:16px;font-weight:700' }, 'Ajouter l’adresse à l’événement calendrier'),
                h('span', { class: 'muted', style: 'font-size:14px' }, 'Le client la retrouve dans son agenda après l’ajout du rendez-vous.')))),
          h('section', { class: 'sec' },
            h('div', {}, h('h2', {}, 'Fuseau horaire'),
              h('p', { class: 'muted', style: 'font-size:14px' }, 'Détermine le « aujourd’hui » de la réservation et l’heure des événements calendrier.')),
            h('label', { class: 'field' }, 'Fuseau du lieu', tz)),
          notificationsSection()),
        h('aside', { style: 'flex:1 1 340px;min-width:0;display:flex;flex-direction:column;gap:12px' },
          h('h2', {}, 'Aperçu dans le calendrier du client'),
          preview,
          h('p', { class: 'muted', style: 'font-size:13px' }, 'L’aperçu se met à jour pendant la saisie. Les événements déjà ajoutés par les clients ne sont pas modifiés.'))),
      saveBar
    );
    refresh();
  }

  render();
  loadSettings()
    .then((loaded) => { if (!disposed) { s = loaded; render(); } })
    .catch((e) => { if (!disposed) { status = { kind: 'error', text: errorMessage(e) }; render(); } });
  return () => { disposed = true; };
}
