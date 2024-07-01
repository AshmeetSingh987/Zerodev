<template>
  <div>
    <button @click="initializeValidator">Initialize ECDSA Validator</button>
    <div v-if="validator">ECDSA Validator initialized</div>
    <div v-if="error">{{ error }}</div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { walletClientToSmartAccountSigner } from 'permissionless' // Adjust import as per your library
import { createPublicClient, http } from 'viem' // Adjust import as per your library
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator'
import { KERNEL_V3_1 } from '@zerodev/sdk/constants'

export default {
  name: 'EcdsaValidator',
  props: {
    walletClient: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const validator = ref(null)
    const error = ref(null)

    const initializeValidator = async () => {
      try {
        const smartAccountSigner = walletClientToSmartAccountSigner(
          props.walletClient
        )

        const publicClient = createPublicClient({
          transport: http('https://rpc.amoy.polygon.technology'),
        })

        const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
          signer: smartAccountSigner,
          entryPoint: ENTRYPOINT_ADDRESS_V07, // Adjust as per your configuration
          kernelVersion: KERNEL_V3_1, // Adjust as per your configuration
        })

        validator.value = ecdsaValidator
        console.log('ECDSA Validator initialized:', ecdsaValidator)
      } catch (err) {
        error.value = 'Failed to initialize ECDSA Validator'
        console.error('Error initializing ECDSA Validator:', err)
      }
    }

    return {
      validator,
      error,
      initializeValidator,
    }
  },
}
</script>
