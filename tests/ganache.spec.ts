import { ethers } from 'ethers';
import { getWalletForIndex } from './utils';
jest.setTimeout(100000);

describe('Ganache Test', () => {
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
