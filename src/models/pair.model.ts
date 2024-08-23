/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { BigNumber } from 'ethers';
import { BlockInfo, ZERO } from '@derivation-tech/web3-core';
import { Amm, ContractRecord, Pearl, Status } from '../types';
import { Q96, r2w, sqrtX96ToWad, TickMath, wadToSqrtX96, wmul } from '../math';
import { formatExpiry, withinOrderLimit } from '../common';
import { ORDER_SPACING } from '../constants';

import { InstrumentModel } from './instrument.model';

export class PairState {
    amm: Amm;
    pearls = new Map<number, Pearl>();
    tbitmap = new Map<number, BigNumber>();
    records = new Map<number, Map<number, ContractRecord>>();

    blockInfo?: BlockInfo;

    constructor(amm: Amm, blockInfo?: BlockInfo) {
        this.amm = { ...amm };
        this.amm.blockInfo = blockInfo;
        this.blockInfo = blockInfo;
    }

    get fairPriceWad(): BigNumber {
        return sqrtX96ToWad(this.amm.sqrtPX96);
    }

    setPearl(tick: number, pearl: Pearl): void {
        this.pearls.set(tick, pearl);
    }

    setRecord(tick: number, nonce: number, record: ContractRecord): void {
        if (!this.records.has(tick)) {
            this.records.set(tick, new Map<number, ContractRecord>());
        }
        const nonceMap = this.records.get(tick)!;
        nonceMap.set(nonce, record);
        this.records.set(tick, nonceMap);
    }

    setTickBitMap(wordPos: number, word: BigNumber): void {
        this.tbitmap.set(wordPos, word);
    }

    getPearl(tick: number): Pearl {
        if (!this.pearls.has(tick)) {
            this.setPearl(tick, {
                liquidityGross: ZERO,
                liquidityNet: ZERO,
                nonce: 0,
                fee: ZERO,
                left: ZERO,
                taken: ZERO,
                entrySocialLossIndex: ZERO,
                entryFundingIndex: ZERO,
            } as Pearl);
        }
        return this.pearls.get(tick)!;
    }

    getRecord(tick: number, nonce: number): ContractRecord {
        if (!this.records.has(tick)) {
            this.records.set(tick, new Map<number, ContractRecord>());
        }
        if (!this.records.get(tick)!.has(nonce)) {
            this.setRecord(tick, nonce, {
                taken: ZERO,
                fee: ZERO,
                entrySocialLossIndex: ZERO,
                entryFundingIndex: ZERO,
            });
        }
        return this.records.get(tick)!.get(nonce)!;
    }

    // int16 => uint
    getTbitmapWord(wordPos: number): BigNumber {
        if (!this.tbitmap.has(wordPos)) {
            this.setTickBitMap(wordPos, ZERO);
        }

        return this.tbitmap.get(wordPos)!;
    }
}

export class PairModel {
    public readonly rootInstrument: InstrumentModel;
    state: PairState;

    markPrice: BigNumber;

    constructor(rootInstrument: InstrumentModel, amm: Amm, markPrice: BigNumber, blockInfo?: BlockInfo) {
        this.rootInstrument = rootInstrument;
        this.state = new PairState(amm, blockInfo);
        this.markPrice = markPrice;
    }

    public static minimalPairWithAmm(instrumentModel: InstrumentModel, initPairPrice: BigNumber): PairModel {
        const amm = {
            expiry: 0,
            timestamp: 0,
            status: Status.TRADING,
            tick: 0,
            sqrtPX96: ZERO,
            liquidity: ZERO,
            totalLiquidity: ZERO,
            involvedFund: ZERO,
            insuranceFund: ZERO,
            openInterests: ZERO,
            feeIndex: ZERO,
            protocolFee: ZERO,
            totalLong: ZERO,
            totalShort: ZERO,
            longSocialLossIndex: ZERO,
            shortSocialLossIndex: ZERO,
            longFundingIndex: ZERO,
            shortFundingIndex: ZERO,
            settlementPrice: ZERO,
        };
        amm.sqrtPX96 = wadToSqrtX96(initPairPrice);
        amm.tick = TickMath.getTickAtPWad(initPairPrice);

        return new PairModel(instrumentModel, amm, ZERO);
    }

    get isInverse(): boolean {
        return this.rootInstrument.isInverse;
    }

    get amm(): Amm {
        return this.state.amm;
    }

    get symbol(): string {
        return `${this.rootInstrument.info.symbol}-${formatExpiry(this.amm.expiry)}`;
    }

    get fairPriceWad(): BigNumber {
        // p * 10^(d-8) * 10^18 => p * 10^18
        return sqrtX96ToWad(this.amm.sqrtPX96);
    }

    get benchmarkPrice(): BigNumber {
        return this.rootInstrument.getBenchmarkPrice(this.amm.expiry);
    }

    get openInterests(): BigNumber {
        return this.amm.openInterests;
    }

    get placeOrderLimit(): {
        upperTick: number;
        lowerTick: number;
    } {
        const currentImr = this.rootInstrument.setting.initialMarginRatio;
        const maxDiff = wmul(this.markPrice, r2w(currentImr)).mul(2);
        const rawUpperTick = TickMath.getTickAtPWad(this.markPrice.add(maxDiff));
        const rawLowerTick = TickMath.getTickAtPWad(this.markPrice.sub(maxDiff));
        let upperTick = ORDER_SPACING * Math.floor(rawUpperTick / ORDER_SPACING);
        let lowerTick = ORDER_SPACING * Math.ceil(rawLowerTick / ORDER_SPACING);
        if (!withinOrderLimit(TickMath.getWadAtTick(rawUpperTick), this.markPrice, currentImr)) {
            upperTick = upperTick - ORDER_SPACING;
        }

        if (!withinOrderLimit(TickMath.getWadAtTick(rawLowerTick), this.markPrice, currentImr)) {
            lowerTick = lowerTick + ORDER_SPACING;
        }
        return {
            upperTick,
            lowerTick,
        };
    }

    getMinLiquidity(px96?: BigNumber): BigNumber {
        const sqrtPX96 = px96 ? px96 : this.amm.sqrtPX96;
        return this.rootInstrument.minRangeValue.mul(Q96).div(sqrtPX96.mul(2));
    }
}
