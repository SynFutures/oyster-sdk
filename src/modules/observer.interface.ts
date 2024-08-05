import { BigNumber, CallOverrides } from 'ethers';
import { InstrumentLevelAccountModel, InstrumentModel, PairLevelAccountModel } from '../models';
import { FetchInstrumentParam, InstrumentIdentifier } from '../types';
import { TokenInfo } from '@derivation-tech/web3-core';

export interface ObserverInterface {
    /**
     *Get instrument level accounts infos
     *given single trader address, return multiple instrument level account which have been involved
     * @param target the target address
     * @param overrides overrides with ethers types
     */
    getInstrumentLevelAccounts(target: string, overrides?: CallOverrides): Promise<InstrumentLevelAccountModel[]>;

    /**
     *Get pair level account infos
     * @param target the target address
     * @param instrument the instrument address
     * @param expiry the expiry
     * @param useCache whether use cache
     */
    getPairLevelAccount(
        target: string,
        instrument: string,
        expiry: number,
        useCache: boolean,
    ): Promise<PairLevelAccountModel>;

    /**
     *Get all instruments
     * @param batchSize the batch size,default value is 10
     * @param overrides overrides with ethers types
     */
    getAllInstruments(batchSize: number, overrides?: CallOverrides): Promise<InstrumentModel[]>;

    /**
     *Fetch instrument batch by given params
     * @param params the params
     * @param overrides overrides with ethers types
     */
    fetchInstrumentBatch(params: FetchInstrumentParam[], overrides?: CallOverrides): Promise<InstrumentModel[]>;

    /**
     *Get quote token info by quote symbol and instrument
     * @param quoteSymbol the quote symbol
     * @param instrumentAddr the instrument
     */
    getQuoteTokenInfo(quoteSymbol: string, instrumentAddr: string): Promise<TokenInfo>;

    /**
     *Inspect dex v2 market benchmark price
     * @param instrumentIdentifier the instrument
     * @param expiry the expiry
     */
    inspectDexV2MarketBenchmarkPrice(instrumentIdentifier: InstrumentIdentifier, expiry: number): Promise<BigNumber>;

    /**
     * Inspect cex market benchmark price
     * @param instrumentIdentifier the instrument
     * @param expiry the expiry
     */
    inspectCexMarketBenchmarkPrice(instrumentIdentifier: InstrumentIdentifier, expiry: number): Promise<BigNumber>;

    /**
     * Get raw spot price by instrument marketType
     * @param identifier the instrument identifier
     */
    getRawSpotPrice(identifier: InstrumentIdentifier): Promise<BigNumber>;
}
