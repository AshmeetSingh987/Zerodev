import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { KERNEL_V3_1 } from "@zerodev/sdk/constants";
import { walletClientToSmartAccountSigner, ENTRYPOINT_ADDRESS_V07 } from 'permissionless';
import { createPublicClient, http } from 'viem';

export async function initializeEcdsaValidator(walletClient) {
    try {
        const smartAccountSigner=walletClientToSmartAccountSigner(walletClient);

        const publicClient=createPublicClient({
            transport: http('https://rpc-amoy.polygon.technology'),
        });

        const ecdsaValidator=await signerToEcdsaValidator(publicClient, {
            signer: smartAccountSigner,
            entryPoint: ENTRYPOINT_ADDRESS_V07,
            kernelVersion: KERNEL_V3_1
        });

        return ecdsaValidator;
    } catch (error) {
        console.error('Failed to initialize ECDSA Validator:', error);
        return null;
    }
}
