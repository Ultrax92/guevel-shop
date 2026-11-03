// src/pages/Register.js
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import http, { errorMessage } from '../services/http';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await http.post('/auth/register', formData);
      alert('Inscription réussie ! Vous pouvez maintenant vous connecter.');
      navigate('/login');
    } catch (err) {
      // Message renvoyé par le serveur (détail de la validation), sinon message générique (erreur réseau)
      setError(errorMessage(err));
    }
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-md w-80">
        <h2 className="text-2xl font-bold mb-4 text-center">Inscription</h2>
        {error && <p className="text-red-500 mb-4 whitespace-pre-line">{error}</p>}
        <input
          type="text"
          name="username"
          placeholder="Nom d'utilisateur"
          autoComplete="username"
          required
          minLength={3}
          maxLength={30}
          value={formData.username}
          onChange={handleChange}
          className="border border-gray-300 p-2 w-full mb-4"
        />
        <input
          type="email"
          name="email"
          placeholder="Adresse email"
          autoComplete="email"
          required
          value={formData.email}
          onChange={handleChange}
          className="border border-gray-300 p-2 w-full mb-4"
        />
        <input
          type="password"
          name="password"
          placeholder="Mot de passe (8 caractères min., lettre + chiffre)"
          autoComplete="new-password"
          required
          minLength={8}
          value={formData.password}
          onChange={handleChange}
          className="border border-gray-300 p-2 w-full mb-4"
        />
        <button type="submit" className="bg-blue-500 text-white p-2 w-full rounded">S&apos;inscrire</button>
      </form>
    </div>
  );
};

export default Register;
