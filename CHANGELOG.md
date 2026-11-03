# Journal des évolutions

Toutes les évolutions notables du projet sont consignées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions selon le [versionnage sémantique](https://semver.org/lang/fr/).

## [2.0.0] — 2026-11-03 — Robustesse, sécurité et documentation

### Sécurité
- Validation **Joi** de toutes les entrées utilisateur (inscription, connexion, commande, statut, stock, identifiants d'URL), avec des messages en français. Les champs inconnus sont supprimés.
- Protection contre l'**injection NoSQL** : types stricts côté Joi et `mongoose.set('sanitizeFilter', true)`.
- **JWT déplacé du `localStorage` vers un cookie `HttpOnly` / `Secure` / `SameSite=Strict`** ; nouvelles routes `/api/auth/logout` et `/api/auth/me`. Algorithme JWT imposé (HS256).
- **Prix et total recalculés côté serveur** : le prix envoyé par le client était utilisé tel quel, ce qui permettait de le falsifier.
- **Helmet** sur tous les services, **CORS** avec `credentials` limité aux domaines du front, **limitation des tentatives** sur `/api/auth` (20 requêtes / 15 min / IP).
- Message unique « Identifiants invalides » pour éviter l'énumération des comptes.
- Politique de mot de passe : 8 caractères minimum, avec au moins une lettre et un chiffre.
- Frontend : migration de Create React App (abandonné) vers **Vite**. L'audit npm passe de **71 vulnérabilités à 0**.

### Corrigé
- `DELETE /api/orders/:id` ne renvoyait jamais de réponse et n'exigeait pas le rôle admin.
- `PUT /api/orders/:id/validate` ne faisait rien. La commande passe désormais « En cours de traitement ».
- Le stock n'était jamais décrémenté. Il est maintenant réservé de façon atomique (pas de survente) et restitué en cas d'échec, d'annulation ou de suppression.
- Le statut « Validée » était absent de l'énumération du modèle. Les statuts sont désormais validés, et une commande annulée ne peut plus changer de statut.
- Lectures sans `try/catch` (`getOrders`, `getProducts`), qui risquaient de faire planter le serveur.
- Doublon de nom d'utilisateur à l'inscription : erreur 500, remplacée par un message 400.
- `authenticateToken` : une erreur survenant plus loin dans la chaîne passait pour un token invalide.
- Frontend :
  - barre de navigation non mise à jour après connexion ;
  - rôle conservé après déconnexion ;
  - faute de frappe dans la route `shippig_payment`, et page non protégée ;
  - livraison et paiement jamais enregistrés tant que l'utilisateur ne changeait pas l'option affichée ;
  - mutation de l'état du panier ;
  - clé React manquante ;
  - stock 0 refusé dans l'admin ;
  - erreurs serveur non affichées.
- Champs `createdAt` / `updatedAt` en double avec `timestamps` dans le modèle Order.

### Ajouté
- Actions admin : validation, annulation, livraison et suppression de commande. Noms des produits dans le détail.
- E-mail au client à chaque changement de statut, et alerte e-mail « stock bas ». Événements de stock envoyés au microservice stock-management.
- Test de fumée de bout en bout (`scripts/smoke-test.js`, 25 contrôles fonctionnels et de sécurité).
- Tests unitaires du panier (Vitest).
- ESLint (flat config) et Prettier pour tout le dépôt.
- Documentation générée depuis le code (JSDoc → `docs/api`), README et ce CHANGELOG.
- CI :
  - job qualité (lint et formatage) ;
  - job d'intégration (API + MongoDB + test de fumée) ;
  - tests du frontend.

### Supprimé
- Code mort : `adminController` / `adminRoutes` (jamais montés), routes gateway `auth` / `notif` (vides ou vers un service inexistant), microservice `auth-gateway` (vide), fichiers CRA inutilisés.
- Dépendances inutilisées : `debug`, `body-parser`, `react-scripts`, `web-vitals`.

## [1.1.0] — 2026-11-03 — Mise en production

### Ajouté
- Hébergement :
  - Vercel, 5 projets en région Paris : `develop` → préprod, `main` → prod ;
  - MongoDB Atlas M0 ;
  - domaine `guevel-shop.xyz` avec 11 sous-domaines et certificats HTTPS automatiques.
- Conteneurisation : un Dockerfile par service (non-root, healthcheck), frontend servi par Nginx, `docker-compose.yml` complet.
- CI GitHub Actions : chargement et audit des services, build du frontend, images Docker publiées sur GHCR.
- Logs JSON Winston, journal d'audit persistant (`auditlogs`, 90 jours), `GET /api/audit`.
- Sondes `/health` avec la version déployée et un ping de la base. 10 moniteurs UptimeRobot avec alertes e-mail.
- Seeder : création du premier administrateur (dump et accès admin non fournis).

### Sécurité
- Secrets retirés du code et des logs (mot de passe SMTP, mots de passe, tokens, URI MongoDB). Secrets régénérés, distincts par environnement.
- Clé interne obligatoire entre backend, gateway et microservices (`/notify` n'est plus un relais d'e-mails public).
- `npm audit fix` sur tous les services, nodemailer 6 → 10.

### Corrigé
- URL `localhost` codées en dur, remplacées par des variables d'environnement.
- Ports et services incohérents dans `docker-compose.yml`.
- Identifiants SMTP fournis refusés par Gmail.
- Faux « db: down » au réveil d'une instance serverless.
- Tag Docker invalide sur les pull requests.
- Redéploiement Vercel ignoré après un changement de variable d'environnement.

## [1.0.0] — 2024-11 — Version fournie

- Application initiale fournie pour l'examen (frontend CRA, backend Express, gateway, microservices notifications et stock).
