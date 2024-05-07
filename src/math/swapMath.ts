// TO BE FILLED
import { BigNumber } from 'ethers';
import { ZERO } from './constants';
import { SqrtPriceMath } from './sqrtPriceMath';
import { PairState } from '../types';
import { TickMath } from './tickMath';
import { neg } from './basic';

export interface SwapImpact {
    sqrtPostPX96: BigNumber;
    dx: BigNumber;
    dy: BigNumber;
}

export abstract class SwapMath {
    public static swapWithinRange(
        sqrtCurrentPX96: BigNumber,
        sqrtTargetPX96: BigNumber,
        liquidity: BigNumber,
        sizeLeft: BigNumber,
    ): SwapImpact {
        const long = sizeLeft.gt(ZERO);
        const dxMax = SqrtPriceMath.getDeltaBaseAutoRoundUp(sqrtTargetPX96, sqrtCurrentPX96, liquidity);
        let dxAbs: BigNumber = sizeLeft.abs();
        let sqrtPostPX96;
        if (dxAbs.gte(dxMax)) {
            // if sizeLeft is adequate
            dxAbs = dxMax;
            sqrtPostPX96 = sqrtTargetPX96;
        } else {
            // else sizeLeft is completely consumed
            sqrtPostPX96 = SqrtPriceMath.getNextSqrtPriceFromDeltaBase(sqrtCurrentPX96, liquidity, dxAbs, long);
        }

        const dy = SqrtPriceMath.getDeltaQuote(sqrtPostPX96, sqrtCurrentPX96, liquidity, long);
        const dx: BigNumber = long ? dxAbs : dxAbs.mul(-1);
        return { sqrtPostPX96, dx, dy };
    }

    public static swapCrossRange(
        pair: PairState,
        size: BigNumber,
    ): { liquidity: BigNumber; ticks: number[]; takens: BigNumber[] } {
        const amm = pair.amm;
        const ticks = [];
        const takens = [];
        const long: boolean = size.gt(ZERO);

        // update order at pearls
        let totalOrderValue = ZERO;
        let totalCurveValue = ZERO;
        let swapSize = size;
        const currTickLeft = pair.getPearl(amm.tick).left;
        if (!swapSize.eq(0) && long && currTickLeft.lt(0)) {
            const taken = swapSize.abs().gte(currTickLeft.abs()) ? currTickLeft : swapSize.mul(-1);
            ticks.push(amm.tick);
            takens.push(taken);
            const takenValue = TickMath.calcTakenNotional(amm.tick, taken);
            swapSize = swapSize.add(taken);
            totalOrderValue = totalOrderValue.add(takenValue);
            if (swapSize.eq(0)) {
                return { liquidity: amm.liquidity, ticks, takens };
            }
        }

        let targetTick = TickMath.nextInitializedTick(pair.tbitmap, long ? amm.tick : amm.tick + 1, long);
        let sqrtPX96State = amm.sqrtPX96;
        let liquidityState = amm.liquidity;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const targetPX96 = TickMath.getSqrtRatioAtTick(targetTick);

            const { sqrtPostPX96, dx, dy } = SwapMath.swapWithinRange(
                sqrtPX96State,
                targetPX96,
                liquidityState,
                swapSize,
            );
            sqrtPX96State = sqrtPostPX96;
            swapSize = swapSize.sub(dx);
            totalCurveValue = totalCurveValue.add(dy);

            if (sqrtPostPX96 == targetPX96) {
                const left = pair.getPearl(targetTick)!.left;
                if (!swapSize.eq(0) && ((long && left.lt(0)) || (!long && left.gt(0)))) {
                    const taken = swapSize.abs().gte(left.abs()) ? left : swapSize.mul(-1);
                    ticks.push(targetTick);
                    takens.push(taken);
                    const takenValue = TickMath.calcTakenNotional(targetTick, taken);
                    swapSize = swapSize.add(taken);
                    totalOrderValue = totalOrderValue.add(takenValue);
                }
                const isRangeEnd = pair.getPearl(targetTick)!.liquidityGross.gt(0);
                const lastLiquidity = liquidityState;
                if (isRangeEnd) {
                    let liqNet = pair.getPearl(targetTick).liquidityNet;
                    if (!long) liqNet = neg(liqNet);
                    liquidityState = liquidityState.add(liqNet);
                }
                if (swapSize.eq(ZERO)) {
                    if (!long) {
                        liquidityState = lastLiquidity;
                    }
                    break;
                }
                targetTick = TickMath.nextInitializedTick(pair.tbitmap, targetTick, long);
            } else {
                break;
            }
        }
        return { liquidity: liquidityState, ticks, takens };
    }
}
