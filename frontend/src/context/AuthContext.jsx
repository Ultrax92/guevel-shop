// src/context/AuthContext.js
// Session utilisateur côté front : le JWT reste dans un cookie HttpOnly (illisible en JavaScript),
// le front ne connaît que le profil public renvoyé par /auth/me.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import http from '../services/http';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // { username, role } ou null
  const [loading, setLoading] = useState(true);

  // Au chargement, on demande au backend si une session (cookie) est active
  useEffect(() => {
    http
      .get('/auth/me')
      .then((response) => setUser(response.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await http.post('/auth/login', credentials);
    setUser(response.data);
    return response.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await http.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
