<template>
  <div class="session-key-manager">
    <h2>Session Key Manager</h2>
    <button @click="sessionManager.connectAndInitialize">Connect and Initialize</button>
    <button @click="sessionManager.createKernelAccountnew" class="create-account-btn">Create New Kernel Account</button>
    
    <div v-if="sessionManager.kernelAccount" class="kernel-account">
      <p>Current Active Kernel Account Address:</p>
      <pre>{{ sessionManager.kernelAccount }}</pre>
    </div>

    <div v-if="sessionManager.kernelAccounts.length > 0" class="current-kernel-accounts">
      <h3>Current Kernel Accounts (This Session):</h3>
      <ul>
        <li v-for="account in sessionManager.kernelAccounts" :key="account.index">
          <p>Index: {{ account.index }}</p>
          <p>Address: {{ account.address }}</p>
          <button @click="sessionManager.switchKernelAccount(account.index)">Switch to this Account</button>
        </li>
      </ul>
    </div>

    <button @click="sessionManager.createSessionKeyButton" :disabled="!sessionManager.kernelAccount">Create Session Key for Current Account</button>
    <div v-if="sessionManager.sessionKey" class="session-key">
      <p>Session Key Created for Current Account:</p>
      <pre>{{ sessionManager.sessionKey }}</pre>
    </div>
    
    <button @click="sessionManager.useSessionKeyButton" :disabled="!sessionManager.kernelAccount || !sessionManager.sessionKey">Use Session Key for Current Account</button>
    <div v-if="sessionManager.deserializedSessionKey" class="session-key">
      <p>Session Key Deserialized for Current Account:</p>
      <pre>{{ sessionManager.deserializedSessionKey }}</pre>
    </div>

    <div v-if="sessionManager.sessionError" class="error-message">{{ sessionManager.sessionError }}</div>
    
    <button @click="sessionManager.swapDefi" :disabled="!sessionManager.kernelAccount">Swap DeFi Tokens with Current Account</button>
    <div v-if="sessionManager.swapComplete" class="success-message">
      <p>Swap Complete for Current Account!</p>
      <a :href="sessionManager.swapUrl" target="_blank">View on JiffyScan</a>
    </div>
    
    <button @click="sessionManager.fetchRecentTransactions" :disabled="!sessionManager.kernelAccount">Show Recent Transactions for Current Account</button>
    <div v-if="sessionManager.kernelError" class="error-message">{{ sessionManager.kernelError }}</div>

    <button @click="sessionManager.getAllKernelAccounts">Fetch All Kernel Accounts</button>
    <div v-if="sessionManager.allKernelAccounts.length > 0" class="all-kernel-accounts">
      <h3>All Kernel Accounts for Current Wallet:</h3>
      <ul>
        <li v-for="account in sessionManager.allKernelAccounts" :key="account.index">
          <p>Index: {{ account.index }}</p>
          <p>Address: {{ account.address }}</p>
        </li>
      </ul>
    </div>

    <!-- Display recent transactions -->
    <div v-if="sessionManager.recentTransactions.length > 0" class="transactions">
      <h3>Recent Transactions:</h3>
      <ul>
        <li v-for="tx in sessionManager.recentTransactions" :key="tx.hash">
          <p>Transaction Hash: <a :href="'https://polygonscan.com/tx/' + tx.hash" target="_blank">{{ tx.hash }}</a></p>
          <p>From: {{ tx.from }}</p>
          <p>To: {{ tx.to }}</p>
          <p>Value: {{ tx.value }}</p>
        </li>
      </ul>
    </div>
  </div>
</template>


