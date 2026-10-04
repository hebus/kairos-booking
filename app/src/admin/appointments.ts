// Page par défaut de l'Admin : rendez-vous à venir, alertes d'annulation, suppression, recherche.
import { deleteAppointment, listAppointments, markSeen, subscribeAppointments } from '../data/admin';
import type { Appointment } from '../data/types';
import { emptyState, fill, h, icon } from '../ui/dom';
import { capitalize, digitsOf, formatDay, fullName, hhmm, toIso } from '../ui/format';
import { banner, errorMessage } from '../ui/notice';
import { MOBILE_QUERY } from '../ui/viewport';
import type { Cleanup } from '../router';

export function buildAppointments(main: HTMLElement): Cleanup {
  const todayIso = toIso(new Date());
  let list: Appointment[] = [];
  let q = '';
  let asking: string | null = null;
  let flash = '';
  let error = '';
  let loading = true;
  let disposed = false;

  const content = h('div', { style: 'display:flex;flex-direction:column;gap:28px' });
  const count = h('p', {});
  const search = h('input', { type: 'search', placeholder: 'Nom, prénom ou téléphone' });
  search.addEventListener('input', () => { q = search.value; renderList(); });

  main.append(
    h('div', { class: 'admin-head' },
      h('div', { class: 'head-row' },
        h('div', {}, h('div', { class: 'eyebrow' }, 'Administration'), h('h1', {}, 'Rendez-vous'), count),
        // Mobile : les onglets sont masqués, « Gérer » ouvre le menu des réglages.
        h('a', { class: 'btn btn-dark btn-sm manage-link', href: '#/admin/gerer' }, icon('sliders', 18), 'Gérer')
      ),
      h('label', { class: 'field', style: 'flex:0 1 320px;min-width:220px' }, 'Rechercher un client', search)
    ),
    content
  );

  async function reload(): Promise<void> {
    try {
      list = await listAppointments();
      error = '';
    } catch (e) {
      error = errorMessage(e);
    }
    loading = false;
    if (!disposed) renderList();
  }

  function matches(a: Appointment): boolean {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    const digits = digitsOf(needle);
    return (
      fullName(a.first_name, a.last_name).toLowerCase().includes(needle) ||
      (digits !== '' && digitsOf(a.phone).includes(digits))
    );
  }

  async function remove(a: Appointment): Promise<void> {
    asking = null;
    try {
      await deleteAppointment(a.id);
      flash = `Rendez-vous de ${fullName(a.first_name, a.last_name)} (${formatDay(a.day)}, ${hhmm(a.start_time)}) supprimé. Il a aussi disparu de l’espace du client.`;
      error = '';
    } catch (e) {
      error = errorMessage(e);
    }
    await reload();
  }

  /** Ouvre la confirmation et la ramène au milieu de l'écran (hors de la zone du geste système en bas). */
  function ask(id: string): void {
    asking = id;
    flash = '';
    renderList();
    content.querySelector('.appt-ask')?.scrollIntoView({ block: 'center' });
  }

  function row(a: Appointment): HTMLElement {
    const cancelled = a.status === 'cancelled';
    const name = fullName(a.first_name, a.last_name);
    const asked = asking === a.id;
    const card = h('div', { class: 'appt-row' },
      h('div', { class: 'time-pill' }, hhmm(a.start_time)),
      h('div', { class: 'appt-who' }, h('strong', {}, name), h('span', { class: 'lbl' }, 'Réservé en ligne')),
      h('a', {
        class: 'appt-phone', href: 'tel:' + a.phone.replace(/\s/g, ''),
        'aria-label': `Appeler ${name} au ${a.phone}`
      }, icon('phone', 18), h('span', { class: 'lbl' }, a.phone)),
      h('span', { class: 'pill' + (cancelled ? ' warn' : '') }, cancelled ? 'Annulé par le client' : 'Confirmé'),
      asked
        ? h('div', { class: 'appt-ask' },
            h('span', {}, 'Supprimer ce rendez-vous ? Il disparaîtra aussi chez le client.'),
            h('button', { class: 'btn btn-outline btn-sm', onclick: () => { asking = null; renderList(); } }, 'Garder'),
            h('button', { class: 'btn btn-danger btn-sm', onclick: () => void remove(a) }, 'Supprimer')
          )
        : h('button', {
            class: 'btn btn-outline btn-sm',
            style: 'color:var(--danger);border-color:var(--line-strong)',
            'aria-label': `Supprimer le rendez-vous de ${name}`,
            onclick: () => ask(a.id)
          }, icon('trash', 18), h('span', { class: 'lbl' }, 'Supprimer'))
    );
    if (asked || !window.matchMedia(MOBILE_QUERY).matches) return card;
    // Mobile : glisser la carte vers la droite ouvre la même confirmation que le bouton (sans supprimer d'emblée).
    const reveal = h('div', { class: 'appt-swipe-bg', 'aria-hidden': 'true' }, icon('trash', 20), 'Supprimer');
    enableSwipe(card, () => ask(a.id));
    return h('div', { class: 'appt-swipe' }, reveal, card);
  }

  function enableSwipe(card: HTMLElement, onTrigger: () => void): void {
    const THRESHOLD = 80;
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let mode: 'idle' | 'pending' | 'swipe' = 'idle';
    const reset = (): void => {
      mode = 'idle';
      card.style.transition = 'transform 0.15s';
      card.style.transform = '';
    };
    card.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      mode = 'pending';
      startX = e.clientX;
      startY = e.clientY;
      dx = 0;
      card.style.transition = 'none';
    });
    card.addEventListener('pointermove', (e) => {
      if (mode === 'idle') return;
      const mx = e.clientX - startX;
      const my = e.clientY - startY;
      if (mode === 'pending') {
        if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { reset(); return; } // défilement vertical
        if (mx > 10) mode = 'swipe'; else return;
      }
      dx = Math.max(0, Math.min(mx, 140));
      card.style.transform = `translateX(${dx}px)`;
    });
    const end = (): void => {
      if (mode === 'swipe' && dx >= THRESHOLD) { mode = 'idle'; setTimeout(onTrigger, 0); return; }
      reset();
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', reset);
  }

  function renderList(): void {
    const upcoming = list.filter((a) => a.day >= todayIso);
    const shown = upcoming.filter(matches);
    const confirmed = upcoming.filter((a) => a.status === 'confirmed').length;
    count.textContent = upcoming.length === 0 ? 'Aucun rendez-vous' : `${confirmed} rendez-vous à venir`;

    const alerts = list
      .filter((a) => a.status === 'cancelled' && !a.seen_by_admin)
      .map((a) =>
        h('div', { class: 'alert', role: 'status' },
          h('span', {}, `${fullName(a.first_name, a.last_name)} a annulé son rendez-vous du ${formatDay(a.day)} à ${hhmm(a.start_time)}.`),
          h('button', { class: 'btn btn-warn btn-sm', onclick: async () => {
            try { await markSeen(a.id); } catch (e) { error = errorMessage(e); }
            await reload();
          } }, 'Marquer comme lu')
        )
      );

    const days: string[] = [];
    for (const a of shown) if (!days.includes(a.day)) days.push(a.day);

    fill(content,
      ...alerts,
      flash ? banner(flash) : null,
      error ? banner(error, 'error') : null,
      loading ? h('p', { class: 'muted', role: 'status' }, 'Chargement…') : null,
      ...days.map((day) =>
        h('section', { class: 'appt-group' },
          h('h2', {}, capitalize(formatDay(day))),
          h('div', { class: 'appt-list' }, ...shown.filter((a) => a.day === day).map(row))
        )
      ),
      shown.length > 0 ? h('p', { class: 'muted swipe-hint' }, 'Glissez un rendez-vous vers la droite pour le supprimer.') : null,
      !loading && upcoming.length === 0
        ? h('div', { style: 'border-radius:24px;background:var(--surface)' }, emptyState({
            icon: 'calendar-empty',
            title: 'Aucun rendez-vous pour le moment',
            text: 'Les rendez-vous réservés par vos clients apparaîtront ici. Vérifiez que vos disponibilités sont à jour pour qu’ils puissent réserver.',
            action: h('a', { class: 'btn btn-dark', href: '#/admin/disponibilites' }, 'Gérer mes disponibilités')
          }))
        : null,
      !loading && upcoming.length > 0 && shown.length === 0
        ? emptyState({ icon: 'search', title: 'Aucun résultat', text: 'Aucun rendez-vous ne correspond à cette recherche.' })
        : null
    );
  }

  renderList();
  void reload();
  const unsubscribe = subscribeAppointments(() => void reload());
  return () => {
    disposed = true;
    unsubscribe();
  };
}
