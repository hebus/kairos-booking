// Edge Function : notifie les admins (push web) à chaque nouveau rendez-vous ou annulation.
// Appelée par un Database Webhook sur public.appointments (Insert + Update).
// Secrets : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, WEBHOOK_SECRET.
// SUPABASE_URL et SUPABASE_SECRET_KEYS (dictionnaire JSON des clés « secret ») sont injectés par Supabase ;
// à défaut, on retombe sur l'ancienne SUPABASE_SERVICE_ROLE_KEY (dépréciée).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

interface Appt {
  first_name: string;
  last_name: string;
  day: string;
  start_time: string;
  status: string;
}
interface Hook {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  record: Appt | null;
  old_record: Appt | null;
}

const env = (k: string): string => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`Variable manquante : ${k}`);
  return v;
};

function message(hook: Hook): { title: string; body: string; tag: string } | null {
  const a = hook.record;
  if (!a) return null;
  const day = new Date(a.day + 'T12:00:00Z').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC'
  });
  const who = `${a.first_name} ${a.last_name}`.trim();
  const when = `${day} à ${a.start_time.slice(0, 5)}`;
  if (hook.type === 'INSERT' && a.status === 'confirmed') {
    return { title: 'Nouveau rendez-vous', body: `${who} — ${when}`, tag: 'appt-new' };
  }
  if (hook.type === 'UPDATE' && a.status === 'cancelled' && hook.old_record?.status === 'confirmed') {
    return { title: 'Rendez-vous annulé', body: `${who} a annulé — ${when}`, tag: 'appt-cancel' };
  }
  return null;
}

function secretKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    const k = (JSON.parse(keys) as Record<string, string>)['default'];
    if (k) return k;
  }
  return env('SUPABASE_SERVICE_ROLE_KEY');
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== env('WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 });
  }
  const msg = message((await req.json()) as Hook);
  if (!msg) return new Response('ignored');

  webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
  const db = createClient(env('SUPABASE_URL'), secretKey());
  const { data: subs, error } = await db.from('push_subscriptions').select('endpoint, p256dh, auth');
  if (error) return new Response(error.message, { status: 500 });

  const payload = JSON.stringify({ ...msg, url: './#/admin/rendez-vous' });
  const expired: string[] = [];
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) expired.push(s.endpoint); // abonnement révoqué
    }
  }));
  if (expired.length) await db.from('push_subscriptions').delete().in('endpoint', expired);
  return new Response(`sent ${(subs?.length ?? 0) - expired.length}`);
});
