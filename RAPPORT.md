# Rapport d'examen — Mise en production et maintenance de l'application e-commerce

**Candidat :** Mickaël GUEVEL — **Date :** 03/11/2026 — **Dépôt :** https://github.com/Ultrax92/guevel-shop

> Journal tenu au fil de l'épreuve. Les captures d'écran (dossier `screenshots/`, rangées par session et préfixées par le numéro d'exercice) sont référencées `[capture : session-N/fichier.png]`.

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
   - Risque accepté : accès réseau Atlas `0.0.0.0/0` (les fonctions Vercel Hobby n'ont pas d'IP de sortie fixe), compensé par l'authentification forte, le TLS et le moindre privilège. `[capture : session-1/E22-atlas-acces-reseau.png, session-1/E22-atlas-utilisateurs-base.png]`
4. **Cloisonnement des microservices** : le gateway et les microservices exigent une clé interne partagée (`x-internal-key`, comparaison à temps constant). `/notify` n'est plus un relais d'e-mails public. Test : sans clé → 401, avec clé → 200.
5. **Réduction de la surface d'attaque** : CORS limité aux domaines du front, en-tête `X-Powered-By` supprimé, taille des corps JSON limitée, gestionnaire d'erreurs global (pas de stack renvoyée au client), en-têtes de sécurité (HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy).
6. **Conteneurs** : images `node:22-alpine` exécutées avec l'utilisateur non-root `node`, `npm ci --omit=dev`, `HEALTHCHECK` intégré.
7. **Dépendances** : `npm audit fix` sur tous les services, montée de version de nodemailer (6 → 10). Résultat : 0 vulnérabilité *high* ou *critical* sur les services Node. Contrôle automatisé dans la CI.
8. **Secrets côté hébergeur** : variables Vercel de type *Secret* (illisibles après enregistrement), séparées par environnement (*Production* / *Preview* limité à la branche `develop`). Les variables non sensibles (URL, CORS, niveau de log) sont de type *Config*. `[capture : session-1/E22-vercel-variables-api.png, …-gateway.png, …-notifications.png, …-stock.png]`
9. **Protection des déploiements** : l'authentification Vercel a été désactivée sur la préproduction afin que les correcteurs puissent y accéder ; la préprod ne contient que des données de test et les routes sensibles restent protégées (JWT, CORS, clé interne).
10. **Bases initialisées** : seed des bases `exam1_preprod` et `exam1_prod` (5 produits + 1 compte admin, mot de passe différent par environnement, haché bcrypt).

---

## E23 — Nom de domaine, DNS et certificats

- Domaine réservé : **guevel-shop.xyz** (Hostinger, 2,37 € la première année, renouvellement automatique désactivé).
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

  `[capture : session-1/E23-dns-hostinger-1-initial.png, session-1/E23-dns-hostinger-2-final.png, session-1/E23-vercel-domaines-valides.png]`
- Chaque domaine est rattaché à son projet Vercel ; les domaines de préproduction sont liés à la branche `develop` (*Git branch domain*).
- **Certificats** : émis automatiquement par Vercel (Let's Encrypt, challenge HTTP-01) pour chaque sous-domaine, renouvellement automatique.
- **Vérification** (`curl`) : certificat valide (`ssl_verify_result=0`) sur tous les domaines ; `https://www.guevel-shop.xyz` → `308` vers `https://guevel-shop.xyz` ; en-tête HSTS présent. `[capture : session-1/E23-certificat-https.png]`
- Remarque « DNS Change Recommended » dans Vercel : ce n'est pas une erreur. L'API Vercel renvoie `misconfigured: false` et `ipStatus: optional-change` : les valeurs historiques (`76.76.21.21`, `cname.vercel-dns.com`) restent valides, et Vercel suggère simplement ses nouvelles cibles (IP `216.198.79.1` et CNAME dédié par projet, `*.vercel-dns-017.com`). Évolution possible : remplacer le CNAME générique `*` par un CNAME explicite par sous-domaine. Ça évite aussi qu'un sous-domaine non prévu pointe vers Vercel.

---

## E24 — Déploiement automatisé (CI/CD) et conteneurisation

### Conteneurisation
- Un `Dockerfile` par service ; frontend en build multi-étapes (Node → Nginx avec routage SPA et en-têtes de sécurité).
- `docker-compose.yml` complet : mongo (authentifié, volume persistant, healthcheck), backend, gateway, notifications, stock-management, frontend.
- Test réalisé : `docker compose up -d --build` → 6 conteneurs démarrés ; parcours complet validé (inscription, connexion user/admin, commande, 403 pour un user sur la liste des commandes, changement de statut par l'admin). `[capture : session-2/E27-E28-test-de-fumee-25-controles.png]` (test de fumée exécuté sur la pile Docker locale)

### Intégration continue — GitHub Actions (`.github/workflows/ci.yml`)
Sur chaque push et pull request vers `main` / `develop` :
1. **Services Node** (matrice ×4) : `npm ci`, chargement de l'application, `npm audit --audit-level=high`.
2. **Frontend** : build de production en mode CI (warnings ESLint bloquants, comme sur Vercel).
3. **Docker** (matrice ×5) : build des images, puis publication sur **GHCR** (`ghcr.io/ultrax92/guevel-shop-<service>:<branche>` et `:<sha>`) pour les push.

### Déploiement continu — Vercel
- `develop` → déploiement automatique en **préproduction** ; `main` → **production**.
- Un service n'est reconstruit que si son dossier a changé depuis son dernier déploiement réussi (`ignoreCommand` basé sur `VERCEL_GIT_PREVIOUS_SHA`) : monorepo de 5 projets sans builds inutiles. Si ce commit est absent du clone partiel de Vercel, le service est reconstruit par sécurité (`git rev-parse --verify`).
- Flux : feature → `develop` (préprod, recette) → pull request vers `main` (CI verte obligatoire) → production.
- Mise en œuvre réelle : PR [#1](https://github.com/Ultrax92/guevel-shop/pull/1) `develop → main`, contrôles GitHub Actions et Vercel verts avant fusion. Seul le service modifié (API) a été reconstruit, les autres ont été ignorés automatiquement. `[capture : session-1/E24-pull-request-1.png, session-1/E24-ci-github-verte.png, session-1/E24-images-docker-ghcr.png]`
- Chaque `/health` expose la version déployée (`version` = commit), ce qui permet de vérifier d'un coup d'œil ce qui tourne en préprod et en prod.
- Incident rencontré : à la création des projets, le tout premier déploiement (issu de `develop`) a été classé en *production* par Vercel. Correction : branche de production fixée à `main`, déploiements fautifs annulés, puis redéploiement. Les déploiements `develop` sont désormais bien en *Preview*. `[capture : session-1/E21-vercel-deploiement-api.png, …-frontend.png, …-gateway.png, …-notifications.png, …-stock.png]`

---

## E25 — Journalisation et audit

- **Winston** sur tous les services : logs JSON horodatés (`service`, `env`, `level`, `message`), lus par Docker (`docker compose logs`) et par Vercel Runtime Logs.
- **Log d'accès HTTP** : méthode, URL, code de statut, durée (sans corps ni en-têtes sensibles).
- **Journal d'audit** (`audit: true`) : connexions réussies et échouées, inscriptions, changements de statut de commande (avec l'identifiant de l'admin), appels internes refusés.
- **Suppression des données sensibles des logs** : plus aucun mot de passe, hash, token ni URI de base.
- **Journal d'audit persistant** : chaque action sensible est aussi écrite dans la collection MongoDB `auditlogs` (action, niveau, utilisateur, IP réelle du client, environnement, date), avec une expiration automatique à 90 jours (index TTL). Les logs Vercel de l'offre Hobby ne sont conservés que peu de temps : l'audit reste ainsi consultable. Consultation réservée aux admins : `GET /api/audit?limit=50` (401 sans token, 403 pour un user). `[capture : session-2/E27-E28-test-de-fumee-25-controles.png]` (contrôle « Journal d'audit (admin) »)
- **Centralisation** : Vercel Runtime Logs regroupe par projet et par environnement les logs JSON de toutes les fonctions, avec filtres par niveau, domaine et branche. Exemple réel en préprod : les entrées `Audit: connexion réussie`, `Commande créée` et `Échec de l'envoi de la notification` y apparaissent. `[capture : session-1/E25-logs-vercel.png]`
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

  Vérification toutes les 5 minutes, **alerte e-mail** au contact du compte. `[capture : session-1/E26-uptimerobot-10-moniteurs.png]`
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
| 10 | `DELETE /api/orders/:id` ne renvoyait jamais de réponse (requête bloquée) et n'exigeait pas le rôle admin | `orderController.js`, `orderRoutes.js` | Suppression réelle, réservée aux admins, avec restitution du stock si la commande n'est pas expédiée | ✅ |
| 11 | `PUT /api/orders/:id/validate` ne faisait rien (lisait `orderId` dans le corps au lieu de l'URL) | `orderController.js` | La commande passe « En cours de traitement », l'action est auditée et le client est notifié | ✅ |
| 12 | Le stock n'était jamais décrémenté (appel au microservice commenté) : survente possible | `stockService.js` | Réservation **atomique** (`findOneAndUpdate` avec `stock >= quantité`), restituée en cas d'échec ou d'annulation ; événement envoyé au microservice stock ; alerte « stock bas » | ✅ |
| 13 | Statut « Validée » écrit en base alors qu'il n'existe pas dans l'énumération du modèle (`runValidators` absent) | `adminController.js` (supprimé), `schemas.js` | Statuts validés par Joi ; une commande annulée ne peut plus changer de statut | ✅ |
| 14 | `getOrders` et `getProducts` sans `try/catch` : exception non gérée en cas d'erreur de base | contrôleurs | `try/catch` et gestionnaire d'erreurs global | ✅ |
| 15 | Inscription avec un nom d'utilisateur déjà pris → erreur 500 (index unique) | `authController.js` | Vérification préalable, message 400 | ✅ |
| 16 | Routes admin (`adminRoutes`) jamais montées : code mort qui dupliquait les routes commandes/produits | `backend/routes` | Supprimées, fonctionnalités utiles fusionnées | ✅ |
| 17 | Navbar non mise à jour après connexion ; rôle conservé après déconnexion | `Navbar.jsx` | Contexte d'authentification réactif, déconnexion côté serveur | ✅ |
| 18 | Livraison et paiement jamais enregistrés tant que l'option affichée par défaut n'était pas changée → commande refusée | `ShippingMethodSelection.jsx`, `PaymentMethodSelection.jsx` | Option « -- Choisissez -- » vide et obligatoire | ✅ |
| 19 | Route `shippig_payment` (faute de frappe) accessible sans être connecté | `App.jsx` | `/shipping-payment` protégée, retour à la page demandée après connexion | ✅ |
| 20 | Panier : mutation directe de l'état React (`quantity +=`) ; clé React `product.id` inexistante | `CartContext.jsx`, `ProductList.jsx` | Mise à jour immuable, clé `_id`, couverte par 5 tests unitaires | ✅ |
| 21 | Admin : un stock à 0 était refusé (`!stockValue`), erreurs de chargement non gérées | `Admin.jsx` | Contrôle corrigé, messages d'erreur, nom des produits dans le détail | ✅ |
| 22 | `authenticateToken` : `next()` dans le `try`, une erreur en aval était présentée comme « token invalide » | `authMiddleware.js` | `next()` sorti du bloc | ✅ |
| 23 | Test par défaut de CRA cassé (cherchait « learn react ») | `App.test.js` | Remplacé par des tests du panier | ✅ |
| 24 | Déploiements Vercel en échec (`fatal: bad object`) après un push de plusieurs commits : le dernier commit déployé n'était plus dans le clone partiel | `*/vercel.json` | La règle vérifie que le commit existe (`git rev-parse --verify`), sinon elle reconstruit | ✅ |
| 25 | Page admin : libellé « Status » en anglais, case « Nouveau stock » trop étroite (texte tronqué), titres de sections incohérents | `Admin.jsx` | Libellés en français, case élargie, titres harmonisés | ✅ |

**Vérification** : test de fumée `scripts/smoke-test.js` (25 contrôles), exécuté en local (Docker) et intégré à la CI avec une vraie base MongoDB ; parcours complet rejoué dans un navigateur (inscription, connexion, panier, livraison, commande, déconnexion). `[capture : session-2/E27-E28-test-de-fumee-25-controles.png, session-2/E27-E29-ci-verte-merge-pr4.png, session-1/E22-prod-administration.png]`

---

## E28 — Failles de sécurité et corrections

| # | Faille | Risque | Correction | Vérification |
|---|---|---|---|---|
| 1 | **Prix et total envoyés par le client** et enregistrés tels quels | Fraude : acheter un produit à 0,01 € | Prix relus en base, total recalculé ; les champs `price`/`total` du client sont supprimés par Joi | Commande envoyée avec `price: 0.01` → total facturé 700 € |
| 2 | **JWT dans le `localStorage`** | Vol de session par XSS | Cookie `HttpOnly` + `Secure` + `SameSite=Strict`, routes `/logout` et `/me` ; le front ne stocke plus ni token ni rôle | `document.cookie` et `localStorage` vides dans le navigateur ; cookie HttpOnly vérifié par le test |
| 3 | **Aucune validation des entrées** | Données incohérentes, injection NoSQL (`{"$ne": null}`) | Schémas **Joi** sur toutes les routes + `mongoose sanitizeFilter` | Injection → 400 ; statut, stock, identifiant invalides → 400 |
| 4 | **Énumération des comptes** (« Utilisateur non trouvé » / « Mot de passe incorrect ») | Découverte des identifiants existants | Message unique « Identifiants invalides » (401) | Messages identiques vérifiés |
| 5 | **Force brute** sur la connexion | Devinette de mots de passe | `express-rate-limit` : 20 essais / 15 min / IP sur `/api/auth` | — |
| 6 | Mots de passe faibles acceptés | Comptes faciles à compromettre | 8 caractères min., lettre + chiffre | Inscription « 123 » → 400 |
| 7 | En-têtes HTTP de sécurité absents | Clickjacking, sniffing MIME… | `helmet` sur les 4 services Node + en-têtes Vercel/Nginx pour le front | En-têtes présents en prod |
| 8 | `DELETE /api/orders/:id` sans contrôle de rôle | Un client pouvait supprimer des commandes | `isAdmin` + validation de l'identifiant | — |
| 9 | Secrets journalisés et distribués (session 1) | Fuite de mots de passe, tokens, SMTP | Voir E22 : secrets retirés des logs, régénérés, stockés en *Secret* Vercel | 0 secret dans l'historique Git |
| 10 | `/notify` ouvert à tous (session 1) | Relais d'e-mails abusif | Clé interne à temps constant entre services | 401 sans clé |
| 11 | **Dépendances vulnérables** | Exploitation de failles connues | Services Node : `npm audit fix` ; frontend : **migration CRA → Vite** (CRA n'est plus maintenu) | Frontend : **71 vulnérabilités (dont 4 critiques) → 0** ; services : 0 high/critical (contrôle CI) |

`[capture : session-2/E28-cookie-httponly-secure-strict.png, session-2/E28-console-document-cookie-vide.png, session-2/E28-localstorage-vide.png, session-2/E28-npm-audit-frontend-0-vulnerabilite.png]`

Qualité du code : **ESLint** (flat config, règles React/Hooks) et **Prettier** configurés à la racine pour tout le dépôt, contrôlés par un job CI dédié ; les erreurs remontées par ESLint ont été corrigées (bug n° 22 notamment).

Remarque sur `connect-flash` (cité dans les consignes) : ce module repose sur des sessions serveur et des rendus côté serveur. L'application étant une API JSON consommée par une SPA React, l'équivalent mis en place est un format d'erreur uniforme (`message` + `details`) affiché par le front dans les formulaires.

---

## E29 — Documentation et CHANGELOG

- **Documentation générée à partir du code** : commentaires JSDoc (`@module`, `@param`, `@returns`, `@typedef`) sur tous les fichiers du backend, du gateway et des microservices, puis génération HTML par `npm run docs` (JSDoc), dans [`docs/api`](docs/api/index.html) : 66 pages, une par module, avec le code source annoté. La CI échoue si un commentaire JSDoc est invalide. `[capture : session-2/E29-doc-jsdoc-accueil.png, session-2/E29-doc-jsdoc-stockService.png]`
- **README.md** : architecture, tableau des routes de l'API, démarrage local (Docker ou non), scripts, flux CI/CD, sécurité, supervision.
- **CHANGELOG.md** au format *Keep a Changelog* et versionnage sémantique : `1.0.0` (version fournie), `1.1.0` (mise en production), `2.0.0` (robustesse, sécurité, documentation), `2.0.1` (finitions de la page admin).
- **Historique Git** lisible : commits conventionnels (`feat`, `fix`, `ci`, `docs`, `style`…) avec description détaillée, formatage isolé dans un commit `style`.

---

## Accès pour la vérification
| Ressource | Accès |
|---|---|
| Dépôt GitHub | https://github.com/Ultrax92/guevel-shop (public) |
| Production | https://guevel-shop.xyz |
| Préproduction | https://preprod.guevel-shop.xyz |
| Compte admin de l'application | *(transmis dans le formulaire)* |
