// src/pages/Admin.js
import React, { useState, useEffect } from "react";
import {
  getOrders,
  updateOrderStatus,
  validateOrder,
  deleteOrder,
  getProducts,
  updateProductStock,
} from "../services/adminApi";
import { errorMessage } from "../services/http";

// Statuts après lesquels une commande ne peut plus être annulée
const FINAL_STATUSES = ["Expédiée", "Délivrée", "Annulée"];

const Admin = () => {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(null);
  const [newStock, setNewStock] = useState({}); // Stock temporaire par produit
  const [updatingStock, setUpdatingStock] = useState(null); // Stock en cours de mise à jour
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ordersResponse, productsResponse] = await Promise.all([getOrders(), getProducts()]);
        setOrders(ordersResponse.data);
        setProducts(productsResponse.data);
      } catch (err) {
        setError(errorMessage(err, "Impossible de charger les données d'administration."));
      }
    };

    fetchData();
  }, []);

  // Remplace la commande modifiée par la version renvoyée par le serveur
  const replaceOrder = (updated) =>
    setOrders((prevOrders) =>
      prevOrders.map((order) => (order._id === updated._id ? { ...order, status: updated.status } : order))
    );

  const runOrderAction = async (orderId, action, successMessage) => {
    setLoadingOrder(orderId); // Active le loader
    try {
      const response = await action();
      if (response.data.order) replaceOrder(response.data.order);
      alert(successMessage);
    } catch (err) {
      alert(errorMessage(err, "Erreur lors de la mise à jour de la commande."));
    } finally {
      setLoadingOrder(null); // Désactive le loader
    }
  };

  const handleOrderStatusChange = (orderId, newStatus) =>
    runOrderAction(orderId, () => updateOrderStatus(orderId, newStatus), `Statut de la commande ${orderId} mis à jour en "${newStatus}".`);

  const handleOrderValidation = (orderId) =>
    runOrderAction(orderId, () => validateOrder(orderId), `Commande ${orderId} validée.`);

  const handleOrderDeletion = async (orderId) => {
    if (!window.confirm("Supprimer définitivement cette commande ?")) return;
    setLoadingOrder(orderId);
    try {
      await deleteOrder(orderId);
      setOrders((prevOrders) => prevOrders.filter((order) => order._id !== orderId));
    } catch (err) {
      alert(errorMessage(err, "Erreur lors de la suppression de la commande."));
    } finally {
      setLoadingOrder(null);
    }
  };

  const handleStockUpdate = async (productId) => {
    const stockValue = newStock[productId]; // Récupère la valeur saisie pour ce produit

    // 0 est une valeur valide (rupture de stock) : seul un champ vide ou négatif est refusé
    if (stockValue === undefined || stockValue === "" || Number(stockValue) < 0) {
      alert("Veuillez entrer une quantité de stock valide.");
      return;
    }

    try {
      setUpdatingStock(productId); // Active le loader
      const response = await updateProductStock(productId, Number(stockValue));
      alert(`Stock du produit mis à jour à ${response.data.product.stock}.`);

      // Mise à jour de l'affichage avec le stock enregistré par le serveur
      setProducts((prevProducts) =>
        prevProducts.map((product) => (product._id === productId ? response.data.product : product))
      );

      // Réinitialisation du champ
      setNewStock({ ...newStock, [productId]: "" });
    } catch (err) {
      alert(errorMessage(err, "Échec de la mise à jour du stock."));
    } finally {
      setUpdatingStock(null); // Désactive le loader
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-4">Page d'administration</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {/* Gestion des Commandes */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold">Gestion des Commandes</h3>
        {orders.length === 0 && <p className="text-gray-500">Aucune commande.</p>}
        <ul>
          {orders.map((order) => (
            <li key={order._id} className="border p-4 mb-4 rounded shadow">
              <p>
                <strong>ID :</strong> {order._id}
              </p>
              <p>
                <strong>Date :</strong> {new Date(order.createdAt).toLocaleString("fr-FR")}
              </p>
              <p>
                <strong>Status :</strong> {order.status}
              </p>
              {order.status === "En attente" && (
                <button
                  onClick={() => handleOrderValidation(order._id)}
                  className="bg-green-500 text-white px-2 py-1 mt-2 rounded mr-2"
                  disabled={loadingOrder === order._id}
                >
                  Valider la commande
                </button>
              )}

              {!FINAL_STATUSES.includes(order.status) && (
                <button
                  onClick={() => handleOrderStatusChange(order._id, "Expédiée")}
                  className="bg-blue-500 text-white px-2 py-1 mt-2 rounded mr-2"
                  disabled={loadingOrder === order._id}
                >
                  {loadingOrder === order._id
                    ? "Mise à jour..."
                    : 'Changer état à "Expédiée"'}
                </button>
              )}

              {order.status === "Expédiée" && (
                <button
                  onClick={() => handleOrderStatusChange(order._id, "Délivrée")}
                  className="bg-blue-700 text-white px-2 py-1 mt-2 rounded mr-2"
                  disabled={loadingOrder === order._id}
                >
                  Marquer "Délivrée"
                </button>
              )}

              {!FINAL_STATUSES.includes(order.status) && (
                <button
                  onClick={() => handleOrderStatusChange(order._id, "Annulée")}
                  className="bg-yellow-500 text-white px-2 py-1 mt-2 rounded mr-2"
                  disabled={loadingOrder === order._id}
                >
                  Annuler
                </button>
              )}

              <button
                onClick={() => setSelectedOrder(order)}
                className="bg-gray-500 text-white px-2 py-1 mt-2 rounded mr-2"
              >
                Détails
              </button>

              <button
                onClick={() => handleOrderDeletion(order._id)}
                className="bg-red-500 text-white px-2 py-1 mt-2 rounded"
                disabled={loadingOrder === order._id}
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Gestion des Produits */}
      <div>
        <h2 className="text-xl font-bold">Gestion des Produits</h2>
        <table className="min-w-full border">
          <thead>
            <tr className="bg-gray-200">
              <th className="border px-4 py-2">Nom</th>
              <th className="border px-4 py-2">Prix</th>
              <th className="border px-4 py-2">Stock</th>
              <th className="border px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product._id} className="border">
                <td className="border px-4 py-2">{product.name}</td>
                <td className="border px-4 py-2">{product.price} €</td>
                <td className="border px-4 py-2">{product.stock}</td>
                <td className="border px-4 py-2 flex">
                  <input
                    type="number"
                    placeholder="Nouveau stock"
                    min="0"
                    step="1"
                    value={newStock[product._id] ?? ""}
                    className="border p-2 w-20"
                    onChange={(e) =>
                      setNewStock({
                        ...newStock,
                        [product._id]: e.target.value,
                      })
                    }
                  />
                  <button
                    onClick={() => handleStockUpdate(product._id)}
                    className="bg-green-500 text-white px-2 py-1 ml-2 rounded"
                    disabled={updatingStock === product._id}
                  >
                    {updatingStock === product._id
                      ? "Mise à jour..."
                      : "Mettre à jour"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fenêtre modale pour afficher les détails de la commande */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded-lg shadow-lg w-1/2">
            <h2 className="text-xl font-bold mb-4">Détails de la Commande</h2>
            <p>
              <strong>ID :</strong> {selectedOrder._id}
            </p>
            <p>
              <strong>Status :</strong> {selectedOrder.status}
            </p>
            <p>
              <strong>Total :</strong> {selectedOrder.total} €
            </p>
            <p>
              <strong>Livraison :</strong> {selectedOrder.shippingMethod} — {selectedOrder.shippingAddress?.street},{" "}
              {selectedOrder.shippingAddress?.postalCode} {selectedOrder.shippingAddress?.city},{" "}
              {selectedOrder.shippingAddress?.country}
            </p>
            <p>
              <strong>Paiement :</strong> {selectedOrder.paymentMethod}
            </p>
            <h3 className="text-lg font-semibold mt-4">Produits :</h3>
            <ul className="mt-2">
              {selectedOrder.items.map((item, index) => (
                <li key={index} className="border-b p-2">
                  <p>
                    <strong>Produit :</strong> {item.productId?.name || item.productId?._id || "Produit supprimé"}
                  </p>
                  <p>
                    <strong>Quantité :</strong> {item.quantity}
                  </p>
                  <p>
                    <strong>Prix :</strong> {item.price} €
                  </p>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setSelectedOrder(null)}
              className="bg-red-500 text-white px-4 py-2 mt-4 rounded"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
