import { addedDeadline, getWalletForIndex } from './utils';
import { ethers } from 'ethers';
import { WrappedNative__factory } from '@derivation-tech/web3-core';
import { InstrumentModel, SynFuturesV3 } from '../src';

jest.setTimeout(200000);
describe('Gate plugin Test', () => {
    const wallet = getWalletForIndex(1);
    async function addWthToMockAccount(): Promise<void> {
        const provider = new ethers.providers.JsonRpcProvider('http://34.92.80.193:8545');
        const synf = SynFuturesV3.getInstance(81457);
        synf.setProvider(provider);
        const wallet1 = wallet.connect(provider);
        const weth = WrappedNative__factory.connect('0x4300000000000000000000000000000000000004', wallet1);
        const tx = await weth.deposit({ value: ethers.utils.parseEther('1') });
        await tx.wait();
        const approveTx = await weth.approve(synf.contracts.gate.address, ethers.constants.MaxUint256);
        await approveTx.wait();
    }

    beforeAll(async () => {
        await addWthToMockAccount();
    });

    it('Add liquidity', async () => {
        const provider = new ethers.providers.JsonRpcProvider('http://34.92.80.193:8545');
        const wallet1 = wallet.connect(provider);
        const synf = SynFuturesV3.getInstance(81457);
        synf.setProvider(provider);
        await synf.init();
        const ins = synf.cache.instrumentMap.get('0x379226d215509de2089103e0d5c425e54889830e') as InstrumentModel;
        await synf.syncGateCache(wallet1.address, [ins?.info.quote.address]);
        const instrumentIdentifier = {
            marketType: ins?.marketType,
            baseSymbol: ins?.info.base,
            quoteSymbol: ins?.info.quote,
        };
        const simRes = await synf.simulate.simulateAddLiquidity(
            wallet1.address,
            instrumentIdentifier,
            4294967295,
            ethers.utils.parseEther('2'),
            ethers.utils.parseEther('1'),
            5,
            ins.getPairModel(4294967295).amm.sqrtPX96,
        );
        const addLiquidityTx = await synf.addLiquidity(
            wallet1,
            instrumentIdentifier,
            4294967295,
            simRes.tickDelta,
            ethers.utils.parseEther('1'),
            simRes.sqrtStrikeLowerPX96,
            simRes.sqrtStrikeUpperPX96,
            addedDeadline(5),
        );
        console.log(addLiquidityTx);
    });

    it('Get position', async () => {
        const provider = new ethers.providers.JsonRpcProvider('http://34.92.80.193:8545');
        const wallet1 = wallet.connect(provider);
        const synf = SynFuturesV3.getInstance(81457);
        synf.setProvider(provider);
        await synf.init();
        const portfolio = await synf.getInstrumentLevelAccounts(wallet1.address);
        console.log(portfolio);
    });
});
