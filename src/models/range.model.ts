import { BigNumber } from 'ethers';
import { Amm, Position, Range, rangeToPosition, tally } from '../types';
import { parseTicks, rangeKey } from '../common';
import { TickMath, wmulDown, WAD, safeWDiv } from '../math';

import { PositionModel, WrappedPositionModel } from './position.model';
import { PairModel, PairModelBase, WrappedPairModel } from './pair.model';
import { InstrumentModel, InstrumentModelBase, WrappedInstrumentModel } from './instrument.model';

function customAmm(tick: number, input: Amm): Amm {
    const amm = Object.assign({}, input);
    amm.tick = tick;
    amm.sqrtPX96 = TickMath.getSqrtRatioAtTick(tick);
    return amm;
}

export interface RangeData {
    rootPair: PairModel;
    liquidity: BigNumber;
    balance: BigNumber;
    sqrtEntryPX96: BigNumber;
    entryFeeIndex: BigNumber;
    tickLower: number;
    tickUpper: number;
}

abstract class RangeModelBase<U extends InstrumentModelBase, T extends PairModelBase<U>> {
    constructor(protected readonly data: RangeData) {}

    abstract get rootPair(): T;

    get liquidity(): BigNumber {
        return this.data.liquidity;
    }

    get balance(): BigNumber {
        return this.data.balance;
    }

    get sqrtEntryPX96(): BigNumber {
        return this.data.sqrtEntryPX96;
    }

    get entryFeeIndex(): BigNumber {
        return this.data.entryFeeIndex;
    }

    get tickLower(): number {
        return this.data.tickLower;
    }

    get tickUpper(): number {
        return this.data.tickUpper;
    }

    get isInverse(): boolean {
        return this.rootPair.isInverse;
    }

    get rid(): number {
        return rangeKey(this.tickLower, this.tickUpper);
    }

    get lowerPrice(): BigNumber {
        return TickMath.getWadAtTick(this.tickLower);
    }

    get upperPrice(): BigNumber {
        return TickMath.getWadAtTick(this.tickUpper);
    }

    get valueLocked(): BigNumber {
        const position = this.rawPositionIfRemove(this.rootPair.amm);
        const total = tally(this.data.rootPair.amm, position, this.data.rootPair.markPrice);
        return total.equity;
    }

    get feeEarned(): BigNumber {
        const amm = this.rootPair.amm;
        return wmulDown(amm.feeIndex.sub(this.entryFeeIndex), this.liquidity);
    }

    rawPositionIfRemove(amm: Amm): Position {
        return rangeToPosition(
            amm.sqrtPX96,
            amm.tick,
            amm.feeIndex,
            amm.longSocialLossIndex,
            amm.shortSocialLossIndex,
            amm.longFundingIndex,
            amm.shortFundingIndex,
            this.tickLower,
            this.tickUpper,
            this,
        );
    }
}

export class RangeModel extends RangeModelBase<InstrumentModel, PairModel> {
    public static fromRawRange(rootPair: PairModel, range: Range, rid: number): RangeModel {
        const { tickLower, tickUpper } = parseTicks(rid);
        return new RangeModel({
            rootPair,
            liquidity: range.liquidity,
            balance: range.balance,
            sqrtEntryPX96: range.sqrtEntryPX96,
            entryFeeIndex: range.entryFeeIndex,
            tickLower,
            tickUpper,
        });
    }

    get rootPair(): PairModel {
        return this.data.rootPair;
    }

    get wrap(): WrappedRangeModel {
        return new WrappedRangeModel(this.data);
    }

    get lowerPositionModelIfRemove(): PositionModel {
        const amm = customAmm(this.tickLower, this.rootPair.amm);
        const rawPositionLower = this.rawPositionIfRemove(amm);
        return PositionModel.fromRawPosition(this.rootPair, rawPositionLower);
    }

    get upperPositionModelIfRemove(): PositionModel {
        const amm = customAmm(this.tickUpper, this.rootPair.amm);
        const rawPositionLower = this.rawPositionIfRemove(amm);
        return PositionModel.fromRawPosition(this.rootPair, rawPositionLower);
    }
}

export class WrappedRangeModel extends RangeModelBase<WrappedInstrumentModel, WrappedPairModel> {
    get rootPair(): WrappedPairModel {
        return this.data.rootPair.wrap;
    }

    get unWrap(): RangeModel {
        return new RangeModel(this.data);
    }

    get tickLower(): number {
        return this.isInverse ? super.tickUpper : super.tickLower;
    }

    get tickUpper(): number {
        return this.isInverse ? super.tickLower : super.tickUpper;
    }

    get lowerPrice(): BigNumber {
        return this.isInverse ? safeWDiv(WAD, super.upperPrice) : super.lowerPrice;
    }

    get upperPrice(): BigNumber {
        return this.isInverse ? safeWDiv(WAD, super.lowerPrice) : super.upperPrice;
    }

    get lowerPositionModelIfRemove(): WrappedPositionModel {
        const amm = customAmm(this.tickUpper, this.rootPair.amm);
        const rawPositionLower = this.rawPositionIfRemove(amm);
        return PositionModel.fromRawPosition(this.data.rootPair, rawPositionLower).wrap;
    }

    get upperPositionModelIfRemove(): WrappedPositionModel {
        const amm = customAmm(this.tickLower, this.rootPair.amm);
        const rawPositionLower = this.rawPositionIfRemove(amm);
        return PositionModel.fromRawPosition(this.data.rootPair, rawPositionLower).wrap;
    }
}
