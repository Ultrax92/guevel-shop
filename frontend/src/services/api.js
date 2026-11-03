// src/services/api.js
import http from './http';

export const fetchProducts = () => http.get('/products');

// Seuls productId et quantity sont envoyés : le prix et le total sont calculés par le serveur
export const createOrder = (orderData) => http.post('/orders', orderData);
