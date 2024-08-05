import { CHAIN_ID, TokenInfo } from '@derivation-tech/web3-core';
import { SynFuturesV3 } from '../synfuturesV3Core';
import { EMPTY_QUOTE_PARAM, MarketType } from '../types';
import { BigNumber } from 'ethers';
import { ConfigState, GateState, InstrumentModel, PairLevelAccountModel } from '../models';
import type { Module } from '../common';

export class CacheModule implements Module {
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
        this.gateState = new GateState(synfV3.ctx.wrappedNativeToken.address.toLowerCase());
        this.configState = new ConfigState();
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
        for (const [symbol, param] of Object.entries(this.synfV3.config.quotesParam)) {
            const quoteInfo = await this.synfV3.ctx.getTokenInfo(symbol);
            this.configState.setQuoteParam(quoteInfo.address, param ?? EMPTY_QUOTE_PARAM);
        }

        for (const type of Object.keys(this.synfV3.config.marketConfig)) {
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

    public async syncGateCache(target: string, quotes: string[]): Promise<void> {
        const resp = await this.synfV3.contracts.observer.getVaultBalances(target, quotes);
        for (let i = 0; i < quotes.length; ++i) {
            this.gateState.setReserve(quotes[i], target, resp[0][i]);
        }
    }

    public async syncGateCacheWithAllQuotes(target: string): Promise<void> {
        const quoteParamConfig = this.synfV3.config.quotesParam;
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
}
