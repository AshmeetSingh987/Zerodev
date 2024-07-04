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
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import replace from '@rollup/plugin-replace';
import envCompatible from 'vite-plugin-env-compatible';

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
    'process.env': {
      VUE_APP_BACKEND_URL: 'http://localhost:3000',
      BUNDLER_RPC: 'https://rpc.zerodev.app/api/v2/bundler/d045926c-99c5-403f-ae0f-1da6a752f3cf',
      PAYMASTER_RPC: 'https://rpc.zerodev.app/api/v2/paymaster/d045926c-99c5-403f-ae0f-1da6a752f3cf',
      ENSO_API_KEY: 'e17fb01c-1c11-443c-835f-6418f207b4c1',
      //PRIVATE_KEY=,
    },
  }
  // Add other configurations here
});

