// server.js
require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const logger = require('./config/logger');
const { getJwtSecret } = require('./config/secrets');

// Refus de démarrer avec un secret JWT faible : mieux vaut une panne visible qu'une faille silencieuse
try {
  getJwtSecret();
} catch (error) {
  logger.error(error.message);
  process.exit(1);
}

// Connexion anticipée ; en cas d'échec, les routes répondent 503 et la sonde /health passe en "degraded"
connectDB().catch(() => {});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => logger.info(`Serveur en écoute sur le port ${PORT}`));
