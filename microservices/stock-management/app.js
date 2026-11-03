// stock-management/app.js
const express = require('express');
const helmet = require('helmet');
const logger = require('./lib/logger');
const internalAuth = require('./lib/internalAuth');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '50kb' }));

// Sonde de supervision
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'stock-management', env: process.env.APP_ENV || 'local', version: process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : 'local' });
});

// Reçoit les mouvements de stock publiés par le backend (source de vérité : la base produits)
app.post('/update-stock', internalAuth, (req, res) => {
  const { productId, quantity, remaining } = req.body || {};
  if (typeof productId !== 'string' || !Number.isInteger(quantity)) {
    return res.status(400).json({ message: 'productId (chaîne) et quantity (entier) sont requis.' });
  }
  logger.info('Mouvement de stock', { productId, quantity, remaining });
  res.json({ message: `Stock mis à jour pour le produit de ID : ${productId}`, productId, remaining });
});

module.exports = app;
