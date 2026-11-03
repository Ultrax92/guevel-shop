// lib/logger.js
// Logger JSON structuré (Winston) du microservice stock-management
const { createLogger, format, transports } = require('winston');

module.exports = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'stock-management', env: process.env.APP_ENV || 'local' },
  format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
  transports: [new transports.Console()],
});
