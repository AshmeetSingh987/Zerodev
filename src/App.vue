<template>
  <div id="app">
    <WalletConnect />
    <EcdsaValidator />
    <SessionKeyManager />
  </div>
</template>

<script>
import WalletConnect from './components/WalletConnect.vue'
import EcdsaValidator from './components/EcdsaValidator.vue'
import SessionKeyManager from './components/SessionKeyManager.vue'
export default {
  name: 'App',
  components: {
    WalletConnect,
  SessionKeyManager
  },
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #aecae3;
  margin-top: 60px;
}
</style>
