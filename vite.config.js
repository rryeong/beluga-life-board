import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

function versionPlugin() {
  return {
    name: 'generate-version-file',

    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          version: Date.now().toString(),
        }),
      })
    },
  }
}

export default defineConfig({
  base: '/beluga-life-board/',

  plugins: [vue(), vueDevTools(), versionPlugin()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
