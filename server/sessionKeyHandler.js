const {
    createPublicClient, http, zeroAddress,
    parseUnits
}=require('viem');
const { polygon }=require('viem/chains');
const {
    createKernelAccountClient,
    createZeroDevPaymasterClient,
    KERNEL_V3_1
}=require("@zerodev/sdk");
const {
    deserializePermissionAccount,
    toPermissionValidator
}=require("@zerodev/permissions");
const { toECDSASigner }=require("@zerodev/permissions/signers");
const { privateKeyToAccount }=require("viem/accounts");
const { ENTRYPOINT_ADDRESS_V07 }=require("permissionless");
const { createKernelDefiClient, baseTokenAddresses }=require('@zerodev/defi');

const publicClient=createPublicClient({
    chain: polygon,
    transport: http(process.env.BUNDLER_RPC),
});

async function useSessionKey(serializedSessionKey, sessionPrivateKey) {
    try {
        const sessionKeySigner=await toECDSASigner({
            signer: privateKeyToAccount(sessionPrivateKey),
        });

        const sessionPointerAccount=await deserializePermissionAccount(
            publicClient,
            ENTRYPOINT_ADDRESS_V07,
            KERNEL_V3_1,
            serializedSessionKey,
            sessionKeySigner,
        );

        if (!sessionPointerAccount) {
            throw new Error('Failed to deserialize session pointer account');
        }

        const kernelPaymaster=createZeroDevPaymasterClient({
            entryPoint: ENTRYPOINT_ADDRESS_V07,
            chain: polygon,
            transport: http(process.env.PAYMASTER_RPC),
        });

        const kernelClient=createKernelAccountClient({
            entryPoint: ENTRYPOINT_ADDRESS_V07,
            account: sessionPointerAccount,
            chain: polygon,
            bundlerTransport: http(process.env.BUNDLER_RPC),
            middleware: {
                sponsorUserOperation: async ({ userOperation }) => {
                    return kernelPaymaster.sponsorUserOperation({
                        userOperation,
                        entryPoint: ENTRYPOINT_ADDRESS_V07,
                    });
                },
            },
        });

        const defiClient=createKernelDefiClient(kernelClient, process.env.PROJECT_ID);

        const swapParams={
            fromToken: baseTokenAddresses[polygon.id].USDC,
            toToken: baseTokenAddresses[polygon.id].AAVE,
            fromAmount: BigInt(2),
            gasToken: 'sponsored',
        };

        console.log('Sending Swap Op', swapParams);
        const swapUserOpHashResponse=await defiClient.sendSwapUserOp(swapParams);
        const swapUrl=`https://jiffyscan.xyz/userOpHash/${swapUserOpHashResponse}`;

        return {
            deserializedSessionKey: sessionPointerAccount,
            swapUserOpHash: swapUserOpHashResponse,
            swapUrl: swapUrl,
        };
    } catch (error) {
        console.error('Error in useSessionKey:', error);
        throw error;
    }
}

module.exports={ useSessionKey };