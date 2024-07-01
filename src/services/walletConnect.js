import { createWalletClient, custom } from 'viem';
import { mainnet } from 'viem/chains';

export async function connectWallet() {
    if (!window.ethereum) {
        alert('Please install MetaMask');
        return null;
    }

    try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });

        const walletClient=createWalletClient({
            chain: mainnet,
            transport: custom(window.ethereum)
        });

        const [address]=await walletClient.getAddresses();

        return { walletClient, account: address };
    } catch (error) {
        console.error('Failed to connect wallet:', error);
        return null;
    }
}
