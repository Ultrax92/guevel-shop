// gateway/app.js
const express = require('express');
const helmet = require('helmet');
const logger = require('./lib/logger');
const internalAuth = require('./lib/internalAuth');
const notifiProxy = require('./routes/notifi');
const stockProxy = require('./routes/stock');

const app = express();
app.disable('x-powered-by');
app.use(helmet());

// Journalisation de chaque requête relayée
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('http', { method: req.method, url: req.originalUrl, status: res.statusCode, durationMs: Date.now() - start });
  });
  next();
});

// Sonde de supervision
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'gateway', env: process.env.APP_ENV || 'local', version: process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : 'local' });
});

// Routes principales pour chaque microservice (le corps est relayé tel quel, sans parsing)
app.use('/notify', internalAuth, notifiProxy);
app.use('/update-stock', internalAuth, stockProxy);

app.use((req, res) => res.status(404).json({ message: 'Ressource introuvable' }));

module.exports = app;
