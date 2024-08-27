import { ethers } from 'ethers';
import { SynFuturesV3 } from '../src';
import { getWalletForIndex, startLocal } from './utils';
import { WrappedNative__factory } from '@derivation-tech/web3-core';

jest.setTimeout(100000);
describe('Gate plugin Test', () => {
    beforeAll(async () => {
        startLocal({
            rpc: 'https://rpc.ankr.com/blast/2219ac21908239838622dff2c3c105f4a7e7c487ce2591fb5af2ac09e988ebeb',
            chainId: 81457,
            startBlockNumber: 7915870,
            localPort: 8545,
        });
    });

    it('Test get positions', async () => {
        const address = '0x5886dc296336cc01e6c7257676171170795e8cbc';
        const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
        const synf = SynFuturesV3.getInstance(81457);
        synf.setProvider(provider);
        await synf.init();
        const portfolio = await synf.getInstrumentLevelAccounts(address);
        expect(portfolio.length).toBe(1);
    });

    it('Test Deposit and withdraw', async () => {
        const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
        const synf = SynFuturesV3.getInstance(81457);
        synf.setProvider(provider);
        const wallet = getWalletForIndex(1).connect(provider);
        const weth = WrappedNative__factory.connect('0x4300000000000000000000000000000000000004', wallet);
        const tx = await weth.deposit({ value: ethers.utils.parseEther('1') });
        await tx.wait();
        let wethBalance = await weth.balanceOf(wallet.address);
        expect(wethBalance.toString()).toBe('1000000000000000000');
        const approveTx = await weth.approve(synf.contracts.gate.address, ethers.constants.MaxUint256);
        await approveTx.wait();
        await synf.gate.deposit(wallet, weth.address, ethers.utils.parseEther('1'));
        wethBalance = await weth.balanceOf(wallet.address);
        expect(wethBalance.toString()).toBe('0');
        await synf.gate.withdraw(wallet, weth.address, ethers.utils.parseEther('1'));
        wethBalance = await weth.balanceOf(wallet.address);
        expect(wethBalance.toString()).toBe('1000000000000000000');
    });
});
