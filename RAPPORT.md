# Rapport d'examen — Mise en production et maintenance de l'application e-commerce

**Candidat :** Mickaël GUEVEL — **Date :** 03/11/2026 — **Dépôt :** https://github.com/Ultrax92/guevel-shop

> Journal tenu au fil de l'épreuve. Les captures d'écran sont référencées `[capture: ...]`.

---

## 0. Analyse de l'existant

### Architecture fournie
| Composant | Techno | Port local | Rôle |
|---|---|---|---|
| frontend | React 18 (Create React App) + Tailwind | 3000 | Boutique, panier (Context API), commande, admin |
| backend | Node.js / Express / Mongoose | 5000 | API REST : produits, commandes, authentification JWT |
| gateway | Express + express-http-proxy | 8000 | Point d'entrée unique vers les microservices |
| notifications | Express + Nodemailer | 4002 | Envoi des e-mails (nouvelle commande, statut, stock) |
| stock-management | Express | 4003 | Gestion décentralisée du stock (squelette) |
| base de données | MongoDB | 27017 | Utilisateurs, produits, commandes |

### Constats principaux à l'arrivée
**Déploiement / exploitation**
- Aucun Dockerfile ; `docker-compose.yml` incomplet et incohérent (ports 3001/3002 au lieu de 4002/4003, gateway absent, Mongo sans authentification et exposé, nom de base différent).
- URL `localhost` codées en dur dans le front et le back ; destinataire e-mail codé en dur.
- Aucune journalisation structurée, aucune sonde de santé, aucune CI/CD.
- Dump de base et accès admin annoncés mais absents du ZIP ; identifiants SMTP fournis **refusés par Gmail** (`535 BadCredentials`).

