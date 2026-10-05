import { defineConfig, type Plugin } from 'vite';

// Identifiant unique de ce build. Il est compilé dans l'appli (__APP_VERSION__) ET publié dans version.json :
// l'appli compare les deux pour savoir qu'une nouvelle version est en ligne.
const VERSION = Date.now().toString(36);

function versionFile(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VERSION }) });
    }
  };
}

// GitHub Pages sert l'appli sous /<repo>/ : chemins relatifs + routage par hash.
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  plugins: [versionFile()],
  build: { target: 'es2022', sourcemap: false }
});
