<template>
  <div class="session-key-manager">
    <h2>Session Key Manager</h2>
    <button @click="sessionManager.connectAndInitialize">Connect and Initialize</button>
    <button @click="sessionManager.createKernelAccountnew">Create Kernel Account</button>
    <button @click="sessionManager.createSessionKeyButton">Create Session Key</button>
    <div v-if="sessionManager.sessionKey" class="session-key">
      <p>Session Key Created:</p>
      <pre>{{ sessionManager.sessionKey }}</pre>
    </div>
    <button @click="sessionManager.useSessionKeyButton">Use Session Key</button>
    <div v-if="sessionManager.deserializedSessionKey" class="session-key">
      <p>Session Key Deserialized:</p>
      <pre>{{ sessionManager.deserializedSessionKey }}</pre>
    </div>
    <div v-if="sessionManager.sessionError" class="error-message">{{ sessionManager.sessionError }}</div>
    <button @click="sessionManager.swapDefi">Swap DeFi Tokens</button>
    <div v-if="sessionManager.swapComplete" class="success-message">
      <p>Swap Complete!</p>
      <a :href="sessionManager.swapUrl" target="_blank">View on JiffyScan</a>
    </div>
    <div v-if="sessionManager.kernelError" class="error-message">{{ sessionManager.kernelError }}</div>
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

    this.publicClient = createPublicClient({
      chain: polygon,
      transport: http(process.env.polygon.BUNDLER_RPC),
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
        kernelVersion: KERNEL_V3_1,
      })
      console.log('Kernel Account :', kernelAccountResponse)
      if (!kernelAccountResponse || !kernelAccountResponse.address) {
        throw new Error('Kernel Account response or address is undefined')
      }

      this.kernelAccount.value = kernelAccountResponse.address
      console.log('Kernel Account created:', kernelAccountResponse.address)

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
    } catch (error) {
      this.sessionError.value = error.message
      console.error('Error using session key:', error)
    }
  }

  async swapDefi() {
    try {
      if (!this.kernelClient.value) {
        throw new Error('Kernel Client is not initialized')
      }
      const defiClient = createKernelDefiClient(this.kernelClient.value, process.env.polygon.PROJECT_ID)

      const swapAmount = parseUnits('10', 6) // Example amount, adjust as needed
      const swapParams = {
        fromToken: baseTokenAddresses[polygon.id].USDC,
        toToken: baseTokenAddresses[polygon.id].WETH,
        fromAmount: swapAmount,
        gasToken: 'sponsored',
      }

      console.log('Sending Swap Op', swapParams)
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
