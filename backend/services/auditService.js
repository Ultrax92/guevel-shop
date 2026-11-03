// services/auditService.js
// Trace une action sensible dans les logs (Winston) ET dans la collection auditlogs (MongoDB)
const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

exports.audit = async (req, action, { level = 'info', actorId, username, details } = {}) => {
  const entry = { action, level, actorId, username, details, ip: req.ip, env: process.env.APP_ENV || 'local' };
  logger[level](`Audit: ${action}`, { audit: true, ...entry });

  try {
    await AuditLog.create(entry);
  } catch (error) {
    // L'échec d'écriture de l'audit ne doit pas bloquer l'action métier
    logger.error("Écriture du journal d'audit impossible", { action, error: error.message });
  }
};
