import { ConfigState, GateState, InstrumentModel, PairLevelAccountModel } from '../models';
import { ChainContext, TokenInfo } from '@derivation-tech/web3-core';
import { BigNumber, CallOverrides, Signer } from 'ethers';
import { FetchInstrumentParam, Instrument, InstrumentIdentifier, InstrumentInfo } from '../types';
import { SynfConfig, SynFuturesV3Contracts } from '../config';
import { Provider } from '@ethersproject/providers';
import { InterfaceImplementationMissingError } from '../errors/interfaceImplementationMissing.error';
import { BaseInterface } from '../common';

export interface CacheInterface extends BaseInterface {
    get ctx(): ChainContext;
    get config(): SynfConfig;
    get contracts(): SynFuturesV3Contracts;
    get gateState(): GateState;
    get configState(): ConfigState;
    // update <-- new block info
    get instrumentMap(): Map<string, InstrumentModel>; // lowercase address => instrument
    // lowercase address user => lowercase instrument address => expiry => PairLevelAccountModel
    get accountCache(): Map<string, Map<string, Map<number, PairLevelAccountModel>>>;
    // quote symbol => quote token info
    get quoteSymbolToInfo(): Map<string, TokenInfo>;

    /**
     *Init local cache
     * 1: init gate state
     * 2: init config state
     */
    init(): Promise<void>;

    /**
     * Init instruments
     * @param symbolToInfo the token info
     */
    initInstruments(symbolToInfo?: Map<string, TokenInfo>): Promise<InstrumentModel[]>;

    setProvider(provider: Provider, isOpSdkCompatible?: boolean): void;

    registerQuoteInfo(tokenInfo: TokenInfo): void;

    computeInitData(instrumentIdentifier: InstrumentIdentifier): Promise<string>;

    getInstrumentContract(address: string, signerOrProvider?: Signer | Provider): Instrument;
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

export function createNullCacheModule(): CacheInterface {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const errorHandler = () => {
        throw new InterfaceImplementationMissingError('CacheInterface', 'cache');
    };
    return {
        synfV3: null as never,
        ctx: null as never,
        accountCache: null as never,
        config: null as never,
        configState: null as never,
        contracts: null as never,
        gateState: null as never,
        instrumentMap: null as never,
        quoteSymbolToInfo: null as never,
        computeInitData: errorHandler,
        getCachedGateBalance: errorHandler,
        getInstrumentContract: errorHandler,
        getInstrumentInfo: errorHandler,
        init: errorHandler,
        initInstruments: errorHandler,
        registerQuoteInfo: errorHandler,
        setProvider: errorHandler,
        syncGateCache: errorHandler,
        syncGateCacheWithAllQuotes: errorHandler,
        updateInstrument: errorHandler,
    };
}
