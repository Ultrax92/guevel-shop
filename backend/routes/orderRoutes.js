// backend/routes/orderRoutes.js
/** @module backend/routes/orderRoutes */
const express = require('express');
const {
  createOrder,
  deleteOrder,
  getOrders,
  validateOrder,
  updateOrderStatus,
} = require('../controllers/orderController');
const { authenticateToken, isAdmin } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { orderSchema, orderStatusSchema, idParamSchema } = require('../validators/schemas');

const router = express.Router();
const validId = validate(idParamSchema('id'), 'params');

router.get('/', authenticateToken, isAdmin, getOrders); // Accès pour administrateurs
router.post('/', authenticateToken, validate(orderSchema), createOrder); // Accès pour utilisateurs connectés
router.delete('/:id', authenticateToken, isAdmin, validId, deleteOrder); // Accès pour administrateurs
router.put('/:id/validate', authenticateToken, isAdmin, validId, validateOrder); // Accès pour administrateurs
router.put('/:id/status', authenticateToken, isAdmin, validId, validate(orderStatusSchema), updateOrderStatus); // Accès pour administrateurs

module.exports = router;
