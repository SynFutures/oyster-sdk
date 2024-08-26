import { BigNumber } from 'ethers';
import { Side } from '../enum';
import { WrappedPositionModel } from '../../models';
import { SimulateTradeResult } from '../params';

export interface ITradeRequest {
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
    tradePrice: BigNumber; // inverse display
    simulationMainPosition: WrappedPositionModel; // wrapped model
}
