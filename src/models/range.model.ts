import { Amm, PairModel, Position, Range, rangeToPosition, tally } from '../types';
import { BigNumber } from 'ethers';
import { parseTicks, rangeKey } from '../common';
import { TickMath, wmulDown } from '../math';
import { PositionModel } from './position.model';

export class RangeModel {
    public readonly rootPair: PairModel;

    liquidity: BigNumber;
    balance: BigNumber;
    sqrtEntryPX96: BigNumber;
    entryFeeIndex: BigNumber;

    tickLower: number;
    tickUpper: number;

    constructor(
        rootPair: PairModel,
        liquidity: BigNumber,
        balance: BigNumber,
        sqrtEntryPX96: BigNumber,
        entryFeeIndex: BigNumber,
        tickLower: number,
        tickUpper: number,
    ) {
        this.rootPair = rootPair;
        this.liquidity = liquidity;
        this.balance = balance;
        this.sqrtEntryPX96 = sqrtEntryPX96;
        this.entryFeeIndex = entryFeeIndex;
        this.tickLower = tickLower;
        this.tickUpper = tickUpper;
    }

    public static fromRawRange(rootPair: PairModel, range: Range, rid: number): RangeModel {
        const { tickLower, tickUpper } = parseTicks(rid);
        return new RangeModel(
            rootPair,
            range.liquidity,
            range.balance,
            range.sqrtEntryPX96,
            range.entryFeeIndex,
            tickLower,
            tickUpper,
        );
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
