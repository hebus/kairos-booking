# Architecture

Inspirée de `popmart` : une couche de données isolée (`src/data/*`, équivalent d'`exchange.js`), un SQL idempotent avec RLS et droits par colonne, des tests SQL qui finissent par un rollback, et cette checklist de non-régression. Contrairement à popmart, l'appli est en TypeScript avec build Vite, deux interfaces et un rôle admin.

## Contraintes GitHub Pages
- Hébergement statique : aucune logique serveur. Toute règle sensible vit dans Postgres (RLS + fonctions `security definer`).
- Servie sous `/<repo>/` : `base: './'`, **routage par hash**, jamais de chemin absolu.
- Clé publishable publique ; variables `VITE_*` figées au build (GitHub Actions). Aucun secret dans le bundle.

## Couches
```
src/config.ts              identité affichée (BRAND : nom de l'appli, nom de la société)
src/router.ts              routeur par hash ; chaque route = render(root) → fonction de nettoyage
src/main.ts                table des routes (client + admin)
src/data/supabase.ts       2 clients (client / admin) avec storageKey distincts + check() → messages FR
src/data/booking.ts        API Client : session anonyme paresseuse, RPC, realtime
src/data/admin.ts          API Admin : auth email/mot de passe, CRUD protégé par RLS
src/data/profile-store.ts  localStorage : profil + cache « mes rendez-vous »
src/client/*               pick (accueil), reserve (confirmation / formulaire / terminé), profile, mine, draft (état éphémère)
src/admin/*                shell (garde d'accès + menu), appointments (défaut), availability, blocked
src/ui/*                   dom.ts (h(), texte uniquement, icônes, états vides), calendar.ts, format.ts (testé), notice.ts,
                           calendar-export.ts (.ics avec VTIMEZONE Europe/Paris, UID = id du rendez-vous, rappel 1 h ; lien Google Agenda ; testé)
src/client/add-to-calendar.ts  boutons « Ajouter à mon calendrier » / « Google Agenda »
src/styles.css             tokens et composants (repris de la maquette)
```
Les pages n'accèdent jamais à Supabase directement : tout passe par `src/data/*`.

## Parcours client (routes)
`#/` (calendrier + créneaux) → `#/reserver` (confirmation directe si un profil existe, sinon formulaire qui crée le profil) → `#/confirme`. `#/profil` (créer/modifier ; retour à l'écran d'origine, y compris `#/reserver`), `#/rendez-vous` (liste, annulation). Le brouillon (jour, créneau) vit en mémoire : perdu au rechargement, volontairement.

## Tests
- `npm test` (Vitest) : formats de dates, validation téléphone/profil (`src/ui/format.test.ts`), génération du `.ics` et du lien Google Agenda (`src/ui/calendar-export.test.ts`).
- `supabase/rls-tests.sql` : droits, double réservation, isolation entre clients, annulation, profil, jour bloqué, `save_availability`. À rejouer après toute modification de `functions.sql` ou `policies.sql`.
- CI : le workflow lance `typecheck` + `test` avant le build.

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

## Checklist de non-régression (deux navigateurs)
Cochées = vérifiées sur le site publié le 2026-10-04 (script Playwright, hors dépôt). Non cochées = à passer à la main (elles demandent le compte admin).

- [x] Client : jour fermé / passé grisé ; créneaux = ceux de l'admin ; « aujourd'hui » non réservable.
- [x] Première réservation sans profil → formulaire → profil créé (localStorage) → confirmation.
- [x] Réservation avec profil → confirmation directe, « Modifier mon profil » revient à la confirmation (avec le message « Profil mis à jour », corrigé après ce test : à re-vérifier).
- [x] Modifier le profil → le nouveau nom/téléphone est répercuté sur les rendez-vous à venir (vérifié en base côté client ; vue admin à contrôler).
- [x] Client réserve ailleurs avec la même identité → « Mes rendez-vous » se met à jour en direct.
- [x] Client annule → statut `cancelled` et `seen_by_admin = false` en base ; états vides côté client.
- [x] Deux clients visent le même créneau → le second reçoit `slot_unavailable` ; le créneau disparaît de la liste.
- [x] Isolation : un autre client ne voit rien ; écriture directe, blocage de jour, `save_availability`, table `admins` refusés.
- [x] `#/admin…` sans compte → écran de connexion ; mauvais identifiants → message d'erreur ; rechargement direct OK sur chaque route (hash).
- [x] `supabase/rls-tests.sql` : OK.
- [ ] Confirmation et « Mes rendez-vous » : « Ajouter à mon calendrier » télécharge un `.ics` qui s'ouvre (iPhone, Android, Outlook) avec la bonne heure ; « Google Agenda » pré-remplit l'événement.
- [ ] Client réserve → l'admin le voit en direct (sans recharger).
- [ ] Admin supprime → disparaît chez le client en direct.
- [ ] Alerte jaune côté admin + badge « Annulé par le client » ; « Marquer comme lu » la retire.
- [ ] Admin bloque un jour → plus aucun créneau côté client ; débloque → réapparaît.
- [ ] Admin : enregistrer les disponibilités (journée entière, créneaux, jour fermé), changer la durée des créneaux.
- [ ] États vides côté admin (aucun rendez-vous, recherche sans résultat).
- [ ] Compte connecté mais absent de `admins` → refusé.
