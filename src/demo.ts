import { BigNumber } from 'ethers';
import { InverseInterface, InverseModule } from './modules';
import { SynFuturesV3 } from './synfuturesV3Core';
import { ITradeRequest, Side, IPlaceOrderRequest } from './types';
import { WrappedPositionModel } from './models';

export async function main(): Promise<void> {
    const sdk = SynFuturesV3.getInstance('base');
    const inverseDemoModule = new InverseModule(sdk) as InverseInterface;

    await demoTrade(inverseDemoModule);
    await demoPlaceOrder(inverseDemoModule);
}

async function demoTrade(inverseModule: InverseInterface): Promise<void> {
    // TODO: mock position for testing, replace to the actual position
    const position = null as unknown as WrappedPositionModel;

    // input like website
    const paramsInput: ITradeRequest = {
        side: Side.LONG,
        quoteAmount: BigNumber.from(1),
        leverage: BigNumber.from(5),
        position: position,
        traderAddr: '0x0',
    };
    const simulateResult = inverseModule.simulateTrade(paramsInput);

    // output like website
    console.log(`simulate result:`, {
        'Margin Required': simulateResult.margin,
        'Price Impact': simulateResult.priceImpactWad,
        'Est. Trade Value': simulateResult.estimatedTradeValue,
        'Trading Fee': simulateResult.tradingFee,
        'Additional Fee': simulateResult.stabilityFee,
        marginToDeposit: simulateResult.marginToDepositWad,
        // simulate position
        'Liquidation Price': simulateResult.simulationMainPosition.liquidationPrice,
        'Average Price': simulateResult.simulationMainPosition.entryPrice,
        leverage: simulateResult.simulationMainPosition.leverageWad,
        // ...
    });

    const txResult = await inverseModule.trade(paramsInput, simulateResult);

    console.log('trade result tx:', txResult);
}

async function demoPlaceOrder(inverseModule: InverseInterface): Promise<void> {
    // TODO: mock position for testing, replace to the actual position
    const position = null as unknown as WrappedPositionModel;
    // input like website
    const paramsInput: IPlaceOrderRequest = {
        side: Side.LONG,
        baseAmount: BigNumber.from(1),
        leverage: BigNumber.from(5),
        orderPrice: BigNumber.from(63573.183152),
        position: position,
        traderAddr: '0x0',
    };
    const simulateResult = inverseModule.simulatePlaceOrder(paramsInput);

    // output like website
    console.log(`simulate result:`, {
        'Margin Required': simulateResult.marginRequired,
        'Est. Trade Value': simulateResult.estimatedTradeValue,
        'Fee Rebate': simulateResult.minFeeRebate,
        marginToDeposit: simulateResult.marginToDepositWad,
        // ...
    });

    const txResult = await inverseModule.placeOrder(paramsInput, simulateResult);

    console.log('trade result tx:', txResult);
}
