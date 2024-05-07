/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { BigNumber, ethers } from 'ethers';
import { ZERO } from '../math';
import { NATIVE_TOKEN_ADDRESS } from '../constants';
import {
    BlacklistEventObject,
    NewInstrumentEventObject,
    SetPendingDurationEventObject,
    SetThresholdEventObject,
    UpdatePendingEventObject,
    WithdrawEventObject,
} from './typechain/Gate';
import { DepositEventObject } from './typechain/Gate';
import { GatherEventObject } from './typechain/Gate';
import { ScatterEventObject } from './typechain/Gate';
import { BlockInfo, SECS_PER_HOUR } from '@derivation-tech/web3-core';
import { ParsedEvent } from './common';
import { EventHandler } from './eventHandler';
import { deserializeSimpleObject, serializeSimpleObject } from '../common';

export interface FundFlow {
    totalIn: BigNumber;
    totalOut: BigNumber;
}

export interface Pending {
    timestamp: number;
    native: boolean;
    amount: BigNumber;
    exemption: BigNumber;
}

export class GateState extends EventHandler {
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
        super();
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
            this._pendingOf
                .get(quote)!
                .set(trader, { timestamp: 0, native: false, amount: ZERO, exemption: ZERO });
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

    // event Withdraw(address indexed quote, address indexed trader, uint quantity);
    handleWithdraw(event: ParsedEvent<WithdrawEventObject>, log: ethers.providers.Log): void {
        void log;
        let quote = event.args.quote.toLowerCase();
        const trader = event.args.trader.toLowerCase();

        quote = this.getEventTokenAddr(quote);
        const balance = this.getBalance(quote, trader);
        this.reserveOf.get(quote)!.set(trader, balance.sub(event.args.quantity));

        const fundFlow = this.fundFlowOf(quote, trader);
        fundFlow.totalOut = fundFlow.totalOut.add(event.args.quantity);
    }

    // event Deposit(address indexed quote, address indexed trader, uint quantity);
    handleDeposit(event: ParsedEvent<DepositEventObject>, log: ethers.providers.Log): void {
        void log;
        let quote = event.args.quote.toLowerCase();
        const trader = event.args.trader.toLowerCase();

        quote = this.getEventTokenAddr(quote);
        const balance = this.getBalance(quote, trader);
        this.reserveOf.get(quote)!.set(trader, balance.add(event.args.quantity));

        const fundFlow = this.fundFlowOf(quote, trader);
        fundFlow.totalIn = fundFlow.totalIn.add(event.args.quantity);
    }

    // event Gather(address indexed quote, address indexed trader, address indexed instrument, uint32 expiry, uint quantity);
    handleGather(event: ParsedEvent<GatherEventObject>, log: ethers.providers.Log): void {
        void log;
        const quote = event.args.quote.toLowerCase();
        const trader = event.args.trader.toLowerCase();

        this.adjustBalance(quote, trader, event.args.quantity);
    }

    // event Scatter(address indexed quote, address indexed trader, address indexed instrument, uint32 expiry, uint quantity);
    handleScatter(event: ParsedEvent<ScatterEventObject>, log: ethers.providers.Log): void {
        void log;
        const quote = event.args.quote.toLowerCase();
        const trader = event.args.trader.toLowerCase();

        this.adjustBalance(quote, trader, event.args.quantity.mul(-1));
    }

    // event NewInstrument(bytes32 index, address instrument, address base, address quote, string symbol, uint total);
    handleNewInstrument(event: ParsedEvent<NewInstrumentEventObject>, log: ethers.providers.Log): void {
        void log;
        this.allInstruments.push(event.args.instrument.toLowerCase());
        this.indexOf.set(event.args.instrument.toLowerCase(), event.args.index);
    }

    // event Blacklist(address indexed trader, bool banned);
    handleBlacklist(event: ParsedEvent<BlacklistEventObject>): void {
        this.isBlacklisted.set(event.args.trader.toLowerCase(), event.args.banned);
    }

    // event SetPendingDuration(uint duration);
    handleSetPendingDuration(event: ParsedEvent<SetPendingDurationEventObject>): void {
        this.pendingDuration = event.args.duration;
    }

    // event SetThreshold(address indexed quote, uint threshold);
    handleSetThreshold(event: ParsedEvent<SetThresholdEventObject>): void {
        this._thresholdOf.set(event.args.quote.toLowerCase(), event.args.threshold);
    }

    handleUpdatePending(event: ParsedEvent<UpdatePendingEventObject>): void {
        const currPending = event.args.pending;
        const prevPending = this.pendingOf(event.args.quote.toLowerCase(), event.args.trader.toLowerCase());
        if (currPending.amount.gt(prevPending.amount)) {
            // accumulate pending
            this.adjustBalance(
                event.args.quote.toLowerCase(),
                event.args.trader.toLowerCase(),
                currPending.amount.sub(prevPending.amount).mul(-1),
            );
        } else if (currPending.amount.eq(0) && prevPending.amount.gt(0)) {
            // release pending
            // since pending amount is already subtracted from reserve when pending is created,
            // and handleWithdraw subtracts duplicated withdraw amount from reserve, here need to add back the pending amount
            this.adjustBalance(event.args.quote.toLowerCase(), event.args.trader.toLowerCase(), prevPending.amount);
        }
        this._pendingOf.get(event.args.quote.toLowerCase())!.set(event.args.trader.toLowerCase(), currPending);
    }
}
