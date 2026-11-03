// services/stockService.js
/** @module backend/services/stockService */
// Réservation et restitution atomiques du stock, et événement envoyé au microservice stock-management
const axios = require('axios');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const logger = require('../config/logger');
const { sendNotification } = require('./notificationService');

/**
 * Ligne de panier à réserver.
 * @typedef {Object} StockLine
 * @property {string} productId Identifiant du produit
 * @property {number} quantity Quantité demandée
 */

/**
 * Ligne réservée, avec les informations relues en base.
 * @typedef {Object} ReservedLine
 * @property {string} productId Identifiant du produit
 * @property {number} quantity Quantité réservée
 * @property {number} price Prix unitaire en base (jamais celui du client)
 * @property {string} name Nom du produit
 * @property {number} remaining Stock restant après réservation
 */

const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD || 5);

/** Erreur métier portant le code HTTP à renvoyer au client. */
class StockError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Prévient le microservice stock-management (via le gateway) et alerte l'admin si le stock devient bas.
 * @param {{ productId: string, name: string, quantity: number, remaining: number }} event
 */
const publishStockEvent = async ({ productId, name, quantity, remaining }) => {
  const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:8000';
  try {
    await axios.post(
      `${gatewayUrl}/update-stock`,
      { productId, quantity, remaining },
      { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY }, timeout: 8000 }
    );
  } catch (error) {
    logger.error('Événement de stock non transmis au microservice', { productId, error: error.message });
  }

  if (remaining <= LOW_STOCK_THRESHOLD) {
    await sendNotification({
      subject: 'Alerte stock bas',
      text: `Le produit "${name}" (${productId}) n'a plus que ${remaining} unité(s) en stock.`,
    });
  }
};

/**
 * Réserve le stock de chaque produit de façon atomique (pas de survente même avec des commandes simultanées)
 * et renvoie les lignes de commande avec le prix lu en base (jamais celui envoyé par le client).
 * En cas d'échec, le stock déjà réservé est restitué.
 * @param {Array.<StockLine>} items
 * @returns {Promise.<Array.<ReservedLine>>}
 */
exports.reserveStock = async (items) => {
  // Regroupe les quantités d'un même produit présent plusieurs fois
  const quantities = new Map();
  for (const { productId, quantity } of items) {
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }

  const reserved = [];
  try {
    for (const [productId, quantity] of quantities) {
      const product = await Product.findOneAndUpdate(
        // mongoose.trusted : opérateur voulu malgré sanitizeFilter (protection anti-injection globale)
        { _id: productId, stock: mongoose.trusted({ $gte: quantity }) },
        { $inc: { stock: -quantity } },
        { new: true }
      );

      if (!product) {
        const exists = await Product.exists({ _id: productId });
        throw exists
          ? new StockError(409, 'Stock insuffisant pour un des produits du panier.')
          : new StockError(404, "Un des produits du panier n'existe plus.");
      }

      reserved.push({ productId, quantity, price: product.price, name: product.name, remaining: product.stock });
    }
    return reserved;
  } catch (error) {
    await exports.releaseStock(reserved);
    throw error;
  }
};

/**
 * Restitue du stock (échec de commande, annulation, suppression).
 * @param {Array.<StockLine>} items
 */
exports.releaseStock = async (items) => {
  await Promise.all(
    items.map(({ productId, quantity }) => Product.updateOne({ _id: productId }, { $inc: { stock: quantity } }))
  );
};

exports.publishStockEvent = publishStockEvent;
exports.StockError = StockError;
