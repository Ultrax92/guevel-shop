// notifications/app.js
const express = require('express');
const nodemailer = require('nodemailer');
const logger = require('./lib/logger');
const internalAuth = require('./lib/internalAuth');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));

// Configuration de Nodemailer (identifiants uniquement via variables d'environnement, jamais journalisés)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Adresse Gmail
    pass: process.env.EMAIL_APPLICATION_PASSWORD, // Mot de passe spécifique à l'application
  },
});

// Sonde de supervision
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notifications', env: process.env.APP_ENV || 'local' });
});

// Route pour envoyer un email
app.post('/notify', internalAuth, async (req, res) => {
  const { to, subject, text } = req.body || {};
  if (!to || !subject || !text) {
    return res.status(400).json({ message: 'Les champs to, subject et text sont requis.' });
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info('Email envoyé avec succès', { subject });
    return res.status(200).json({ message: 'Email envoyé avec succès.' });
  } catch (error) {
    logger.error('Erreur lors de l\'envoi de l\'email', { subject, error: error.message });
    return res.status(500).json({ message: 'Erreur lors de l\'envoi de l\'email.' });
  }
});

module.exports = app;
