// stock-management/index.js
require('dotenv').config();
const app = require('./app');
const logger = require('./lib/logger');

const PORT = process.env.STOCK_PORT || process.env.PORT || 4003;

app.listen(PORT, () => logger.info(`Service de gestion des stocks sur le port ${PORT}`));
