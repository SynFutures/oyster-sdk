import { PriceFeeder, DexV2Feeder, Market } from './market';
import { InstrumentCondition } from './enum';
import { BaseInfo, TokenInfo } from './token';
import { Amm } from './pair';
import { BigNumber } from 'ethers';
import { QuoteParam } from './params';

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
    addr: string;
    symbol: string;
    base: BaseInfo;
    quote: TokenInfo;
}

export interface InstrumentMarket extends Market {
    feeder: PriceFeeder | DexV2Feeder;
}
