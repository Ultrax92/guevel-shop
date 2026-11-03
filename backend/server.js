// server.js
require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const logger = require('./config/logger');

// Connexion anticipée ; en cas d'échec, les routes répondent 503 et la sonde /health passe en "degraded"
connectDB().catch(() => {});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => logger.info(`Serveur en écoute sur le port ${PORT}`));