**Sécurité (détail en partie E28)**
- Secrets journalisés en clair : mot de passe SMTP, mots de passe utilisateurs (login/register), tokens JWT, URI MongoDB.
- Secrets réels présents dans les `.env` distribués (JWT_SECRET, mot de passe d'application Gmail).
- `/notify` ouvert à tous via le gateway : relais d'e-mails exploitable par n'importe qui.
- Total de commande calculé à partir du prix envoyé par le client (manipulable).
- JWT stocké dans `localStorage` (exposé au XSS), CORS ouvert à toutes les origines, aucune validation des entrées, pas de limitation des tentatives de connexion.
- Dépendances vulnérables (npm audit : vulnérabilités *critical* sur mongoose, form-data, proxy-addr ; *high* sur express, axios, nodemailer…).

**Bugs (détail en partie E27)**
- `deleteOrder` ne renvoie jamais de réponse ; route DELETE sans contrôle admin.
- Routes admin (`adminRoutes`) jamais montées ; appels de notification vers un mauvais port avec un mauvais format.
- Statut `Validée` absent de l'énumération du modèle ; stock jamais décrémenté.
- Front : méthode de livraison/paiement non enregistrée si l'utilisateur ne change pas la valeur par défaut, faute de frappe `shippig_payment`, stock 0 refusé dans l'admin, déconnexion qui ne supprime pas le rôle.

### Gestion de version
Le code fourni a été versionné tel quel dans un premier commit (`chore: import de l'application fournie`) afin que chaque modification soit traçable par `git diff` et reprise dans le CHANGELOG.

---

## E21 — Choix de la solution d'hébergement

### Critères
Coût (contrainte : gratuit), sécurité (HTTPS, isolation, gestion des secrets), maintenance (aucun serveur à patcher), performance (latence en France), prise en charge préprod/prod, intégration CI/CD.

### Comparatif
| Solution | Coût | HTTPS / domaines | Préprod + prod | Maintenance | Conteneurs | Verdict |
|---|---|---|---|---|---|---|
| VPS (OVH, Hetzner, Scaleway) | ~4 €/mois | À configurer (Caddy/Traefik) | Manuel | Élevée (OS, pare-feu, mises à jour) | Oui | Écarté : payant |
| AWS / GCP / Azure | Carte bancaire requise | Oui | Oui | Moyenne à élevée | Oui | Écarté : complexité et risque de facturation |
| Render (offre gratuite) | 0 € | Oui | 1 service gratuit, mise en veille | Faible | Oui | Écarté : démarrages à froid de ~50 s |
| **Vercel (Hobby)** + **MongoDB Atlas (M0)** | **0 €** | **Certificats automatiques, domaines personnalisés** | **Natif : branche `develop` = préprod, `main` = prod** | **Très faible (serverless)** | Non à l'exécution | **Retenu** |

### Architecture cible retenue
- **Vercel (offre Hobby)**, un projet par composant, région **cdg1 (Paris)** :
  `guevel-shop-frontend`, `guevel-shop-api`, `guevel-shop-gateway`, `guevel-shop-notifications`, `guevel-shop-stock`.
- **MongoDB Atlas M0** (AWS eu-west-3, Paris) : une base et un utilisateur dédiés par environnement (`exam1_preprod`, `exam1_prod`).
- **GitHub** (dépôt public) + **GitHub Actions** pour l'intégration continue ; **GHCR** pour les images Docker.
- **Docker / docker-compose** pour l'environnement conteneurisé local et la recette (les images sont reconstruites à chaque push par la CI).

Limite assumée : Vercel exécute des fonctions serverless et non des conteneurs. La conteneurisation reste couverte par les Dockerfiles et le compose (exécutables sur n'importe quel hébergeur Docker) ainsi que par la publication automatique des images.

---

## E22 — Mise en œuvre sécurisée de l'environnement de production

Actions réalisées :
1. **Secrets hors du code** : toutes les valeurs sensibles passent par des variables d'environnement ; `.env*` est ignoré par Git (seul `.env.example`, sans valeur réelle, est versionné). Vérification automatique avant chaque push : 0 secret dans l'historique Git.
2. **Rotation des secrets** : les secrets distribués avec le sujet sont considérés comme compromis. Nouveaux `JWT_SECRET` et `INTERNAL_API_KEY` générés aléatoirement (32 octets), **différents en préprod et en prod**.
3. **Base de données** : utilisateurs Atlas à moindre privilège (`readWrite` sur leur seule base), TLS obligatoire, base locale Docker authentifiée et non exposée sur l'hôte.
   - Risque accepté : accès réseau Atlas `0.0.0.0/0` (les fonctions Vercel Hobby n'ont pas d'IP de sortie fixe), compensé par l'authentification forte, le TLS et le moindre privilège. `[capture: Atlas Network Access]`
4. **Cloisonnement des microservices** : le gateway et les microservices exigent une clé interne partagée (`x-internal-key`, comparaison à temps constant). `/notify` n'est plus un relais d'e-mails public. Test : sans clé → 401, avec clé → 200.
5. **Réduction de la surface d'attaque** : CORS limité aux domaines du front, en-tête `X-Powered-By` supprimé, taille des corps JSON limitée, gestionnaire d'erreurs global (pas de stack renvoyée au client), en-têtes de sécurité (HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy).
6. **Conteneurs** : images `node:22-alpine` exécutées avec l'utilisateur non-root `node`, `npm ci --omit=dev`, `HEALTHCHECK` intégré.
7. **Dépendances** : `npm audit fix` sur tous les services, montée de version de nodemailer (6 → 10). Résultat : 0 vulnérabilité *high* ou *critical* sur les services Node. Contrôle automatisé dans la CI.
8. **Protection des déploiements Vercel** : les URL techniques `*.vercel.app` restent protégées par l'authentification Vercel, seuls les domaines personnalisés sont publics.

---

## E23 — Nom de domaine, DNS et certificats

- Domaine réservé : **guevel-shop.xyz** (Hostinger, 2,37 € la première année, renouvellement automatique désactivé). `[capture: commande Hostinger]`
- Plan de nommage :

| Composant | Production (`main`) | Préproduction (`develop`) |
|---|---|---|
| Frontend | `guevel-shop.xyz`, `www.guevel-shop.xyz` | `preprod.guevel-shop.xyz` |
| API backend | `api.guevel-shop.xyz` | `api-preprod.guevel-shop.xyz` |
| Gateway | `gateway.guevel-shop.xyz` | `gateway-preprod.guevel-shop.xyz` |
| Notifications | `notifications.guevel-shop.xyz` | `notifications-preprod.guevel-shop.xyz` |
| Stock | `stock.guevel-shop.xyz` | `stock-preprod.guevel-shop.xyz` |

- Zone DNS chez Hostinger : `A @ → 76.76.21.21`, `CNAME www → cname.vercel-dns.com`, `CNAME * → cname.vercel-dns.com`. `[capture: zone DNS]`
- Certificats : émis automatiquement par Vercel (Let's Encrypt) pour chaque sous-domaine, renouvellement automatique. *(vérification à compléter)*

---

## E24 — Déploiement automatisé (CI/CD) et conteneurisation

### Conteneurisation
- Un `Dockerfile` par service ; frontend en build multi-étapes (Node → Nginx avec routage SPA et en-têtes de sécurité).
- `docker-compose.yml` complet : mongo (authentifié, volume persistant, healthcheck), backend, gateway, notifications, stock-management, frontend.
- Test réalisé : `docker compose up -d --build` → 6 conteneurs démarrés ; parcours complet validé (inscription, connexion user/admin, commande, 403 pour un user sur la liste des commandes, changement de statut par l'admin). `[capture: docker compose ps + test]`

### Intégration continue — GitHub Actions (`.github/workflows/ci.yml`)
Sur chaque push et pull request vers `main` / `develop` :
1. **Services Node** (matrice ×4) : `npm ci`, chargement de l'application, `npm audit --audit-level=high`.
2. **Frontend** : build de production en mode CI (warnings ESLint bloquants, comme sur Vercel).
3. **Docker** (matrice ×5) : build des images, puis publication sur **GHCR** (`ghcr.io/ultrax92/guevel-shop-<service>:<branche>` et `:<sha>`) pour les push.

### Déploiement continu — Vercel
- `develop` → déploiement automatique en **préproduction** ; `main` → **production**.
- Un service n'est reconstruit que si son dossier a changé (`ignoreCommand: git diff --quiet HEAD^ HEAD -- .`).
- Flux : feature → `develop` (préprod, recette) → pull request vers `main` (CI verte obligatoire) → production.

*(captures des déploiements à ajouter)*

---

## E25 — Journalisation et audit

- **Winston** sur tous les services : logs JSON horodatés (`service`, `env`, `level`, `message`), lus par Docker (`docker compose logs`) et par Vercel Runtime Logs.
- **Log d'accès HTTP** : méthode, URL, code de statut, durée (sans corps ni en-têtes sensibles).
- **Journal d'audit** (`audit: true`) : connexions réussies et échouées, inscriptions, changements de statut de commande (avec l'identifiant de l'admin), appels internes refusés.
- **Suppression des données sensibles des logs** : plus aucun mot de passe, hash, token ni URI de base.
- Audit d'infrastructure : historique des déploiements Vercel, historique Git et des workflows GitHub, journal d'activité Atlas.

*(outil de centralisation des logs à compléter)*

---

## E26 — Supervision et alertes

- Sondes `/health` sur chaque service (le backend vérifie aussi la connexion MongoDB : 200 si la base répond, 503 sinon).
- *(à compléter : moniteurs UptimeRobot ou Better Stack sur les deux environnements, alertes e-mail)*

---

## E27 — Bugs détectés et corrections

| # | Bug | Fichier | Correction | Statut |
|---|---|---|---|---|
| 1 | Appels de notification vers `localhost:3001` (mauvais port, mauvais format `{message}`) | `backend/controllers/adminController.js` | Service `notificationService` via le gateway, format `{to, subject, text}` | ✅ |
| 2 | Destinataire e-mail codé en dur (`syaob@yahoo.fr`) | `backend/controllers/orderController.js` | Variable `ADMIN_EMAIL` | ✅ |
| 3 | `docker-compose.yml` : ports faux, gateway absent | `docker-compose.yml` | Réécriture complète | ✅ |
| 4 | Build Vercel en échec (warning ESLint `setError` inutilisé) | `frontend/src/pages/Register.js` | Message d'erreur affiché dans le formulaire | ✅ |
| 5 | Accès admin et dump absents | `backend/seeder.js` | Création du premier admin à partir des variables d'environnement | ✅ |
| … | *(suite en session 2)* | | | |

---

## E28 — Failles de sécurité et corrections
*(session 2)*

## E29 — Documentation et CHANGELOG
*(session 2)*

---

## Accès pour la vérification
| Ressource | Accès |
|---|---|
| Dépôt GitHub | https://github.com/Ultrax92/guevel-shop (public) |
| Production | https://guevel-shop.xyz |
| Préproduction | https://preprod.guevel-shop.xyz |
| Compte admin de l'application | *(transmis dans le formulaire)* |
