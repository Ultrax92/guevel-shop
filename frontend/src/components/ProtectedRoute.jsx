// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Garde de route : réserve la page aux utilisateurs connectés ;
 * sinon redirige vers /login en mémorisant la page demandée.
 * @param {{ children: React.ReactNode }} props Page protégée
 */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="p-8">Chargement…</p>;
  if (!user) {
    // Retour sur la page demandée après connexion
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
};

export default ProtectedRoute;
