# Studio

This is Studio Playground using Zerodev SDK. It is a Vue 3 project bootstrapped with [Vite](https://vitejs.dev/).

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

Under this Application Majot Code which combines all Components lied under src\components\WalletConnect.vue so for Debugging use this File , other Com-ponents were made diffrent but so as to reduce complexity to make things work i made changes and Combined all in one file.
`npm run dev ` to run the application

Steps in which this application works are as follows:

1. First it will ask for the Wallet Connection , you can connect with any wallet like Metamask or Trust Wallet.
2. ECDSA object will be genrearted using walletClient.
3. The ECDSA validator is passed to KernelAccount to create a new Kernel Account.
4. The Kernel Account is created and the address is displayed on the screen.
5. The Kernel Account is then used to send transactions.
6. Further User ops are created which are bundled up and transaction is sent.
