// backend/validators/schemas.js
// Schémas Joi : contrôle de toutes les données utilisateur avant tout accès à la base.
// Les types stricts (string, number…) bloquent aussi les injections d'opérateurs MongoDB ({"$ne": null}).
const Joi = require('joi');

const ORDER_STATUSES = ['En attente', 'En cours de traitement', 'Expédiée', 'Délivrée', 'Annulée'];
const PAYMENT_METHODS = ['Carte bancaire', 'PayPal', 'Virement'];
const SHIPPING_METHODS = ['colissimo', 'chronopost'];

const objectId = Joi.string().hex().length(24);

/** Inscription : identifiant alphanumérique, e-mail valide, mot de passe d'au moins 8 caractères avec lettre et chiffre. */
const registerSchema = Joi.object({
  username: Joi.string().trim().alphanum().min(3).max(30).required().label("Le nom d'utilisateur"),
  email: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .max(254)
    .required()
    .label("L'e-mail"),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/[A-Za-z]/)
    .pattern(/\d/)
    .required()
    .label('Le mot de passe')
    .messages({ 'string.pattern.base': 'Le mot de passe doit contenir au moins une lettre et un chiffre.' }),
});

/** Connexion. */
const loginSchema = Joi.object({
  username: Joi.string().trim().max(30).required().label("Le nom d'utilisateur"),
  password: Joi.string().max(128).required().label('Le mot de passe'),
});

/** Commande : seuls l'identifiant et la quantité des produits sont acceptés, le prix est relu en base. */
const orderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: objectId.required().label("L'identifiant produit"),
        quantity: Joi.number().integer().min(1).max(100).required().label('La quantité'),
      })
    )
    .min(1)
    .max(50)
    .required()
    .label('Le panier'),
  shippingAddress: Joi.object({
    street: Joi.string().trim().min(3).max(200).required().label('La rue'),
    city: Joi.string().trim().min(2).max(100).required().label('La ville'),
    postalCode: Joi.string()
      .trim()
      .pattern(/^[A-Za-z0-9 -]{3,10}$/)
      .required()
      .label('Le code postal')
      .messages({ 'string.pattern.base': 'Le code postal est invalide.' }),
    country: Joi.string().trim().min(2).max(100).required().label('Le pays'),
  })
    .required()
    .label("L'adresse de livraison"),
  paymentMethod: Joi.string()
    .valid(...PAYMENT_METHODS)
    .required()
    .label('Le mode de paiement'),
  shippingMethod: Joi.string()
    .valid(...SHIPPING_METHODS)
    .required()
    .label('La méthode de livraison'),
});

/** Changement de statut d'une commande (admin). */
const orderStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...ORDER_STATUSES)
    .required()
    .label('Le statut'),
});

/** Mise à jour du stock d'un produit (admin). */
const stockSchema = Joi.object({
  stock: Joi.number().integer().min(0).max(100000).required().label('Le stock'),
});

/** Paramètre d'URL contenant un identifiant MongoDB. */
const idParamSchema = (name) => Joi.object({ [name]: objectId.required().label("L'identifiant") });

module.exports = {
  ORDER_STATUSES,
  registerSchema,
  loginSchema,
  orderSchema,
  orderStatusSchema,
  stockSchema,
  idParamSchema,
};
