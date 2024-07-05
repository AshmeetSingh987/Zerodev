<template>
  <div class="session-management">
    <button @click="createSessionKey" v-if="!sessionKeyAddress">
      Create Session Key
    </button>
    <div v-if="sessionKeyAddress">
      Session Key Address: {{ sessionKeyAddress }}
    </div>

    <button
      @click="approveSessionKey"
      v-if="sessionKeyAddress && !sessionApproval"
    >
      Approve Session Key
    </button>
    <div v-if="sessionApproval">Session Key Approved</div>

    <button @click="useSessionKey" v-if="sessionApproval">
      Use Session Key
    </button>
    <button @click="revokeSessionKey" v-if="sessionApproval">
      Revoke Session Key
    </button>

    <div v-if="sessionError" class="error-message">{{ sessionError }}</div>
  </div>
</template>

<script>
import { ref } from 'vue'
import {
 
 
  addressToEmptyAccount,

  createKernelAccount,
  


} from '@zerodev/sdk'
import { toECDSASigner } from "@zerodev/permissions/signers"
import {
  
  deserializePermissionAccount,
  serializePermissionAccount,
  toPermissionValidator,
} from "@zerodev/permissions"
import { ParamCondition, toCallPolicy, toSudoPolicy } from "@zerodev/permissions/policies"
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator'
import { providerToSmartAccountSigner } from 'permissionless'
 import { toRemoteSigner, RemoteSignerMode } from "@zerodev/remote-signer"
  import { createPublicClient, http, zeroAddress } from 'viem'

export default {
  name: 'SessionManagement',
  props: {
    walletClient: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const sessionKeyAddress = ref(null)
    const sessionApproval = ref(null)
    const sessionError = ref(null)
    const sudoKernelClient = ref(null)

    const createSessionKey = async () => {
      try {
        const remoteSigner = await toRemoteSigner({
          apiKey:
            'https://passkeys.zerodev.app/api/v3/925e6965-4c1a-49c4-9edc-c938ee96770f',
          mode: RemoteSignerMode.Create,
        })
        const sessionKeySigner = toECDSASigner({
          signer: walletClient,
        })
        sessionKeyAddress.value = sessionKeySigner.account.address
        console.log('Session Key Address:', sessionKeyAddress.value)
      } catch (err) {
        sessionError.value = err.message || 'Failed to create session key'
        console.error('Error creating session key:', err)
      }
    }

    const approveSessionKey = async () => {
      try {
        const publicClient = createPublicClient({
          transport: http(
            'https://rpc.zerodev.app/api/v2/bundler/925e6965-4c1a-49c4-9edc-c938ee96770f'
          ),
        })

        const smartAccountSigner = await providerToSmartAccountSigner(
          window.ethereum
        )

        const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
          entryPoint: ENTRYPOINT_ADDRESS_V07,
          kernelVersion: KERNEL_V3_1,
          signer: smartAccountSigner,
        })

        const emptyAccount = addressToEmptyAccount(sessionKeyAddress.value)
        const emptySessionKeySigner = await toECDSASigner({
          signer: emptyAccount,
        })

        const permissionPlugin = await toPermissionValidator(publicClient, {
          entryPoint: ENTRYPOINT_ADDRESS_V07,
          kernelVersion: KERNEL_V3_1,
          signer: emptySessionKeySigner,
          policies: [
         toSudoPolicy({}),
          ],
        })

        const sessionKeyAccount = await createKernelAccount(publicClient, {
          entryPoint: ENTRYPOINT_ADDRESS_V07,
          kernelVersion: KERNEL_V3_1,
          plugins: {
            sudo: ecdsaValidator,
            regular: permissionPlugin,
          },
        })

        sessionApproval.value = await serializePermissionAccount(
          sessionKeyAccount
        )
        console.log('Session Key Approved')
      } catch (err) {
        sessionError.value = err.message || 'Failed to approve session key'
        console.error('Error approving session key:', err)
      }
    }

    const useSessionKey = async () => {
      try {
        // const remoteSignerWithGet = await toRemoteSigner({
        //   apiKey: 'https://passkeys.zerodev.app/api/v3/8abbd50e-9d08-4157-965d-c83eab9c42c3', // Replace with your API key
        //   keyAddress: sessionKeyAddress.value,
        //   mode: RemoteSignerMode.Get,
        // })

        const sessionKeySigner = toECDSASigner({
          signer: walletClient,
        })

        const publicClient = createPublicClient({
          transport: http(
            'https://rpc.zerodev.app/api/v2/bundler/925e6965-4c1a-49c4-9edc-c938ee96770f'
          ),
        })

        const sessionKeyAccount = await deserializePermissionAccount(
          publicClient,
          ENTRYPOINT_ADDRESS_V07,
          KERNEL_V3_1,
          sessionApproval.value,
          sessionKeySigner
        )

        sudoKernelClient.value = createKernelAccountClient({
          account: sessionKeyAccount,
          entryPoint: ENTRYPOINT_ADDRESS_V07,
          chain: polygonAmoy,
          bundlerTransport: http(
            'https://rpc.zerodev.app/api/v2/bundler/925e6965-4c1a-49c4-9edc-c938ee96770f'
          ),
        })
        console.log('Kernel Client initialized')
      } catch (err) {
        sessionError.value = err.message || 'Failed to use session key'
        console.error('Error using session key:', err)
      }
    }

    const revokeSessionKey = async () => {
      try {
        if (!sudoKernelClient.value) {
          throw new Error('Kernel Client not initialized')
        }

        const txHash = await sudoKernelClient.value.uninstallPlugin({
          plugin: permissionPlugin,
        })

        console.log('Session Key revoked, tx hash:', txHash)
      } catch (err) {
        sessionError.value = err.message || 'Failed to revoke session key'
        console.error('Error revoking session key:', err)
      }
    }

    return {
      sessionKeyAddress,
      sessionApproval,
      sessionError,
      createSessionKey,
      approveSessionKey,
      useSessionKey,
      revokeSessionKey,
    }
  },
}
</script>

<style scoped>
.session-management {
  background-color: white;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 5px;
  max-width: 400px;
  margin: 20px auto;
}

.error-message {
  margin-top: 10px;
  color: red;
}
</style>
