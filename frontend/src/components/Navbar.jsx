// src/components/Navbar.js
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const navigate = useNavigate();
  const { cart } = useCart();
  // L'état de connexion vient du contexte (réactif) et non plus du localStorage lu une seule fois
  const { user, isAdmin, logout } = useAuth();
  const itemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const handleLogout = async () => {
    // Le serveur supprime le cookie d'authentification ; le rôle n'est plus conservé côté client
    await logout();
    navigate('/login');
  };

  return (
    <nav className="bg-blue-500 text-white p-4 flex justify-between items-center">
      <div className="flex items-center space-x-4">
        <Link to="/" className="text-xl font-bold">Mon Application</Link>
      </div>

      <div className="flex items-center space-x-4">
        {/* Afficher le nom de l'utilisateur s'il est connecté */}
        {user && (
          <span className="font-semibold">
            Bonjour, {user.username}
          </span>
        )}

        {isAdmin && <Link to="/admin">Administration</Link>}

        {/* Lien vers le Panier avec le nombre d'articles */}
        <Link to="/cart" className="relative">
          <span>Panier</span>
          {itemCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-white rounded-full text-xs px-2">
              {itemCount}
            </span>
          )}
        </Link>

        {/* Lien Connexion / Déconnexion */}
        {!user ? (
          <>
            <Link to="/login">Connexion</Link>
            <Link to="/register">Inscription</Link>
          </>
        ) : (
          <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded">
            Déconnexion
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
