# Kairos — prise de rendez-vous

Application simple de prise de rendez-vous, aujourd'hui configurée pour **Angel, Éveilleuse d'âmes**.
Appli statique (Vite + TypeScript, sans framework) hébergée sur **GitHub Pages**, avec Supabase pour les données.

- Site : https://hebus.github.io/kairos-booking/
- Dépôt : https://github.com/hebus/kairos-booking

Deux interfaces dans une seule appli, routage par hash :

| Interface | URL | Rôle |
|---|---|---|
| Client | `#/` | Choisir un jour puis un créneau, profil, « Mes rendez-vous », annulation |
| Admin | `#/admin` | Rendez-vous (page par défaut), disponibilités, jours bloqués |

## Contenu du dépôt

```
app/          Application (Vite + TypeScript) — voir ARCHITECTURE.md
supabase/     schema.sql, functions.sql, policies.sql, rls-tests.sql (idempotents)
design/       Maquette validée (fichiers .dc.html, Artifact « Kairos — Prise de rendez-vous »)
.github/      Workflow de déploiement GitHub Pages
```

L'architecture, la sécurité et la checklist de non-régression sont dans [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Fonctionnalités

**Client** : calendrier des jours réservables, créneaux libres, profil (prénom, nom, téléphone) enregistré dans le navigateur et utilisé pour les réservations suivantes, « Mes rendez-vous » (à venir / passés, mise à jour en direct), annulation, états vides, et ajout du rendez-vous au calendrier de l'utilisateur (fichier `.ics` ou lien Google Agenda) depuis la confirmation et depuis « Mes rendez-vous ».

**Admin** (connexion email + mot de passe) :
- *Rendez-vous* : liste groupée par jour, recherche, suppression (disparaît chez le client), alerte quand un client annule.
- *Disponibilités* : semaine type ; par jour « journée entière » (début/fin, créneaux générés selon la durée choisie) ou créneaux explicites.
- *Jours bloqués* : dates exceptionnelles non réservables.

## Personnaliser le nom de la société

Modifier uniquement `app/src/config.ts` (`BRAND.company`). Il apparaît au-dessus du titre côté client et dans le titre de l'onglet.

## Mise en route

### 1. Supabase
1. Créer un projet Supabase.
2. SQL Editor : exécuter dans l'ordre `supabase/schema.sql`, `supabase/functions.sql`, `supabase/policies.sql`.
3. Authentication → Sign In / Providers : **« Allow new users to sign up » = ON** et **« Allow anonymous sign-ins » = ON**, et garder **« Confirm email » = ON**.
   > Ne pas désactiver « Allow new users to sign up » : cela bloque aussi les connexions anonymes (erreur `signup_disabled`, HTTP 422) et personne ne peut plus réserver. Un compte créé par un tiers n'a aucun privilège : l'admin n'est reconnu que par la table `admins`.
4. Créer le compte admin (Authentication → Users → Add user, email + mot de passe), puis :
   ```sql
   insert into public.admins (user_id) values ('<uuid du compte>');
   ```
5. Vérifier : coller `supabase/rls-tests.sql` dans le SQL Editor — doit renvoyer une ligne `OK — tous les tests RLS/RPC passent` (le script finit par un ROLLBACK ; en cas d'échec : une erreur « ECHEC : … »).
6. *(Facultatif)* Authentication → URL Configuration : Site URL = l'URL GitHub Pages, et `http://localhost:5173/**` dans Redirect URLs. Inutile pour la connexion actuelle (email + mot de passe, anonyme), utile seulement pour les emails de réinitialisation de mot de passe ou d'invitation.

### 2. Développement local
```bash
cd app
cp .env.example .env.local   # renseigner l'URL et la clé publishable
npm install
npm run dev
```
Scripts : `npm run typecheck`, `npm test`, `npm run build`, `npm run preview`.

### 3. Déploiement GitHub Pages
1. Settings → Pages → Source : **GitHub Actions**.
2. Settings → Secrets and variables → Actions → **Variables** : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Push sur `main` : `.github/workflows/deploy.yml` vérifie les types, lance les tests, construit et publie.

> La clé publishable (anon) est publique par conception : la sécurité repose sur la RLS. **Ne jamais** utiliser la clé `service_role` dans l'appli.

## Limites connues
- L'événement ajouté au calendrier est une copie : annuler dans l'appli (ou suppression par l'admin) ne le retire pas du calendrier du client. Pas d'adresse dans l'événement pour l'instant ; l'ajouter demandera une colonne en base et un champ côté Admin.
- Pas de favicon (404 dans la console du navigateur).
- Pas de mode sombre.
- Les `.dc.html` de `design/` sont des maquettes (format d'un outil de design), pas du code de l'appli.
- Pas de réinitialisation de mot de passe admin dans l'appli : à faire depuis le tableau de bord Supabase.
- Les actions GitHub du workflow tournent encore sur Node 20 (avertissement de dépréciation).
