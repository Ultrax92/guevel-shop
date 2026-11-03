// backend/routes/auditRoutes.js
/** @module backend/routes/auditRoutes */
const express = require('express');
const AuditLog = require('../models/AuditLog');
const { authenticateToken, isAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

// Consultation du journal d'audit (administrateurs uniquement) : ?limit=50&action=...
router.get('/', authenticateToken, isAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const filter = typeof req.query.action === 'string' ? { action: req.query.action } : {};
    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
