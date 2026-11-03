// src/components/AdminRoute.js
// Confort d'affichage uniquement : le contrôle réel du rôle admin est fait par le backend (isAdmin)
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <p className="p-8">Chargement…</p>;
  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AdminRoute;
