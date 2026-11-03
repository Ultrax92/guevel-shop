// controllers/productController.js
const Product = require('../models/Product');
const { audit } = require('../services/auditService');
const { sendNotification } = require('../services/notificationService');

/**
 * Liste publique des produits.
 * @type {import('express').RequestHandler}
 */
exports.getProducts = async (req, res, next) => {
  try {
    const products = await Product.find().sort({ name: 1 }).lean();
    res.json(products);
  } catch (error) {
    next(error);
  }
};

/**
 * Mise à jour du stock d'un produit (admin, valeur validée par Joi : entier ≥ 0).
 * @type {import('express').RequestHandler}
 */
exports.updateProductStock = async (req, res, next) => {
  try {
    const { stock } = req.body;
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé.' });
    }

    const previous = product.stock;
    product.stock = stock;
    await product.save();

    await audit(req, 'stock produit modifié', {
      actorId: req.user.userId,
      details: { productId, from: previous, to: stock },
    });
    await sendNotification({
      subject: 'Mise à jour du stock',
      text: `Le stock du produit "${product.name}" est passé de ${previous} à ${stock}.`,
    });

    res.json({ message: 'Stock mis à jour avec succès.', product });
  } catch (error) {
    next(error);
  }
};
