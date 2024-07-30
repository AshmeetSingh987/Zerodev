// import { defineConfig } from 'vite'
// import vue from '@vitejs/plugin-vue'
// import vueJsx from '@vitejs/plugin-vue-jsx'
// import NodePolyfillPlugin from 'node-polyfill-webpack-plugin'
// import { fileURLToPath, URL } from 'node:url'

// export default defineConfig({
//   plugins: [vue(), vueJsx()],
//   resolve: {
//     alias: {
//       '@': fileURLToPath(new URL('./src', import.meta.url)),
//     },
//     extensions: ['.js', '.ts', '.jsx', '.tsx', '.json'],
//   },
//   define: {
//     'process.env': {},
//     global: 'window',
//   },
//   optimizeDeps: {
//     include: ['@walletconnect/web3-provider'],
//   },
//   build: {
//     rollupOptions: {
//       plugins: [new NodePolyfillPlugin()],
//     },
//   },
//   server: {
//     proxy: {
//       '/api': {
//         target: 'http://localhost:3000',
//         changeOrigin: true,
//         rewrite: (path) => path.replace(/^\/api/, ''),
//       },
//     },
//   },
// })

// Import the necessary plugins
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import replace from '@rollup/plugin-replace'
import envCompatible from 'vite-plugin-env-compatible'

export default defineConfig({
  plugins: [
    vue(),
    envCompatible(),
    replace({
      'process.env': JSON.stringify(process.env),
      preventAssignment: true,
    }),
    // Add other plugins here
  ],
  optimizeDeps: {
    include: ['viem'],
  },
  define: {
    'process.env.polygon': {
      VUE_APP_BACKEND_URL: 'http://localhost:3000',
      BUNDLER_RPC:
        'https://rpc.zerodev.app/api/v2/bundler/8abbd50e-9d08-4157-965d-c83eab9c42c3',
      PAYMASTER_RPC:
        'https://rpc.zerodev.app/api/v2/paymaster/8abbd50e-9d08-4157-965d-c83eab9c42c3',
      ENSO_API_KEY: 'e17fb01c-1c11-443c-835f-6418f207b4c1',
      PROJECT_ID: '8abbd50e-9d08-4157-965d-c83eab9c42c3',
      PRIVATE_KEY:
        '0xf4f8027386114fea9fa340e804cfa581c7da2d3b48c5dee06d29033f281abdea',
      POLYGONSCAN_API_KEY: '27I1EXYVGADZQ3ZSYB3EHD4Y2RKAK587XS',
    },
    'process.env.sepolia': {
      VUE_APP_BACKEND_URL: 'http://localhost:3000',
      BUNDLER_RPC:
        'https://rpc.zerodev.app/api/v2/bundler/925e6965-4c1a-49c4-9edc-c938ee96770f',
      PAYMASTER_RPC:
        'https://rpc.zerodev.app/api/v2/paymaster/925e6965-4c1a-49c4-9edc-c938ee96770f',
      ENSO_API_KEY: 'e17fb01c-1c11-443c-835f-6418f207b4c1',
      PROJECT_ID: '925e6965-4c1a-49c4-9edc-c938ee96770f',
      //PRIVATE_KEY=,
    },
  },
  // Add other configurations here
})
