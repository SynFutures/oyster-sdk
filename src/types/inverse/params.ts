import { BigNumber, Signer } from 'ethers';
import { Side } from '../enum';
import { PositionModel, WrappedPositionModel } from '../../models';
import { InstrumentIdentifier, SimulateOrderResult, SimulateTradeResult } from '../params';

export interface ITradeRequest {
    signer: Signer;
    position: WrappedPositionModel;
    traderAddr: string;
    side: Side; // side choose from website
    slippage: number;
    deadline: number;

    // [size] from website
    baseAmount?: BigNumber; // base size input from website
    quoteAmount?: BigNumber; // input by quote will calculate base amount send to deep module

    // [Adjust Margin] by leverage or margin
    leverage?: BigNumber; // leverage input from website
    margin?: BigNumber; // margin input from website

    // referral
    referralCode?: string;
}

export interface ISimulateTradeResult extends SimulateTradeResult {
    origin: SimulateTradeResult; // origin result
    tradePrice: BigNumber; // [modify] inverse display
    simulationMainPosition: WrappedPositionModel; // [modify] wrapped model
}

export interface IPlaceOrderRequest {
    signer: Signer;
    position: WrappedPositionModel;
    traderAddr: string;
    side: Side; // side choose from website
    leverage: BigNumber; // leverage input from website
    deadline: number;

    // [price] from website
    orderTick?: number; // need align input price to tick
    orderPrice?: BigNumber; // or pass price to sdk to calculate

    // [size] from website
    baseAmount?: BigNumber; // base size input from website
    quoteAmount?: BigNumber; // input by quote will calculate base amount send to deep module

    // referral
    referralCode?: string;
}

export interface ISimulatePlaceOrderResult extends SimulateOrderResult {
    origin: SimulateOrderResult; // origin result
    marginRequired: BigNumber; // [add] equal to balance from SimulateOrderResult
    estimatedTradeValue: BigNumber; // [add] estimated TradeValue for this order
}

export interface IAddLiquidityRequest {
    signer: Signer;
    traderAddr: string;
    instrumentIdentifier: InstrumentIdentifier;
    expiry: number;
    margin: BigNumber;
    alpha: BigNumber;
    slippage: number;
    deadline: number;
    currentSqrtPX96?: BigNumber;
    // referral
    referralCode?: string;
}

// TODO:  old sdk result has no type
export interface SimulateAddLiquidityResult {
    tickDelta: number;
    liquidity: BigNumber;
    upperPrice: BigNumber;
    lowerPrice: BigNumber;
    lowerPosition: PositionModel;
    lowerLeverageWad: BigNumber;
    upperPosition: PositionModel;
    upperLeverageWad: BigNumber;
    sqrtStrikeLowerPX96: BigNumber;
    sqrtStrikeUpperPX96: BigNumber;
    marginToDepositWad: BigNumber;
    minMargin: BigNumber;
    minEffectiveQuoteAmount: BigNumber;
    equivalentAlpha: BigNumber;
}

export interface ISimulateAddLiquidityResult extends SimulateAddLiquidityResult {
    origin: SimulateAddLiquidityResult; // origin result
    lowerPrice: BigNumber; // [modify] inverse display
    upperPrice: BigNumber; // [modify] inverse display
    lowerPosition: WrappedPositionModel; // [modify] inverse display
    upperPosition: WrappedPositionModel; // [modify] inverse display
    lowerLeverageWad: BigNumber; // [modify] inverse display
    upperLeverageWad: BigNumber; // [modify] inverse display
    capitalEfficiencyBoost: number; // [add] calcBoost() result
}
