import { BigNumber } from 'ethers';
import { BlockInfo } from '@derivation-tech/web3-core';
import { Position } from './position';
import { r2w, ONE, Q96, SqrtPriceMath, sqrtX96ToWad, TickMath, wmul, wmulDown, wmulUp, ZERO } from '../math';
import { RANGE_SPACING } from '../constants';

export interface Range {
    liquidity: BigNumber;
    entryFeeIndex: BigNumber;
    balance: BigNumber;
    sqrtEntryPX96: BigNumber;
    blockInfo?: BlockInfo;
}

export function entryDelta(
    sqrtEntryPX96: BigNumber,
    tickLower: number,
    tickUpper: number,
    entryMargin: BigNumber,
    initialMarginRatio: number,
): { deltaBase: BigNumber; deltaQuote: BigNumber; liquidity: BigNumber } {
    const upperPX96 = TickMath.getSqrtRatioAtTick(tickUpper);
    const lowerPX96 = TickMath.getSqrtRatioAtTick(tickLower);
    const liquidityByUpper = getLiquidityFromMarginByUpper(sqrtEntryPX96, upperPX96, entryMargin, initialMarginRatio);
    const liquidityByLower = getLiquidityFromMarginByLower(sqrtEntryPX96, lowerPX96, entryMargin, initialMarginRatio);
    const liquidity = liquidityByUpper.lt(liquidityByLower) ? liquidityByUpper : liquidityByLower;
    const deltaBase = SqrtPriceMath.getDeltaBaseAutoRoundUp(sqrtEntryPX96, upperPX96, liquidity);
    const deltaQuote = SqrtPriceMath.getDeltaQuoteAutoRoundUp(lowerPX96, sqrtEntryPX96, liquidity);

    return { deltaBase: deltaBase, deltaQuote: deltaQuote, liquidity: liquidity };
}

export function alignRangeTick(tick: number, lower: boolean): number {
    if ((tick > 0 && lower) || (tick < 0 && !lower)) {
        return RANGE_SPACING * ~~(tick / RANGE_SPACING);
    } else {
        return RANGE_SPACING * ~~((tick + (tick > 0 ? 1 : -1) * (RANGE_SPACING - 1)) / RANGE_SPACING);
    }
}

export function getLiquidityFromMarginByUpper(
    sqrtEntryPX96: BigNumber,
    sqrtUpperPX96: BigNumber,
    entryMargin: BigNumber,
    initialMarginRatio: number,
): BigNumber {
    const numerator = entryMargin.mul(sqrtEntryPX96).div(sqrtUpperPX96.sub(sqrtEntryPX96));
    const denominator = sqrtUpperPX96.sub(sqrtEntryPX96).add(wmulUp(sqrtUpperPX96, r2w(initialMarginRatio)));
    return numerator.mul(Q96).div(denominator);
}

export function getLiquidityFromMarginByLower(
    sqrtEntryPX96: BigNumber,
    sqrtLowerPX96: BigNumber,
    entryMargin: BigNumber,
    initialMarginRatio: number,
): BigNumber {
    const numerator = entryMargin.mul(sqrtEntryPX96).div(sqrtEntryPX96.sub(sqrtLowerPX96));
    const denominator = sqrtEntryPX96.sub(sqrtLowerPX96).add(wmulUp(sqrtLowerPX96, r2w(initialMarginRatio)));
    return numerator.mul(Q96).div(denominator);
}

export function getMarginFromLiquidity(
    sqrtEntryPX96: BigNumber,
    tickUpper: number,
    liquidity: BigNumber,
    initialMarginRatio: number,
): BigNumber {
    const sqrtUpperPX96 = TickMath.getSqrtRatioAtTick(tickUpper);
    const denominator = wmulUp(sqrtUpperPX96, r2w(10000 + initialMarginRatio)).sub(sqrtEntryPX96);
    const temp = liquidity.mul(denominator).div(Q96);
    return temp.mul(sqrtUpperPX96.sub(sqrtEntryPX96)).div(sqrtEntryPX96);
}

export function rangeEntryDeltaBase(range: Range, tickUpper: number): BigNumber {
    const sqrtUpperPX96 = TickMath.getSqrtRatioAtTick(tickUpper);
    return SqrtPriceMath.getDeltaBaseAutoRoundUp(range.sqrtEntryPX96, sqrtUpperPX96, range.liquidity);
}

export function rangeEntryDeltaQuote(range: Range, tickLower: number): BigNumber {
    const sqrtLowerPX96 = TickMath.getSqrtRatioAtTick(tickLower);
    return SqrtPriceMath.getDeltaQuoteAutoRoundUp(sqrtLowerPX96, range.sqrtEntryPX96, range.liquidity);
}

export function rangeToPosition(
    currentPX96: BigNumber,
    currentTick: number,
    feeIndex: BigNumber,
    longSocialLossIndex: BigNumber,
    shortSocialLossIndex: BigNumber,
    longFundingIndex: BigNumber,
    shortFundingIndex: BigNumber,
    tickLower: number,
    tickUpper: number,
    range: Range,
): Position {
    const sqrtUpperPX96 = TickMath.getSqrtRatioAtTick(tickUpper);
    const sqrtLowerPX96 = TickMath.getSqrtRatioAtTick(tickLower);
    const fair = sqrtX96ToWad(currentPX96);
    const entryDeltaBase = rangeEntryDeltaBase(range, tickUpper);
    const entryDeltaQuote = rangeEntryDeltaQuote(range, tickLower);

    let removeDeltaBase = ZERO;
    let removeDeltaQuote = ZERO;

    if (currentTick < tickLower) {
        removeDeltaBase = SqrtPriceMath.getDeltaBaseAutoRoundUp(
            sqrtLowerPX96,
            TickMath.getSqrtRatioAtTick(tickUpper),
            range.liquidity,
        );
    } else if (currentTick < tickUpper) {
        removeDeltaBase = SqrtPriceMath.getDeltaBaseAutoRoundUp(
            currentPX96,
            TickMath.getSqrtRatioAtTick(tickUpper),
            range.liquidity,
        );
        removeDeltaQuote = SqrtPriceMath.getDeltaQuoteAutoRoundUp(sqrtLowerPX96, currentPX96, range.liquidity);
    } else {
        removeDeltaQuote = SqrtPriceMath.getDeltaQuoteAutoRoundUp(sqrtLowerPX96, sqrtUpperPX96, range.liquidity);
    }

    // cal pnl
    const earnedByBase = wmul(removeDeltaBase.sub(entryDeltaBase), fair);
    const earnedByQuote = removeDeltaQuote.sub(entryDeltaQuote);
    const pnl = earnedByBase.add(earnedByQuote);
    const fee = wmulDown(feeIndex.sub(range.entryFeeIndex), range.liquidity);
    const size = removeDeltaBase.sub(entryDeltaBase);
    return {
        balance: range.balance.add(fee).add(pnl).sub(ONE),
        size: size,
        takeProfitRatio: 0,
        stopLossRatio: 0,
        entryNotional: wmul(fair, size.abs()),
        entrySocialLossIndex: size.gt(ZERO) ? longSocialLossIndex : shortSocialLossIndex,
        entryFundingIndex: size.gt(ZERO) ? longFundingIndex : shortFundingIndex,
    } as Position;
}
