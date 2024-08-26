import { BigNumber } from 'ethers';
import { InverseInterface, InverseModule } from './modules';
import { SynFuturesV3 } from './synfuturesV3Core';
import { ITradeRequest, Side } from './types';

export async function main(): Promise<void> {
    const sdk = SynFuturesV3.getInstance('base');
    const inverseDemoModule = new InverseModule(sdk) as InverseInterface;

    await demoTrade(inverseDemoModule);
}

async function demoTrade(inverseModule: InverseInterface): Promise<void> {
    // input like website
    const paramsInput: ITradeRequest = {
        side: Side.LONG,
        quoteAmount: BigNumber.from(1),
        leverage: BigNumber.from(5),
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
