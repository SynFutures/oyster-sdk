import { BigNumber } from 'ethers';
import { Side } from '../enum';
import { WrappedPositionModel } from '../../models';
import { SimulateOrderResult, SimulateTradeResult } from '../params';

export interface ITradeRequest {
    position: WrappedPositionModel;
    traderAddr: string;
    side: Side; // side choose from website

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
    position: WrappedPositionModel;
    traderAddr: string;
    side: Side; // side choose from website
    leverage: BigNumber; // leverage input from website

    // [price] from website
    orderTick?: number; // need align input price to tick
    orderPrice?: BigNumber; // or pass price to sdk to calculate

    // [size] from website
    baseAmount?: BigNumber; // base size input from website
    quoteAmount?: BigNumber; // input by quote will calculate base amount send to deep module
}

export interface ISimulatePlaceOrderResult extends SimulateOrderResult {
    origin: SimulateOrderResult; // origin result
    marginRequired: BigNumber; // [add] equal to balance from SimulateOrderResult
    estimatedTradeValue: BigNumber; // [add] estimated TradeValue for this order
}
