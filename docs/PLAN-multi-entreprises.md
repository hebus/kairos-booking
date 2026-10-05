# Passer Kairos en plateforme multi-entreprises

## Contexte
Aujourd'hui, l'appli est mono-société de bout en bout : une base Supabase, un singleton `settings`, un seul build GitHub Pages, des identifiants en dur (`BRAND`, `.eq('id', true)`, `rdv:*` dans localStorage). La méthode actuelle pour une autre société est de forker le dépôt (voir `app/src/config.ts:1`).

Objectif : plusieurs entreprises sur **un seul déploiement et une seule base**, chacune avec son lien (`…/#/<slug>`), son admin, ses horaires et ses rendez-vous, totalement isolés les uns des autres. Les entreprises sont créées **par vous, à la main** (pas d'auto-inscription dans cette première étape).

## Approche recommandée : multi-tenant à base partagée
Une colonne `tenant_id` sur chaque table, une isolation par RLS, et le `slug` de l'entreprise dans l'URL.
(Alternative écartée : un projet Supabase par entreprise. Isolation maximale, mais un déploiement et des migrations par client, impossible à maintenir à l'échelle.)

## 1. Base de données (`supabase/`)
- **Nouvelle table `tenants`** : `id`, `slug` unique (public, dans l'URL), `created_at`.
- **`settings`** : plus de singleton (`id boolean`) ; clé primaire = `tenant_id`. Le défaut `company_name` en dur disparaît. Étendre ou retirer le check sur le fuseau (`schema.sql:35-37`).
- **`weekly_availability`**, **`availability_slots`**, **`blocked_days`**, **`appointments`** : ajouter `tenant_id`, l'inclure dans les clés primaires/uniques.
- **Anti-double-réservation** (`schema.sql:87-88`) : l'index unique devient `(tenant_id, day, start_time) where status='confirmed'`, sinon deux entreprises se bloquent mutuellement.
- **`admins`** : `(tenant_id, user_id)` (et un rôle plus tard). Un compte peut administrer plusieurs entreprises.
- **Fonctions** (`functions.sql`) : `is_admin(p_tenant)`, et un paramètre `p_tenant`/`p_slug` sur `available_slots`, `open_days`, `book_appointment`, `save_availability`, `local_today`, `cancel_my_appointment`. Le plafond de 10 rendez-vous à venir devient par entreprise.
- **RLS** (`policies.sql`) : toutes les policies filtrent par `tenant_id` ; `appt_select` côté admin = admin **de cette entreprise** seulement (aujourd'hui n'importe quel admin verrait tout).
- **Tests** (`rls-tests.sql`) : ajouter deux entreprises et vérifier qu'aucune lecture/écriture ne traverse la frontière (client, admin, anonyme).
- **Migration** : script qui crée `tenants` pour la société actuelle (« angel ») et rattache les données existantes.

## 2. Frontend (`app/src/`)
- **Résolution de l'entreprise** : le slug vient du hash (`#/<slug>/…`, `#/<slug>/admin/…`). `router.ts` et `main.ts` : routes avec préfixe ; accueil `#/` = page neutre (ou liste vide). Un slug inconnu mène à une page « entreprise introuvable ».
- **Contexte entreprise** : un module (ex. `data/tenant.ts`) qui expose le `tenant_id` courant ; remplacer tous les `.eq('id', true)` (`data/settings.ts:113`, `data/admin.ts:64,88,93,98`) et passer le tenant aux RPC (`data/booking.ts`).
- **Identité** : supprimer `BRAND.company` de `config.ts` (le nom vient de `settings`). `index.html` et le `<title>` deviennent génériques puis sont fixés par `router.ts:36`.
- **Stockage local isolé par entreprise** : préfixer `rdv:settings`, `rdv:profile`, `rdv:appointments` (`profile-store.ts`, `settings.ts:82`) et les clés de session `rdv-client-auth` / `rdv-admin-auth` (`supabase.ts:18-19`) par le slug, sinon un client verrait le profil et les rendez-vous d'une autre entreprise.
- **Realtime** : ajouter un filtre `tenant_id=eq.<id>` aux canaux (`booking.ts:92-100`, `admin.ts:42-51`).
- **Admin** : `adminRoute` (`admin/shell.ts:30`) vérifie `isAdmin(tenant)`. Le QR code (`admin/qr.ts:8-10`) encode `…/#/<slug>` et non plus l'URL nue.
- **`.ics`** (`ui/calendar-export.ts`) : retirer `Kairos`/`@kairos-booking` en dur ; le `VTIMEZONE` n'est valable que pour l'Europe centrale. Soit garder la liste de fuseaux limitée, soit générer le fuseau selon `settings.timezone`.

## 3. Mise en route d'une entreprise (manuel)
Script SQL ou fonction réservée : créer le `tenant` + `settings` par défaut, créer le compte admin (Supabase Auth), l'ajouter à `admins`, donner le lien et le QR code. Documenter dans `README.md`.

## 4. Ce qui reste hors périmètre (à décider plus tard)
- Auto-inscription, facturation, domaines personnalisés / marque blanche.
- Notifications : il n'y en a aucune aujourd'hui (ni email, ni SMS, hors alerte d'annulation dans l'interface admin). Probablement la première demande des entreprises.
- Réinitialisation de mot de passe et gestion des admins dans l'appli (déjà listées comme limites dans le `README.md`).
- Plusieurs praticiens/salles par entreprise (le modèle actuel n'a pas de « ressource »).
- Super-admin pour piloter toutes les entreprises.

## Vérification
- `supabase/rls-tests.sql` étendu à deux entreprises : aucune fuite entre elles.
- Réserver le même créneau dans deux entreprises : les deux réussissent ; dans la même : la seconde échoue.
- Manuel : deux slugs dans le même navigateur, profils et rendez-vous distincts ; admin A ne voit pas les données de B.
- `npm run build` et `npm test` (ajouter des tests sur la résolution du slug).

## Ordre conseillé
1. Schéma + RLS + fonctions + migration + tests SQL.
2. Contexte entreprise + routage par slug + préfixage du stockage.
3. Admin, QR code, `.ics`.
4. Script de création d'entreprise + documentation.
