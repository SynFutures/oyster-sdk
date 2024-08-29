import { ethers } from 'ethers';
import { PERP_EXPIRY, SynFuturesV3, Side } from '../src/';
import { WrappedPlaceOrderRequest } from '../src/types/advanced';

async function main() {
    const sdk = SynFuturesV3.getWrappedInstance('base');

    const signer = await sdk.ctx.getSigner('SAMLIOR');

    console.log('signer address:', await signer.getAddress());

    const instruments = await sdk.fetchInstrumentBatch([
        {
            // WETH-DEGEN-LINK
            instrument: '0x75da1f73fa85ce885fd209e34d6d9334ecaff14f',
            expiries: [PERP_EXPIRY],
        },
    ]);

    const instrument = instruments[0];

    const pair = instrument.getPairModel(PERP_EXPIRY);

    const leverage = ethers.utils.parseUnits('5');

    await sdk.syncGateCacheWithAllQuotes(await signer.getAddress());

    const request = new WrappedPlaceOrderRequest({
        pair,
        traderAddr: await signer.getAddress(),
        side: Side.LONG,
        leverage,
        priceInfo: { price: ethers.utils.parseUnits('0.00000150') },
        amountInfo: { base: ethers.utils.parseUnits('0.0037') },
    });

    const simulateResult = await sdk.order.simulatePlaceOrder(request);

    console.log('baseSize:', ethers.utils.formatUnits(simulateResult.baseSize));
    console.log('marginRequired:', ethers.utils.formatUnits(simulateResult.marginRequired));
    console.log('estimatedTradeValue:', ethers.utils.formatUnits(simulateResult.estimatedTradeValue));
    console.log('leverageWad:', ethers.utils.formatUnits(simulateResult.leverageWad));
    console.log('marginToDepositWad:', ethers.utils.formatUnits(simulateResult.marginToDepositWad));
    console.log('minOrderValue:', ethers.utils.formatUnits(simulateResult.minOrderValue));
    console.log('limitPrice:', ethers.utils.formatUnits(simulateResult.limitPrice));

    const receipt = await sdk.order.placeOrder(signer, request, Math.floor(Date.now() / 1000) + 300, simulateResult);

    console.log('transactionHash:', (receipt as any).transactionHash);
}

main().catch(console.error);
