import type { BigNumber } from 'ethers';
import type { CHAIN_ID } from '@derivation-tech/web3-core';
import type { PriceFeeder, DexV2Feeder, Market } from './market';
import type { InstrumentCondition } from './enum';
import type { BaseInfo, TokenInfo } from './token';
import type { Amm } from './pair';
import type { QuoteParam } from './params';

export interface AssembledInstrumentData {
    instrumentAddr: string;
    symbol: string;
    market: string;

    dexV2Feeder: DexV2Feeder;
    priceFeeder: PriceFeeder;

    initialMarginRatio: number;
    maintenanceMarginRatio: number;
    param: QuoteParam;
    spotPrice: BigNumber;
    condition: InstrumentCondition;
    amms: Amm[];
    markPrices: BigNumber[];
}

export interface InstrumentInfo {
    chainId: CHAIN_ID;
    addr: string;
    symbol: string;
    base: BaseInfo;
    quote: TokenInfo;
}

// TODO: @samlior a more explicit way of expressing
export type WrappedInstrumentInfo = InstrumentInfo;

export interface InstrumentMarket extends Market {
    feeder: PriceFeeder | DexV2Feeder;
}