<script>
import { ref } from 'vue'
import {
  createKernelAccount,
  createZeroDevPaymasterClient,
  createKernelAccountClient,
} from "@zerodev/sdk"
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator"
import { ENTRYPOINT_ADDRESS_V07 } from "permissionless"
import {
  http,
  createPublicClient,
  zeroAddress,
  custom,
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { polygon } from "viem/chains"
import { toECDSASigner } from "@zerodev/permissions/signers"
import {
  deserializePermissionAccount,
  serializePermissionAccount,
  toPermissionValidator,
} from "@zerodev/permissions"
import { providerToSmartAccountSigner } from 'permissionless'
import { toSudoPolicy } from "@zerodev/permissions/policies"
import { KERNEL_V3_1 } from "@zerodev/sdk/constants"
import { createWalletClient, parseUnits } from 'viem'
import {
  createKernelDefiClient,
  baseTokenAddresses,
  defiTokenAddresses,
} from '@zerodev/defi'
import axios from 'axios';

class SessionManager {
  constructor() {
    this.sessionKey = ref(null)
    this.deserializedSessionKey = ref(null)
    this.sessionError = ref(null)
    this.kernelError = ref(null)
    this.walletClient = ref(null)
    this.account = ref(null)
    this.validator = ref(null)
    this.kernelAccount = ref(null)
    this.kernelClient = ref(null)
    this.smartAccountSigner = ref(null)
    this.serializedSessionKey = ref(null)
    this.sessionPrivateKey = ref(null)
    this.swapComplete = ref(false)
    this.swapUrl = ref(null)
    this.recentTransactions = ref([])
    this.kernelAccounts = ref([])
    this.allKernelAccounts = ref([])
    this.currentKernelIndex = ref(0)
    this.publicClient = createPublicClient({
      chain: polygon,
      transport: http(process.env.polygon.BUNDLER_RPC),
    })
  }

  async switchKernelAccount(index) {
    const account = this.kernelAccounts.value.find(acc => acc.index === index)
    if (account) {
      this.kernelAccount.value = account.address
      await this.initializeKernelClient(account.address)
      console.log(`Switched to Kernel Account at index ${index}: ${account.address}`)
    } else {
      console.error(`No Kernel Account found at index ${index}`)
    }
  }

  
  async initializeKernelClient(address) {
    const kernelAccountResponse = await createKernelAccount(this.publicClient, {
      plugins: {
        sudo: this.validator.value,
      },
      entryPoint: ENTRYPOINT_ADDRESS_V07,
      address: address,
      kernelVersion: KERNEL_V3_1,
    })

    const kernelPaymaster = createZeroDevPaymasterClient({
      chain: polygon,
      transport: http(process.env.polygon.PAYMASTER_RPC),
      entryPoint: ENTRYPOINT_ADDRESS_V07,
    })

    this.kernelClient.value = createKernelAccountClient({
      account: kernelAccountResponse,
      entryPoint: ENTRYPOINT_ADDRESS_V07,
      chain: polygon,
      bundlerTransport: http(process.env.polygon.BUNDLER_RPC),
      middleware: {
        sponsorUserOperation: async ({ userOperation }) => {
          return kernelPaymaster.sponsorUserOperation({
            userOperation,
            entryPoint: ENTRYPOINT_ADDRESS_V07,
          })
        },
      },
    })
  }

  async connectAndInitialize() {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed or not detected')
      }

      await window.ethereum.request({ method: 'eth_requestAccounts' })

      this.smartAccountSigner.value = await providerToSmartAccountSigner(window.ethereum)

      this.walletClient.value = createWalletClient({
        chain: polygon,
        transport: custom(window.ethereum),
      })

      const addresses = await window.ethereum.request({ method: 'eth_accounts' })
      this.account.value = addresses[0]
      this.validator.value = await signerToEcdsaValidator(this.walletClient.value, {
        signer: this.smartAccountSigner.value,
        entryPoint: ENTRYPOINT_ADDRESS_V07,
        kernelVersion: KERNEL_V3_1,
      })
      console.log('ECDSA Validator initialized:', this.validator.value)

      await this.getAllKernelAccounts()
    } catch (err) {
      this.sessionError.value = err.message || 'Failed to connect and initialize ECDSA Validator'
      console.error('Error connecting and initializing:', err)
    }
  }

  async createKernelAccountnew() {
    try {
      if (!this.validator.value || !this.account.value) {
        throw new Error('ECDSA Validator or account not initialized')
      }

      const kernelAccountResponse = await createKernelAccount(this.publicClient, {
        plugins: {
          sudo: this.validator.value,
        },
        entryPoint: ENTRYPOINT_ADDRESS_V07,
        index: this.currentKernelIndex.value,
        kernelVersion: KERNEL_V3_1,
      })

      if (!kernelAccountResponse || !kernelAccountResponse.address) {
        throw new Error('Kernel Account response or address is undefined')
      }

     const newAccount = {
      index: this.currentKernelIndex.value,
      address: kernelAccountResponse.address
    }
    this.kernelAccounts.value.push(newAccount)
    this.allKernelAccounts.value.push(newAccount)

    this.kernelAccount.value = kernelAccountResponse.address
    await this.initializeKernelClient(this.kernelAccount.value)
    this.currentKernelIndex.value++

    console.log('Kernel Account created:', kernelAccountResponse.address)
    console.log('Current Kernel Accounts:', this.kernelAccounts.value)

      const kernelPaymaster = createZeroDevPaymasterClient({
        chain: polygon,
        transport: http(process.env.polygon.PAYMASTER_RPC),
        entryPoint: ENTRYPOINT_ADDRESS_V07,
      })

      this.kernelClient.value = createKernelAccountClient({
        account: kernelAccountResponse,
        entryPoint: ENTRYPOINT_ADDRESS_V07,
        chain: polygon,
        bundlerTransport: http(process.env.polygon.BUNDLER_RPC),
        middleware: {
          sponsorUserOperation: async ({ userOperation }) => {
            return kernelPaymaster.sponsorUserOperation({
              userOperation,
              entryPoint: ENTRYPOINT_ADDRESS_V07,
            })
          },
        },
      })
    } catch (error) {
      this.sessionError.value = error.message
      console.error('Error creating Kernel Account:', error)
    }
  }

  async createSessionKey(sessionKeySigner, sessionKeyAccount) {
    try {
      if (!this.kernelAccount.value) {
        throw new Error('No active Kernel Account')
      }
      if (!sessionKeySigner || !sessionKeyAccount) {
        throw new Error('Session key signer or account is missing')
      }

      const ecdsaValidator = await signerToEcdsaValidator(this.publicClient, {
        entryPoint: ENTRYPOINT_ADDRESS_V07,
        signer: this.smartAccountSigner.value,
        kernelVersion: KERNEL_V3_1,
      })

      const masterAccount = await createKernelAccount(this.publicClient, {
        entryPoint: ENTRYPOINT_ADDRESS_V07,
        plugins: {
          sudo: ecdsaValidator,
        },
        kernelVersion: KERNEL_V3_1,
      })
      console.log('Account address:', masterAccount.address)

      const permissionPlugin = await toPermissionValidator(this.publicClient, {
        entryPoint: ENTRYPOINT_ADDRESS_V07,
        signer: sessionKeySigner,
        policies: [toSudoPolicy({})],
        kernelVersion: KERNEL_V3_1,
      })

      const sessionPointerAccount = await createKernelAccount(this.publicClient, {
        entryPoint: ENTRYPOINT_ADDRESS_V07,
        plugins: {
          sudo: ecdsaValidator,
          regular: permissionPlugin,
        },
        kernelVersion: KERNEL_V3_1,
      })
      console.log('Session Pointer Account:', sessionPointerAccount)

      const serializedKey = await serializePermissionAccount(sessionPointerAccount, sessionKeyAccount.privateKey)

      if (!serializedKey) {
        throw new Error('Failed to serialize session key')
      }
      this.sessionKey.value = serializedKey
      return serializedKey
    } catch (error) {
      this.sessionError.value = error.message
      console.error('Error creating session key:', error)
    }
  }

  async useSessionKey(serializedSessionKey) {
    try {
      if (!serializedSessionKey) {
        throw new Error('Serialized session key is missing')
      }

      console.log('Using serialized session key:', serializedSessionKey)

      const sessionKeySigner = await toECDSASigner({
        signer: privateKeyToAccount(this.sessionPrivateKey.value),
      })
      const sessionPointerAccount = await deserializePermissionAccount(
        this.publicClient,
        ENTRYPOINT_ADDRESS_V07,
        KERNEL_V3_1,
        serializedSessionKey,
        sessionKeySigner,
      )
      if (!sessionPointerAccount) {
        throw new Error('Failed to deserialize session pointer account')
      }
      console.log('Session pointer account:', sessionPointerAccount)

      const kernelPaymaster = createZeroDevPaymasterClient({
        entryPoint: ENTRYPOINT_ADDRESS_V07,
        chain: polygon,
        transport: http(process.env.polygon.PAYMASTER_RPC),
      })
      this.kernelClient.value = createKernelAccountClient({
        entryPoint: ENTRYPOINT_ADDRESS_V07,
        account: sessionPointerAccount,
        chain: polygon,
        bundlerTransport: http(process.env.polygon.BUNDLER_RPC),
        middleware: {
          sponsorUserOperation: async ({ userOperation }) => {
            return kernelPaymaster.sponsorUserOperation({
              userOperation,
              entryPoint: ENTRYPOINT_ADDRESS_V07,
            })
          },
        },
      })

      this.deserializedSessionKey.value = sessionPointerAccount

      const defiClient = createKernelDefiClient(this.kernelClient.value, process.env.polygon.PROJECT_ID)

      const swapAmount = parseUnits('1', 6) // Example amount, adjust as needed
      const swapParams = {
        fromToken: baseTokenAddresses[polygon.id].USDC,
        toToken: baseTokenAddresses[polygon.id].AAVE,
        fromAmount: BigInt(2),
        gasToken: 'sponsored',
      }

      console.log('Sending Swap Op', swapParams)  
      
      const swapUserOpHashResponse = await defiClient.sendSwapUserOp(swapParams)
      this.swapUrl.value = `https://jiffyscan.xyz/userOpHash/${swapUserOpHashResponse}`
      this.swapComplete.value = true
      console.log('Swap UserOp hash:', swapUserOpHashResponse)

      const accountBalancesAfterSwap = await defiClient.listTokenBalances({
        account: "0x41E716e7b7f8A4d597564dd8096e5bB56C45f4dB",
        chainId: polygon.id,
      }) 
      console.log("accountBalances After Swap :", accountBalancesAfterSwap)

    } catch (error) {
      this.sessionError.value = error.message
      console.error('Error using session key:', error)
    }
  }

  async fetchRecentTransactions() {
    try {
      if (!this.kernelAccount.value) {
        throw new Error('Kernel Account is not initialized')
      }

      const response = await axios.get(`https://api.polygonscan.com/api`, {
        params: {
          module: 'account',
          action: 'txlist',
          address: this.kernelAccount.value,
          startblock: 0,
          endblock: 99999999,
          sort: 'desc',
          apikey: process.env.polygon.POLYGONSCAN_API_KEY
        }
      });

      if (response.data.status === '1') {
        this.recentTransactions.value = response.data.result;
      } else {
        throw new Error('Failed to fetch transactions');
      }
    } catch (error) {
      this.kernelError.value = error.message
      console.error('Error fetching recent transactions:', error)
    }
  }

  async swapDefi() {
    try {
      if (!this.kernelClient.value) {
        throw new Error('Kernel Client is not initialized')
      }
      const defiClient = createKernelDefiClient(this.kernelClient.value, process.env.polygon.PROJECT_ID)

      const swapAmount = parseUnits('1', 6) // Example amount, adjust as needed
      const swapParams = {
        fromToken: baseTokenAddresses[polygon.id].USDC,
        toToken: baseTokenAddresses[polygon.id]['USDT']['aave-v3'],
        fromAmount: BigInt(2),
        gasToken: 'sponsored',
      }

      console.log('Sending Swap Op', swapParams)
      const accountBalances = await defiClient.listTokenBalances({
        account: this.kernelClient.address,
        chainId: polygon.id,
      })
      console.log('Account balances:', accountBalances)
      const swapUserOpHashResponse = await defiClient.sendSwapUserOp(swapParams)
      this.swapUrl.value = `https://jiffyscan.xyz/userOpHash/${swapUserOpHashResponse}`
      this.swapComplete.value = true
      console.log('Swap UserOp hash:', swapUserOpHashResponse)
    } catch (err) {
      this.kernelError.value = err.message || 'Failed to send Swap UserOp'
      console.error('Error sending Swap UserOp:', err)
    }
  }

  async createSessionKeyButton() {
    try {
      this.sessionPrivateKey.value = generatePrivateKey()
      const sessionKeyAccount = privateKeyToAccount(this.sessionPrivateKey.value)
      console.log('Generated session key account:', sessionKeyAccount)
      const sessionKeySigner = toECDSASigner({ signer: sessionKeyAccount })
      console.log('Generated session key signer:', sessionKeySigner)
      this.serializedSessionKey.value = await this.createSessionKey(sessionKeySigner, sessionKeyAccount)
      console.log('Serialized session key:', this.serializedSessionKey.value)
    } catch (error) {
      this.sessionError.value = error.message
      console.error('Error in createSessionKeyButton:', error)
    }
  }

  async useSessionKeyButton() {
    console.log('Serialized session key on button click:', this.serializedSessionKey.value)
    console.log('Session private key on button click:', this.sessionPrivateKey.value)
    if (this.serializedSessionKey.value && this.sessionPrivateKey.value) {
      await this.useSessionKey(this.serializedSessionKey.value)
    } else {
      this.sessionError.value = 'No session key available. Create a session key first.'
    }
  }

  async getAllKernelAccounts() {
    try {
      if (!this.validator.value || !this.account.value) {
        throw new Error('ECDSA Validator or account not initialized')
      }

      this.allKernelAccounts.value = []

      let index = 0
      while (true) {
        try {
          const kernelAccountResponse = await createKernelAccount(this.publicClient, {
            plugins: {
              sudo: this.validator.value,
            },
            entryPoint: ENTRYPOINT_ADDRESS_V07,
            index: index,
            kernelVersion: KERNEL_V3_1,
          })

          if (kernelAccountResponse && kernelAccountResponse.address) {
            this.allKernelAccounts.value.push({
              index: index,
              address: kernelAccountResponse.address
            })
            index++
          } else {
            break
          }
        } catch (error) {
          break
        }
      }

      console.log('All Kernel Accounts:', this.allKernelAccounts.value)
      return this.allKernelAccounts.value
    } catch (error) {
      this.sessionError.value = error.message
      console.error('Error fetching all Kernel Accounts:', error)
    }
  }

  async switchKernelAccount(index) {
    const account = this.kernelAccounts.value.find(acc => acc.index === index)
    if (account) {
      this.kernelAccount.value = account.address
      console.log(`Switched to Kernel Account at index ${index}: ${account.address}`)
    } else {
      console.error(`No Kernel Account found at index ${index}`)
    }
  }
}

export default {
  name: 'SessionKeyManager',
  setup() {
    const sessionManager = new SessionManager()
    return {
      sessionManager,
    }
  },
}
</script>

<style scoped>
.session-key-manager {
  max-width: 600px;
  margin: 0 auto;
}

button {
  display: block;
  margin: 10px 0;
}

.error-message {
  color: red;
}

.success-message {
  color: green;
}
</style>