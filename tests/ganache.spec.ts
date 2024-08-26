import { ethers } from 'ethers';
import { getWalletForIndex, startLocal } from './utils';
jest.setTimeout(100000);

describe('Ganache Test', () => {
    beforeAll(async () => {
        startLocal({
            rpc: 'https://rpc.ankr.com/blast/2219ac21908239838622dff2c3c105f4a7e7c487ce2591fb5af2ac09e988ebeb',
            chainId: 81457,
            startBlockNumber: 7915870,
            localPort: 8545,
        });
    });

    it('Test get native balance', async () => {
        const result = true;
        expect(result).toBe(true);
        const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
        const balance = await provider.getBalance('0x7644B015aF7f3085F9EB1ef3eD4a7d9DA57fc45e');
        expect(ethers.utils.formatEther(balance)).toBe('5039.306890297711144818');
    });

    it('Test native transfer', async () => {
        const result = true;
        expect(result).toBe(true);
        const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
        const wallet = getWalletForIndex(1).connect(provider);
        const balance = await provider.getBalance(wallet.getAddress());
        expect(ethers.utils.formatEther(balance)).toBe('100.0');
        const toAddress = getWalletForIndex(20).getAddress();
        const unsignedTx = await wallet.populateTransaction({
            to: toAddress,
            value: ethers.utils.parseEther('1'),
        });
        const res = await wallet.sendTransaction(unsignedTx);
        await res.wait();
    });
});
