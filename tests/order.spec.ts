import { addedDeadline, getWalletForIndex } from './utils';
import { ethers } from 'ethers';
import { SynFuturesV3 } from '../src';
import { WrappedNative__factory } from '@derivation-tech/web3-core';
import { inversePlugin } from '../src';
import { PERP_EXPIRY, Side } from '../build';
import { WrappedPlaceOrderRequest } from '../src/types/inverse';

jest.setTimeout(200000);
describe('Inverse plugin test', () => {
    const wallet = getWalletForIndex(2);
    async function addWthToMockAccount(): Promise<void> {
        const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
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

    it('Test simulate and placeOrder', async () => {
        const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
        const wallet1 = wallet.connect(provider);
        const synf = SynFuturesV3.getInstance(81457).use(inversePlugin());
        synf.setProvider(provider);
        await synf.cache.syncGateCacheWithAllQuotes(await wallet1.getAddress());
        const instruments = await synf.observer.fetchInstrumentBatch([
            {
                instrument: '0x379226d215509de2089103e0d5c425e54889830e',
                expiries: [PERP_EXPIRY],
            },
        ]);
        const ins = instruments[0];
        const request = new WrappedPlaceOrderRequest(
            ins.pairs.get(4294967295)!.wrap,
            wallet1.address,
            Side.LONG,
            ethers.utils.parseEther('5'),
            addedDeadline(5),
            {
                price: ethers.utils.parseUnits('0.001230093652398441'),
            },
            {
                base: ethers.utils.parseEther('100'),
            },
        );
        const simulateRes = await synf.inverse.simulatePlaceOrder(request);
        const tx = await synf.inverse.placeOrder(wallet1, request, simulateRes);
        console.log(tx);
    });
});
