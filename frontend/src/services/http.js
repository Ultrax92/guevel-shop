// src/services/http.js
// Client HTTP unique : URL de l'API centralisée et envoi du cookie d'authentification HttpOnly
import axios from 'axios';
import { API_BASE_URL } from '../config';

const http = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
});

/**
 * Extrait un message d'erreur lisible d'une réponse de l'API.
 * @param {unknown} error Erreur axios
 * @param {string} fallback Message par défaut (erreur réseau…)
 * @returns {string}
 */
export const errorMessage = (error, fallback = 'Une erreur est survenue. Veuillez réessayer.') => {
  const data = error?.response?.data;
  if (data?.details?.length) return data.details.join('\n');
  return data?.message || fallback;
};

export default http;
