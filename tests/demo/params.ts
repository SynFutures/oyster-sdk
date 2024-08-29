import { BigNumber, Signer, Overrides, CallOverrides } from 'ethers';
import { BatchOrderSizeDistribution, Side } from '../../src/types/enum';
import {
    PairModel,
    PositionModel,
    RangeModel,
    WrappedPositionModel,
    WrappedOrderModel,
    InstrumentLevelAccountModel,
} from '../../src/models';
import {
    InstrumentIdentifier,
    InstrumentPointConfigParam,
    SimulateOrderResult,
    SimulateTradeResult,
} from '../../src/types/params';
import { Quotation } from '../../src/types';
import { BlockInfo } from '@derivation-tech/web3-core';

export interface ITradeRequest {
    signer: Signer;
    position: WrappedPositionModel;
    traderAddr: string;
    side: Side; // side choose from website
    slippage: number;
    deadline: number;

    // [size] from website, input baseAmount or quoteAmount
    baseAmount?: BigNumber; // base size input from website
    quoteAmount?: BigNumber; // input by quote will calculate base amount send to deep module

    // [Adjust Margin] by leverage or margin, input leverage or margin
    leverage?: BigNumber; // leverage input from website
    margin?: BigNumber; // margin input from website

    // referral
    referralCode?: string;
}

// TODO: Result class with unWrap()/wrap() @sam
export interface ISimulateTradeResult extends SimulateTradeResult {
    origin: SimulateTradeResult; // origin result
    tradePrice: BigNumber; // [modify] inverse display
    simulationMainPosition: WrappedPositionModel; // [modify] wrapped model
}

export interface IPlaceOrderRequest {
    signer: Signer;
    position: WrappedPositionModel; // TODO by @jinxi: or pair?
    traderAddr: string;
    side: Side; // side choose from website
    leverage: BigNumber; // leverage input from website
    deadline: number;

    // [price] from website, input orderTick or orderPrice
    orderTick?: number; // need align input price to tick
    orderPrice?: BigNumber; // or pass price to sdk to calculate

    // [size] from website, input baseAmount or quoteAmount
    baseAmount?: BigNumber; // base size input from website
    quoteAmount?: BigNumber; // input by quote will calculate base amount send to deep module

    // referral
    referralCode?: string;
}

// TODO: Result class with unWrap()/wrap() @sam
export interface ISimulatePlaceOrderResult extends SimulateOrderResult {
    origin: SimulateOrderResult; // origin result
    marginRequired: BigNumber; // [add] equal to balance from SimulateOrderResult, TOOD by @jinxi, maybe rename old [balance]?
    estimatedTradeValue: BigNumber; // [add] estimated TradeValue for this order
    limitPrice: BigNumber; // [add] TickMath.getWadAtTick(tickNumber)
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

// TODO:  old sdk result has no type, need add to type
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

// TODO: Result class with unWrap()/wrap() @sam
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

export interface IAdjustMarginRequest {
    signer: Signer;
    position: WrappedPositionModel;
    traderAddr: string;
    slippage: number;
    deadline: number;

    // [amount] from website
    transferAmount?: BigNumber; // positive for [transfer in] and negative for [transfer out]
    leverage?: BigNumber; // bigger then current for [transfer out], less then current current for [transfer in]

    // referral
    referralCode?: string;
}

// TODO:  old sdk result has no type, need add to type
interface AdjustMarginResult {
    transferAmount: BigNumber;
    simulationMainPosition: PositionModel;
    marginToDepositWad: BigNumber;
    leverageWad: BigNumber;
}

// TODO: Result class with unWrap()/wrap() @sam
export interface ISimulateAdjustMarginResult extends AdjustMarginResult {
    origin: AdjustMarginResult; // origin result
    simulationMainPosition: WrappedPositionModel; // [modify] inverse display
}

export interface IRemoveLiquidityRequest {
    signer: Signer;
    traderAddr: string;
    slippage: number;
    deadline: number;
    pair: PairModel; // TODO by @jinxi, maybe WrappedPairModel?
    range: RangeModel; // TODO by @jinxi, maybe WrappedRangeModel?
}

// TODO:  old sdk result has no type, need add to type

export interface RemoveLiquidityResult {
    simulatePositionRemoved: PositionModel;
    simulationMainPosition: PositionModel;
    sqrtStrikeLowerPX96: BigNumber;
    sqrtStrikeUpperPX96: BigNumber;
}

export interface IRemoveLiquidityResult extends RemoveLiquidityResult {
    origin: RemoveLiquidityResult; // origin result
    simulatePositionRemoved: WrappedPositionModel; // [modify] inverse display
    simulationMainPosition: WrappedPositionModel; // [modify] inverse display
    sqrtStrikeLowerPX96: BigNumber; // [modify] inverse display
    sqrtStrikeUpperPX96: BigNumber; // [modify] inverse display
}

export interface IBatchPlaceScaledLimitOrderRequest {
    signer: Signer;
    position: WrappedPositionModel; // TODO by @jinxi: or pair?
    traderAddr: string;
    side: Side; // side choose from website
    leverage: BigNumber; // leverage input from website
    deadline: number;

