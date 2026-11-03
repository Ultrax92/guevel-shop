// notifications/index.js
require('dotenv').config();
const app = require('./app');
const logger = require('./lib/logger');

// Lancer le service Notification
const PORT = process.env.NOTIFI_PORT || process.env.PORT || 4002;
app.listen(PORT, () => {
  logger.info(`Service de notification en écoute sur le port ${PORT}`);
});
