// src/index.jsx
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { CartProvider } from './context/CartContext';

// Point d'entrée : monte l'application dans #root ; le panier (CartProvider) englobe toute l'application.
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <CartProvider>
    <App />
  </CartProvider>
);
