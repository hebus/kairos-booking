import { defineConfig } from 'vite';

// GitHub Pages sert l'appli sous /<repo>/ : chemins relatifs + routage par hash.
export default defineConfig({
  base: './',
  build: { target: 'es2022', sourcemap: false }
});
