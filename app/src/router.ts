// Routeur par hash (GitHub Pages ne sait pas réécrire les URL : pas de History API).
import { BRAND } from './config';

export type Cleanup = (() => void) | void;
export type RenderFn = (root: HTMLElement) => Cleanup | Promise<Cleanup>;

export interface Route {
  path: string; // ex. "/admin/rendez-vous"
  title: string;
  render: RenderFn;
}

export function currentPath(): string {
  const raw = location.hash.replace(/^#/, '');
  const path = raw.split('?')[0] ?? '';
  return path === '' ? '/' : path;
}

export function go(path: string): void {
  location.hash = '#' + path;
}

export function startRouter(root: HTMLElement, routes: Route[], notFound: string): void {
  let cleanup: (() => void) | void;
  let token = 0;

  async function show(): Promise<void> {
    const mine = ++token;
    if (cleanup) cleanup();
    cleanup = undefined;
    const route = routes.find((r) => r.path === currentPath());
    if (!route) {
      go(notFound);
      return;
    }
    document.title = `${route.title} · ${BRAND.company}`;
    root.replaceChildren();
    const result = await route.render(root);
    // Navigation survenue pendant un rendu asynchrone : on libère tout de suite.
    if (mine !== token) {
      if (result) result();
      return;
    }
    cleanup = result;
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', () => void show());
  void show();
}
