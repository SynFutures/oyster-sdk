import { BigNumber } from 'ethers';
import { Position, PositionModel } from './index';
import { FeederType, MarketType, QuoteType } from './enum';
import { ZERO } from '../math/constants';
import { TokenInfo } from '@derivation-tech/web3-core';

// sdk interface
export interface SetChainlinkFeederParam {
    base: string; // base symbol
    quote: string; // quote symbol
    ftype: FeederType;
    aggregator0: string;
    heartBeat0: number;
    aggregator1?: string;
    heartBeat1?: number;
}

export interface InstrumentSetting {
    initialMarginRatio: number;
    maintenanceMarginRatio: number;
    quoteParam: QuoteParam;
}

export interface QuoteParam {
    minMarginAmount: BigNumber;

    tradingFeeRatio: number;
    protocolFeeRatio: number;
    stabilityFeeRatioParam: BigNumber;

    tip: BigNumber;
    qtype: QuoteType;
}

export const EMPTY_QUOTE_PARAM: QuoteParam = {
    tradingFeeRatio: 0,
    stabilityFeeRatioParam: ZERO,
    protocolFeeRatio: 0,
    qtype: QuoteType.INVALID,
    minMarginAmount: ZERO,
    tip: ZERO,
};

export type PositionCache = Position;

export interface SetFeederPriceParam {
    marketType: MarketType;
    // note:
    // for chainlink market, base is base symbol, quote is quote address
    // for dex market, base is base address, quote is quote address
    base: string;
    quote: string;
    basePrice: number;
    quotePrice: number;
}

export interface InstrumentIdentifier {
    marketType: MarketType;
    baseSymbol: string | TokenInfo;
    quoteSymbol: string | TokenInfo;
}

export interface AdjustParam {
    expiry: number;
    net: BigNumber;
    deadline: number;
}

export interface AddParam {
    expiry: number;
    tickDeltaLower: number;
    tickDeltaUpper: number;
    amount: BigNumber;
    limitTicks: BigNumber;
    deadline: number;
}

export interface RemoveParam {
    expiry: number;
    target: string;
    tickLower: number;
    tickUpper: number;
    limitTicks: BigNumber;
    deadline: number;
}

export interface TradeParam {
    expiry: number;
    size: BigNumber;
    amount: BigNumber;
    limitTick: number;
    deadline: number;
}

export interface FillParam {
    expiry: number;
    tick: number;
    target: string;
    nonce: number;
}

export interface CancelParam {
    expiry: number;
    tick: number;
    deadline: number;
}

export interface SweepParam {
    expiry: number;
    target: string;
    size: BigNumber;
}

export interface LiquidateParam {
    expiry: number;
    target: string;
    size: BigNumber;
    amount: BigNumber;
}

export interface PlaceParam {
    expiry: number;
    tick: number;
    size: BigNumber;
    amount: BigNumber;
    deadline: number;
}

export interface BatchPlaceParam {
    expiry: number;
    ticks: number[];
    ratios: number[];
    size: BigNumber;
    leverage: BigNumber;
    deadline: number;
}

export interface InstrumentPointConfigParam {
    isStable: boolean;
    quotePriceWad: BigNumber;
    // expiry -> PoolFactor
    poolFactorMap: Map<number, number>;
}

export interface FetchInstrumentParam {
    instrument: string;
    expiries: number[];
}
export interface ClaimAirDropParam {
    epoch: number;
    index: BigNumber;
    account: string;
    amount: BigNumber;
    proof: string[];
}

export interface SimulateTradeResult {
    tradePrice: BigNumber;
    estimatedTradeValue: BigNumber;
    minTradeValue: BigNumber;
    tradingFee: BigNumber;
    stabilityFee: BigNumber;
    margin: BigNumber;
    leverageWad: BigNumber;
    priceImpactWad: BigNumber;
    realized: BigNumber;
    simulationMainPosition: PositionModel;
    marginToDepositWad: BigNumber;
    limitTick: number;
    exceedMaxLeverage: boolean;
}

export interface SimulateOrderResult {
    baseSize: BigNumber;
    balance: BigNumber;
    leverageWad: BigNumber;
    marginToDepositWad: BigNumber;
    minOrderValue: BigNumber;
    minFeeRebate: BigNumber;
}
