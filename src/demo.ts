import { BigNumber, Signer } from 'ethers';
import { InverseInterface, InverseModule } from './modules';
import { SynFuturesV3 } from './synfuturesV3Core';
import {
    ITradeRequest,
    Side,
    IPlaceOrderRequest,
    IAddLiquidityRequest,
    MarketType,
    IAdjustMarginRequest,
    IRemoveLiquidityRequest,
    ICrossMarketOrderRequest,
    IBatchCancelOrderRequest,
} from './types';
import { PairModel, RangeModel, WrappedOrderModel, WrappedPositionModel } from './models';
import { PERP_EXPIRY } from './constants';

export async function main(): Promise<void> {
    // TODO by jinxi: replace with new sdk and inverse module entry
    const sdk = SynFuturesV3.getInstance('base');
    const inverseDemoModule = new InverseModule(sdk) as InverseInterface;

    await demoTrade(inverseDemoModule);
    await demoPlaceOrder(inverseDemoModule);
    await demoAddLiquidity(inverseDemoModule);
    await demoAdjustMargin(inverseDemoModule);
    await demoRemoveLiquidity(inverseDemoModule);
    await demoBatchCancelOrder(inverseDemoModule);
    await demoCrossMarketOrder(inverseDemoModule);
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

async function demoBatchCancelOrder(inverseModule: InverseInterface): Promise<void> {
    // TODO: mock signer for testing, replace to the actual signer
    const signer = null as unknown as Signer;
    const pair = null as unknown as PairModel;
    const ordersToCancel = null as unknown as WrappedOrderModel[];
    // input like website
    const paramsInput: IBatchCancelOrderRequest = {
        signer,
        pair,
        ordersToCancel: ordersToCancel,
        deadline: 5,
    };

    const txResult = await inverseModule.batchCancelOrder(paramsInput);

    console.log('result tx:', txResult);
}

async function demoCrossMarketOrder(inverseModule: InverseInterface): Promise<void> {
    // TODO: mock position for testing, replace to the actual position
    const position = null as unknown as WrappedPositionModel;
    const signer = null as unknown as Signer;

    const side = Side.LONG;
    // input like website
    const paramsInput: ICrossMarketOrderRequest = {
        signer,
        side: side,
        baseAmount: BigNumber.from(1),
        leverage: BigNumber.from(5),
        orderPrice: BigNumber.from(63573.183152),
        position: position,
        traderAddr: '0x0',
        slippage: 10,
        deadline: 5,
    };
    const simulateResult = inverseModule.simulateCrossMarketOrder(paramsInput);

    // output like website
    console.log(`simulate result:`, {
        MarketTrade: {
            Title: `A market trade for ${side} ${simulateResult.tradeSize} will be executed at ${simulateResult.tradeSimulation.tradePrice}.`,
            'Margin Required': `${simulateResult.tradeSimulation.margin}`,
            'Est. P&L': simulateResult.tradeSimulation.realized,
            'Price Impact': simulateResult.tradeSimulation.priceImpactWad,
            'Est. Trade Value': simulateResult.tradeSimulation.estimatedTradeValue,
            'Trading Fee': simulateResult.tradeSimulation.tradingFee,
            'Additional Fee': simulateResult.tradeSimulation.stabilityFee,
            marginToDeposit: simulateResult.tradeSimulation.marginToDepositWad,
        },
        OrderTrade: {
            Title: `A limit order for ${side} ${simulateResult.orderSize} will be placed at ${simulateResult.orderSimulation.limitPrice}.`,
            'Margin Required': `${simulateResult.orderSimulation.marginRequired}`,
            'Est. Trade Value': simulateResult.orderSimulation.estimatedTradeValue,
            'Fee Rebate': simulateResult.orderSimulation.minFeeRebate,
            marginToDeposit: simulateResult.orderSimulation.marginToDepositWad,
        },
        // ...
    });

    const txResult = await inverseModule.placeCrossMarketOrder(paramsInput, simulateResult);

    console.log('result tx:', txResult);
}
