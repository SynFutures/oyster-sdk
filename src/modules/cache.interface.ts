import { ConfigState, GateState, InstrumentModel, PairLevelAccountModel } from '../models';
import { TokenInfo } from '@derivation-tech/web3-core';
import { BigNumber, CallOverrides } from 'ethers';
import { FetchInstrumentParam, InstrumentInfo } from '../types';

export interface CacheInterface {
    gateState: GateState;
    configState: ConfigState;
    // update <-- new block info
    instrumentMap: Map<string, InstrumentModel>; // lowercase address => instrument
    // lowercase address user => lowercase instrument address => expiry => PairLevelAccountModel
    accountCache: Map<string, Map<string, Map<number, PairLevelAccountModel>>>;
    // quote symbol => quote token info
    quoteSymbolToInfo: Map<string, TokenInfo>;

    /**
     *Init local cache
     * 1: init gate state
     * 2: init config state
     */
    initCache(): Promise<void>;

    /**
     * Init instruments
     * @param symbolToInfo the token info
     */
    initInstruments(symbolToInfo?: Map<string, TokenInfo>): Promise<InstrumentModel[]>;

    /**
     *Get instrument info from cache
     * @param instrumentAddress
     */
    getInstrumentInfo(instrumentAddress: string): Promise<InstrumentInfo>;

    /**
     *Update instrument cache
     * will update all expiries when params.expiry.length is 0
     * @param params the params
     * @param overrides overrides with ethers types
     */
    updateInstrument(params: FetchInstrumentParam[], overrides?: CallOverrides): Promise<InstrumentModel[]>;

    /**
     *Sync gate cache
     * @param target the target address
     * @param quotes the quote address list
     */
    syncGateCache(target: string, quotes: string[]): Promise<void>;

    /**
     *Sync gate cache with all quotes(in config file:quotesParam)
     * todo: optimize for all quotes,not just in the config file
     * @param target
     */
    syncGateCacheWithAllQuotes(target: string): Promise<void>;

    /**
     *Get cached gate balance of targetAddress by quoteAddress
     * @param quote the quote address
     * @param target the target address
     */
    getCachedGateBalance(quote: string, target: string): BigNumber;
}
