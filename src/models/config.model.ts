/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { BlockInfo } from '@derivation-tech/web3-core';
import { MarketInfo, MarketType, QuoteParam } from '../types';

export class ConfigState {
    quotesParam = new Map<string, QuoteParam>(); // address => QuoteParam
    marketsInfo = new Map<MarketType, MarketInfo>();
    lpWhitelist = new Map<string, boolean>();

    liquidatorWhitelist = new Map<string, boolean>();

    openLp = false;
    restrictLp = new Map<string, boolean>();
    lpWhitelistPerQuote = new Map<string, Map<string, boolean>>();

    openLiquidator = false;

    blockInfo?: BlockInfo;

    constructor(blockInfo?: BlockInfo) {
        this.blockInfo = blockInfo;
    }

    setQuoteParam(addr: string, quoteParam: QuoteParam): void {
        this.quotesParam.set(addr.toLowerCase(), quoteParam);
    }
}
