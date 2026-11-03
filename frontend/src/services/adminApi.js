// src/services/adminApi.js
// Appels réservés aux administrateurs (le cookie d'authentification est envoyé automatiquement)
import http from './http';

export const getOrders = () => http.get('/orders');

export const getProducts = () => http.get('/products');

export const updateOrderStatus = (orderId, status) => http.put(`/orders/${orderId}/status`, { status });

export const validateOrder = (orderId) => http.put(`/orders/${orderId}/validate`);

export const deleteOrder = (orderId) => http.delete(`/orders/${orderId}`);

export const updateProductStock = (productId, stock) => http.put(`/products/${productId}/stock`, { stock });
