<template>
  <div class="session-key-manager">
    <h2>Session Key Manager</h2>
    <button @click="connectAndInitialize">Connect and Initialize</button>
    <button @click="createKernelAccountnew">Create Kernel Account</button>
    <button @click="createSessionKeyButton">Create Session Key</button>
    <div v-if="sessionKey" class="session-key">
      <p>Session Key Created:</p>
      <pre>{{ sessionKey }}</pre>
    </div>
    <button @click="useSessionKeyButton">Use Session Key</button>
    <div v-if="deserializedSessionKey" class="session-key">
      <p>Session Key Deserialized:</p>
      <pre>{{ deserializedSessionKey }}</pre>
    </div>
    <div v-if="sessionError" class="error-message">{{ sessionError }}</div>
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
import { createWalletClient } from 'viem'

export default {
  name: 'SessionKeyManager',
  setup() {
    const sessionKey = ref(null)
    const deserializedSessionKey = ref(null)
    const sessionError = ref(null)
    const walletClient = ref(null)
    const account = ref(null)
    const validator = ref(null)
    const kernelAccount = ref(null)
    const kernelClient = ref(null)
    const smartAccountSigner = ref(null)
    const serializedSessionKey = ref(null)
    const sessionPrivateKey = ref(null)

    const publicClient = createPublicClient({
      chain: polygon,
      transport: http(process.env.polygon.BUNDLER_RPC),
    })
    const signer = privateKeyToAccount(process.env.polygon.PRIVATE_KEY)

    const connectAndInitialize = async () => {
      try {
        if (!window.ethereum) {
          throw new Error('MetaMask is not installed or not detected')
        }

        await window.ethereum.request({ method: 'eth_requestAccounts' })

        smartAccountSigner.value = await providerToSmartAccountSigner(window.ethereum)

        walletClient.value = createWalletClient({
          chain: polygon,
          transport: custom(window.ethereum),
        })

        const addresses = await window.ethereum.request({ method: 'eth_accounts' })
        account.value = addresses[0]
        validator.value = await signerToEcdsaValidator(walletClient.value, {
          signer: smartAccountSigner.value,
          entryPoint: ENTRYPOINT_ADDRESS_V07,
          kernelVersion: KERNEL_V3_1,
        })
        console.log('ECDSA Validator initialized:', validator.value)
      } catch (err) {
        sessionError.value = err.message || 'Failed to connect and initialize ECDSA Validator'
        console.error('Error connecting and initializing:', err)
      }
    }

    const createKernelAccountnew = async () => {
      try {
        if (!validator.value || !account.value) {
          throw new Error('ECDSA Validator or account not initialized')
        }

        const publicClient = createPublicClient({
          transport: http(process.env.polygon.BUNDLER_RPC),
        })
        console.log('Public Client initialized', publicClient)

        const kernelAccountResponse = await createKernelAccount(publicClient, {
          plugins: {
            sudo: validator.value,
          },
          entryPoint: ENTRYPOINT_ADDRESS_V07,
          kernelVersion: KERNEL_V3_1,
        })
        console.log('Kernel Account :', kernelAccountResponse)
        if (!kernelAccountResponse || !kernelAccountResponse.address) {
          throw new Error('Kernel Account response or address is undefined')
        }

        kernelAccount.value = kernelAccountResponse.address
        console.log('Kernel Account created:', kernelAccountResponse.address)

        kernelClient.value = createKernelAccountClient({
          account: kernelAccountResponse,
          entryPoint: ENTRYPOINT_ADDRESS_V07,
          chain: polygon,
          bundlerTransport: http(process.env.polygon.BUNDLER_RPC),
          middleware: {
            sponsorUserOperation: async ({ userOperation }) => {
              const paymasterClient = createZeroDevPaymasterClient({
                chain: polygon,
                transport: http(process.env.polygon.PAYMASTER_RPC),
                entryPoint: ENTRYPOINT_ADDRESS_V07,
              })
              return paymasterClient.sponsorUserOperation({
                userOperation,
                entryPoint: ENTRYPOINT_ADDRESS_V07,
              })
            },
          },
        })
      } catch (error) {
        sessionError.value = error.message
        console.error('Error creating Kernel Account:', error)
      }
    }

    const createSessionKey = async (sessionKeySigner, sessionKeyAccount) => {
      try {
        if (!sessionKeySigner || !sessionKeyAccount) {
          throw new Error('Session key signer or account is missing')
        }

        const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
          entryPoint: ENTRYPOINT_ADDRESS_V07,
          signer: smartAccountSigner.value,
          kernelVersion: KERNEL_V3_1,
        })

        const masterAccount = await createKernelAccount(publicClient, {
          entryPoint: ENTRYPOINT_ADDRESS_V07,
          plugins: {
            sudo: ecdsaValidator,
          },
          kernelVersion: KERNEL_V3_1,
        })
        console.log('Account address:', masterAccount.address)

        const permissionPlugin = await toPermissionValidator(publicClient, {
          entryPoint: ENTRYPOINT_ADDRESS_V07,
          signer: sessionKeySigner,
          policies: [toSudoPolicy({})],
          kernelVersion: KERNEL_V3_1,
        })

        const sessionPointerAccount = await createKernelAccount(publicClient, {
          entryPoint: ENTRYPOINT_ADDRESS_V07,
          plugins: {
            sudo: ecdsaValidator,
            regular: permissionPlugin,
          },
          kernelVersion: KERNEL_V3_1,
        })
        const approval = await serializePermissionAccount(sessionPointerAccount)
console.log('Approval:', approval)
        console.log('Session Pointer Account:', sessionPointerAccount)
        const serializedKey = await serializePermissionAccount(sessionPointerAccount, sessionKeyAccount.privateKey)

        if (!serializedKey) {
          throw new Error('Failed to serialize session key')
        }
        sessionKey.value = serializedKey
        return serializedKey
      } catch (error) {
        sessionError.value = error.message
        console.error('Error creating session key:', error)
      }
    }

    const useSessionKey = async (serializedSessionKey) => {
  try {
    if (!serializedSessionKey) {
      throw new Error('Serialized session key is missing')
    }


    console.log('Using serialized session key:', serializedSessionKey)

    const sessionKeySigner = await toECDSASigner({
      signer: privateKeyToAccount(sessionPrivateKey.value),
    })
    const sessionPointerAccount = await deserializePermissionAccount(
      publicClient,
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
    const kernelClient = createKernelAccountClient({
      entryPoint: ENTRYPOINT_ADDRESS_V07,
      account: sessionPointerAccount,
      chain: polygon,
      bundlerTransport: http(process.env.polygon.BUNDLER_RPC),
      middleware: {
        sponsorUserOperation: kernelPaymaster.sponsorUserOperation,
      },
    })

    const userOpHash = await kernelClient.sendUserOperation({
      userOperation: {
        callData: await sessionPointerAccount.encodeCallData({
          to: zeroAddress,
          value: BigInt(0),
          data: '0x',
        }),
      },
    })

    if (!userOpHash) {
      throw new Error('Failed to send user operation')
    }

    console.log('userOp hash:', userOpHash)
    deserializedSessionKey.value = userOpHash
  } catch (error) {
    sessionError.value = error.message
    console.error('Error using session key:', error)
  }
}


    const createSessionKeyButton = async () => {
      try {
        sessionPrivateKey.value = generatePrivateKey()
        const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey.value)
        console.log('Generated session key account:', sessionKeyAccount)
        const sessionKeySigner = toECDSASigner({ signer: sessionKeyAccount })
        console.log('Generated session key signer:', sessionKeySigner)
        serializedSessionKey.value = await createSessionKey(sessionKeySigner, sessionKeyAccount)
        console.log('Serialized session key:', serializedSessionKey.value)
      } catch (error) {
        sessionError.value = error.message
        console.error('Error in createSessionKeyButton:', error)
      }
    }

    const useSessionKeyButton = async () => {
      console.log('Serialized session key on button click:', serializedSessionKey.value)
      console.log('Session private key on button click:', sessionPrivateKey.value)
      if (serializedSessionKey.value && sessionPrivateKey.value) {
        await useSessionKey(serializedSessionKey.value)
      } else {
        sessionError.value = 'No session key available. Create a session key first.'
      }
    }

    return {
      connectAndInitialize,
      createKernelAccountnew,
      createSessionKeyButton,
      useSessionKeyButton,
      sessionKey,
      deserializedSessionKey,
      sessionError,
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
</style>
