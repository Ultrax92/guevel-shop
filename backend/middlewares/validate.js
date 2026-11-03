// backend/middlewares/validate.js
// Middleware générique de validation Joi : renvoie 400 avec des messages lisibles, et nettoie les données reçues

// Messages d'erreur en français pour les règles Joi utilisées
const messages = {
  'any.required': '{{#label}} est obligatoire.',
  'any.only': "{{#label}} doit être l'une des valeurs suivantes : {{#valids}}.",
  'string.base': '{{#label}} doit être une chaîne de caractères.',
  'string.empty': '{{#label}} ne peut pas être vide.',
  'string.min': '{{#label}} doit contenir au moins {{#limit}} caractères.',
  'string.max': '{{#label}} doit contenir au plus {{#limit}} caractères.',
  'string.alphanum': '{{#label}} ne doit contenir que des lettres et des chiffres.',
  'string.email': '{{#label}} doit être une adresse e-mail valide.',
  'string.hex': '{{#label}} est invalide.',
  'string.length': '{{#label}} est invalide.',
  'number.base': '{{#label}} doit être un nombre.',
  'number.integer': '{{#label}} doit être un nombre entier.',
  'number.min': '{{#label}} doit être supérieur ou égal à {{#limit}}.',
  'number.max': '{{#label}} doit être inférieur ou égal à {{#limit}}.',
  'array.base': '{{#label}} doit être une liste.',
  'array.min': '{{#label}} doit contenir au moins {{#limit}} élément(s).',
  'array.max': '{{#label}} doit contenir au plus {{#limit}} éléments.',
  'object.base': '{{#label}} est invalide.',
  'object.unknown': "Le champ {{#label}} n'est pas autorisé.",
};

/**
 * Valide `req[property]` avec un schéma Joi.
 * Les champs inconnus sont supprimés (ex. un `price` envoyé par le client) et les valeurs sont normalisées.
 * @param {import('joi').ObjectSchema} schema Schéma Joi à appliquer
 * @param {'body'|'params'|'query'} [property='body'] Partie de la requête à valider
 * @returns {import('express').RequestHandler}
 */
module.exports =
  (schema, property = 'body') =>
  (req, res, next) => {
    const { error, value } = schema.validate(req[property] ?? {}, {
      abortEarly: false,
      stripUnknown: true,
      messages,
      errors: { wrap: { label: false } },
    });

    if (error) {
      return res.status(400).json({
        message: 'Données invalides.',
        details: error.details.map((detail) => detail.message),
      });
    }

    req[property] = value;
    next();
  };
