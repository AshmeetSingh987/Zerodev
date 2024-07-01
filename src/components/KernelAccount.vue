<template>
  <div>
    <button @click="connectWallet">Connect Wallet</button>
    <button @click="createAccount" :disabled="!walletClient">
      Create Account
    </button>
    <button @click="sendUserOperation" :disabled="!accountAddress">
      Send User Operation
    </button>
    <p v-if="errorMessage">Error: {{ errorMessage }}</p>
    <p v-if="walletClient">Wallet Client Connected</p>
    <p v-if="accountAddress">Account Address: {{ accountAddress }}</p>
    <p v-if="userOpHash">User Operation Hash: {{ userOpHash }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ethers } from 'ethers'
import { createPublicClient, http } from 'viem'
import {
  createKernelAccount,
  createZeroDevPaymasterClient,
  createKernelAccountClient,
} from '@zerodev/sdk'
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator'
import { ENTRYPOINT_ADDRESS_V07, bundlerActions } from 'permissionless'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { KERNEL_V3_1 } from '@zerodev/sdk/constants'

const errorMessage = ref(null)
const accountAddress = ref(null)
const userOpHash = ref(null)
const walletClient = ref(null)
const publicClient = createPublicClient({
  transport: http('https://rpc.sepolia.dev'),
})

const connectWallet = async () => {
  try {
    if (!window.ethereum) {
      errorMessage.value = 'MetaMask is not installed!'
      return
    }

    await window.ethereum.request({ method: 'eth_requestAccounts' })
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    walletClient.value = provider.getSigner()

    errorMessage.value = null
  } catch (error) {
    errorMessage.value = error.message
  }
}

const createAccount = async () => {
  try {
    if (!walletClient.value) {
      throw new Error('Wallet client is not connected')
    }

    const signer = await walletClient.value.getAddress()
    const privateKey = process.env.PRIVATE_KEY
    if (!privateKey) {
      throw new Error('PRIVATE_KEY is not set')
    }

    const account = privateKeyToAccount(privateKey)
    const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
      signer: account,
      entryPoint: ENTRYPOINT_ADDRESS_V07,
      kernelVersion: KERNEL_V3_1,
    })

    const kernelAccount = await createKernelAccount(publicClient, {
      plugins: {
        sudo: ecdsaValidator,
      },
      entryPoint: ENTRYPOINT_ADDRESS_V07,
      kernelVersion: KERNEL_V3_1,
    })

    accountAddress.value = kernelAccount.address
    errorMessage.value = null
  } catch (error) {
    errorMessage.value = error.message
  }
}

const sendUserOperation = async () => {
  try {
    if (!accountAddress.value) {
      throw new Error('Account is not created')
    }

    const kernelClient = createKernelAccountClient({
      account: { address: accountAddress.value },
      entryPoint: ENTRYPOINT_ADDRESS_V07,
      chain: sepolia,
      bundlerTransport: http('https://rpc.sepolia.dev'),
      middleware: {
        sponsorUserOperation: async ({ userOperation }) => {
          const paymasterClient = createZeroDevPaymasterClient({
            chain: sepolia,
            transport: http('https://rpc.sepolia.dev'),
            entryPoint: ENTRYPOINT_ADDRESS_V07,
          })
          return paymasterClient.sponsorUserOperation({
            userOperation,
            entryPoint: ENTRYPOINT_ADDRESS_V07,
          })
        },
      },
    })

    const userOperation = {
      callData: await kernelClient.encodeCallData({
        to: '0x0000000000000000000000000000000000000000',
        value: BigInt(0),
        data: '0x',
      }),
    }

    userOpHash.value = await kernelClient.sendUserOperation({ userOperation })
    errorMessage.value = null
  } catch (error) {
    errorMessage.value = error.message
  }
}
</script>
