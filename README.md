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

---

## Démarrage en local

### Avec Docker (recommandé)

```bash
cp .env.example .env        # puis renseigner les valeurs (secrets, SMTP…)
docker compose up -d --build
docker compose exec backend node seeder.js   # produits + premier administrateur
```

Frontend : http://localhost:3000 · API : http://localhost:5000/health

### Sans Docker

Prérequis : Node.js 22 et une base MongoDB locale.

```bash
npm install                                    # outils racine (ESLint, Prettier, JSDoc, nodemon)
for d in backend gateway microservices/notifications microservices/stock-management frontend; do (cd $d && npm install); done
npm run start:all
```

---

## Scripts (à la racine)

| Commande | Rôle |
|---|---|
| `npm run lint` | ESLint sur tous les services et le frontend |
| `npm run format` / `npm run format:check` | Formatage Prettier |
| `npm run docs` | Génère la documentation du code (JSDoc) dans `docs/api` |
| `npm run test:smoke` | Test de fumée de bout en bout sur l'API locale |
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
