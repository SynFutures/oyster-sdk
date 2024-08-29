/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { BigNumber, CallOverrides, ethers, Signer } from 'ethers';
import { Provider } from '@ethersproject/providers';
import { CHAIN_ID, TokenInfo } from '@derivation-tech/web3-core';
import { SynFuturesV3 as SynFuturesV3Core } from '../core';
import {
    FetchInstrumentParam,
    Instrument,
    Instrument__factory,
    InstrumentIdentifier,
    InstrumentInfo,
    MarketType,
} from '../types';
import { ConfigState, GateState, InstrumentModel, PairLevelAccountModel } from '../models';
import { EMPTY_QUOTE_PARAM } from '../constants';
import { Combine, getTokenInfo, InstrumentParser, cexMarket } from '../common';
import { CacheInterface } from './cache.interface';
import { ObserverPlugin } from './observer.plugin';

type SynFuturesV3 = Combine<[SynFuturesV3Core, ObserverPlugin]>;

export class CacheModule implements CacheInterface {
    synfV3: SynFuturesV3;
    gateState: GateState;
    configState: ConfigState;
    // update <-- new block info
    instrumentMap: Map<string, InstrumentModel> = new Map(); // lowercase address => instrument
    // lowercase address user => lowercase instrument address => expiry => PairLevelAccountModel
    accountCache: Map<string, Map<string, Map<number, PairLevelAccountModel>>> = new Map();
    // quote symbol => quote token info
    quoteSymbolToInfo: Map<string, TokenInfo> = new Map();

    constructor(synfV3: SynFuturesV3) {
        this.synfV3 = synfV3;
        this.gateState = new GateState(this.synfV3.ctx.wrappedNativeToken.address.toLowerCase());
        this.configState = new ConfigState();
    }

    async init(): Promise<void> {
        const list = await this.initInstruments();
        await this.initGateState(list);
        await this.updateConfigState();
    }

    async getInstrumentInfo(instrumentAddress: string): Promise<InstrumentInfo> {
        if (!this.instrumentMap.has(instrumentAddress.toLowerCase())) {
            await this.initInstruments();
        }
        const instrument = this.instrumentMap.get(instrumentAddress.toLowerCase());
        if (!instrument) {
            throw new Error(`Invalid instrument`);
        }
        return instrument.info;
    }

    async initInstruments(symbolToInfo?: Map<string, TokenInfo>): Promise<InstrumentModel[]> {
        this.quoteSymbolToInfo = symbolToInfo ?? new Map();
        for (const [, info] of this.quoteSymbolToInfo) {
            this.synfV3.registerQuoteInfo(info);
        }
        const list = await this.synfV3.observer.getAllInstruments();

        for (const instrument of list) {
            this.instrumentMap.set(instrument.info.addr.toLowerCase(), instrument);
            this.synfV3.ctx.registerAddress(instrument.info.addr, instrument.info.symbol);
            this.synfV3.ctx.registerContractParser(instrument.info.addr, new InstrumentParser());
        }
        return list;
    }

    async updateInstrument(params: FetchInstrumentParam[], overrides?: CallOverrides): Promise<InstrumentModel[]> {
        const instrumentModels = await this.synfV3.observer.fetchInstrumentBatch(params, overrides);
        this.updateInstrumentCache(instrumentModels);
        return instrumentModels;
    }

    async computeInitData(instrumentIdentifier: InstrumentIdentifier): Promise<string> {
        const { baseTokenInfo, quoteTokenInfo } = await getTokenInfo(instrumentIdentifier, this.synfV3.ctx);
        const quoteAddress = quoteTokenInfo.address;
        let data;
        if (cexMarket(instrumentIdentifier.marketType)) {
            const baseSymbol =
                typeof instrumentIdentifier.baseSymbol === 'string'
                    ? instrumentIdentifier.baseSymbol
                    : instrumentIdentifier.baseSymbol.symbol;
            data = ethers.utils.defaultAbiCoder.encode(['string', 'address'], [baseSymbol, quoteAddress]);
        } else {
            data = ethers.utils.defaultAbiCoder.encode(['address', 'address'], [baseTokenInfo.address, quoteAddress]);
        }
        return data;
    }

