// backend/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User'); // modèle utilisateur
const logger = require('../config/logger');
//const sendEmail = require('../services/emailService');

// Ne jamais journaliser de mot de passe, de hash ou de token
exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      logger.warn('Audit: échec de connexion (utilisateur inconnu)', { audit: true, username });
      return res.status(400).json({ message: 'Utilisateur non trouvé' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.warn('Audit: échec de connexion (mot de passe)', { audit: true, username });
      return res.status(400).json({ message: 'Mot de passe incorrect' });
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    logger.info('Audit: connexion réussie', { audit: true, userId: user._id.toString(), role: user.role });

    res.json({ token, role: user.role, username: user.username });
  } catch (error) {
    logger.error('Erreur lors de la connexion', { error: error.message });
    res.status(500).json({ message: 'Erreur serveur' });
  }
};


exports.register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Vérifier si l'email ou le nom d'utilisateur existe déjà
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
    }

    // Créer un nouvel utilisateur
    const user = new User({ username, email, password });
    await user.save();

    logger.info('Audit: nouvel utilisateur inscrit', { audit: true, userId: user._id.toString() });

    // Envoyer un email de bienvenue
    // await sendEmail(
    //   email,
    //   'Bienvenue dans notre application',
    //   `Bonjour ${username},\n\nMerci de vous être inscrit. Nous sommes ravis de vous accueillir !`
    // );

    // await axios.post('http://localhost:4002/notify', {
    //   to: email,
    //   subject: 'Bienvenue dans notre application',
    //   text: `Bonjour ${username},\n\nMerci de vous être inscrit. Nous sommes ravis de vous accueillir !`,
    // });

    res.status(201).json({ message: 'Utilisateur créé avec succès.' });
  } catch (error) {
    logger.error('Erreur lors de l\'inscription', { error: error.message });
    res.status(500).json({ message: 'Une erreur est survenue.' });
  }
};