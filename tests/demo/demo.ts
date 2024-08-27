import { BigNumber, Signer } from 'ethers';
import { InverseInterface } from '../../src/modules';
import { SynFuturesV3 } from '../../src/core';
import { MarketType, Side } from '../../src/types';
import {
    ITradeRequest,
    IPlaceOrderRequest,
    IAddLiquidityRequest,
    IAdjustMarginRequest,
    IRemoveLiquidityRequest,
} from './params';
import { PairModel, RangeModel, WrappedPositionModel } from '../../src/models';
import { PERP_EXPIRY } from '../../src/constants';

export async function main(): Promise<void> {
    // TODO by jinxi: replace with new sdk and inverse module entry
    const sdk = SynFuturesV3.getWrappedInstance('base');
    const inverseDemoModule = (sdk as any).inverse;

    await demoTrade(inverseDemoModule);
    await demoPlaceOrder(inverseDemoModule);
    await demoAddLiquidity(inverseDemoModule);
    await demoAdjustMargin(inverseDemoModule);
    await demoRemoveLiquidity(inverseDemoModule);
}

async function demoTrade(inverseModule: InverseInterface): Promise<void> {
    // TODO: mock position for testing, replace to the actual position
    const position = null as unknown as WrappedPositionModel;
    const signer = null as unknown as Signer;

    // input like website
    const paramsInput: ITradeRequest = {
        signer,
        side: Side.LONG,
        quoteAmount: BigNumber.from(1),
        leverage: BigNumber.from(5),
        position: position,
        traderAddr: '0x0',
        slippage: 10,
        deadline: 5,
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

    console.log('result tx:', txResult);
}

async function demoPlaceOrder(inverseModule: InverseInterface): Promise<void> {
    // TODO: mock position for testing, replace to the actual position
    const position = null as unknown as WrappedPositionModel;
    const signer = null as unknown as Signer;
    // input like website
    const paramsInput: IPlaceOrderRequest = {
        signer,
        side: Side.LONG,
        baseAmount: BigNumber.from(1),
        leverage: BigNumber.from(5),
        orderPrice: BigNumber.from(63573.183152),
        position: position,
        traderAddr: '0x0',
        deadline: 5,
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

    console.log('result tx:', txResult);
}

async function demoAddLiquidity(inverseModule: InverseInterface): Promise<void> {
    // TODO: mock signer for testing, replace to the actual signer
    const signer = null as unknown as Signer;
    // input like website
    const paramsInput: IAddLiquidityRequest = {
        signer,
        instrumentIdentifier: { baseSymbol: 'BTC', quoteSymbol: 'USDC', marketType: MarketType.LINK },
        expiry: PERP_EXPIRY,
        margin: BigNumber.from(1),
        alpha: BigNumber.from(2),
        slippage: 10,
        deadline: 5,
        traderAddr: '0x0',
    };
    const simulateResult = inverseModule.simulateAddLiquidity(paramsInput);

    // output like website
    console.log(`simulate result:`, {
        'Capital Efficiency Boost': simulateResult.capitalEfficiencyBoost,
        'Removal Price': `${simulateResult.lowerPrice}/${simulateResult.upperPrice}`,
        'Liquidation Price': `${simulateResult.lowerPosition.liquidationPrice}/${simulateResult.upperPosition.liquidationPrice}`,
        marginToDeposit: simulateResult.marginToDepositWad,
        // ...
    });

    const txResult = await inverseModule.addLiquidity(paramsInput, simulateResult);

    console.log('result tx:', txResult);
}

async function demoAdjustMargin(inverseModule: InverseInterface): Promise<void> {
    // TODO: mock position for testing, replace to the actual position
    const position = null as unknown as WrappedPositionModel;
    const signer = null as unknown as Signer;
    // input like website
    const paramsInput: IAdjustMarginRequest = {
        signer,
        transferAmount: BigNumber.from(1),
        leverage: BigNumber.from(5),
        position: position,
        traderAddr: '0x0',
        slippage: 10,
        deadline: 5,
    };
    const simulateResult = inverseModule.simulateAdjustMargin(paramsInput);

    // output like website
    console.log(`simulate result:`, {
        'Margin Required/Margin Released': simulateResult.marginToDepositWad,
        marginToDeposit: simulateResult.marginToDepositWad,
        // ...
    });

    const txResult = await inverseModule.adjustMargin(paramsInput, simulateResult);

    console.log('trade result tx:', txResult);
}

async function demoRemoveLiquidity(inverseModule: InverseInterface): Promise<void> {
    // TODO: mock signer for testing, replace to the actual signer
    const signer = null as unknown as Signer;
    const pair = null as unknown as PairModel;
    const range = null as unknown as RangeModel;
    const currentPosition = null as unknown as WrappedPositionModel;
    // input like website
    const paramsInput: IRemoveLiquidityRequest = {
        signer,
        slippage: 10,
        deadline: 5,
        traderAddr: '0x0',
        pair,
        range,
    };
    const simulateResult = inverseModule.simulateRemoveLiquidity(paramsInput);

    // output like website
    console.log(`simulate result:`, {
        'Value to be removed': simulateResult?.simulatePositionRemoved?.getEquity(),
        'Current Trading Position': currentPosition.size,
        'Liquidity Net Position': simulateResult?.simulationMainPosition.size.sub(currentPosition?.size || 0),
        'New Trading Position': simulateResult?.simulationMainPosition.size,
        Margin: simulateResult?.simulationMainPosition.getEquity(),
        Leverage: simulateResult?.simulationMainPosition.leverageWad,
        // ...
    });

    const txResult = await inverseModule.removeLiquidity(paramsInput, simulateResult);

    console.log('result tx:', txResult);
}
