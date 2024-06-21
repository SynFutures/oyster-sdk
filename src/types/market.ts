import { BigNumber } from 'ethers';
import { FeederType } from './enum';

export interface Market {
    info: MarketInfo;
    config: MarketConfig;
}

export interface MarketInfo {
    addr: string;
    type: string;
    beacon: string;
}

export interface CexFeederSource {
    baseSymbol: string;
    quoteSymbol: string;
    ftype: FeederType;
    aggregator0: string;
    heartBeat0: number;
    aggregator1?: string;
    heartBeat1?: number;
}

export interface DexV2FeederSource {
    factory: string;
    router: string;
}

export interface MarketConfig {
    dailyInterestRate: number;
    feederSource: CexFeederSource[] | DexV2FeederSource[];
}

export interface PythMarketConfig extends MarketConfig {
    pythCore: string;
}

export interface PriceFeeder {
    ftype: FeederType;
    scaler0: BigNumber;
    aggregator0: string;
    heartBeat0: number;
    scaler1: BigNumber;
    aggregator1: string;
    heartBeat1: number;
}

export interface DexV2Feeder {
    ftype: FeederType;
    isToken0Quote: boolean;
    pair: string;
    scaler0: BigNumber;
    scaler1: BigNumber;
}
