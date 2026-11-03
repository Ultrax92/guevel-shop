// Tests unitaires du panier (reducer du CartContext)
import { cartReducer } from './CartContext';

const empty = { cart: [], shippingMethod: null, paymentMethod: null, shippingAddress: {} };
const product = { id: 'p1', name: 'Clavier', price: 120 };

test('ajoute un produit au panier avec une quantité de 1', () => {
  const state = cartReducer(empty, { type: 'ADD_TO_CART', payload: { ...product, quantity: 1 } });
  expect(state.cart).toEqual([{ ...product, quantity: 1 }]);
});

test("incrémente la quantité sans muter l'état précédent", () => {
  const first = cartReducer(empty, { type: 'ADD_TO_CART', payload: { ...product, quantity: 1 } });
  const snapshot = JSON.parse(JSON.stringify(first));
  const second = cartReducer(first, { type: 'ADD_TO_CART', payload: { id: 'p1', quantity: 1 } });
  expect(second.cart[0].quantity).toBe(2);
  expect(first).toEqual(snapshot); // l'ancien état n'a pas été modifié
});

test('la décrémentation ne descend pas sous 1', () => {
  const state = cartReducer(
    { ...empty, cart: [{ ...product, quantity: 1 }] },
    { type: 'DECREMENT_QUANTITY', payload: { id: 'p1' } }
  );
  expect(state.cart[0].quantity).toBe(1);
});

test('retire un produit puis vide le panier', () => {
  const withTwo = {
    ...empty,
    cart: [
      { ...product, quantity: 1 },
      { id: 'p2', name: 'Souris', price: 30, quantity: 2 },
    ],
  };
  const removed = cartReducer(withTwo, { type: 'REMOVE_FROM_CART', payload: { id: 'p1' } });
  expect(removed.cart.map((item) => item.id)).toEqual(['p2']);
  expect(cartReducer(removed, { type: 'CLEAR_CART' }).cart).toEqual([]);
});

test('enregistre la méthode de livraison et de paiement', () => {
  let state = cartReducer(empty, { type: 'SET_SHIPPING_METHOD', payload: 'colissimo' });
  state = cartReducer(state, { type: 'SET_PAYMENT_METHOD', payload: 'PayPal' });
  expect(state.shippingMethod).toBe('colissimo');
  expect(state.paymentMethod).toBe('PayPal');
});
