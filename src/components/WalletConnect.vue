<template>
  <div class="wallet-connect">
    <button @click="connectAndInitialize">
      Connect Wallet & Initialize ECDSA Validator
    </button>
    <div v-if="account" class="connected-account">
      Connected account: {{ account }}
    </div>
    <div v-if="validator" class="validator-initialized">
      ECDSA Validator initialized
    </div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <button
      @click="createKernelAccountnew"
      v-if="validator && account && !kernelAccount"
    >
      Create Kernel Account
    </button>
    <div v-if="kernelAccount" class="kernel-account">
      Kernel Account created: {{ kernelAccount }}
    </div>
    <div v-if="kernelClient" class="kernel-client">
      <div>Kernel Client initialized</div>
      <button @click="sendUserOperation">Send UserOp</button>
      <div v-if="userOpHash">UserOp hash: {{ userOpHash }}</div>
      <div v-if="userOpComplete">
        UserOp complete: <a :href="userOpUrl">{{ userOpHash }}</a>
      </div>
      <button @click="swapDefi">Swap Tokens</button>
      <div v-if="swapUserOpHash">Swap UserOp hash: {{ swapUserOpHash }}</div>
      <div v-if="swapComplete">
        Swap complete: <a :href="swapUrl">{{ swapUserOpHash }}</a>
      </div>
    </div>
    <div v-if="kernelError" class="error-message">{{ kernelError }}</div>
  </div>
</template>

<script>
import { ref } from 'vue'

import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator'
import { createWalletClient, custom } from 'viem'
import { polygonAmoy } from 'viem/chains'
import { KERNEL_V3_1 } from '@zerodev/sdk/constants'
import { providerToSmartAccountSigner } from 'permissionless'
import { createPublicClient, http, zeroAddress } from 'viem'
import { ENTRYPOINT_ADDRESS_V07, bundlerActions } from 'permissionless'
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk'
import {
  createKernelDefiClient,
  baseTokenAddresses,
  defiTokenAddresses,
} from '@zerodev/defi'

