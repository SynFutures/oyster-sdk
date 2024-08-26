import { BigNumber, ethers, PayableOverrides, Signer } from 'ethers';
import { PairLevelAccountModel, PairModel, PositionModel, RangeModel } from '../models';
import {
    BaseInterface,
    BatchOrderSizeDistribution,
    InstrumentIdentifier,
    Quotation,
    Side,
    SimulateOrderResult,
    SimulateTradeResult,
    TokenInfo,
} from '../types';
import { InterfaceImplementationMissingError } from '../errors/interfaceImplementationMissing.error';

export interface SimulateInterface extends BaseInterface {
    placeCrossMarketOrder(
        signer: Signer,
        pair: PairModel,
        side: Side,

        swapSize: BigNumber,
        swapMargin: BigNumber,
        swapTradePrice: BigNumber,

        orderTickNumber: number,
        orderBaseWad: BigNumber,
        orderMargin: BigNumber,

        slippage: number,
        deadline: number,
        referralCode?: string,
        overrides?: PayableOverrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    simulateCrossMarketOrder(
        pairAccountModel: PairLevelAccountModel,
        targetTick: number,
        side: Side,
        baseSize: BigNumber,
        leverageWad: BigNumber,
        slippage: number,
    ): Promise<{
        canPlaceOrder: boolean;
        tradeQuotation: Quotation;
        tradeSize: BigNumber;
        orderSize: BigNumber;
        tradeSimulation: SimulateTradeResult;
        orderSimulation: SimulateOrderResult;
    }>;

    simulateOrder(
        pairAccountModel: PairLevelAccountModel,
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
    ): {
        orders: {
            baseSize: BigNumber;
            balance: BigNumber;
            leverageWad: BigNumber;
            minFeeRebate: BigNumber;
        }[];
        marginToDepositWad: BigNumber;
        minOrderValue: BigNumber;
    };

    simulateBatchOrder(
        pairAccountModel: PairLevelAccountModel,
        lowerTick: number,
        upperTick: number,
        orderCount: number,
        sizeDistribution: BatchOrderSizeDistribution,
        baseSize: BigNumber,
        side: Side,
        leverageWad: BigNumber,
    ): {
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
    };

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
    ): {
        transferAmount: BigNumber;
        simulationMainPosition: PositionModel;
        marginToDepositWad: BigNumber;
        leverageWad: BigNumber;
    };

    simulateBenchmarkPrice(instrumentIdentifier: InstrumentIdentifier, expiry: number): Promise<BigNumber>;

    simulateAddLiquidity(
        targetAddress: string,
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
        alphaWad: BigNumber,
        margin: BigNumber,
        slippage: number,
        currentSqrtPX96?: BigNumber,
    ): Promise<{
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
    }>;

    simulateAddLiquidityWithAsymmetricRange(
        targetAddress: string,
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
        alphaWadLower: BigNumber,
        alphaWadUpper: BigNumber,
        margin: BigNumber,
        slippage: number,
        currentSqrtPX96?: BigNumber,
    ): Promise<{
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
    }>;

    simulateRemoveLiquidity(
        pairAccountModel: PairLevelAccountModel,
        rangeModel: RangeModel,
        slippage: number,
    ): {
        simulatePositionRemoved: PositionModel;
        simulationMainPosition: PositionModel;
        sqrtStrikeLowerPX96: BigNumber;
        sqrtStrikeUpperPX96: BigNumber;
    };

    marginToDepositWad(
        traderAddress: string,
        quoteInfo: TokenInfo,
        marginNeedWad: BigNumber,
        balanceInVaultWadOverride?: BigNumber,
    ): BigNumber;
}

export function createNullSimulateModule(): SimulateInterface {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const errorHandler = () => {
        throw new InterfaceImplementationMissingError('SimulateInterface', 'simulate');
    };
    return {
        synfV3: null as never,
        simulateOrder: errorHandler,
        simulateBatchPlace: errorHandler,
        simulateBatchOrder: errorHandler,
        simulateTrade: errorHandler,
        simulateAdjustMargin: errorHandler,
        simulateBenchmarkPrice: errorHandler,
        simulateAddLiquidity: errorHandler,
        simulateAddLiquidityWithAsymmetricRange: errorHandler,
        simulateRemoveLiquidity: errorHandler,
        marginToDepositWad: errorHandler,
        placeCrossMarketOrder: errorHandler,
        simulateCrossMarketOrder: errorHandler,
    };
}
