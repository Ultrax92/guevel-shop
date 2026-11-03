// services/notificationService.js
// Envoi des notifications via le gateway (URL et clé interne issues des variables d'environnement)
const axios = require('axios');
const logger = require('../config/logger');

exports.sendNotification = async ({ to, subject, text }) => {
  const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:8000';
  try {
    await axios.post(
      `${gatewayUrl}/notify`,
      { to: to || process.env.ADMIN_EMAIL, subject, text },
      { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY }, timeout: 8000 }
    );
    logger.info('Notification envoyée', { subject });
  } catch (error) {
    // Une notification en échec ne doit pas faire échouer l'action métier
    logger.error('Échec de l\'envoi de la notification', { subject, error: error.message });
  }
};