    public async syncGateCache(target: string, quotes: string[]): Promise<void> {
        const resp = await this.synfV3.contracts.observer.getVaultBalances(target, quotes);
        for (let i = 0; i < quotes.length; ++i) {
            this.gateState.setReserve(quotes[i], target, resp[0][i]);
        }
    }

    public async syncGateCacheWithAllQuotes(target: string): Promise<void> {
        const quoteParamConfig = this.synfV3.conf.quotesParam;
        const quoteAddresses: string[] = [];
        for (const symbol in quoteParamConfig) {
            quoteAddresses.push(await this.synfV3.ctx.getAddress(symbol));
        }
        await this.syncGateCache(target, quoteAddresses);
    }

    public getCachedGateBalance(quoteAddress: string, userAddress: string): BigNumber {
        const quote = quoteAddress.toLowerCase();
        const user = userAddress.toLowerCase();
        const balanceMap = this.gateState.reserveOf.get(quote.toLowerCase());
        if (balanceMap) {
            const balance = balanceMap.get(user);
            if (balance) {
                return balance;
            } else {
                throw new Error(`Not cached: gate balance for quote ${quote} of user ${user}`);
            }
        } else {
            throw new Error(`Not cached: gate for quote ${quote}`);
        }
    }

    public getInstrumentContract(address: string, signerOrProvider?: Signer | Provider): Instrument {
        return Instrument__factory.connect(address, signerOrProvider ?? this.synfV3.ctx.provider);
    }

    private updateInstrumentCache(instrumentModels: InstrumentModel[]): void {
        for (let i = 0; i < instrumentModels.length; ++i) {
            const instrument = instrumentModels[i].info.addr.toLowerCase();
            const oldModel = this.instrumentMap.get(instrument);
            if (oldModel) {
                oldModel.updateInstrumentState(instrumentModels[i].state, instrumentModels[i].spotPrice);
                for (const pair of instrumentModels[i].state.pairStates.values()) {
                    oldModel.updatePair(pair.amm, instrumentModels[i].getMarkPrice(pair.amm.expiry), pair.blockInfo);
                }
            } else {
                this.instrumentMap.set(instrument, instrumentModels[i]);
            }
        }
    }

    async updateConfigState(): Promise<void> {
        this.configState.openLp = true;
        if (this.synfV3.ctx.chainId !== CHAIN_ID.BASE) {
            try {
                this.configState.openLp = await this.synfV3.contracts.config.openLp();
            } catch (e) {
                // ignore error since the contract on some network may not have this function
            }
        }
        this.configState.openLiquidator = await this.synfV3.contracts.config.openLiquidator();
        for (const [symbol, param] of Object.entries(this.synfV3.conf.quotesParam)) {
            const quoteInfo = await this.synfV3.ctx.getTokenInfo(symbol);
            this.configState.setQuoteParam(quoteInfo.address, param ?? EMPTY_QUOTE_PARAM);
        }

        for (const type of Object.keys(this.synfV3.conf.marketConfig)) {
            const info = await this.synfV3.contracts.config.getMarketInfo(type);
            this.configState.marketsInfo.set(type as MarketType, {
                addr: info.market,
                beacon: info.beacon,
                type: type,
            });
        }
    }

    async initGateState(instrumentList: InstrumentModel[]): Promise<void> {
        this.gateState.allInstruments = instrumentList.map((i) => i.info.addr);
        for (const addr of this.gateState.allInstruments) {
            const index = await this.synfV3.contracts.gate.indexOf(addr);
            this.gateState.indexOf.set(addr.toLowerCase(), index);
        }
    }
}