export default {
  name: 'WalletConnect',
  setup() {
    const account = ref(null)
    const validator = ref(null)
    const error = ref(null)
    const kernelAccount = ref(null)
    const kernelClient = ref(null)
    const kernelError = ref(null)
    const userOpHash = ref(null)
    const userOpComplete = ref(false)
    const userOpUrl = ref('')
    const swapUserOpHash = ref(null)
    const swapComplete = ref(false)
    const swapUrl = ref('')

    let walletClient = null // Declare walletClient outside setup() scope

    const connectAndInitialize = async () => {
      try {
        if (!window.ethereum) {
          throw new Error('MetaMask is not installed or not detected')
        }

        await window.ethereum.request({ method: 'eth_requestAccounts' })

        const smartAccountSigner = await providerToSmartAccountSigner(
          window.ethereum
        )

        walletClient = createWalletClient({
          chain: polygonAmoy, // Adjust as per your configuration
          transport: custom(window.ethereum), // Adjust as per your configuration
        })

        validator.value = await signerToEcdsaValidator(walletClient, {
          signer: smartAccountSigner,
          entryPoint: ENTRYPOINT_ADDRESS_V07,
          kernelVersion: KERNEL_V3_1,
        })

        const addresses = await window.ethereum.request({
          method: 'eth_accounts',
        })
        account.value = addresses[0] // Assuming the first account is used

        console.log('ECDSA Validator initialized:', validator.value)
      } catch (err) {
        error.value =
          err.message || 'Failed to connect and initialize ECDSA Validator'
        console.error('Error connecting and initializing:', err)
      }
    }

    const createKernelAccountnew = async () => {
      try {
        if (!validator.value || !account.value) {
          throw new Error('ECDSA Validator or account not initialized')
        }

        const publicClient = createPublicClient({
          transport: http(
            'https://rpc.zerodev.app/api/v2/bundler/925e6965-4c1a-49c4-9edc-c938ee96770f'
          ),
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
          chain: polygonAmoy,
          bundlerTransport: http(
            'https://rpc.zerodev.app/api/v2/bundler/925e6965-4c1a-49c4-9edc-c938ee96770f'
          ),
          middleware: {
            sponsorUserOperation: async ({ userOperation }) => {
              const paymasterClient = createZeroDevPaymasterClient({
                chain: polygonAmoy,
                transport: http(process.env.PAYMASTER_RPC),
                entryPoint: ENTRYPOINT_ADDRESS_V07,
              })
              return paymasterClient.sponsorUserOperation({
                userOperation,
                entryPoint: ENTRYPOINT_ADDRESS_V07,
              })
            },
          },
        })

        console.log('Kernel Client initialized')
      } catch (err) {
        kernelError.value =
          err.message ||
          'Failed to create Kernel Account or initialize Kernel Client'
        console.error(
          'Error creating Kernel Account or initializing Kernel Client:',
          err
        )
      }
    }
    chain = polygonAmoy
    const projectId = '925e6965-4c1a-49c4-9edc-c938ee96770f'
    const defiClient = createKernelDefiClient(kernelClient.value, projectId)
    console.log(defiClient)
    const sendUserOperation = async () => {
      try {
        if (!kernelClient.value) {
          throw new Error('Kernel Client not initialized')
        }

        const userOpHashResponse = await kernelClient.value.sendUserOperation({
          userOperation: {
            callData: await kernelClient.value.account.encodeCallData({
              to: zeroAddress,
              value: BigInt(0),
              data: '0x',
            }),
          },
        })

        userOpHash.value = userOpHashResponse
        console.log('UserOp hash:', userOpHashResponse)

        // Wait for UserOp to complete
        const bundlerClient = kernelClient.value.extend(
          bundlerActions(ENTRYPOINT_ADDRESS_V07)
        )
        await bundlerClient.waitForUserOperationReceipt({
          hash: userOpHashResponse,
        })

        console.log('UserOp completed')
        userOpComplete.value = true
        userOpUrl.value = `https://jiffyscan.xyz/userOpHash/${userOpHashResponse}`
      } catch (err) {
        kernelError.value = err.message || 'Failed to send UserOp'
        console.error('Error sending UserOp:', err)
      }
    }

    const swapDefi = async () => {
      try {
        if (!kernelClient.value) {
          throw new Error('Kernel Client not initialized')
        }

        const swapUserOpHashResponse = await defiClient.sendSwapUserOp({
          fromToken: baseTokenAddresses[polygonAmoy.id].USDC,
          fromAmount: BigInt('100'),
          toToken: defiTokenAddresses[polygonAmoy.id]['USDC']['aave-v3'],
          gasToken: 'sponsored',
        })

        swapUserOpHash.value = swapUserOpHashResponse
        console.log('Swap UserOp hash:', swapUserOpHashResponse)

        // Wait for Swap UserOp to complete
        const bundlerClient = kernelClient.value.extend(
          bundlerActions(ENTRYPOINT_ADDRESS_V07)
        )
        await bundlerClient.waitForUserOperationReceipt({
          hash: swapUserOpHashResponse,
        })

        console.log('Swap UserOp completed')
        swapComplete.value = true
        swapUrl.value = `https://jiffyscan.xyz/userOpHash/${swapUserOpHashResponse}`
      } catch (err) {
        kernelError.value = err.message || 'Failed to send Swap UserOp'
        console.error('Error sending Swap UserOp:', err)
      }
    }

    return {
      account,
      validator,
      error,
      kernelAccount,
      kernelClient,
      kernelError,
      userOpHash,
      userOpComplete,
      userOpUrl,
      swapUserOpHash,
      swapComplete,
      swapUrl,
      connectAndInitialize,
      createKernelAccountnew,
      sendUserOperation,
      swapDefi,
    }
  },
}
</script>

<style scoped>
.wallet-connect {
  background-color: white;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 5px;
  max-width: 400px;
  margin: 20px auto;
}

.connected-account {
  margin-top: 10px;
  font-weight: bold;
}

.validator-initialized {
  margin-top: 10px;
  color: green;
}

.kernel-account {
  margin-top: 10px;
}

.kernel-client {
  margin-top: 10px;
  color: blue;
}

.error-message {
  margin-top: 10px;
  color: red;
}

.kernel-client button {
  margin-top: 10px;
}
</style>
