// app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const logger = require('./config/logger');

const app = express();
app.disable('x-powered-by');
// Derrière le proxy Vercel / Nginx : req.ip = IP réelle du client (X-Forwarded-For du premier proxy)
app.set('trust proxy', 1);

// CORS restreint aux fronts autorisés (liste séparée par des virgules)
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim());
// En-têtes de sécurité HTTP (HSTS, nosniff, frameguard, CSP minimale pour une API JSON…)
app.use(helmet());
// credentials: true -> le navigateur envoie le cookie HttpOnly d'authentification
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Journalisation de chaque requête HTTP (sans corps ni en-têtes sensibles)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('http', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
});

// Sonde de supervision : état du service et de la base
// Un vrai ping (et non readyState) évite les faux "down" au réveil d'une instance serverless
app.get('/health', async (req, res) => {
  let dbUp = false;
  try {
    await connectDB();
    await mongoose.connection.db.admin().command({ ping: 1 });
    dbUp = true;
  } catch (err) {
    logger.warn('Sonde /health : base injoignable', { error: err.message });
  }
  res.status(dbUp ? 200 : 503).json({
    status: dbUp ? 'ok' : 'degraded',
    service: 'backend',
    env: process.env.APP_ENV || 'local',
    db: dbUp ? 'up' : 'down',
    version: process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : 'local',
  });
});

// Garantit la connexion à la base avant toute route API
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({ message: 'Base de données indisponible' });
  }
});

app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/audit', require('./routes/auditRoutes'));

app.use((req, res) => res.status(404).json({ message: 'Ressource introuvable' }));

// Gestionnaire d'erreurs global : évite le crash et ne divulgue pas la stack au client
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Erreur non gérée', { error: err.message, stack: err.stack, url: req.originalUrl });
  res.status(500).json({ message: 'Erreur serveur' });
});

module.exports = app;
