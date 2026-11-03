// src/config.js
// URL de l'API injectée au build (REACT_APP_API_URL) : différente en local, préprod et prod
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
