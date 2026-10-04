# Architecture

Inspirée de `popmart` : une couche de données isolée (`src/data/*`, équivalent d'`exchange.js`), un SQL idempotent avec RLS et droits par colonne, des tests SQL qui finissent par un rollback, et cette checklist de non-régression. Contrairement à popmart, l'appli est en TypeScript avec build Vite, deux interfaces et un rôle admin.

## Contraintes GitHub Pages
- Hébergement statique : aucune logique serveur. Toute règle sensible vit dans Postgres (RLS + fonctions `security definer`).
- Servie sous `/<repo>/` : `base: './'`, **routage par hash**, jamais de chemin absolu.
- Clé publishable publique ; variables `VITE_*` figées au build (GitHub Actions). Aucun secret dans le bundle.

## Couches
```
src/data/supabase.ts       2 clients (client / admin) avec storageKey distincts + check() → messages FR
src/data/booking.ts        API Client : session anonyme paresseuse, RPC, realtime
src/data/admin.ts          API Admin : auth email/mot de passe, CRUD protégé par RLS
src/data/profile-store.ts  localStorage : profil + cache « mes rendez-vous »
src/client/*, src/admin/*  pages (fonctions render(root) → cleanup), aucun accès Supabase direct
src/ui/*                   dom.ts (h(), texte uniquement), calendar.ts, format.ts (testé), notice.ts
```

## Modèle de données
`admins`, `settings` (durée des créneaux, fuseau), `weekly_availability` (0 = dimanche), `availability_slots`, `blocked_days`, `appointments` (index unique partiel `(day, start_time) where status = 'confirmed'`).

## Règles métier (une seule implémentation, en SQL)
- `available_slots(day)` : jour futur (strictement après aujourd'hui dans le fuseau du lieu), travaillé, non bloqué, créneau non pris. Mode « journée entière » : créneaux générés toutes les `slot_minutes` ; mode « créneaux » : chaque plage est un créneau tel quel.
- `open_days(from, to)` : alimente le calendrier client.
- `book_appointment`, `cancel_my_appointment`, `update_my_profile` : seules écritures possibles pour un client.
- `save_availability(jsonb)` : enregistrement atomique de la semaine (admin).

## Sécurité
- `revoke all` puis `grant` ciblés ; RLS partout. Le rôle `authenticated` inclut les connexions anonymes et tout compte créé par inscription : l'admin n'est reconnu que par `is_admin()` (table `admins`), donc un compte tiers n'a aucun droit de plus qu'un client anonyme.
- Auth Supabase : « Allow new users to sign up » doit rester **ON** (sinon `signInAnonymously` échoue en `signup_disabled`). Garder « Confirm email » ON pour qu'une inscription par email n'obtienne pas de session sans confirmation.
- Clients : ne lisent que leurs rendez-vous (`client_id = auth.uid()`), n'écrivent que par RPC. Admin : lit/supprime tout.
- Realtime : `appointments` publié ; replica identity par défaut, donc les `DELETE` ne contiennent que l'id (pas de donnée personnelle). Les événements `DELETE` ne supportent pas de filtre : le client écoute sans filtre et **recharge** sa liste (filtrée par RLS).
- Les données distantes sont toujours insérées comme texte (`createTextNode`), jamais `innerHTML`.
- Sessions séparées (`rdv-client-auth` / `rdv-admin-auth`) : se connecter en admin n'écrase pas l'identité client du même navigateur.
- Risque connu : abus des connexions anonymes. Mitigation actuelle : quota de 10 rendez-vous à venir par client. Piste : captcha (Turnstile) sur `signInAnonymously`.

## Conventions UI (reprises de popmart)
Mobile-first 360–390 px côté client ; cibles tactiles ≥ 44 px ; champs 16 px (pas de zoom iOS) ; pas de défilement horizontal ; aucune interaction dépendant du survol ; `aria-label` sur les boutons-icônes ; dégradation propre si Supabase est absent (bandeau d'erreur).

## Checklist de non-régression (manuelle, deux navigateurs)
- [ ] Client : jour fermé / passé / bloqué grisé ; créneaux = ceux de l'admin ; « aujourd'hui » non réservable.
- [ ] Première réservation sans profil → formulaire → profil créé (localStorage) → confirmation.
- [ ] Réservation avec profil → confirmation directe, « Modifier mon profil » revient à la confirmation.
- [ ] Modifier le profil → l'admin voit le nouveau nom/téléphone sur les rendez-vous à venir.
- [ ] Client réserve → l'admin le voit en direct (sans recharger).
- [ ] Admin supprime → disparaît chez le client en direct.
- [ ] Client annule → alerte jaune côté admin + badge « Annulé par le client » ; « Marquer comme lu » la retire.
- [ ] Admin bloque un jour → plus aucun créneau côté client ; débloque → réapparaît.
- [ ] Deux clients visent le même créneau → le second reçoit « Ce créneau vient d'être pris ».
- [ ] États vides : liste vide côté admin (et recherche sans résultat) et côté client.
- [ ] `/#/admin` sans compte admin → écran de connexion ; compte non listé dans `admins` → refusé.
- [ ] `npm run build && npm run preview` : rechargement sur chaque route OK (hash).
- [ ] `supabase/rls-tests.sql` : OK.
