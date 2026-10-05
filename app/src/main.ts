import './styles.css';
import { adminRoute } from './admin/shell';
import { buildAppointments } from './admin/appointments';
import { buildAvailability } from './admin/availability';
import { buildBlocked } from './admin/blocked';
import { buildMenu } from './admin/menu';
import { buildQr } from './admin/qr';
import { buildSettings } from './admin/settings';
import { renderMine } from './client/mine';
import { renderPick } from './client/pick';
import { renderProfile } from './client/profile';
import { renderDone, renderReserve } from './client/reserve';
import { loadPublicSettings } from './data/settings';
import { configured } from './data/supabase';
import { startRouter, type Route } from './router';

const routes: Route[] = [
  // Client
  { path: '/', title: 'Prendre rendez-vous', render: renderPick },
  { path: '/reserver', title: 'Vos coordonnées', render: renderReserve },
  { path: '/confirme', title: 'Rendez-vous confirmé', render: renderDone },
  { path: '/profil', title: 'Mon profil', render: renderProfile },
  { path: '/rendez-vous', title: 'Mes rendez-vous', render: renderMine },
  // Admin (la page par défaut est « Rendez-vous »)
  { path: '/admin', title: 'Admin — Rendez-vous', render: adminRoute('rendez-vous', buildAppointments) },
  { path: '/admin/rendez-vous', title: 'Admin — Rendez-vous', render: adminRoute('rendez-vous', buildAppointments) },
  { path: '/admin/gerer', title: 'Admin — Gérer', render: adminRoute('gerer', buildMenu) },
  { path: '/admin/disponibilites', title: 'Admin — Disponibilités', render: adminRoute('disponibilites', buildAvailability) },
  { path: '/admin/jours-bloques', title: 'Admin — Jours bloqués', render: adminRoute('jours-bloques', buildBlocked) },
  { path: '/admin/parametres', title: 'Admin — Paramètres', render: adminRoute('parametres', buildSettings) },
  { path: '/admin/qr-code', title: 'Admin — QR code', render: adminRoute('qr-code', buildQr) }
];

const root = document.getElementById('app');
if (!root) throw new Error('#app introuvable');

// Nom, téléphone et adresse de la société : on attend au plus 2,5 s, sinon on affiche la dernière
// valeur connue (cache navigateur ou valeur par défaut) sans bloquer l'application.
if (configured) {
  await Promise.race([
    loadPublicSettings().catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 2500))
  ]);
}
startRouter(root, routes, '/');
