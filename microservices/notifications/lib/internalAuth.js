// lib/internalAuth.js
/** @module microservices/notifications/lib/internalAuth */
// Seul le gateway (porteur de la clé interne partagée) peut appeler ce microservice
const crypto = require('crypto');
const logger = require('./logger');

const safeEqual = (a, b) => {
  const bufA = Buffer.from(a || '');
  const bufB = Buffer.from(b || '');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

module.exports = (req, res, next) => {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected || !safeEqual(req.get('x-internal-key'), expected)) {
    logger.warn('Audit: appel refusé (clé interne invalide)', { audit: true, url: req.originalUrl });
    return res.status(401).json({ message: 'Non autorisé' });
  }
  next();
};
