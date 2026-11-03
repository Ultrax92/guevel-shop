// backend/seeder.js
// Usage : node seeder.js  (lit MONGO_URI, ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD dans l'environnement)
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');
const User = require('./models/User');

dotenv.config();

// Jeux de produits à insérer
const products = [
  {
    name: 'Ordinateur Portable',
    price: 1000,
    description: 'Un ordinateur portable performant pour tous vos besoins.',
    stock: 20,
  },
  {
    name: 'Smartphone',
    price: 700,
    description: 'Un smartphone moderne avec un écran OLED.',
    stock: 50,
  },
  {
    name: 'Casque Audio',
    price: 150,
    description: 'Un casque audio sans fil avec réduction de bruit.',
    stock: 30,
  },
  {
    name: 'Tablette',
    price: 400,
    description: 'Une tablette légère et puissante.',
    stock: 25,
  },
  {
    name: 'Clavier Mécanique',
    price: 120,
    description: 'Un clavier mécanique pour les gamers.',
    stock: 15,
  },
];

// Le dump et les accès admin n'étant pas fournis, le premier administrateur est créé ici
const seedAdmin = async () => {
  const { ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log("ADMIN_USERNAME / ADMIN_EMAIL / ADMIN_PASSWORD absents : pas de création d'admin");
    return;
  }

  const existing = await User.findOne({ username: ADMIN_USERNAME });
  if (existing) {
    console.log(`Admin "${ADMIN_USERNAME}" déjà présent`);
    return;
  }

  // save() déclenche le hash bcrypt du modèle User
  await new User({ username: ADMIN_USERNAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'admin' }).save();
  console.log(`Admin "${ADMIN_USERNAME}" créé`);
};

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('MongoDB connecté pour le seed');

    // Supprimer les anciens produits puis insérer le jeu de données
    await Product.deleteMany();
    await Product.insertMany(products);
    console.log('Jeux de produits insérés avec succès !');

    await seedAdmin();
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Erreur lors du seed :', error.message);
    process.exit(1);
  }
};

seed();
