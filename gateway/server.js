// gateway/server.js
require('dotenv').config();
const app = require('./app');
const logger = require('./lib/logger');

// Lancer le Gateway
const PORT = process.env.GATEWAY_PORT || process.env.PORT || 8000;
app.listen(PORT, () => {
  logger.info(`Gateway opérationnel sur le port ${PORT}`);
});
