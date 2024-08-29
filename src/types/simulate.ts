import type { BigNumber } from 'ethers';
import type { PositionModel } from '../models';
import type { Quotation } from './position';
import type { SimulateOrderResult, SimulateTradeResult } from './params';

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

export interface SimulateAddLiquidityWithAsymmetricRangeResult {
    tickDeltaLower: number;
    tickDeltaUpper: number;
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
    equivalentAlphaLower: BigNumber;
    equivalentAlphaUpper: BigNumber;
}

export interface SimulateRemoveLiquidityResult {
    simulatePositionRemoved: PositionModel;
    simulationMainPosition: PositionModel;
    sqrtStrikeLowerPX96: BigNumber;
    sqrtStrikeUpperPX96: BigNumber;
}

export interface SimulateAdjustMarginResult {
    transferAmount: BigNumber;
    simulationMainPosition: PositionModel;
    marginToDepositWad: BigNumber;
    leverageWad: BigNumber;
}

export interface SimulateCrossMarketOrderResult {
    canPlaceOrder: boolean;
    tradeQuotation: Quotation;
    tradeSize: BigNumber;
    orderSize: BigNumber;
    tradeSimulation: SimulateTradeResult;
    orderSimulation: SimulateOrderResult;
}

export interface SimulateBatchPlaceResult {
    orders: {
        baseSize: BigNumber;
        balance: BigNumber;
        leverageWad: BigNumber;
        minFeeRebate: BigNumber;
    }[];
    marginToDepositWad: BigNumber;
    minOrderValue: BigNumber;
}

export interface SimulateBatchOrderResult {
    orders: {
        tick: number;
        baseSize: BigNumber;
        ratio: number;
        balance: BigNumber;
        leverageWad: BigNumber;
        minFeeRebate: BigNumber;
        minOrderSize: BigNumber;
    }[];
    marginToDepositWad: BigNumber;
    minOrderValue: BigNumber;
    totalMinSize: BigNumber;
}
