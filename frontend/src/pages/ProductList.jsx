// src/pages/ProductList.js
import { useEffect, useState } from 'react';
import { fetchProducts } from '../services/api';
import { useCart } from '../context/CartContext';

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const { dispatch } = useCart();

  const [error, setError] = useState('');

  useEffect(() => {
    fetchProducts()
      .then((response) => setProducts(response.data))
      .catch(() => setError('Impossible de charger les produits. Veuillez réessayer plus tard.'));
  }, []);

  const addToCart = (product) => {
    dispatch({
      type: 'ADD_TO_CART',
      payload: { ...product, id:product._id, quantity: 1 }, // Ajoute +1 à la quantité
    });
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-4">Liste des Produits</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <li key={product._id} className="border p-4 rounded shadow">
            <h3 className="text-lg font-semibold">{product.name}</h3>
            <p className="text-sm text-gray-600">{product.description}</p>
            <p className="text-gray-500">{product.price} €</p>
            <p className="text-xs text-gray-400">{product.stock > 0 ? `${product.stock} en stock` : 'Rupture de stock'}</p>
            <button
              onClick={() => addToCart(product)}
              disabled={product.stock <= 0}
              className="bg-green-500 text-white px-4 py-2 mt-2 rounded disabled:opacity-50"
            >
              Ajouter au panier
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ProductList;
