/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ethers } from 'ethers';
import { deserializeSimpleObject, serializeSimpleObject } from '../common/util';
import { ParsedEvent } from './common';
import { MarketType } from './enum';
import { MarketInfo } from './market';
import { EMPTY_QUOTE_PARAM, QuoteParam } from './params';
import {
    DisableLiquidatorWhitelistEventObject,
    DisableLpWhitelistEventObject,
    EnableLpWhitelistForQuoteEventObject,
    SetLiquidatorWhitelistEventObject,
    SetLpWhitelistEventObject,
    SetLpWhitelistForQuoteEventObject,
    SetMarketInfoEventObject,
    SetQuoteParamEventObject,
} from './typechain/Config';
import { BlockInfo } from '@derivation-tech/web3-core';
import { EventHandler } from './eventHandler';

export class ConfigState extends EventHandler {
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
        super();
        this.blockInfo = blockInfo;
    }

    serialize(): any {
        const quotesParam: any = {};
        for (const [k, v] of this.quotesParam) {
            quotesParam[k] = serializeSimpleObject(v);
        }

        const marketsInfo: any = {};
        for (const [k, v] of this.marketsInfo) {
            marketsInfo[k] = serializeSimpleObject(v);
        }

        const lpWhitelist: any = {};
        for (const [k, v] of this.lpWhitelist) {
            lpWhitelist[k] = v;
        }

        const restrictLp: any = {};
        for (const [k, v] of this.restrictLp) {
            restrictLp[k] = v;
        }

        const lpWhitelistPerQuote: any = {};
        for (const [quote, lpWhitelist] of this.lpWhitelistPerQuote) {
            lpWhitelistPerQuote[quote] = {};
            for (const [k, v] of lpWhitelist) {
                lpWhitelistPerQuote[quote][k] = v;
            }
        }

        const liquidatorWhitelist: any = {};
        for (const [k, v] of this.liquidatorWhitelist) {
            liquidatorWhitelist[k] = v;
        }

        return {
            quotesParam,
            marketsInfo,
            lpWhitelist,
            liquidatorWhitelist,
            openLp: this.openLp,
            restrictLp,
            lpWhitelistPerQuote,
            openLiquidator: this.openLiquidator,
        };
    }

    deserialize(serialized: any): this {
        if (
            this.quotesParam.size > 0 ||
            this.marketsInfo.size > 0 ||
            this.lpWhitelist.size > 0 ||
            this.liquidatorWhitelist.size > 0 ||
            this.restrictLp.size > 0 ||
            this.lpWhitelistPerQuote.size > 0
        ) {
            throw new Error('invalid deserialize');
        }

        if (
            typeof serialized !== 'object' ||
            typeof serialized.quotesParam !== 'object' ||
            typeof serialized.marketsInfo !== 'object' ||
            typeof serialized.lpWhitelist !== 'object' ||
            typeof serialized.liquidatorWhitelist !== 'object' ||
            typeof serialized.restrictLp !== 'object' ||
            typeof serialized.lpWhitelistPerQuote !== 'object'
        ) {
            throw new Error('invalid deserialize');
        }

        this.openLp = serialized.openLp;
        this.openLiquidator = serialized.openLiquidator;

        for (const [k, v] of Object.entries(serialized.quotesParam)) {
            if (typeof v !== 'object' || v === null) {
                throw new Error('invalid deserialize');
            }

            this.quotesParam.set(k, deserializeSimpleObject(v));
        }

        for (const [k, v] of Object.entries(serialized.marketsInfo)) {
            if (typeof v !== 'object' || v === null) {
                throw new Error('invalid deserialize');
            }

            this.marketsInfo.set(k as MarketType, deserializeSimpleObject(v));
        }

        for (const [k, v] of Object.entries(serialized.lpWhitelist)) {
            if (typeof v !== 'boolean') {
                throw new Error('invalid deserialize');
            }

            this.lpWhitelist.set(k, v);
        }

        for (const [k, v] of Object.entries(serialized.liquidatorWhitelist)) {
            if (typeof v !== 'boolean') {
                throw new Error('invalid deserialize');
            }

            this.liquidatorWhitelist.set(k, v);
        }

        for (const [k, v] of Object.entries(serialized.restrictLp)) {
            if (typeof v !== 'boolean') {
                throw new Error('invalid deserialize');
            }

            this.restrictLp.set(k, v);
        }

        for (const [quote, lpWhitelist] of Object.entries(serialized.lpWhitelistPerQuote)) {
            if (typeof lpWhitelist !== 'object' || lpWhitelist === null) {
                throw new Error('invalid deserialize');
            }

            this.lpWhitelistPerQuote.set(quote, new Map());
            for (const [k, v] of Object.entries(lpWhitelist)) {
                if (typeof v !== 'boolean') {
                    throw new Error('invalid deserialize');
                }

                this.lpWhitelistPerQuote.get(quote)!.set(k, v);
            }
        }

        return this;
    }

    copy(): ConfigState {
        return new ConfigState().deserialize(this.serialize());
    }

    setQuoteParam(addr: string, quoteParam: QuoteParam): void {
        this.quotesParam.set(addr.toLowerCase(), quoteParam);
    }

    getQuoteParam(quote: string): QuoteParam {
        quote = quote.toLowerCase();

        if (!this.quotesParam.has(quote)) {
            this.quotesParam.set(quote, EMPTY_QUOTE_PARAM);
        }
        return this.quotesParam.get(quote)!;
    }

    handleSetQuoteParam(event: ParsedEvent<SetQuoteParamEventObject>, log: ethers.providers.Log): void {
        void log;
        this.quotesParam.set(event.args.quote.toLowerCase(), event.args.param);
    }

    handleSetMarketInfo(event: ParsedEvent<SetMarketInfoEventObject>, log: ethers.providers.Log): void {
        void log;
        this.marketsInfo.set(event.args.mtype as MarketType, {
            addr: event.args.market,
            type: event.args.mtype,
            beacon: event.args.beacon,
        });
    }

    handleDisableLpWhitelist(event: ParsedEvent<DisableLpWhitelistEventObject>, log: ethers.providers.Log): void {
        void event;
        void log;
        this.openLp = true;
    }

    handleEnableLpWhitelistForQuote(
        event: ParsedEvent<EnableLpWhitelistForQuoteEventObject>,
        log: ethers.providers.Log,
    ): void {
        void log;
        this.restrictLp.set(event.args.quote, event.args.restricted);
    }

    handleDisableLiquidatorWhitelist(
        event: ParsedEvent<DisableLiquidatorWhitelistEventObject>,
        log: ethers.providers.Log,
    ): void {
        void event;
        void log;
        this.openLiquidator = true;
    }

    handleSetLpWhitelist(event: ParsedEvent<SetLpWhitelistEventObject>, log: ethers.providers.Log): void {
        void log;
        this.lpWhitelist.set(event.args.user, event.args.authorized);
    }

    handleSetLpWhitelistForQuote(
        event: ParsedEvent<SetLpWhitelistForQuoteEventObject>,
        log: ethers.providers.Log,
    ): void {
        void log;
        if (!this.lpWhitelistPerQuote.has(event.args.quote)) {
            this.lpWhitelistPerQuote.set(event.args.quote, new Map());
        }
        this.lpWhitelistPerQuote.get(event.args.quote)!.set(event.args.user, event.args.authorized);
    }

    handleSetLiquidatorWhitelist(
        event: ParsedEvent<SetLiquidatorWhitelistEventObject>,
        log: ethers.providers.Log,
    ): void {
        void log;
        this.liquidatorWhitelist.set(event.args.user, event.args.authorized);
    }
}
