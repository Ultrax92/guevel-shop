// backend/middlewares/authMiddleware.js
/** @module backend/middlewares/authMiddleware */
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const { getJwtSecret } = require('../config/secrets');

/** Nom du cookie HttpOnly qui transporte le JWT. */
const AUTH_COOKIE = 'token';

/**
 * Vérifie le JWT (cookie HttpOnly en priorité, en-tête `Authorization: Bearer` pour les clients d'API)
 * et place `{ userId, role }` dans `req.user`.
 * @type {ExpressHandler}
 */
exports.authenticateToken = (req, res, next) => {
  const token = req.cookies?.[AUTH_COOKIE] || req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Authentification requise.' });

  // Hors du try : un secret mal configuré est une erreur serveur (500), pas un token invalide
  const secret = getJwtSecret();
  try {
    req.user = jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch {
    logger.warn('Token JWT invalide ou expiré', { url: req.originalUrl });
    return res.status(401).json({ message: 'Session invalide ou expirée, veuillez vous reconnecter.' });
  }
  // Hors du try : une erreur levée plus loin dans la chaîne ne doit pas passer pour un token invalide
  next();
};

/**
 * Autorise uniquement les administrateurs (à placer après `authenticateToken`).
 * @type {ExpressHandler}
 */
exports.isAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Accès interdit' });
  next();
};

exports.AUTH_COOKIE = AUTH_COOKIE;
