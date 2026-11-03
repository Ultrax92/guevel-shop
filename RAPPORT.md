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
8. **Secrets côté hébergeur** : variables Vercel de type *Secret* (illisibles après enregistrement), séparées par environnement (*Production* / *Preview* limité à la branche `develop`). Les variables non sensibles (URL, CORS, niveau de log) sont de type *Config*. `[capture: variables d'environnement Vercel]`
9. **Protection des déploiements** : l'authentification Vercel a été désactivée sur la préproduction afin que les correcteurs puissent y accéder ; la préprod ne contient que des données de test et les routes sensibles restent protégées (JWT, CORS, clé interne).
10. **Bases initialisées** : seed des bases `exam1_preprod` et `exam1_prod` (5 produits + 1 compte admin, mot de passe différent par environnement, haché bcrypt).

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

- Zone DNS chez Hostinger (serveurs DNS Hostinger conservés), TTL 3600 :

| Type | Nom | Valeur | Rôle |
|---|---|---|---|
| A | `@` | `76.76.21.21` | Domaine racine → réseau Vercel |
| CNAME | `www` | `cname.vercel-dns.com` | `www` → Vercel (redirection 308 vers la racine) |
| CNAME | `*` | `cname.vercel-dns.com` | Tous les sous-domaines (api, preprod, gateway…) → Vercel |

  `[capture: zone DNS Hostinger]`
