import { BigNumber } from 'ethers';
import { BlockInfo, SECS_PER_HOUR } from '@derivation-tech/web3-core';
import { ZERO } from '../math';
import { deserializeSimpleObject, serializeSimpleObject } from '../common';
import { NATIVE_TOKEN_ADDRESS } from '../constants';
import { FundFlow, Pending } from '../types';

export class GateState {
    indexOf = new Map<string, string>();
    allInstruments: string[] = [];
    pendingDuration = BigNumber.from(24 * SECS_PER_HOUR);
    reserveOf = new Map<string, Map<string, BigNumber>>(); // quote => trader => balance
    _fundFlowOf = new Map<string, Map<string, FundFlow>>(); // quote => trader => fundFlow
    isBlacklisted = new Map<string, boolean>();
    _thresholdOf = new Map<string, BigNumber>(); // quote => threshold
    _pendingOf = new Map<string, Map<string, Pending>>(); // quote => trader => pending
    wrappedNativeToken: string; // wrapped native token address

    blockInfo?: BlockInfo;

    constructor(wrappedNativeToken: string, blockInfo?: BlockInfo) {
        this.wrappedNativeToken = wrappedNativeToken;
        this.blockInfo = blockInfo;
    }

    setReserve(quote: string, target: string, balance: BigNumber): void {
        let subMap = this.reserveOf.get(quote.toLowerCase());
        if (!subMap) {
            subMap = new Map();
            this.reserveOf.set(quote.toLowerCase(), subMap);
        }
        subMap.set(target.toLowerCase(), balance);
    }

    getReserve(quote: string, target: string): BigNumber {
        let subMap = this.reserveOf.get(quote.toLowerCase());
        if (!subMap) {
            subMap = new Map();
            this.reserveOf.set(quote.toLowerCase(), subMap);
        }
        return this.reserveOf.get(quote.toLowerCase())!.get(target.toLowerCase()) ?? ZERO;
    }

    isBlacklistedTrader(trader: string): boolean {
        return this.isBlacklisted.get(trader.toLowerCase()) ?? false;
    }

    setBlacklistTrader(trader: string, banned: boolean): void {
        this.isBlacklisted.set(trader.toLowerCase(), banned);
    }

    serialize(): any {
        const reserveOf: any = {};
        for (const [k, v] of this.reserveOf) {
            const _obj: any = (reserveOf[k] = {});
            for (const [_k, _v] of v) {
                _obj[_k] = _v.toString();
            }
        }

        const fundFlowOf: any = {};
        for (const [k, v] of this._fundFlowOf) {
            const _obj: any = (fundFlowOf[k] = {});
            for (const [_k, _v] of v) {
                _obj[_k] = serializeSimpleObject(_v);
            }
        }

        const indexOf: any = {};
        for (const [k, v] of this.indexOf) {
            indexOf[k] = v;
        }

        const isBlacklisted: any = {};
        for (const [k, v] of this.isBlacklisted) {
            isBlacklisted[k] = v;
        }

        const thresholdOf: any = {};
        for (const [k, v] of this._thresholdOf) {
            thresholdOf[k] = v.toString();
        }

        const pendingOf: any = {};
        for (const [k, v] of this._pendingOf) {
            const _obj: any = (pendingOf[k] = {});
            for (const [_k, _v] of v) {
                _obj[_k] = serializeSimpleObject(_v);
            }
        }

        const pendingDuration = this.pendingDuration;
        return {
            indexOf,
            pendingDuration,
            allInstruments: [...this.allInstruments],
            reserveOf,
            isBlacklisted,
            thresholdOf,
            pendingOf,
            fundFlowOf,
        };
    }

