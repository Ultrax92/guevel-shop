// config/db.js
const mongoose = require('mongoose');
const logger = require('./logger');

let connectionPromise = null;

// Connexion unique réutilisée entre les requêtes (indispensable en serverless : le module reste en mémoire)
const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
      .then((m) => {
        logger.info('MongoDB connecté');
        return m.connection;
      })
      .catch((err) => {
        connectionPromise = null;
        logger.error('Connexion MongoDB impossible', { error: err.message });
        throw err;
      });
  }

  return connectionPromise;
};

module.exports = connectDB;