- Chaque domaine est rattaché à son projet Vercel ; les domaines de préproduction sont liés à la branche `develop` (*Git branch domain*).
- **Certificats** : émis automatiquement par Vercel (Let's Encrypt, challenge HTTP-01) pour chaque sous-domaine, renouvellement automatique.
- **Vérification** (`curl`) : certificat valide (`ssl_verify_result=0`) sur tous les domaines ; `https://www.guevel-shop.xyz` → `308` vers `https://guevel-shop.xyz` ; en-tête HSTS présent. `[capture: cadenas navigateur + détail du certificat]`
- Remarque « DNS Change Recommended » dans Vercel : ce n'est pas une erreur. L'API Vercel renvoie `misconfigured: false` et `ipStatus: optional-change` : les valeurs historiques (`76.76.21.21`, `cname.vercel-dns.com`) restent valides, et Vercel suggère simplement ses nouvelles cibles (IP `216.198.79.1` et CNAME dédié par projet, `*.vercel-dns-017.com`). Évolution possible : remplacer le CNAME générique `*` par un CNAME explicite par sous-domaine. Ça évite aussi qu'un sous-domaine non prévu pointe vers Vercel.

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
- Un service n'est reconstruit que si son dossier a changé depuis son dernier déploiement réussi (`ignoreCommand` basé sur `VERCEL_GIT_PREVIOUS_SHA`) : monorepo de 5 projets sans builds inutiles.
- Flux : feature → `develop` (préprod, recette) → pull request vers `main` (CI verte obligatoire) → production.
- Mise en œuvre réelle : PR [#1](https://github.com/Ultrax92/guevel-shop/pull/1) `develop → main`, contrôles GitHub Actions et Vercel verts avant fusion. Seul le service modifié (API) a été reconstruit, les autres ont été ignorés automatiquement. `[capture: PR #1 et ses checks]`
- Chaque `/health` expose la version déployée (`version` = commit), ce qui permet de vérifier d'un coup d'œil ce qui tourne en préprod et en prod.
- Incident rencontré : à la création des projets, le tout premier déploiement (issu de `develop`) a été classé en *production* par Vercel. Correction : branche de production fixée à `main`, déploiements fautifs annulés, puis redéploiement. Les déploiements `develop` sont désormais bien en *Preview*. `[capture: liste des déploiements Vercel]`

---

## E25 — Journalisation et audit

- **Winston** sur tous les services : logs JSON horodatés (`service`, `env`, `level`, `message`), lus par Docker (`docker compose logs`) et par Vercel Runtime Logs.
- **Log d'accès HTTP** : méthode, URL, code de statut, durée (sans corps ni en-têtes sensibles).
- **Journal d'audit** (`audit: true`) : connexions réussies et échouées, inscriptions, changements de statut de commande (avec l'identifiant de l'admin), appels internes refusés.
- **Suppression des données sensibles des logs** : plus aucun mot de passe, hash, token ni URI de base.
- **Journal d'audit persistant** : chaque action sensible est aussi écrite dans la collection MongoDB `auditlogs` (action, niveau, utilisateur, IP réelle du client, environnement, date), avec une expiration automatique à 90 jours (index TTL). Les logs Vercel de l'offre Hobby ne sont conservés que peu de temps : l'audit reste ainsi consultable. Consultation réservée aux admins : `GET /api/audit?limit=50` (401 sans token, 403 pour un user). `[capture: réponse /api/audit]`
- **Centralisation** : Vercel Runtime Logs regroupe par projet et par environnement les logs JSON de toutes les fonctions, avec filtres par niveau, domaine et branche. Exemple réel en préprod : les entrées `Audit: connexion réussie`, `Commande créée` et `Échec de l'envoi de la notification` y apparaissent. `[capture: Runtime Logs Vercel]`
- Audit d'infrastructure : historique des déploiements Vercel, historique Git et des workflows GitHub, journal d'activité Atlas.

---

## E26 — Supervision et alertes

- Sondes `/health` sur chaque service, qui renvoient `status`, `service`, `env` et `version`. Le backend envoie en plus un vrai `ping` à MongoDB : 200 si la base répond, 503 sinon.
- Test de panne en local : arrêt du conteneur Mongo → `/health` passe en 503 `degraded`, puis revient automatiquement en 200 après redémarrage (reconnexion automatique).
- Faux positif corrigé : au réveil d'une instance serverless, l'ancien contrôle (`readyState`) signalait `db: down` pendant la reconnexion. Il est remplacé par un `ping` réel, pour éviter les fausses alertes.
- **UptimeRobot** (offre gratuite) : 10 moniteurs créés par script (`scripts/uptimerobot-setup.js`, via l'API, clé jamais versionnée) :

| Environnement | Moniteur | Type | Condition d'alerte |
|---|---|---|---|
| Prod / Préprod | frontend (`/`) | HTTP(S) | code ≠ 2xx/3xx ou délai dépassé |
| Prod / Préprod | api, gateway, notifications, stock (`/health`) | Mot-clé | la réponse ne contient plus `"status":"ok"` (couvre aussi la base indisponible côté API, qui renvoie `degraded`) |

  Vérification toutes les 5 minutes, **alerte e-mail** au contact du compte. `[capture: tableau de bord UptimeRobot]`
- Alerte de bout en bout : une panne de base fait passer l'API en `degraded` (HTTP 503), le mot-clé disparaît et l'alerte part. Le retour à la normale envoie une notification « Up ».
- Complément : Vercel Runtime Logs pour le diagnostic, et la version (commit) dans `/health` pour relier un incident au déploiement en cause.

---

## E27 — Bugs détectés et corrections

| # | Bug | Fichier | Correction | Statut |
|---|---|---|---|---|
| 1 | Appels de notification vers `localhost:3001` (mauvais port, mauvais format `{message}`) | `backend/controllers/adminController.js` | Service `notificationService` via le gateway, format `{to, subject, text}` | ✅ |
| 2 | Destinataire e-mail codé en dur (`syaob@yahoo.fr`) | `backend/controllers/orderController.js` | Variable `ADMIN_EMAIL` | ✅ |
| 3 | `docker-compose.yml` : ports faux, gateway absent | `docker-compose.yml` | Réécriture complète | ✅ |
| 4 | Build Vercel en échec (warning ESLint `setError` inutilisé) | `frontend/src/pages/Register.js` | Message d'erreur affiché dans le formulaire | ✅ |
| 5 | Accès admin et dump absents | `backend/seeder.js` | Création du premier admin à partir des variables d'environnement | ✅ |
| 6 | Identifiants SMTP fournis refusés par Gmail (`535 BadCredentials`) | configuration | Mot de passe d'application Gmail du candidat, stocké en *Secret* Vercel ; envoi validé (« Email envoyé avec succès » dans les logs, e-mail reçu) | ✅ |
| 7 | `/health` : faux « db: down » au réveil d'une instance serverless | `backend/app.js` | `ping` MongoDB réel | ✅ |
| 8 | CI : job Docker en échec sur les pull requests (tag `2/merge` invalide) | `.github/workflows/ci.yml` | Tag calculé à partir de la branche source, `/` remplacé | ✅ |
| 9 | Un redéploiement (après changement de variable d'env) était annulé par l'*Ignored Build Step* | `*/vercel.json` | Build forcé lorsqu'il s'agit du même commit | ✅ |
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
