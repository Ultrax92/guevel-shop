// scripts/smoke-test.js
// Test de fumée de bout en bout de l'API (local, Docker, préprod ou prod) : fonctionnel + sécurité.
// Usage : node scripts/smoke-test.js <fichier .env contenant ADMIN_USERNAME / ADMIN_PASSWORD> <URL de l'API>
//   ex. node scripts/smoke-test.js .env http://localhost:5000
// Aucun secret n'est affiché. Crée un utilisateur et des commandes de test.
const fs = require('fs');

const [envFile = '.env', API = 'http://localhost:5000'] = process.argv.slice(2);
const env = Object.fromEntries(
  fs
    .readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])
);

let failures = 0;
const check = (label, condition, info = '') => {
  if (!condition) failures += 1;
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} ${label}${info ? ` (${info})` : ''}`);
};

/** Appel JSON ; `cookie` = valeur "token=..." à renvoyer, la réponse expose `setCookie`. */
const call = async (method, path, body, cookie) => {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // réponse sans corps (204)
  }
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return { status: res.status, data, setCookie };
};

const login = async (username, password) => {
  const res = await call('POST', '/api/auth/login', { username, password });
  const raw = res.setCookie.find((c) => c.startsWith('token=')) || '';
  return { ...res, raw, cookie: raw.split(';')[0] };
};

(async () => {
  const health = await call('GET', '/health');
  check('Sonde /health', health.status === 200 && health.data.db === 'up', JSON.stringify(health.data));

  const products = await call('GET', '/api/products');
  check(
    'Liste des produits publique',
    products.status === 200 && products.data.length > 0,
    `${products.data.length} produits`
  );
  const product = [...products.data].sort((a, b) => b.stock - a.stock)[0];

  // --- Inscription et validation des entrées (Joi)
  const weak = await call('POST', '/api/auth/register', { username: 'ab', email: 'pas-un-email', password: '123' });
  check('Inscription invalide refusée (400)', weak.status === 400, (weak.data.details || []).length + ' erreurs');
  const username = `smoke${Date.now()}`;
  const password = 'Smoke-Test-2026';
  const reg = await call('POST', '/api/auth/register', { username, email: `${username}@example.test`, password });
  check('Inscription valide (201)', reg.status === 201);
  const dup = await call('POST', '/api/auth/register', { username, email: `autre-${username}@example.test`, password });
  check("Nom d'utilisateur en double refusé (400, plus de 500)", dup.status === 400);

  // --- Connexion
  const injection = await call('POST', '/api/auth/login', { username: { $ne: null }, password: { $ne: null } });
  check('Injection NoSQL à la connexion refusée (400)', injection.status === 400);
  const bad = await call('POST', '/api/auth/login', { username, password: 'Mauvais-1234' });
  const unknown = await call('POST', '/api/auth/login', { username: 'inexistant' + Date.now(), password });
  check(
    'Même message pour utilisateur inconnu et mauvais mot de passe (401)',
    bad.status === 401 && unknown.status === 401 && bad.data.message === unknown.data.message
  );
  const user = await login(username, password);
  check(
    'Connexion : cookie HttpOnly + SameSite=Strict',
    user.status === 200 && /HttpOnly/i.test(user.raw) && /SameSite=Strict/i.test(user.raw)
  );
  check("Le token n'est plus renvoyé dans le corps JSON", user.data && !('token' in user.data));
  const me = await call('GET', '/api/auth/me', undefined, user.cookie);
  check('Session lue par /api/auth/me', me.status === 200 && me.data.username === username);

  // --- Commandes
  const address = { street: '1 rue du Test', city: 'Paris', postalCode: '75001', country: 'France' };
  const order = (items) => ({
    items,
    shippingAddress: address,
    paymentMethod: 'Carte bancaire',
    shippingMethod: 'colissimo',
  });

  const invalid = await call('POST', '/api/orders', { items: [] }, user.cookie);
  check('Commande invalide refusée (400)', invalid.status === 400);
  const tooMuch = await call('POST', '/api/orders', order([{ productId: product._id, quantity: 100 }]), user.cookie);
  check(
    'Commande au-delà du stock refusée',
    tooMuch.status === 409 || tooMuch.status === 400,
    `HTTP ${tooMuch.status}`
  );

  const tampered = await call(
    'POST',
    '/api/orders',
    order([{ productId: product._id, quantity: 1, price: 0.01 }]),
    user.cookie
  );
  check(
    'Prix falsifié ignoré : total calculé côté serveur',
    tampered.status === 201 && tampered.data.order.total === product.price,
    `total ${tampered.data?.order?.total} € pour un prix réel de ${product.price} €`
  );
  const after = (await call('GET', '/api/products')).data.find((p) => p._id === product._id);
  check('Stock décrémenté après la commande', after.stock === product.stock - 1, `${product.stock} → ${after.stock}`);

  check(
    'Liste des commandes interdite à un client (403)',
    (await call('GET', '/api/orders', undefined, user.cookie)).status === 403
  );
  check('Accès sans authentification refusé (401)', (await call('GET', '/api/orders')).status === 401);

  // --- Administration
  const admin = await login(env.ADMIN_USERNAME, env.ADMIN_PASSWORD);
  check('Connexion admin', admin.status === 200 && admin.data.role === 'admin');
  const orders = await call('GET', '/api/orders', undefined, admin.cookie);
  check(
    'Liste des commandes (admin)',
    orders.status === 200 && Array.isArray(orders.data),
    `${orders.data.length} commandes`
  );
  const orderId = tampered.data.order._id;
  const badStatus = await call('PUT', `/api/orders/${orderId}/status`, { status: 'Validée' }, admin.cookie);
  check('Statut hors liste refusé (400)', badStatus.status === 400);
  const badId = await call('PUT', '/api/orders/pas-un-id/status', { status: 'Expédiée' }, admin.cookie);
  check('Identifiant invalide refusé (400)', badId.status === 400);
  const validated = await call('PUT', `/api/orders/${orderId}/validate`, undefined, admin.cookie);
  check('Validation de commande', validated.status === 200 && validated.data.order.status === 'En cours de traitement');
  const cancelled = await call('PUT', `/api/orders/${orderId}/status`, { status: 'Annulée' }, admin.cookie);
  const restored = (await call('GET', '/api/products')).data.find((p) => p._id === product._id);
  check(
    'Annulation : stock restitué',
    cancelled.status === 200 && restored.stock === product.stock,
    `stock ${restored.stock}`
  );
  const badStock = await call('PUT', `/api/products/${product._id}/stock`, { stock: -3 }, admin.cookie);
  check('Stock négatif refusé (400)', badStock.status === 400);
  const audit = await call('GET', '/api/audit?limit=5', undefined, admin.cookie);
  check(
    "Journal d'audit (admin)",
    audit.status === 200 && audit.data.length > 0,
    audit.data.map((a) => a.action).join(' | ')
  );

  // --- Déconnexion
  const out = await call('POST', '/api/auth/logout', undefined, user.cookie);
  check('Déconnexion : cookie supprimé', out.status === 204 && out.setCookie.some((c) => c.startsWith('token=;')));

  console.log(failures === 0 ? '\nTous les tests sont passés.' : `\n${failures} test(s) en échec.`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((error) => {
  console.error('Erreur du test :', error.message);
  process.exit(1);
});
