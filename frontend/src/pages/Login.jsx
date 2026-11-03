// src/pages/Login.js
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../services/http";

const Login = () => {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // Le token est posé par le serveur dans un cookie HttpOnly : plus rien n'est stocké dans le localStorage
      await login(credentials);
      navigate(location.state?.from || "/"); // Retour à la page demandée, sinon l'accueil
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow-md w-80"
      >
        <h2 className="text-2xl font-bold mb-4 text-center">Connexion</h2>
        {error && <p className="text-red-500 mb-4 whitespace-pre-line">{error}</p>}
        <input
          type="text"
          placeholder="Nom d'utilisateur"
          autoComplete="username"
          required
          value={credentials.username}
          onChange={(e) =>
            setCredentials({ ...credentials, username: e.target.value })
          }
          className="border border-gray-300 p-2 w-full mb-4"
        />
        <input
          type="password"
          placeholder="Mot de passe"
          autoComplete="current-password"
          required
          value={credentials.password}
          onChange={(e) =>
            setCredentials({ ...credentials, password: e.target.value })
          }
          className="border border-gray-300 p-2 w-full mb-4"
        />
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-500 text-white p-2 w-full rounded disabled:opacity-50"
        >
          {submitting ? "Connexion…" : "Se connecter"}
        </button>
        <p className="text-sm text-center mt-4">
          Pas de compte ? <Link to="/register" className="text-blue-600 underline">Inscription</Link>
        </p>
      </form>
    </div>
  );
};

export default Login;
