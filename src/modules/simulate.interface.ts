import { BigNumber } from 'ethers';
import { PairLevelAccountModel, PairModel, RangeModel } from '../models';
import {
    BatchOrderSizeDistribution,
    InstrumentIdentifier,
    Quotation,
    Side,
    SimulateOrderResult,
    SimulateTradeResult,
    TokenInfo,
} from '../types';
import { BaseInterface } from '../common';
import {
    SimulateAddLiquidityResult,
    SimulateAddLiquidityWithAsymmetricRangeResult,
    SimulateAdjustMarginResult,
    SimulateBatchOrderResult,
    SimulateBatchPlaceResult,
    SimulateCrossMarketOrderResult,
    SimulateRemoveLiquidityResult,
} from '../types/simulate';

export interface SimulateInterface extends BaseInterface {
    simulateCrossMarketOrder(
        pairAccountModel: PairLevelAccountModel,
        targetTick: number,
        side: Side,
        baseSize: BigNumber,
        leverageWad: BigNumber,
        slippage: number,
    ): Promise<SimulateCrossMarketOrderResult>;

    simulateOrder(
        pairAccountModel: PairLevelAccountModel,
        targetTick: number,
        baseSize: BigNumber,
        side: Side,
        leverageWad: BigNumber,
    ): SimulateOrderResult;

    // TODO: @samlior rename symbol
    simulateOrder2(
        pairModel: PairModel,
        traderAddr: string,
        targetTick: number,
        baseSize: BigNumber,
        side: Side,
        leverageWad: BigNumber,
    ): SimulateOrderResult;

    simulateBatchPlace(
        pairAccountModel: PairLevelAccountModel,
        targetTicks: number[],
        ratios: number[],
        baseSize: BigNumber,
        side: Side,
        leverageWad: BigNumber,
    ): SimulateBatchPlaceResult;

    simulateBatchOrder(
        pairAccountModel: PairLevelAccountModel,
        lowerTick: number,
        upperTick: number,
        orderCount: number,
        sizeDistribution: BatchOrderSizeDistribution,
        baseSize: BigNumber,
        side: Side,
        leverageWad: BigNumber,
    ): SimulateBatchOrderResult;

    simulateTrade(
        pairAccountModel: PairLevelAccountModel,
        quotation: Quotation,
        side: Side,
        baseSize: BigNumber,
        margin: BigNumber | undefined,
        leverageWad: BigNumber | undefined,
        slippage: number,
    ): SimulateTradeResult;

    simulateAdjustMargin(
        pairAccountModel: PairLevelAccountModel,
        transferAmount: BigNumber | undefined,
        leverageWad: BigNumber | undefined,
    ): SimulateAdjustMarginResult;

    simulateBenchmarkPrice(instrumentIdentifier: InstrumentIdentifier, expiry: number): Promise<BigNumber>;

    simulateAddLiquidity(
        targetAddress: string,
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
        alphaWad: BigNumber,
        margin: BigNumber,
        slippage: number,
        currentSqrtPX96?: BigNumber,
    ): Promise<SimulateAddLiquidityResult>;

    simulateAddLiquidityWithAsymmetricRange(
        targetAddress: string,
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
        alphaWadLower: BigNumber,
        alphaWadUpper: BigNumber,
        margin: BigNumber,
        slippage: number,
        currentSqrtPX96?: BigNumber,
    ): Promise<SimulateAddLiquidityWithAsymmetricRangeResult>;

    simulateRemoveLiquidity(
        pairAccountModel: PairLevelAccountModel,
        rangeModel: RangeModel,
        slippage: number,
    ): SimulateRemoveLiquidityResult;

    marginToDepositWad(
        traderAddress: string,
        quoteInfo: TokenInfo,
        marginNeedWad: BigNumber,
        balanceInVaultWadOverride?: BigNumber,
    ): BigNumber;
}
