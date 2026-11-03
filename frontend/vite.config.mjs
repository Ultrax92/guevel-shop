// vite.config.mjs — remplace Create React App (react-scripts), abandonné et source de nombreuses vulnérabilités
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Préfixe REACT_APP_ conservé : les variables existantes (Vercel, Docker) restent valables
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: { port: 3000 },
  preview: { port: 3000 },
  build: { outDir: 'dist', sourcemap: false },
  test: { environment: 'node', globals: true },
});
