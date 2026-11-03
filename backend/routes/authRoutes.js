// backend/routes/authRoutes.js
/** @module backend/routes/authRoutes */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, register, logout, me } = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { loginSchema, registerSchema } = require('../validators/schemas');

const router = express.Router();

// Limitation des tentatives (force brute / création de comptes en masse) : 20 requêtes / 15 min / IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Trop de tentatives, réessayez dans quelques minutes.' },
});

router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/logout', logout);
router.get('/me', authenticateToken, me);

module.exports = router;
