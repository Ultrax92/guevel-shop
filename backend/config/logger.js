// config/logger.js
/** @module backend/config/logger */
// Logger JSON structuré (Winston) : lisible par Vercel Runtime Logs, Docker et les outils de centralisation
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'backend',
    env: process.env.APP_ENV || 'local',
  },
  format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
  transports: [new transports.Console()],
});

module.exports = logger;
