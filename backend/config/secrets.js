// backend/config/secrets.js
/** @module backend/config/secrets */
// Lecture contrôlée des secrets : un JWT_SECRET absent ou trop court rendrait les tokens falsifiables
// (un secret court se casse par force brute hors ligne à partir d'un seul token intercepté).

/** Longueur minimale acceptée pour JWT_SECRET (32 caractères ; 64 hexadécimaux recommandés, soit 256 bits). */
const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Renvoie le secret de signature des JWT après avoir vérifié sa robustesse.
 * @returns {string}
 * @throws {Error} si JWT_SECRET est absent ou fait moins de 32 caractères
 */
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET || '';
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET absent ou trop court (${MIN_JWT_SECRET_LENGTH} caractères minimum). Générez-le avec : openssl rand -hex 32`
    );
  }
  return secret;
};

module.exports = { MIN_JWT_SECRET_LENGTH, getJwtSecret };