    deserialize(serialized: any): this {
        if (this.reserveOf.size > 0) {
            throw new Error('invalid deserialize');
        }

        if (
            typeof serialized !== 'object' ||
            typeof serialized.indexOf !== 'object' ||
            typeof serialized.reserveOf !== 'object' ||
            typeof serialized.isBlacklisted !== 'object' ||
            typeof serialized.fundFlowOf !== 'object' ||
            typeof serialized.thresholdOf !== 'object' ||
            typeof serialized.pendingOf !== 'object' ||
            !Array.isArray(serialized.allInstruments)
        ) {
            throw new Error('invalid deserialize');
        }

        this.allInstruments = serialized.allInstruments;

        for (const [k, v] of Object.entries(serialized.indexOf)) {
            if (typeof v !== 'string') {
                throw new Error('invalid deserialize');
            }
            this.indexOf.set(k, v);
        }

        for (const [k, v] of Object.entries(serialized.isBlacklisted)) {
            if (typeof v !== 'boolean') {
                throw new Error('invalid deserialize');
            }
            this.isBlacklisted.set(k, v);
        }

        for (const [k, v] of Object.entries(serialized.reserveOf)) {
            if (typeof v !== 'object' || v === null) {
                throw new Error('invalid deserialize');
            }

            const _map = new Map<string, BigNumber>();
            for (const [_k, _v] of Object.entries(v)) {
                _map.set(_k, BigNumber.from(_v));
            }

            this.reserveOf.set(k, _map);
        }

        for (const [k, v] of Object.entries(serialized.fundFlowOf)) {
            if (typeof v !== 'object' || v === null) {
                throw new Error('invalid deserialize');
            }

            const _map = new Map<string, FundFlow>();
            for (const [_k, _v] of Object.entries(v)) {
                _map.set(_k, deserializeSimpleObject(_v));
            }

            this._fundFlowOf.set(k, _map);
        }

        for (const [k, v] of Object.entries(serialized.pendingOf)) {
            if (typeof v !== 'object' || v === null) {
                throw new Error('invalid deserialize');
            }

            const _map = new Map<string, Pending>();
            for (const [_k, _v] of Object.entries(v)) {
                _map.set(_k, deserializeSimpleObject(_v));
            }

            this._pendingOf.set(k, _map);
        }

        for (const [k, v] of Object.entries(serialized.thresholdOf)) {
            this._thresholdOf.set(k, BigNumber.from(v));
        }

        this.pendingDuration = serialized.pendingDuration;

        return this;
    }

    copy(): GateState {
        return new GateState(this.wrappedNativeToken).deserialize(this.serialize());
    }

    getEventTokenAddr(tokenAddr: string): string {
        return tokenAddr.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
            ? this.wrappedNativeToken.toLowerCase()
            : tokenAddr.toLowerCase();
    }

    getBalance(quote: string, trader: string): BigNumber {
        quote = quote.toLowerCase();
        trader = trader.toLowerCase();

        if (!this.reserveOf.has(quote)) {
            const accountBalance = new Map<string, BigNumber>();
            this.reserveOf.set(quote, accountBalance);
        }
        if (!this.reserveOf.get(quote)!.has(trader)) {
            this.reserveOf.get(quote)!.set(trader, ZERO);
        }
        return this.reserveOf.get(quote)!.get(trader)!;
    }

    fundFlowOf(quote: string, trader: string): FundFlow {
        quote = quote.toLowerCase();
        trader = trader.toLowerCase();

        if (!this._fundFlowOf.has(quote)) {
            const accountFundFlow = new Map<string, FundFlow>();
            this._fundFlowOf.set(quote, accountFundFlow);
        }
        if (!this._fundFlowOf.get(quote)!.has(trader)) {
            this._fundFlowOf.get(quote)!.set(trader, { totalIn: ZERO, totalOut: ZERO });
        }
        return this._fundFlowOf.get(quote)!.get(trader)!;
    }

    pendingOf(quote: string, trader: string): Pending {
        quote = quote.toLowerCase();
        trader = trader.toLowerCase();

        if (!this._pendingOf.has(quote)) {
            const accountPending = new Map<string, Pending>();
            this._pendingOf.set(quote, accountPending);
        }
        if (!this._pendingOf.get(quote)!.has(trader)) {
            this._pendingOf.get(quote)!.set(trader, { timestamp: 0, native: false, amount: ZERO, exemption: ZERO });
        }
        return this._pendingOf.get(quote)!.get(trader)!;
    }

    thresholdOf(quote: string): BigNumber {
        return this._thresholdOf.get(quote.toLowerCase()) ?? ZERO;
    }

    adjustBalance(quote: string, trader: string, delta: BigNumber): void {
        quote = quote.toLowerCase();
        trader = trader.toLowerCase();

        const balance = this.getBalance(quote, trader);
        this.reserveOf.get(quote)!.set(trader, balance.add(delta));
    }
}
