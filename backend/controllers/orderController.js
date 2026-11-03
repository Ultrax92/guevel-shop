// backend/controllers/orderController.js
const Order = require('../models/Order');
const User = require('../models/User');
const logger = require('../config/logger');
const { sendNotification } = require('../services/notificationService');
const { audit } = require('../services/auditService');
const { reserveStock, releaseStock, publishStockEvent, StockError } = require('../services/stockService');

// Statuts pour lesquels le stock n'est plus « engagé » (la marchandise est partie ou la commande est annulée)
const STOCK_RELEASED_OR_SHIPPED = ['Expédiée', 'Délivrée', 'Annulée'];

/**
 * Prévient le client par e-mail du nouveau statut de sa commande.
 * @param {import('mongoose').Document} order
 */
const notifyCustomer = async (order) => {
  const customer = await User.findById(order.userId).select('email').lean();
  if (!customer) return;
  await sendNotification({
    to: customer.email,
    subject: `Votre commande est "${order.status}"`,
    text: `Bonjour,\n\nLe statut de votre commande ${order._id} est désormais : ${order.status}.`,
  });
};

/**
 * Création d'une commande par un utilisateur connecté (données déjà validées par Joi).
 * Le total est calculé côté serveur à partir des prix en base et le stock est réservé de façon atomique.
 * @type {import('express').RequestHandler}
 */
exports.createOrder = async (req, res) => {
  const { items, shippingAddress, paymentMethod, shippingMethod } = req.body;
  const userId = req.user.userId;

  let reserved = [];
  try {
    reserved = await reserveStock(items);

    const orderItems = reserved.map(({ productId, quantity, price }) => ({ productId, quantity, price }));
    const total = orderItems.reduce((acc, { price, quantity }) => acc + price * quantity, 0);

    const savedOrder = await Order.create({
      userId,
      items: orderItems,
      total,
      shippingAddress,
      paymentMethod,
      shippingMethod,
    });

    logger.info('Commande créée', { orderId: savedOrder._id.toString(), userId, total });

    // Appel au micro-service de notification (via le gateway) : destinataire = admin configuré en variable d'env
    await sendNotification({
      subject: 'Nouvelle Commande Créée',
      text: `Une commande a été créée avec succès pour les produits suivants : \n${reserved
        .map((item) => `${item.name} (ID : ${item.productId}), Quantité : ${item.quantity}`)
        .join('\n')}\nTotal : ${total} €`,
    });

    // Appel au micro-service de gestion des stocks
    await Promise.all(reserved.map(publishStockEvent));

    res.status(201).json({
      message: 'Commande créée avec succès',
      order: savedOrder,
    });
  } catch (error) {
    if (error instanceof StockError) {
      return res.status(error.status).json({ message: error.message });
    }
    // Échec après la réservation (ex. écriture de la commande) : on rend le stock
    await releaseStock(reserved);
    logger.error('Erreur lors de la création de la commande', { error: error.message });
    res.status(500).json({
      message: 'Une erreur est survenue lors de la création de la commande.',
    });
  }
};

/**
 * Suppression d'une commande (admin). Le stock d'une commande non expédiée est restitué.
 * @type {import('express').RequestHandler}
 */
exports.deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: 'Commande non trouvée.' });

    if (!STOCK_RELEASED_OR_SHIPPED.includes(order.status)) {
      await releaseStock(order.items);
    }

    await audit(req, 'commande supprimée', { actorId: req.user.userId, details: { orderId: req.params.id } });
    res.status(200).json({ message: 'Commande supprimée.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Liste des commandes (admin), les plus récentes d'abord, avec le nom des produits.
 * @type {import('express').RequestHandler}
 */
exports.getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).populate('items.productId', 'name').lean();
    res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
};

/**
 * Change le statut d'une commande (admin). Passer à « Annulée » restitue le stock.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} status Nouveau statut (déjà validé)
 */
const applyStatus = async (req, res, status) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Commande non trouvée.' });

  const previous = order.status;
  if (previous === status) return res.status(200).json({ message: 'Statut inchangé.', order });
  if (previous === 'Annulée') {
    return res.status(409).json({ message: 'Une commande annulée ne peut plus changer de statut.' });
  }

  order.status = status;
  await order.save();

  if (status === 'Annulée' && !STOCK_RELEASED_OR_SHIPPED.includes(previous)) {
    await releaseStock(order.items);
  }

  await audit(req, 'statut de commande modifié', {
    actorId: req.user.userId,
    details: { orderId: req.params.id, from: previous, to: status },
  });
  await notifyCustomer(order);

  return res.status(200).json({ message: 'Statut mis à jour avec succès', order });
};

/**
 * Valide une commande en attente (admin) : elle passe « En cours de traitement ».
 * @type {import('express').RequestHandler}
 */
exports.validateOrder = async (req, res, next) => {
  try {
    await applyStatus(req, res, 'En cours de traitement');
  } catch (error) {
    next(error);
  }
};

/**
 * Met à jour le statut d'une commande (admin).
 * @type {import('express').RequestHandler}
 */
exports.updateOrderStatus = async (req, res, next) => {
  try {
    await applyStatus(req, res, req.body.status);
  } catch (error) {
    next(error);
  }
};
