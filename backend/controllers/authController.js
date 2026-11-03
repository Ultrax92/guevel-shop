// backend/controllers/authController.js
/** @module backend/controllers/authController */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User'); // modèle utilisateur
const logger = require('../config/logger');
const { audit } = require('../services/auditService');
const { AUTH_COOKIE } = require('../middlewares/authMiddleware');
const { getJwtSecret } = require('../config/secrets');

const TOKEN_TTL_SECONDS = 60 * 60; // 1 h

// Cookie HttpOnly (inaccessible au JavaScript, donc au XSS), Secure (HTTPS) et SameSite=Strict (anti-CSRF).
// Front et API partagent le même site (guevel-shop.xyz), le cookie est donc bien envoyé par le navigateur.
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE !== 'false',
  sameSite: 'strict',
  path: '/',
});

// Message identique pour un utilisateur inconnu ou un mauvais mot de passe : pas d'énumération des comptes
const INVALID_CREDENTIALS = 'Identifiants invalides.';

/**
 * Connexion : vérifie les identifiants, pose le JWT dans un cookie HttpOnly et renvoie le profil public.
 * Ne jamais journaliser de mot de passe, de hash ou de token.
 * @type {ExpressHandler}
 */
exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      await audit(req, 'échec de connexion (utilisateur inconnu)', { level: 'warn', username });
      return res.status(401).json({ message: INVALID_CREDENTIALS });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await audit(req, 'échec de connexion (mot de passe)', { level: 'warn', actorId: user._id, username });
      return res.status(401).json({ message: INVALID_CREDENTIALS });
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, getJwtSecret(), {
      algorithm: 'HS256',
      expiresIn: TOKEN_TTL_SECONDS,
    });
    await audit(req, 'connexion réussie', { actorId: user._id, username: user.username, details: { role: user.role } });

    res.cookie(AUTH_COOKIE, token, { ...cookieOptions(), maxAge: TOKEN_TTL_SECONDS * 1000 });
    res.json({ role: user.role, username: user.username });
  } catch (error) {
    logger.error('Erreur lors de la connexion', { error: error.message });
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/**
 * Déconnexion : supprime le cookie d'authentification.
 * @type {ExpressHandler}
 */
exports.logout = (req, res) => {
  res.clearCookie(AUTH_COOKIE, cookieOptions());
  res.status(204).end();
};

/**
 * Profil de l'utilisateur connecté (permet au front de connaître la session sans lire le token).
 * @type {ExpressHandler}
 */
exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('username email role').lean();
    if (!user) return res.status(401).json({ message: 'Session invalide, veuillez vous reconnecter.' });
    res.json({ username: user.username, email: user.email, role: user.role });
  } catch (error) {
    logger.error('Erreur lors de la lecture du profil', { error: error.message });
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/**
 * Inscription d'un client (rôle `user` imposé, jamais lu dans la requête).
 * @type {ExpressHandler}
 */
exports.register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Vérifier si l'email ou le nom d'utilisateur existe déjà (sinon l'index unique provoquait une erreur 500)
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });

    if (existingUser) {
      return res.status(400).json({ message: "Ce nom d'utilisateur ou cet e-mail est déjà utilisé." });
    }

    // Créer un nouvel utilisateur
    const user = new User({ username, email, password });
    await user.save();

    await audit(req, 'nouvel utilisateur inscrit', { actorId: user._id, username: user.username });

    res.status(201).json({ message: 'Utilisateur créé avec succès.' });
  } catch (error) {
    logger.error("Erreur lors de l'inscription", { error: error.message });
    res.status(500).json({ message: 'Une erreur est survenue.' });
  }
};
