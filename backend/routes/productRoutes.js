// routes/productRoutes.js
const express = require('express');
const { getProducts, updateProductStock } = require('../controllers/productController');
const { authenticateToken, isAdmin } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { stockSchema, idParamSchema } = require('../validators/schemas');

const router = express.Router();
router.get('/', getProducts);
router.put(
  '/:productId/stock',
  authenticateToken,
  isAdmin,
  validate(idParamSchema('productId'), 'params'),
  validate(stockSchema),
  updateProductStock
);

module.exports = router;