    // [lower price] from website, input price or tick
    lowerTick?: number; // tick for lower
    lowerPrice?: BigNumber; // price from website

    // [upper price] from website, input price or tick
    upperTick?: number; // tick for upper
    upperPrice?: BigNumber; // price from website

    orderCount: number;
    sizeDistribution: BatchOrderSizeDistribution;

    // [size] from website, input baseAmount or quoteAmount
    baseAmount?: BigNumber; // base size input from website
    quoteAmount?: BigNumber; // input by quote will calculate base amount send to deep module
}

// TODO:  old sdk result has no type, need add to type
interface BatchPlaceScaledLimitOrderResult {
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

export interface IBatchPlaceScaledLimitOrderResult extends BatchPlaceScaledLimitOrderResult {
    orders: {
        tick: number;
        baseSize: BigNumber;
        ratio: number;
        balance: BigNumber;
        leverageWad: BigNumber;
        minFeeRebate: BigNumber;
        minOrderSize: BigNumber;
        tradeValue: BigNumber; // [add] tick price * baseSize
    }[];
}

export interface IBatchCancelOrderRequest {
    signer: Signer;
    pair: PairModel; // TODO by @jinxi, maybe WrappedPairModel?
    ordersToCancel: WrappedOrderModel[];
    deadline: number;
}

export interface ICrossMarketOrderRequest {
    signer: Signer;
    traderAddr: string;
    position: WrappedPositionModel; // TODO by @jinxi: or pair?
    side: Side;
    leverage: BigNumber;
    slippage: number;
    deadline: number;

    // [price] from website, input orderTick or orderPrice
    orderTick?: number; // need align input price to tick
    orderPrice?: BigNumber; // or pass price to sdk to calculate

