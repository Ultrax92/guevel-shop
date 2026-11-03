# Guevel Shop — mini site e-commerce MERN

Application e-commerce (catalogue, panier, commande, administration) composée d'un frontend React, d'une API Express/MongoDB, d'un gateway et de deux microservices (notifications, gestion du stock).

| Environnement | Frontend | API |
|---|---|---|
| Production (`main`) | https://guevel-shop.xyz | https://api.guevel-shop.xyz |
| Préproduction (`develop`) | https://preprod.guevel-shop.xyz | https://api-preprod.guevel-shop.xyz |

Documents associés : [CHANGELOG.md](CHANGELOG.md) (journal des évolutions), [RAPPORT.md](RAPPORT.md) (rapport d'examen), documentation du code générée dans [`docs/api`](docs/api/index.html).

---

## Architecture

```
Navigateur ──HTTPS──► Frontend React (Vite)            guevel-shop.xyz
    │
    └──HTTPS + cookie HttpOnly──► API backend (Express) api.guevel-shop.xyz ──TLS──► MongoDB Atlas
                                        │
                                        └── x-internal-key ──► Gateway  gateway.guevel-shop.xyz
                                                                  ├──► notifications (Nodemailer / Gmail SMTP)
                                                                  └──► stock-management
```

| Dossier | Rôle | Port local |
|---|---|---|
| `frontend/` | React 18 + React Router 7 + Tailwind, build Vite | 3000 |
| `backend/` | API REST : authentification JWT (cookie), produits, commandes, audit | 5000 |
| `gateway/` | Point d'entrée unique vers les microservices (`/notify`, `/update-stock`) | 8000 |
| `microservices/notifications/` | Envoi des e-mails (nouvelle commande, statut, stock bas) | 4002 |
| `microservices/stock-management/` | Réception des mouvements de stock | 4003 |
| `scripts/` | Test de fumée de bout en bout, création des moniteurs UptimeRobot | — |

### Principales routes de l'API

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/health` | public | Sonde de supervision (service, environnement, version, base) |
| POST | `/api/auth/register` | public (limité) | Inscription |
| POST | `/api/auth/login` | public (limité) | Connexion : JWT posé dans un cookie HttpOnly |
| POST | `/api/auth/logout` | public | Déconnexion (suppression du cookie) |
| GET | `/api/auth/me` | connecté | Profil de la session |
| GET | `/api/products` | public | Catalogue |
| PUT | `/api/products/:productId/stock` | admin | Mise à jour du stock |
| POST | `/api/orders` | connecté | Création d'une commande (prix et total calculés par le serveur) |
| GET | `/api/orders` | admin | Liste des commandes |
| PUT | `/api/orders/:id/validate` | admin | Validation (« En cours de traitement ») |
| PUT | `/api/orders/:id/status` | admin | Changement de statut (« Annulée » restitue le stock) |
| DELETE | `/api/orders/:id` | admin | Suppression |
| GET | `/api/audit` | admin | Journal d'audit |

Routes internes, appelées uniquement par le backend avec l'en-tête `x-internal-key` (401 sans la clé) :

| Service | Route | Rôle |
|---|---|---|
| Gateway | `POST /notify` → notifications | Envoi d'un e-mail `{ to, subject, text }` (texte brut) |
| Gateway | `POST /update-stock` → stock-management | Mouvement de stock `{ productId, quantity }` |
| Tous | `GET /health` | Sonde publique (sans secret) |

---

## Démarrage en local

### Avec Docker (recommandé)

```bash
cp .env.example .env        # puis renseigner les valeurs (voir « Variables d'environnement »)
docker compose up -d --build
docker compose exec backend node seeder.js   # produits + premier administrateur
```

Frontend : http://localhost:3000 · API : http://localhost:5000/health

### Sans Docker

Prérequis : Node.js 22 et une base MongoDB locale (`MONGO_URI` du `.env`, par défaut `mongodb://127.0.0.1:27017/exam1Db`).

```bash
npm install                                    # outils racine (ESLint, Prettier, JSDoc, nodemon)
for d in backend gateway microservices/notifications microservices/stock-management frontend; do (cd $d && npm install); done
npm run start:all
```

### Variables d'environnement

Toutes sont décrites dans `.env.example`. Un seul fichier `.env` à la racine sert à tous les services en local ; en préprod et en prod, chaque projet Vercel a ses propres variables (type *Secret* pour les valeurs sensibles).

| Variable | Utilisée par | Rôle |
|---|---|---|
| `APP_ENV` | tous | `local`, `preprod` ou `prod` (affiché dans les logs et `/health`) |
| `MONGO_URI` | backend | Connexion MongoDB (Atlas en préprod/prod, remplacée par le compose en Docker) |
| `MONGO_ROOT_USER`, `MONGO_ROOT_PASSWORD` | compose | Compte de la base Docker locale |
| `JWT_SECRET` | backend | Signature des sessions. **32 caractères minimum**, sinon le serveur refuse de démarrer |
| `INTERNAL_API_KEY` | backend, gateway, microservices | Clé partagée `x-internal-key` entre les services |
| `CORS_ORIGINS` | backend | Origines du front autorisées (séparées par des virgules) |
| `COOKIE_SECURE` | backend | `false` uniquement en HTTP local ; vide (= `true`) en préprod/prod |
| `GATEWAY_URL` | backend | URL du gateway |
| `NOTIFI_SERVICE_URL`, `STOCK_SERVICE_URL`, `GATEWAY_PORT` | gateway | URL des microservices, port d'écoute |
| `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | seeder, backend | Premier administrateur créé par `seeder.js` ; `ADMIN_EMAIL` reçoit les alertes |
| `EMAIL_USER`, `EMAIL_APPLICATION_PASSWORD` | notifications | Compte Gmail et mot de passe d'application (vide = envoi désactivé) |
| `REACT_APP_API_URL` | frontend (build) | URL de l'API, injectée au build Vite |

Générer les secrets :

```bash
openssl rand -hex 32   # JWT_SECRET, puis une autre valeur pour INTERNAL_API_KEY
```

---

## Tests

| Test | Commande | Contenu |
|---|---|---|
| Test de fumée de bout en bout | `npm run test:smoke` (local) ou `node scripts/smoke-test.js .env.preprod https://api-preprod.guevel-shop.xyz` | 27 contrôles : inscription, connexion, cookie HttpOnly, commandes, stock, droits admin, audit, déconnexion, et sécurité (injections NoSQL et HTML/JS, prix falsifié, statut ou identifiant invalides, 401/403) |
| Tests unitaires du frontend | `cd frontend && npm test` | Réducteur du panier (Vitest) |
| Qualité | `npm run lint`, `npm run format:check` | ESLint et Prettier sur tout le dépôt |

Le test de fumée lit `ADMIN_USERNAME` / `ADMIN_PASSWORD` dans le fichier `.env` passé en argument, n'affiche aucun secret et crée un utilisateur et une commande de test (annulée, stock restitué). Il tourne aussi dans la CI, sur une vraie base MongoDB.

---

## Scripts (à la racine)

| Commande | Rôle |
|---|---|
| `npm run lint` | ESLint sur tous les services et le frontend |
| `npm run format` / `npm run format:check` | Formatage Prettier |
| `npm run docs` | Génère la documentation du code (JSDoc) dans `docs/api` |
| `npm run test:smoke` | Test de fumée de bout en bout sur l'API locale (27 contrôles) |
| `node scripts/smoke-test.js .env.preprod https://api-preprod.guevel-shop.xyz` | Même test sur un environnement déployé |
| `cd frontend && npm test` | Tests unitaires du frontend (Vitest) |

---

## Intégration et déploiement continus

1. **CI GitHub Actions** (`.github/workflows/ci.yml`), à chaque push ou pull request :
   - qualité (ESLint, Prettier) ;
   - chargement et `npm audit` de chaque service ;
   - test d'intégration (API + MongoDB, test de fumée) ;
   - tests et build du frontend ;
   - build des images Docker, publiées sur GHCR.
2. **CD Vercel** : `develop` est déployée en préproduction, `main` en production. Un service n'est reconstruit que si son dossier a changé.
3. **Flux** : branche de travail → PR vers `develop` (recette en préprod) → PR `develop` → `main` (CI verte) → production.

### Hébergement

| Projet Vercel | Dossier racine | Production (`main`) | Préproduction (`develop`) |
|---|---|---|---|
| `guevel-shop-frontend` | `frontend/` | `guevel-shop.xyz`, `www` | `preprod.guevel-shop.xyz` |
| `guevel-shop-api` | `backend/` | `api.guevel-shop.xyz` | `api-preprod.guevel-shop.xyz` |
| `guevel-shop-gateway` | `gateway/` | `gateway.guevel-shop.xyz` | `gateway-preprod.guevel-shop.xyz` |
| `guevel-shop-notifications` | `microservices/notifications/` | `notifications.guevel-shop.xyz` | `notifications-preprod.guevel-shop.xyz` |
| `guevel-shop-stock` | `microservices/stock-management/` | `stock.guevel-shop.xyz` | `stock-preprod.guevel-shop.xyz` |

- Offre Vercel Hobby, région `cdg1` (Paris) ; chaque dossier a son `vercel.json` (région, en-têtes de sécurité, règle de build).
- Base : MongoDB Atlas M0 (Paris), une base et un utilisateur à moindre privilège par environnement.
- DNS chez Hostinger : 2 enregistrements A sur la racine et un CNAME par sous-domaine ; certificats HTTPS automatiques (Let's Encrypt).
- Supervision : `node scripts/uptimerobot-setup.js` crée les 10 moniteurs UptimeRobot (clé lue dans `.env.uptimerobot`, jamais versionné).

## Sécurité (résumé)

- Validation Joi de toutes les entrées, protection contre l'injection NoSQL (`sanitizeFilter`).
- JWT dans un cookie `HttpOnly`, `Secure` et `SameSite=Strict`. Aucun token dans le `localStorage`.
- Prix et total recalculés côté serveur, réservation atomique du stock.
- Helmet, CORS restreint aux fronts, limitation des tentatives de connexion, messages d'erreur sans fuite d'information.
- Clé interne entre backend, gateway et microservices. Secrets uniquement en variables d'environnement (jamais versionnés).

## Supervision et journalisation

- Logs JSON (Winston) sur tous les services, centralisés dans Vercel Runtime Logs.
- Journal d'audit persistant en base (collection `auditlogs`, 90 jours), consultable via `/api/audit`.
- Sondes `/health` surveillées par UptimeRobot toutes les 5 minutes, avec alerte e-mail (prod et préprod).
