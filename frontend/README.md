# Frontend — Guevel Shop

Application React 18 (React Router 7, Tailwind CSS), construite avec **Vite**. Elle remplace Create React App, qui n'est plus maintenu.

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement sur http://localhost:3000 |
| `npm run build` | Build de production dans `dist/` |
| `npm run preview` | Prévisualisation du build |
| `npm test` | Tests unitaires (Vitest) |

Variable d'environnement (fixée au build) : `REACT_APP_API_URL`, l'URL de l'API, par exemple `https://api.guevel-shop.xyz/api`.

L'authentification repose sur un cookie `HttpOnly` posé par l'API. Le front ne stocke ni token ni rôle.
