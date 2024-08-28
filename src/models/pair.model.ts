/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { BigNumber } from 'ethers';
import { BlockInfo, ZERO } from '@derivation-tech/web3-core';
import { Amm, ContractRecord, Pearl, EMPTY_AMM } from '../types';
import { Q96, r2w, sqrtX96ToWad, TickMath, wadToSqrtX96, wmul, safeWDiv, WAD } from '../math';
import { formatExpiry, withinOrderLimit } from '../common';
import { ORDER_SPACING } from '../constants';

import { InstrumentModel, InstrumentModelBase, WrappedInstrumentModel } from './instrument.model';

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
}

export interface PairData {
    rootInstrument: InstrumentModel;
    state: PairState;
    markPrice: BigNumber;
}

export abstract class PairModelBase<T extends InstrumentModelBase> {
    constructor(protected readonly data: PairData) {}

    abstract get rootInstrument(): T;

    get state(): PairState {
        return this.data.state;
    }

    get markPrice(): BigNumber {
        return this.data.markPrice;
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

    // TODO: @samlior inverse?
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

export class PairModel extends PairModelBase<InstrumentModel> {
    public static minimalPairWithAmm(instrumentModel: InstrumentModel, initPairPrice: BigNumber): PairModel {
        const amm = { ...EMPTY_AMM };
        amm.sqrtPX96 = wadToSqrtX96(initPairPrice);
        amm.tick = TickMath.getTickAtPWad(initPairPrice);

        return new PairModel({
            rootInstrument: instrumentModel,
            state: new PairState(amm),
            markPrice: ZERO,
        });
    }

    get wrap(): WrappedPairModel {
        return new WrappedPairModel(this.data);
    }

    get rootInstrument(): InstrumentModel {
        return this.data.rootInstrument;
    }
}

export class WrappedPairModel extends PairModelBase<WrappedInstrumentModel> {
    get unWrap(): PairModel {
        return new PairModel(this.data);
    }

    get rootInstrument(): WrappedInstrumentModel {
        return this.data.rootInstrument.wrap;
    }

    get markPrice(): BigNumber {
        return this.isInverse ? safeWDiv(WAD, super.markPrice) : super.markPrice;
    }

    get fairPriceWad(): BigNumber {
        return this.isInverse ? safeWDiv(WAD, super.fairPriceWad) : super.fairPriceWad;
    }

    get benchmarkPrice(): BigNumber {
        return this.isInverse ? safeWDiv(WAD, super.benchmarkPrice) : super.benchmarkPrice;
    }
}
