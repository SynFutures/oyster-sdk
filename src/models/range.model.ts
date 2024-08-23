import { BigNumber } from 'ethers';
import { Amm, Position, Range, rangeToPosition, tally } from '../types';
import { parseTicks, rangeKey } from '../common';
import { TickMath, wmulDown, ONE, wdiv } from '../math';

import { PositionModel } from './position.model';
import { PairModel } from './pair.model';

export interface RangeData {
    rootPair: PairModel;
    liquidity: BigNumber;
    balance: BigNumber;
    sqrtEntryPX96: BigNumber;
    entryFeeIndex: BigNumber;
    tickLower: number;
    tickUpper: number;
}

export class RangeModel {
    constructor(private readonly data: RangeData) {}

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

    get wrapped(): WrappedRangeModel {
        return new WrappedRangeModel(this.data);
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
        const total = tally(this.rootPair.amm, position, this.rootPair.markPrice);
        return total.equity;
    }

    get feeEarned(): BigNumber {
        const amm = this.rootPair.amm;
        return wmulDown(amm.feeIndex.sub(this.entryFeeIndex), this.liquidity);
    }

    get lowerPositionModelIfRemove(): PositionModel {
        const amm = this.customAmm(this.tickLower, this.rootPair.amm);
        const rawPositionLower = this.rawPositionIfRemove(amm);
        return PositionModel.fromRawPosition(this.rootPair, rawPositionLower);
    }

    get upperPositionModelIfRemove(): PositionModel {
        const amm = this.customAmm(this.tickUpper, this.rootPair.amm);
        const rawPositionLower = this.rawPositionIfRemove(amm);
        return PositionModel.fromRawPosition(this.rootPair, rawPositionLower);
    }

    public rawPositionIfRemove(amm: Amm): Position {
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

    private customAmm(tick: number, input: Amm): Amm {
        const amm = Object.assign({}, input);
        amm.tick = tick;
        amm.sqrtPX96 = TickMath.getSqrtRatioAtTick(tick);
        return amm;
    }
}

export class WrappedRangeModel extends RangeModel {
    get tickLower(): number {
        return this.isInverse ? super.tickUpper : super.tickLower;
    }

    get tickUpper(): number {
        return this.isInverse ? super.tickLower : super.tickUpper;
    }

    get lowerPrice(): BigNumber {
        return this.isInverse ? wdiv(ONE, super.upperPrice) : super.lowerPrice;
    }

    get upperPrice(): BigNumber {
        return this.isInverse ? wdiv(ONE, super.lowerPrice) : super.upperPrice;
    }

    get lowerPositionModelIfRemove(): PositionModel {
        return this.isInverse ? super.upperPositionModelIfRemove : super.lowerPositionModelIfRemove;
    }

    get upperPositionModelIfRemove(): PositionModel {
        return this.isInverse ? super.lowerPositionModelIfRemove : super.upperPositionModelIfRemove;
    }
}
