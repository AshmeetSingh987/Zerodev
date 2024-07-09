<template>
  <div id="app">
    <WalletConnect />
    <EcdsaValidator />
  </div>
</template>

<script>
import WalletConnect from './components/WalletConnect.vue'
import EcdsaValidator from './components/EcdsaValidator.vue'

export default {
  name: 'App',
  components: {
    WalletConnect,
  
  },
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
