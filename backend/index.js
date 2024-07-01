import 'dotenv/config';
import express from 'express';
import {
    createKernelAccount,
    createZeroDevPaymasterClient,
    createKernelAccountClient,
} from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { ENTRYPOINT_ADDRESS_V07, bundlerActions } from 'permissionless';
import { http, zeroAddress, createPublicClient } from 'viem';
import { sepolia } from 'viem/chains';
import { KERNEL_V3_1 } from '@zerodev/sdk/constants';
import { ethers } from 'ethers';

const app=express();
const port=3000;

app.use(express.json());

const publicClient=createPublicClient({
    transport: http(process.env.BUNDLER_RPC),
});

const chain=sepolia;
const entryPoint=ENTRYPOINT_ADDRESS_V07;

app.post('/createAccount', async (req, res) => {
    try {
        const { signerAddress, signerPrivateKey }=req.body;
        if (!signerAddress||!signerPrivateKey) {
            return res.status(400).json({ error: 'signerAddress and signerPrivateKey are required' });
        }

        const signer=new ethers.Wallet(signerPrivateKey);

        const ecdsaValidator=await signerToEcdsaValidator(publicClient, {
            signer,
            entryPoint,
            kernelVersion: KERNEL_V3_1,
        });

        const account=await createKernelAccount(publicClient, {
            plugins: {
                sudo: ecdsaValidator,
            },
            entryPoint,
            kernelVersion: KERNEL_V3_1,
        });

        res.json({ address: account.address });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/sendUserOperation', async (req, res) => {
    try {
        const { accountAddress, signerPrivateKey }=req.body;
        if (!accountAddress||!signerPrivateKey) {
            return res.status(400).json({ error: 'accountAddress and signerPrivateKey are required' });
        }

        const signer=new ethers.Wallet(signerPrivateKey);
        const account={ address: accountAddress };

        const kernelClient=createKernelAccountClient({
            account,
            entryPoint,
            chain,
            bundlerTransport: http(process.env.BUNDLER_RPC),
            middleware: {
                sponsorUserOperation: async ({ userOperation }) => {
                    const paymasterClient=createZeroDevPaymasterClient({
                        chain,
                        transport: http(process.env.PAYMASTER_RPC),
                        entryPoint,
                    });
                    return paymasterClient.sponsorUserOperation({
                        userOperation,
                        entryPoint,
                    });
                },
            },
        });

        const userOpHash=await kernelClient.sendUserOperation({
            userOperation: {
                callData: await kernelClient.encodeCallData({
                    to: zeroAddress,
                    value: BigInt(0),
                    data: '0x',
                }),
            },
        });

        const bundlerClient=kernelClient.extend(bundlerActions(entryPoint));
        await bundlerClient.waitForUserOperationReceipt({
            hash: userOpHash,
        });

        res.json({ hash: userOpHash });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
