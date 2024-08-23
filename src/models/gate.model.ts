/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { BigNumber } from 'ethers';
import { BlockInfo, SECS_PER_HOUR } from '@derivation-tech/web3-core';
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
}
