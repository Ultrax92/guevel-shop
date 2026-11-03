// src/components/AdminRoute.jsx
// Confort d'affichage uniquement : le contrôle réel du rôle admin est fait par le backend (isAdmin)
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Garde de route : affiche la page si l'utilisateur connecté est administrateur,
 * sinon (visiteur ou simple client) redirige vers l'accueil.
 * @param {{ children: React.ReactNode }} props Page protégée
 */
const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <p className="p-8">Chargement…</p>;
  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AdminRoute;
