// src/context/CartContext.jsx
import { createContext, useContext, useReducer } from 'react';

const CartContext = createContext();

/**
 * Réducteur du panier (articles, livraison, paiement, adresse). Ne modifie jamais l'état existant :
 * chaque action renvoie un nouvel objet, ce que React exige pour rafraîchir l'affichage.
 * @param {Object} state État courant du panier
 * @param {{ type: string, payload: * }} action Action à appliquer
 * @returns {Object} Nouvel état
 */
export const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const existingProductIndex = state.cart.findIndex((item) => item.id === action.payload.id);

      if (existingProductIndex >= 0) {
        // Copie de l'article au lieu de muter l'objet existant (état React immuable)
        const updatedCart = state.cart.map((item, index) =>
          index === existingProductIndex ? { ...item, quantity: item.quantity + (action.payload.quantity || 1) } : item
        );
        return { ...state, cart: updatedCart };
      } else {
        return {
          ...state,
          cart: [...state.cart, { ...action.payload, quantity: 1 }],
        };
      }
    }

    case 'DECREMENT_QUANTITY':
      return {
        ...state,
        cart: state.cart.map((item) =>
          item.id === action.payload.id
            ? { ...item, quantity: Math.max(item.quantity - 1, 1) } // Ne peut pas être inférieur à 1
            : item
        ),
      };

    case 'REMOVE_FROM_CART':
      return {
        ...state,
        cart: state.cart.filter((item) => item.id !== action.payload.id),
      };

    case 'CLEAR_CART':
      return { ...state, cart: [] };

    case 'SET_SHIPPING_METHOD':
      return { ...state, shippingMethod: action.payload };

    case 'SET_PAYMENT_METHOD':
      return { ...state, paymentMethod: action.payload };
    case 'SET_SHIPPING_ADDRESS':
      return { ...state, shippingAddress: action.payload };
    default:
      return state;
  }
};

export const CartProvider = ({ children }) => {
  const [cartState, dispatch] = useReducer(cartReducer, {
    cart: [],
    shippingMethod: null,
    paymentMethod: null,
    shippingAddress: {
      street: '',
      city: '',
      postalCode: '',
      country: '',
    },
  });

  return <CartContext.Provider value={{ ...cartState, dispatch }}>{children}</CartContext.Provider>;
};

export const useCart = () => useContext(CartContext);
