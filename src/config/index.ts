import { BigNumber } from 'ethers';

import * as localConfig from './local.json';
import * as goerliConfig from './goerli.json';
import * as polygonConfig from './polygon.json';
import * as scrollConfig from './scroll.json';
import * as lineaConfig from './linea.json';
import * as arbitrumConfig from './arbitrum.json';
import * as blastsepoliaConfig from './blastsepolia.json';
import * as blastConfig from './blast.json';
import * as baseConfig from './base.json';

import { CHAIN_ID, TokenInfo } from '@derivation-tech/web3-core';
import { MarketType, QuoteType } from '../types/enum';
import { MarketConfig, PythMarketConfig, QuoteParam } from '../types';
import {
    CexMarket,
    Config,
    DexV2Market,
    Beacon,
    Gate,
    Observer,
    Guardian,
    EmergingFeederFactory,
    PythFeederFactory,
} from '../types/typechain';

export interface MarketAddress {
    beacon: string;
    market: string;
    // only apply for chainlink
    feeders?: { [key in string]?: string };
}

export interface FeederFactoryAddress {
    beacon: string;
    factory: string;
}

export interface ContractAddress {
    gate: string;
    observer: string;
    config: string;
    guardian?: string;
    market: { [key in MarketType]?: MarketAddress };
    feederFactory: { [key in MarketType]?: FeederFactoryAddress };
}

export interface SynfConfig {
    subgraph: string;
    // aws proxy for frontend use
    subgraphProxy: string;
    marketConfig: { [key in MarketType]?: MarketConfig | PythMarketConfig };
    quotesParam: { [key in string]?: QuoteParam };
    contractAddress: ContractAddress;
    instrumentProxyByteCode: string;
    tokenInfo?: TokenInfo[];
    inversePairs?: InversePairs;
}

export interface InversePairs {
    instruments: string[];
    stableCoins: string[];
}

export interface QuoteParamJson {
    tradingFeeRatio: number;
    stabilityFeeRatioParam: string;
    protocolFeeRatio: number;
    qtype: number;
    minMarginAmount: string; // numeric string
    tip: string; // numeric string
}

export interface SynfConfigJson {
    subgraph: string;
    // aws proxy for frontend use
    subgraphProxy: string;
    marketConfig: { [key in MarketType]?: MarketConfig };
    quotesParam: { [key in string]?: QuoteParamJson };
    contractAddress: ContractAddress;
    instrumentProxyByteCode: string;
}

export interface SynFuturesV3Contracts {
    config: Config;
    gate: Gate;
    observer: Observer;
    guardian?: Guardian;
    marketContracts: { [key in MarketType]?: MarketContracts };
    feederFactoryContracts: { [key in MarketType]?: FeederFactoryContracts };
}

export interface MarketContracts {
    market: CexMarket | DexV2Market;
    beacon: Beacon;
}

export interface FeederFactoryContracts {
    factory: EmergingFeederFactory | PythFeederFactory;
    beacon: Beacon;
}

export class ConfigManager {
    static getSynfConfig(chainId: CHAIN_ID): SynfConfig {
        switch (chainId) {
            case CHAIN_ID.LOCAL: {
                return ConfigManager.mapSynfConfig(localConfig);
            }
            case CHAIN_ID.GOERLI: {
                return ConfigManager.mapSynfConfig(goerliConfig);
            }
            case CHAIN_ID.POLYGON: {
                return ConfigManager.mapSynfConfig(polygonConfig);
            }
            case CHAIN_ID.SCROLL: {
                return ConfigManager.mapSynfConfig(scrollConfig);
            }
            case CHAIN_ID.LINEA: {
                return ConfigManager.mapSynfConfig(lineaConfig);
            }
            case CHAIN_ID.ARBITRUM: {
                return ConfigManager.mapSynfConfig(arbitrumConfig);
            }
            case CHAIN_ID.BLASTSEPOLIA: {
                return ConfigManager.mapSynfConfig(blastsepoliaConfig);
            }
            case CHAIN_ID.BLAST: {
                return ConfigManager.mapSynfConfig(blastConfig);
            }
            case CHAIN_ID.BASE: {
                return ConfigManager.mapSynfConfig(baseConfig);
            }
            default: {
                throw new Error('Unsupported Network.');
            }
        }
    }

    static isInversePair(chainId: CHAIN_ID, instrument: string, baseToken: string): boolean {
        const { inversePairs } = ConfigManager.getSynfConfig(chainId);
        if (!inversePairs) {
            return false;
        }
        if (inversePairs.instruments?.includes(instrument.toLowerCase())) {
            return true;
        }
        return !!inversePairs.stableCoins?.includes(baseToken.toLowerCase());
    }

    private static mapSynfConfig(json: SynfConfigJson): SynfConfig {
        const config: SynfConfig = {
            ...json,
            quotesParam: ConfigManager.mapQuotesParam(json.quotesParam),
        };
        return config;
    }

    public static mapQuotesParam(quotesParams: { [key in string]?: QuoteParamJson }): { [key in string]?: QuoteParam } {
        const result: { [key in string]?: QuoteParam } = {};
        for (const symbol in quotesParams) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const item: QuoteParamJson = quotesParams[symbol]!;
            result[symbol] = {
                tradingFeeRatio: item.tradingFeeRatio,
                stabilityFeeRatioParam: BigNumber.from(item.stabilityFeeRatioParam),
                protocolFeeRatio: item.protocolFeeRatio,
                qtype: Number(item.qtype) as QuoteType,
                minMarginAmount: BigNumber.from(item.minMarginAmount),
                tip: BigNumber.from(item.tip),
            } as QuoteParam;
        }
        return result;
    }
}
