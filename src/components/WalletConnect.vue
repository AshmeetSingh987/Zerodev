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
      <button @click="createSessionKey">Create Session Key </button>
      <button @click="useSessionKey">Use Session Key </button>
    </div>
    <div v-if="kernelError" class="error-message">{{ kernelError }}</div>
    
  </div>
</template>

<script>
import { ref } from 'vue'
import SessionManagement from './SessionManagement.vue'
import { toECDSASigner } from "@zerodev/permissions/signers"
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator'
import { createWalletClient, custom, parseUnits } from 'viem'
import { polygon } from 'viem/chains'
import { KERNEL_V3_1 } from '@zerodev/sdk/constants'
import { providerToSmartAccountSigner } from 'permissionless'
import { createPublicClient, http, zeroAddress } from 'viem'
import { ENTRYPOINT_ADDRESS_V07, bundlerActions } from 'permissionless'
import { toRemoteSigner, RemoteSignerMode } from "@zerodev/remote-signer"
import { createKernelAccount , createKernelAccountClient , createZeroDevPaymasterClient  } from '@zerodev/sdk'
import { createKernelDefiClient, baseTokenAddresses } from '@zerodev/defi'
import { toSudoPolicy } from '@zerodev/permissions/policies'
import {deserializePermissionAccount,serializePermissionAccount, toPermissionValidator } from '@zerodev/permissions'
// import { ModularSigner } from '@zerodev/permissions'
import { privateKeyToAccount } from 'viem/accounts'
export default {
  name: 'WalletConnect',
  components: {
    SessionManagement,
  },
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
    const walletClient = ref(null)

    const connectAndInitialize = async () => {
      try {
        if (!window.ethereum) {
          throw new Error('MetaMask is not installed or not detected')
        };

        await window.ethereum.request({ method: 'eth_requestAccounts' })

        const smartAccountSigner = await providerToSmartAccountSigner(window.ethereum)
     

        walletClient.value = createWalletClient({
          chain: polygon,
          transport: custom(window.ethereum),
        })

        const addresses = await window.ethereum.request({ method: 'eth_accounts' })
        account.value = addresses[0]
        validator.value = await signerToEcdsaValidator(walletClient.value, {
          signer: smartAccountSigner,
          entryPoint: ENTRYPOINT_ADDRESS_V07,
          kernelVersion: KERNEL_V3_1,
        })
        console.log('ECDSA Validator initialized:', validator.value)
      } catch (err) {
        error.value = err.message || 'Failed to connect and initialize ECDSA Validator'
        console.error('Error connecting and initializing:', err)
      };
    };

   
const createKernelAccountnew = async () => {
      try {
        if (!validator.value || !account.value) {
          throw new Error('ECDSA Validator or account not initialized')
        };

        const publicClient = createPublicClient({
          transport: http(process.env.polygon.BUNDLER_RPC),
        })
        console.log('Public Client initialized', publicClient)
        const smartAccountSigner = await providerToSmartAccountSigner(window.ethereum)
        const signer = privateKeyToAccount(process.env.polygon.PRIVATE_KEY)
        const SessionValidator = await signerToEcdsaValidator(publicClient, {
          signer,
          entryPoint: ENTRYPOINT_ADDRESS_V07,
          kernelVersion: KERNEL_V3_1,
        })
        const masterAccountResponse = await createKernelAccount(publicClient, {
          plugins: {
            sudo: SessionValidator,
          },
          entryPoint: ENTRYPOINT_ADDRESS_V07,
          kernelVersion: KERNEL_V3_1,
        })
        console.log('Master Account:', masterAccountResponse)
        const permissionPlugin = await toPermissionValidator(publicClient, {
    entryPoint:ENTRYPOINT_ADDRESS_V07,
    signer: signer,
    policies: [
    
      toSudoPolicy({}),
    ],
    kernelVersion: KERNEL_V3_1
  }) 

        const sessionKeyAccount = await createKernelAccount(publicClient, {
          plugins: {
            sudo: validator.value,
            regular: permissionPlugin,
          },
          entryPoint: ENTRYPOINT_ADDRESS_V07,
          kernelVersion: KERNEL_V3_1,
        })

        console.log('Kernel Account:', sessionKeyAccount.address)
        const serializedSessionKey = await serializePermissionAccount(sessionKeyAccount, process.env.polygon.PRIVATE_KEY)
        console.log('Serialized Session Key:', serializedSessionKey)

        

        // kernelAccount.value = kernelAccountResponse.address
        // console.log('Kernel Account created:', kernelAccountResponse.address)

        // kernelClient.value = createKernelAccountClient({
        //   account: kernelAccountResponse,
        //   entryPoint: ENTRYPOINT_ADDRESS_V07,
        //   chain: polygon,
        //   bundlerTransport: http(process.env.polygon.BUNDLER_RPC),
        //   middleware: {
        //     sponsorUserOperation: async ({ userOperation }) => {
        //       const paymasterClient = createZeroDevPaymasterClient({
        //         chain: polygon,
        //         transport: http(process.env.polygon.PAYMASTER_RPC),
        //         entryPoint: ENTRYPOINT_ADDRESS_V07,
        //       })
        //       return paymasterClient.sponsorUserOperation({
        //         userOperation,
        //         entryPoint: ENTRYPOINT_ADDRESS_V07,
        //       })
        //     },
        //   },
        // })

        const sessionKeyAccountClient = await deserializePermissionAccount(
          publicClient,
          ENTRYPOINT_ADDRESS_V07,
          KERNEL_V3_1,
          serializedSessionKey
        ) 
        console.log('Session Key Account Client deceriealized ', sessionKeyAccountClient.address)
      
         const kernelPaymaster = createZeroDevPaymasterClient({
    entryPoint,
    chain: polygon,
    transport: http(process.env.polygon.PAYMASTER_RPC),
  });
  const kernelClient = createKernelAccountClient({
    entryPoint,
    account: sessionKeyAccountClient,
    chain: polygon,
    bundlerTransport: http(process.env.polygon.BUNDLER_RPC),
    middleware: {
      sponsorUserOperation: kernelPaymaster.sponsorUserOperation,
    },
  });

  const userOpHash = await kernelClient.sendUserOperation({
    userOperation: {
      callData: await sessionKeyAccountClient.encodeCallData({
        to: zeroAddress,
        value: BigInt(0),
        data: "0x",
      }),
    },
  });
  console.log( 'in user ops ');

  } catch (err) {
    kernelError.value =
      err.message ||
      'Failed to create Kernel Account or initialize Kernel Client'
    console.error(
      'Error creating Kernel Account or initializing Kernel Client:',
      err
    )
  };
}
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
        const bundlerClient = kernelClient.value.extend(bundlerActions(ENTRYPOINT_ADDRESS_V07))
        await bundlerClient.waitForUserOperationReceipt({ hash: userOpHashResponse })

        console.log('UserOp completed')
        userOpComplete.value = true
        userOpUrl.value = `https://jiffyscan.xyz/userOpHash/${userOpHashResponse}`
      } catch (err) {
        kernelError.value = err.message || 'Failed to send UserOp'
        console.error('Error sending UserOp:', err)
      }
    }

    const swapDefi = async () => {
      const projectId = '8abbd50e-9d08-4157-965d-c83eab9c42c3'
      const defiClient = createKernelDefiClient(kernelClient.value, projectId)
      console.log(defiClient)
      try {
        if (!kernelClient.value) {
          throw new Error('Kernel Client not initialized')
        }
        const chain = polygon
        const swapUserOpHashResponse = await defiClient.sendSwapUserOp({
          chainId: defiClient.chain.id,
          fromToken: baseTokenAddresses[chain.id].USDC,
          toToken: baseTokenAddresses[chain.id].WETH,
          fromAmount: parseUnits('1', 6),
          gasToken: 'sponsored',
        })

        swapUserOpHash.value = swapUserOpHashResponse
        console.log('Swap UserOp hash:', swapUserOpHashResponse)

        // Wait for Swap UserOp to complete
        const bundlerClient = kernelClient.value.extend(bundlerActions(ENTRYPOINT_ADDRESS_V07))
        await bundlerClient.waitForUserOperationReceipt({ hash: swapUserOpHashResponse })

        console.log('Swap UserOp completed')
        swapComplete.value = true
        swapUrl.value = `https://jiffyscan.xyz/swapUserOpHash/${swapUserOpHashResponse}`
      } catch (err) {
        kernelError.value = err.message || 'Failed to perform Swap UserOp'
        console.error('Error performing Swap UserOp:', err)
      }
    }
   
     const publicClient = createPublicClient({
          transport: http(process.env.polygon.BUNDLER_RPC),
        })
        console.log('Public Client initialized under Sessions ', publicClient)
  // const SessionSigner = privateKeyToAccount(process.env.PRIVATE_KEY);

  // const createSessionKey = async (
  //   sessionKeySigner,
  //   sessionPrivateKey
  // ) => {
  //   const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
  //     SessionSigner,
  //     entryPoint: ENTRYPOINT_ADDRESS_V07,
  //     kernelVersion: KERNEL_V3_1,
  //   });  
  //   const masterAccount = await createKernelAccount(publicClient, {
  //     entryPoint: ENTRYPOINT_ADDRESS_V07,
  //     plugins: {
  //       sudo: ecdsaValidator,
  //     },
  //     kernelVersion: KERNEL_V3_1,
  //   });
  //   console.log('Master Account:', masterAccount.address);

  //   const permissionPlugin = await toPermissionValidator(publicClient, {
  //     entryPoint: ENTRYPOINT_ADDRESS_V07,
  //     signer: SessionKeySigner,
  //     policies: [
  //       toSudoPolicy({}),
  //     ],
  //     kernelVersion: KERNEL_V3_1
  //   });
  //   const sessionKeyAccount = await createKernelAccount(publicClient, {
  //     entryPoint: ENTRYPOINT_ADDRESS_V07,
  //     plugins: {
  //       sudo: ecdsaValidator,
  //       regular: permissionPlugin,
  //     },
  //     kernelVersion: KERNEL_V3_1,
  //   });

  //   console.log('Session Key Account:', sessionKeyAccount.address); 
  //   return await serializePermissionAccount(sessionKeyAccount, sessionPrivateKey);
  // };

  // const useSessionKey = async (serializedSessionKey) => {
  //   const sessionKeyAccount = await deserializePermissionAccount(
  //     publicClient,

  //     entryPoint,
  //     KERNEL_V3_1,
  //     serializedSessionKey
  //   );

  //   const kernelPaymaster = createZeroDevPaymasterClient({
  //     entryPoint,
  //     chain: polygon,
  //     transport: http(process.env.PAYMASTER_RPC),
  //   });
  //   const kernelClient = createKernelAccountClient({
  //     entryPoint,
  //     account: sessionKeyAccount,
  //     chain: polygon,
  //     bundlerTransport: http(process.env.polygon.BUNDLER_RPC),
  //     middleware: {
  //       sponsorUserOperation: kernelPaymaster.sponsorUserOperation,
  //     },
  //   });

  //   const userOpHash = await kernelClient.sendUserOperation({
  //     userOperation: {
  //       callData: await sessionKeyAccount.encodeCallData({
  //         to: zeroAddress,
  //         value: BigInt(0),
  //         data: "0x",
  //       }),
  //     },
  //   });

  //   console.log("userOp hash:", userOpHash);
  // };

  // console.log(session);

  // const createSessionKeyButton = async () => {
  //   const sessionKeySigner = await toECDSASigner({
  //     signer: sessionKeyAccount,
  //   });
  //   const serializedSessionKey = await createSessionKey(
  //     sessionKeySigner,
  //     sessionPrivateKey
  //   );
  //   console.log("Serialized Session Key:", serializedSessionKey);
  // };

  // const useSessionKeyButton = async () => {
  //   await useSessionKey(serializedSessionKey);
  // }

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
    walletClient,
    connectAndInitialize,
    createKernelAccountnew,
    sendUserOperation,
    swapDefi,
    // createSessionKeyButton,
    // useSessionKeyButton,
    
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