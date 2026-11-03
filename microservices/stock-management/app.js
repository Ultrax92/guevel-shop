// stock-management/app.js
const express = require('express');
const logger = require('./lib/logger');
const internalAuth = require('./lib/internalAuth');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));

// Sonde de supervision
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'stock-management', env: process.env.APP_ENV || 'local', version: process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : 'local' });
});

app.post('/update-stock', internalAuth, (req, res) => {
  const { productId, quantity } = req.body || {};
  logger.info('Mise à jour du stock', { productId, quantity });
  res.send(`Stock mis à jour pour le produit de ID : ${productId}`);
});

module.exports = app;
