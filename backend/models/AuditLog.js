// backend/models/AuditLog.js
/** @module backend/models/AuditLog */
// Journal d'audit persistant : qui a fait quoi, quand, depuis où (conservé 90 jours)
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  level: { type: String, enum: ['info', 'warn'], default: 'info' },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String },
  env: { type: String },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
