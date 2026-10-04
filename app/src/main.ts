import './styles.css';
import { adminRoute } from './admin/shell';
import { buildAppointments } from './admin/appointments';
import { buildAvailability } from './admin/availability';
import { buildBlocked } from './admin/blocked';
import { renderMine } from './client/mine';
import { renderPick } from './client/pick';
import { renderProfile } from './client/profile';
import { renderDone, renderReserve } from './client/reserve';
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
  { path: '/admin/disponibilites', title: 'Admin — Disponibilités', render: adminRoute('disponibilites', buildAvailability) },
  { path: '/admin/jours-bloques', title: 'Admin — Jours bloqués', render: adminRoute('jours-bloques', buildBlocked) }
];

const root = document.getElementById('app');
if (!root) throw new Error('#app introuvable');
startRouter(root, routes, '/');
