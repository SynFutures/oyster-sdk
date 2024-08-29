/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { CallOverrides, BigNumber } from 'ethers';
import { TokenInfo } from '@derivation-tech/web3-core';
import { InverseInterface } from './inverse.interface';
import { Combine } from '../common';
import { SynFuturesV3 as SynFuturesV3Core } from '../core';
import { FetchInstrumentParam, InstrumentIdentifier, WrappedInstrumentInfo } from '../types';
import { WrappedPairLevelAccountModel, WrappedInstrumentModel, WrappedInstrumentLevelAccountModel } from '../models';
import { CachePlugin } from './cache.plugin';
import { InstrumentPlugin } from './instrument.plugin';
import { safeWDiv, WAD } from '../math';
import { SimulatePlugin } from './simulate.plugin';
import { ObserverPlugin } from './observer.plugin';

type SynFuturesV3 = Combine<[SynFuturesV3Core, CachePlugin, InstrumentPlugin, SimulatePlugin, ObserverPlugin]>;

export class InverseModule implements InverseInterface {
    synfV3: SynFuturesV3;

    constructor(synfV3: SynFuturesV3) {
        this.synfV3 = synfV3;
    }

    async getInstrumentInfo(instrumentAddress: string): Promise<WrappedInstrumentInfo> {
        if (!this.synfV3.cache.instrumentMap.has(instrumentAddress.toLowerCase())) {
            await this.synfV3.cache.initInstruments();
        }
        const instrument = this.synfV3.cache.instrumentMap.get(instrumentAddress.toLowerCase());
        if (!instrument) {
            throw new Error(`Invalid instrument`);
        }
        return instrument.wrap.info;
    }

    //todo need to use wrapped map to fix inverse
    get accountCache(): Map<string, Map<string, Map<number, WrappedPairLevelAccountModel>>> {
        const map = new Map<string, Map<string, Map<number, WrappedPairLevelAccountModel>>>();
        for (const key of this.synfV3.cache.accountCache.keys()) {
            const map2 = new Map<string, Map<number, WrappedPairLevelAccountModel>>();
            for (const key2 of this.synfV3.cache.accountCache.get(key)!.keys()) {
                const map3 = new Map<number, WrappedPairLevelAccountModel>();
                for (const key3 of this.synfV3.cache.accountCache.get(key)!.get(key2)!.keys()) {
                    map3.set(key3, this.synfV3.cache.accountCache.get(key)!.get(key2)!.get(key3)!.wrap);
                }
                map2.set(key2, map3);
            }
            map.set(key, map2);
        }
        return map;
    }

    async initInstruments(symbolToInfo?: Map<string, TokenInfo>): Promise<WrappedInstrumentModel[]> {
        const res = await this.synfV3.cache.initInstruments(symbolToInfo);
        return res.map((i) => {
            return i.wrap;
        });
    }

    get instrumentMap(): Map<string, WrappedInstrumentModel> {
        const map = new Map<string, WrappedInstrumentModel>();
        for (const key of this.synfV3.cache.instrumentMap.keys()) {
            map.set(key, this.synfV3.cache.instrumentMap.get(key)!.wrap);
        }
        return map;
    }

    async updateInstrument(
        params: FetchInstrumentParam[],
        overrides?: CallOverrides,
    ): Promise<WrappedInstrumentModel[]> {
        const res = await this.synfV3.cache.updateInstrument(params, overrides);
        return res.map((i) => {
            return i.wrap;
        });
    }

    async getInstrumentLevelAccounts(
        target: string,
        overrides?: CallOverrides,
    ): Promise<WrappedInstrumentLevelAccountModel[]> {
        const res = await this.synfV3.observer.getInstrumentLevelAccounts(target, overrides);
        return res.map((i) => {
            return i.wrap;
        });
    }

    async getPairLevelAccount(
        target: string,
        instrument: string,
        expiry: number,
        useCache?: boolean,
    ): Promise<WrappedPairLevelAccountModel> {
        const res = await this.synfV3.observer.getPairLevelAccount(target, instrument, expiry, useCache);
        return res.wrap;
    }

    async updatePairLevelAccount(
        target: string,
        instrument: string,
        expiry: number,
        overrides?: CallOverrides,
    ): Promise<WrappedPairLevelAccountModel> {
        const res = await this.synfV3.observer.updatePairLevelAccount(target, instrument, expiry, overrides);
        return res.wrap;
    }

    async getAllInstruments(batchSize?: number, overrides?: CallOverrides): Promise<WrappedInstrumentModel[]> {
        const res = await this.synfV3.observer.getAllInstruments(batchSize, overrides);
        return res.map((i) => {
            return i.wrap;
        });
    }

    async fetchInstrumentBatch(
        params: FetchInstrumentParam[],
        overrides?: CallOverrides,
    ): Promise<WrappedInstrumentModel[]> {
        const res = await this.synfV3.observer.fetchInstrumentBatch(params, overrides);
        return res.map((i) => {
            return i.wrap;
        });
    }

    async inspectDexV2MarketBenchmarkPrice(
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
    ): Promise<BigNumber> {
        const res = await this.synfV3.observer.inspectDexV2MarketBenchmarkPrice(instrumentIdentifier, expiry);
        return safeWDiv(WAD, res);
    }

    async inspectCexMarketBenchmarkPrice(
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
    ): Promise<BigNumber> {
        const res = await this.synfV3.observer.inspectCexMarketBenchmarkPrice(instrumentIdentifier, expiry);
        return safeWDiv(WAD, res);
    }

    async getRawSpotPrice(identifier: InstrumentIdentifier): Promise<BigNumber> {
        const res = await this.synfV3.observer.getRawSpotPrice(identifier);
        return safeWDiv(WAD, res);
    }
}
