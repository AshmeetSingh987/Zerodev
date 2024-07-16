<template>
    <div class="session-key-manager">
      <h2>Session Key Manager</h2>
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
  parseAbi,
  encodeFunctionData,
  zeroAddress,
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"
import { toECDSASigner } from "@zerodev/permissions/signers"
import {
 
  deserializePermissionAccount,
  serializePermissionAccount,
  toPermissionValidator,
} from "@zerodev/permissions"
import { ParamCondition, toCallPolicy, toSudoPolicy } from "@zerodev/permissions/policies"
import { KERNEL_V3_1 } from "@zerodev/sdk/constants";

 
  
  

  
  export default {
    name: 'SessionKeyManager',
    setup() {
      const sessionKey = ref(null)
      const deserializedSessionKey = ref(null)
      const sessionError = ref(null)
      const publicClient = createPublicClient({
        transport: http(process.env.VUE_APP_BUNDLER_RPC),
      })
      const signer = privateKeyToAccount(process.env.polygon.PRIVATE_KEY)
  
      const createSessionKey = async (sessionKeySigner, sessionPrivateKey) => {
        try {
          const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
            entryPoint: ENTRYPOINT_ADDRESS_V07,
            signer,
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
  
          const sessionKeyAccount = await createKernelAccount(publicClient, {
            entryPoint: ENTRYPOINT_ADDRESS_V07,
            plugins: {
              sudo: ecdsaValidator,
              regular: permissionPlugin,
            },
            kernelVersion: KERNEL_V3_1,
          })
  
          sessionKey.value = await serializePermissionAccount(sessionKeyAccount, sessionPrivateKey)
        } catch (error) {
          sessionError.value = error.message
        }
      }
  
      const useSessionKey = async (serializedSessionKey) => {
        try {
          const sessionKeyAccount = await deserializePermissionAccount(
            publicClient,
            ENTRYPOINT_ADDRESS_V07,
            KERNEL_V3_1,
            serializedSessionKey
          )
  
          const kernelPaymaster = createZeroDevPaymasterClient({
            entryPoint: ENTRYPOINT_ADDRESS_V07,
            chain: polygon,
            transport: http(process.env.polygon.PAYMASTER_RPC),
          })
          const kernelClient = createKernelAccountClient({
            entryPoint: ENTRYPOINT_ADDRESS_V07,
            account: sessionKeyAccount,
            chain: polygon,
            bundlerTransport: http(process.env.polygon.BUNDLER_RPC),
            middleware: {
              sponsorUserOperation: kernelPaymaster.sponsorUserOperation,
            },
          })
  
          const userOpHash = await kernelClient.sendUserOperation({
            userOperation: {
              callData: await sessionKeyAccount.encodeCallData({
                to: zeroAddress,
                value: BigInt(0),
                data: '0x',
              }),
            },
          })
  
          console.log('userOp hash:', userOpHash)
          deserializedSessionKey.value = userOpHash
        } catch (error) {
          sessionError.value = error.message
        }
      }
  
      const createSessionKeyButton = async () => {
        const sessionPrivateKey = generatePrivateKey()
        const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey)
        const sessionKeySigner = await toECDSASigner({
          signer: sessionKeyAccount,
        })
        await createSessionKey(sessionKeySigner, sessionPrivateKey)
      }
  
      const useSessionKeyButton = async () => {
        if (sessionKey.value) {
          await useSessionKey(sessionKey.value)
        } else {
          sessionError.value = 'No session key available. Create a session key first.'
        }
      }
  
      return {
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
  