import { defineConfig, ViteDevServer } from 'vite'
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
                match: [
                    'http://localhost:8880/*',
                    'http://localhost:8899/*',
                    '*://*.hgj.com/*',
                    '*://*.smartai.hgj.com/*'
                ]
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
    ],
    optimizeDeps: {
        include: ['@vicons/ionicons5', 'naive-ui']
    },
    server: {
        cors: true,
        // Add middleware to respond with Access-Control-Allow-Private-Network for PNA preflight
        middlewareMode: false,
        configureServer(server: ViteDevServer) {
            server.middlewares.use((req: any, res: any, next: any) => {
                // set CORS headers for simple requests
                res.setHeader('Access-Control-Allow-Origin', '*')
                res.setHeader(
                    'Access-Control-Allow-Methods',
                    'GET,HEAD,PUT,PATCH,POST,DELETE'
                )
                res.setHeader(
                    'Access-Control-Allow-Headers',
                    'Content-Type, Authorization, X-Requested-With, Accept, Origin'
                )
                res.setHeader('Access-Control-Allow-Credentials', 'true')
                // Important: allow private network requests (PNA)
                res.setHeader('Access-Control-Allow-Private-Network', 'true')

                if (req.method === 'OPTIONS') {
                    // respond to preflight
                    res.statusCode = 204
                    return res.end()
                }

                next()
            })
        }
    },
    build: {
        minify: true
    }
}))
