# Kairos — prise de rendez-vous

Kairos est une appli statique (Vite + TypeScript, sans framework) hébergée sur **GitHub Pages**, avec Supabase pour les données.
Deux interfaces dans une seule appli, routage par hash :

| Interface | URL | Rôle |
|---|---|---|
| Client | `#/` | Choisir un jour puis un créneau, profil, « Mes rendez-vous », annulation |
| Admin | `#/admin` | Rendez-vous (page par défaut), disponibilités, jours bloqués |

La maquette validée est dans `design/` ; l'architecture dans [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Mise en route

### 1. Supabase
1. Créer un projet Supabase.
2. SQL Editor : exécuter dans l'ordre `supabase/schema.sql`, `supabase/functions.sql`, `supabase/policies.sql`.
3. Authentication → Providers : **activer « Anonymous sign-ins »**, **désactiver les inscriptions par email** (Allow new users to sign up = off).
4. Authentication → URL Configuration : Site URL = l'URL GitHub Pages.
5. Créer le compte admin (Authentication → Users → Add user, email + mot de passe), puis :
   ```sql
   insert into public.admins (user_id) values ('<uuid du compte>');
   ```
6. Vérifier : coller `supabase/rls-tests.sql` dans le SQL Editor — doit renvoyer une ligne `OK — tous les tests RLS/RPC passent` (le script finit par un ROLLBACK ; en cas d'échec : une erreur « ECHEC : … »).

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