    // [size] from website, input baseAmount or quoteAmount
    baseAmount?: BigNumber; // base size input from website
    quoteAmount?: BigNumber; // input by quote will calculate base amount send to deep module
}

interface CrossMarketOrderResult {
    canPlaceOrder: boolean;
    tradeQuotation: Quotation;
    tradeSize: BigNumber;
    orderSize: BigNumber;
    tradeSimulation: SimulateTradeResult;
    orderSimulation: SimulateOrderResult;
}
export interface ICrossMarketOrderResult extends CrossMarketOrderResult {
    origin: CrossMarketOrderResult; // origin result
    tradeSimulation: ISimulateTradeResult; // [modify] inverse display
    orderSimulation: ISimulatePlaceOrderResult; // [modify] inverse display
    totalMinSize: BigNumber; // [add] tradeSize + orderSize
}

export interface Pagination {
    page?: number;
    size?: number;
}
export interface QueryParam extends Pagination {
    traders?: string[];
    instrumentAddr?: string;
    expiry?: number;
    startTs?: number;
    endTs?: number;
    referralCode?: string;
}

export interface VirtualTrade {
    txHash: string;
    timestamp: number;
    blockNumber: number;
    logIndex: number;
    trader: string;
    instrumentAddr: string;
    expiry: number;
    size: BigNumber;
    price: BigNumber;
    tradeValue: BigNumber;
    fee: BigNumber;
    stablityFee: BigNumber;
    // type: VirtualTradeType;
    isRangeLiquidated?: boolean;
    referralCode?: string;
}

export interface IVirtualTrade extends VirtualTrade {
    origin: VirtualTrade; // origin result
    price: BigNumber; // [modify] inverse display
    side: Side; // [add] inverse display
}
export interface FundingHistory {
    timestamp?: number;
    instrumentAddr?: string;
    expiry?: number;
    trader: string;
    funding: BigNumber;
    type: 'Receive' | 'Pay';
    txHash: string;
    //   pair?: WrappedPair;
    logIndex: number;
}
export interface IFundingHistory extends FundingHistory {
    origin: FundingHistory;
}
export interface TransferHistory {
    timestamp?: number;
    instrumentAddr?: string;
    expiry?: number;
    quoteAddr: string;
    trader: string;
    amount: BigNumber;
    isTransferIn: boolean;
    txHash: string;
    //   pair?: WrappedPair;
    logIndex: number;
}
export interface ITransferHistory extends TransferHistory {
    origin: TransferHistory;
}
export interface UserOrder {
    trader: string;
    instrumentAddr: string;
    expiry: number;
    tick: number;
    size: BigNumber;
    filledSize: BigNumber;
    price: BigNumber;
    fee: BigNumber;
    createdTimestamp: number;
    timestamp: number;
    // status: OrderStatus;
    placeTxHash: string;
    placeTxLogIndex: number;
    fillTxHash?: string;
    fillTxLogIndex?: number;
    cancelTxHash?: string;
    cancelTxLogIndex?: number;
    referralCode?: string;
    txHash: string;
    //   pair?: WrappedPair;
    logIndex?: number;
}
export interface IOrderHistory extends UserOrder {
    origin: UserOrder;
    side: Side; // [add] inverse display
    price: BigNumber; // [modify] inverse display
    tradeValue: BigNumber; // [add] price * size. different from status, [OrderStatus.CANCELLED]:price(from tick) * size, [OrderStatus.OPEN||OrderStatus.FILLED]:price * filledSize
}

export interface LiquidityHistory {
    timestamp?: number;
    instrumentAddr?: string;
    expiry?: number;
    trader: string;
    priceRangeMin: BigNumber;
    priceRangeMax: BigNumber;
    amount: BigNumber;
    feeEarned?: BigNumber;
    logIndex: number;
    type: 'Add' | 'Remove';
    //   pair?: WrappedPair;
    fairPrice: BigNumber;
    txHash: string;
    operator: string;
}
export interface ILiquidityHistory extends LiquidityHistory {
    origin: LiquidityHistory;
    priceRangeMin: BigNumber; // [modify] inverse display, and use priceRangeMax to calculate
    priceRangeMax: BigNumber; // [modify] inverse display, and use priceRangeMin to calculate
    fairPrice: BigNumber; // [modify] inverse display
}

export interface AccountBalanceHistory {
    timestamp?: number;
    quoteAddr: string;
    trader: string;
    amount: BigNumber;
    txHash: string;
    logIndex: number;
}
export interface IAccountBalanceHistory extends AccountBalanceHistory {
    origin: AccountBalanceHistory;
}

export interface IOdysseySimulatePortfolioPointPerDayRequest {
    portfolio: InstrumentLevelAccountModel[];
    accountBoost: number;
    pointConfigMetaMap: Map<string, InstrumentPointConfigParam>;
}

export interface IOdysseySimulateRangePointPerDayRequest {
    instrumentIdentifier: InstrumentIdentifier;
    expiry: number;
    alphaWad: BigNumber;
    liquidity: BigNumber;
    balance: BigNumber;
    accountBoost: number;
    poolFactor: number;
    quotePriceWad: BigNumber; // [modify] inverse display
    isStable?: boolean;
}

export interface IOdysseySimulateOrderPointPerDayRequest {
    targetTick: number;
    baseSize: BigNumber;
    accountBoost: number;
    poolFactor: number;
    quotePriceWad: BigNumber; // [modify] inverse display
}

export interface RawSpotState {
    price: BigNumber;
    time: number;
}
export interface IRawSpotState extends RawSpotState {
    origin: RawSpotState;
    price: BigNumber; // [modify] inverse display
}

export interface IRawSpotStateRequest {
    instrumentIdentifier: InstrumentIdentifier;
    instrumentAddr?: string;
}

export interface IGetOrderBookDataRequest {
    // observer: Observer;
    instrumentAddr: string;
    expiry: number;
    stepRatio: number;
    length?: number;
}

interface DepthChartData {
    tick: number;
    price: number;
    base: number;
}

export interface IDepthChartData extends DepthChartData {
    origin: DepthChartData;
    price: number; // [modify] inverse display
}

export interface IOrderBookData {
    left: DepthChartData[];
    right: DepthChartData[];
}

export interface IDepthChartRequest {
    // observer: Observer;
    instrumentAddr: string;
    expiry: number;
    stepRatio: number;
    isInverse?: boolean;
    lowerPrice?: BigNumber;
    upperPrice?: BigNumber;
}
export interface IDeepChartsData {
    left: DepthChartData[];
    right: DepthChartData[];
}

export interface IPortfolioReleaseClaimRequest {
    signer: Signer;
    quote: string;
    trader: string;
    overrides?: Overrides;
}

export interface IPortfolioGetPendingParamsRequest {
    quotes: string[];
    overrides?: CallOverrides;
}

export interface IPortfolioGetPendingParamsResult {
    pendingDuration: BigNumber;
    thresholds: BigNumber[]; // TODO by @jinxi: need to fix decimals to 18?
}

export interface FundFlow {
    totalIn: BigNumber;
    totalOut: BigNumber;
}
export interface Pending {
    timestamp: number;
    native: boolean;
    amount: BigNumber; // TODO by @jinxi: need to fix decimals to 18?
    exemption: BigNumber;
}

export interface IPortfolioGetFundFlowsRequest {
    quoteAddrs: string[];
    trader: string;
    overrides?: CallOverrides;
}

export interface IPortfolioGetFundFlowsResult {
    fundFlows: FundFlow[];
    blockInfo: BlockInfo;
}

export interface IPortfolioGetUserPendingsRequest {
    quoteAddrs: string[];
    trader: string;
    overrides?: CallOverrides;
}

export interface IPortfolioGetUserPendingsResult {
    pendings: {
        maxWithdrawable: BigNumber; // TODO by @jinxi: need to fix decimals to 18?
        pending: Pending;
    }[];
    blockInfo: BlockInfo;
}

export interface IPortfolioDepositRequest {
    signer: Signer;
    quoteAddress: string;
    amount: BigNumber;
}

export interface IPortfolioWithdrawRequest {
    signer: Signer;
    quoteAddress: string;
    amount: BigNumber;
}
