import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import monkey, { cdn } from 'vite-plugin-monkey'
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    plugins: [
        vue(),
        monkey({
            entry: 'src/main.ts',
            userscript: {
                icon: 'https://vitejs.dev/logo.svg',
                namespace: 'npm/vite-plugin-monkey',
                // match: ['*://*/*']
                match: ['https://l-ui.com/*']
            },
            build: {
                externalGlobals:
                    mode === 'production'
                        ? {
                              vue: cdn.jsdelivr(
                                  'Vue',
                                  'dist/vue.global.prod.js'
                              )
                          }
                        : {}
            }
        })
    ]
}))
