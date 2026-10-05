// Notifications push de l'admin : abonnement de l'appareil courant (stocké dans push_subscriptions).
import { adminDb, check, need } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export type PushState = 'unconfigured' | 'unsupported' | 'denied' | 'off' | 'on';

function urlBase64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Sur iPhone, l'API n'existe que si l'appli est installée sur l'écran d'accueil. */
export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.ready;
}

export async function getPushState(): Promise<PushState> {
  if (!VAPID_PUBLIC_KEY) return 'unconfigured';
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const sub = await (await registration()).pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

export async function enablePush(): Promise<void> {
  if (!VAPID_PUBLIC_KEY) throw new Error('Notifications non configurées (clé VAPID absente).');
  if ((await Notification.requestPermission()) !== 'granted') {
    throw new Error('Notifications refusées : autorisez-les dans les réglages du navigateur.');
  }
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(VAPID_PUBLIC_KEY) }));
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!p256dh || !auth) throw new Error('Abonnement invalide. Réessayez.');
  const db = need(adminDb);
  const { data } = await db.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Session expirée : reconnectez-vous.');
  check(await db.from('push_subscriptions').upsert({ endpoint: sub.endpoint, user_id: userId, p256dh, auth }));
}

export async function disablePush(): Promise<void> {
  const sub = await (await registration()).pushManager.getSubscription();
  if (!sub) return;
  check(await need(adminDb).from('push_subscriptions').delete().eq('endpoint', sub.endpoint));
  await sub.unsubscribe();
}
