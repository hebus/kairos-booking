// QR code : permet à un client de scanner avec son téléphone pour ouvrir le site de réservation.
import qrcode from 'qrcode-generator';
import { QR_URL } from '../config';
import { getSettings } from '../data/settings';
import { h } from '../ui/dom';
import type { Cleanup } from '../router';

const QUIET = 4;

function qrMatrix(text: string): { n: number; isDark: (y: number, x: number) => boolean } {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return { n: qr.getModuleCount(), isDark: (y, x) => qr.isDark(y, x) };
}

/** Image PNG du QR code (pour le partager comme fichier). */
function qrPng(text: string, px = 1024): Promise<Blob> {
  const { n, isDark } = qrMatrix(text);
  const total = n + QUIET * 2;
  const scale = Math.floor(px / total);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = total * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('canvas indisponible'));
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (isDark(y, x)) ctx.fillRect((x + QUIET) * scale, (y + QUIET) * scale, scale, scale);
    }
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('export impossible'))), 'image/png'));
}

function qrSvg(text: string): SVGSVGElement {
  const { n, isDark } = qrMatrix(text);
  const quiet = QUIET;
  const size = n + quiet * 2;
  let d = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (isDark(y, x)) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
  }
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'QR code du site de réservation');
  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('width', String(size));
  bg.setAttribute('height', String(size));
  bg.setAttribute('fill', '#fff');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', '#000');
  svg.append(bg, path);
  return svg;
}

export function buildQr(main: HTMLElement): Cleanup {
  const url = QR_URL;
  const status = h('span', { class: 'muted', role: 'status' });
  let timer: number | undefined;

  const copy = h('button', {
    class: 'btn btn-outline',
    type: 'button',
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(url);
        flash('Lien copié.');
      } catch {
        flash('Copie impossible : sélectionnez le lien ci-dessus.');
      }
    }
  }, 'Copier le lien');

  const flash = (msg: string): void => {
    status.textContent = msg;
    clearTimeout(timer);
    timer = window.setTimeout(() => { status.textContent = ''; }, 3000);
  };

  async function share(): Promise<void> {
    const name = getSettings().companyName;
    const data: ShareData = { title: name, text: `Prenez rendez-vous : ${name}`, url };
    try {
      const file = new File([await qrPng(url)], 'qr-code-reservation.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) data.files = [file];
    } catch { /* partage du lien seul */ }
    try {
      if (!navigator.share) throw new Error('partage indisponible');
      await navigator.share(data);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      flash('Partage indisponible sur cet appareil : utilisez « Copier le lien ».');
    }
  }

  main.append(
    h('div', { class: 'admin-head' },
      h('div', {},
        h('h1', {}, 'QR code'),
        h('p', { class: 'muted' }, 'Faites-le scanner avec un téléphone pour ouvrir le site de réservation.'))),
    h('div', { class: 'qr-card' },
      h('div', { class: 'qr-code' }, qrSvg(url)),
      h('strong', {}, getSettings().companyName),
      h('code', { class: 'qr-url' }, url),
      h('div', { class: 'qr-actions' },
        h('button', { class: 'btn btn-dark', type: 'button', onclick: () => void share() }, 'Partager'),
        copy,
        h('button', { class: 'btn btn-outline', type: 'button', onclick: () => window.print() }, 'Imprimer')),
      status)
  );
  return () => clearTimeout(timer);
}
