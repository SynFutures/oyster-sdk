import { ONE, MAX_UINT_256, ZERO, Q32 } from './constants';
import {
    leastNonnegativeComplement,
    leastNonnegativeRemainder,
    leastSignificantBit,
    mostSignificantBit,
    mulShift,
    signedDiv,
    sqrtX96ToWad,
    wadToSqrtX96,
    wmul,
} from './basic';
import { BigNumber } from 'ethers';
import { asInt256, asUint256, decompose, forceAsInt24, solidityRequire } from '../common/util';
import { MAX_TICK, MIN_TICK, PEARL_SPACING } from '../constants';

export abstract class TickMath {
    /**
     * The minimum tick that can be used on any pool.
     */
    public static MIN_TICK = -322517;
    /**
     * The maximum tick that can be used on any pool.
     */
    public static MAX_TICK = 443636;

    /**
     * The sqrt ratio corresponding to the minimum tick that could be used on any pool.
     */
    public static MIN_SQRT_RATIO: BigNumber = BigNumber.from('7867958450021363558555');
    /**
     * The sqrt ratio corresponding to the maximum tick that could be used on any pool.
     */
    public static MAX_SQRT_RATIO: BigNumber = BigNumber.from('340275971719517849884101479065584693834');

    /**
     * Returns the sqrt ratio as a Q64.96 for the given tick. The sqrt ratio is computed as sqrt(1.0001)^tick
     * Adjusted from: https://github.com/Uniswap/v3-sdk/blob/08a7c050cba00377843497030f502c05982b1c43/src/utils/tickMath.ts
     * @param tick the tick for which to compute the sqrt ratio
     */
    public static getSqrtRatioAtTick(tick: number): BigNumber {
        solidityRequire(tick >= TickMath.MIN_TICK && tick <= TickMath.MAX_TICK && Number.isInteger(tick), 'TICK');
        const absTick: number = tick < 0 ? tick * -1 : tick;

        let ratio: BigNumber =
            (absTick & 0x1) != 0
                ? BigNumber.from('0xfffcb933bd6fad37aa2d162d1a594001')
                : BigNumber.from('0x100000000000000000000000000000000');
        if ((absTick & 0x2) != 0) ratio = mulShift(ratio, '0xfff97272373d413259a46990580e213a');
        if ((absTick & 0x4) != 0) ratio = mulShift(ratio, '0xfff2e50f5f656932ef12357cf3c7fdcc');
        if ((absTick & 0x8) != 0) ratio = mulShift(ratio, '0xffe5caca7e10e4e61c3624eaa0941cd0');
        if ((absTick & 0x10) != 0) ratio = mulShift(ratio, '0xffcb9843d60f6159c9db58835c926644');
        if ((absTick & 0x20) != 0) ratio = mulShift(ratio, '0xff973b41fa98c081472e6896dfb254c0');
        if ((absTick & 0x40) != 0) ratio = mulShift(ratio, '0xff2ea16466c96a3843ec78b326b52861');
        if ((absTick & 0x80) != 0) ratio = mulShift(ratio, '0xfe5dee046a99a2a811c461f1969c3053');
        if ((absTick & 0x100) != 0) ratio = mulShift(ratio, '0xfcbe86c7900a88aedcffc83b479aa3a4');
        if ((absTick & 0x200) != 0) ratio = mulShift(ratio, '0xf987a7253ac413176f2b074cf7815e54');
        if ((absTick & 0x400) != 0) ratio = mulShift(ratio, '0xf3392b0822b70005940c7a398e4b70f3');
        if ((absTick & 0x800) != 0) ratio = mulShift(ratio, '0xe7159475a2c29b7443b29c7fa6e889d9');
        if ((absTick & 0x1000) != 0) ratio = mulShift(ratio, '0xd097f3bdfd2022b8845ad8f792aa5825');
        if ((absTick & 0x2000) != 0) ratio = mulShift(ratio, '0xa9f746462d870fdf8a65dc1f90e061e5');
        if ((absTick & 0x4000) != 0) ratio = mulShift(ratio, '0x70d869a156d2a1b890bb3df62baf32f7');
        if ((absTick & 0x8000) != 0) ratio = mulShift(ratio, '0x31be135f97d08fd981231505542fcfa6');
        if ((absTick & 0x10000) != 0) ratio = mulShift(ratio, '0x9aa508b5b7a84e1c677de54f3e99bc9');
        if ((absTick & 0x20000) != 0) ratio = mulShift(ratio, '0x5d6af8dedb81196699c329225ee604');
        if ((absTick & 0x40000) != 0) ratio = mulShift(ratio, '0x2216e584f5fa1ea926041bedfe98');
        if ((absTick & 0x80000) != 0) ratio = mulShift(ratio, '0x48a170391f7dc42444e8fa2');

        if (tick > 0) ratio = MAX_UINT_256.div(ratio);

        // back to Q96
        return ratio.mod(Q32).gt(ZERO) ? ratio.div(Q32).add(ONE) : ratio.div(Q32);
    }

    /**
     * Returns the tick corresponding to a given sqrt ratio, s.t. #getSqrtRatioAtTick(tick) <= sqrtRatioX96
     * and #getSqrtRatioAtTick(tick + 1) > sqrtRatioX96
     * Adjusted from: https://github.com/Uniswap/v3-sdk/blob/08a7c050cba00377843497030f502c05982b1c43/src/utils/tickMath.ts
     * @param sqrtRatioX96 the sqrt ratio as a Q64.96 for which to compute the tick
     */
    public static getTickAtSqrtRatio(sqrtRatioX96: BigNumber): number {
        solidityRequire(
            sqrtRatioX96.gte(TickMath.MIN_SQRT_RATIO) && sqrtRatioX96.lt(TickMath.MAX_SQRT_RATIO),
            'SQRT_RATIO',
        );

        const sqrtRatioX128 = sqrtRatioX96.shl(32);
        const msb = mostSignificantBit(sqrtRatioX128);

        let r: BigNumber;
        if (msb >= 128) {
            r = sqrtRatioX128.shr(msb - 127);
        } else {
            r = sqrtRatioX128.shl(127 - msb);
        }

        let log_2: BigNumber = BigNumber.from(msb - 128).mul(ONE.shl(64));

        let unsignedLog_2 = asUint256(log_2);

        for (let i = 0; i < 14; i++) {
            r = r.mul(r).shr(127);
            const f = r.shr(128);
            unsignedLog_2 = unsignedLog_2.or(f.shl(63 - i));
            r = r.shr(f.toNumber());
        }
        log_2 = asInt256(unsignedLog_2);
        const log_sqrt10001 = log_2.mul(BigNumber.from('255738958999603826347141'));

        const tickLow = forceAsInt24(
            this.signedShr(log_sqrt10001.sub(BigNumber.from('3402992956809132418596140100660247210')), 128),
        ).toNumber();
        const tickHigh = forceAsInt24(
            this.signedShr(log_sqrt10001.add(BigNumber.from('291339464771989622907027621153398088495')), 128),
        ).toNumber();

        return tickLow === tickHigh
            ? tickLow
            : TickMath.getSqrtRatioAtTick(tickHigh).lte(sqrtRatioX96)
            ? tickHigh
            : tickLow;
    }

    /// @dev no matter what sign number is, we always turn it to uint256 then shift right
    static signedShr(number: BigNumber, bits: number): BigNumber {
        const negative = number.isNegative();
        const temp = negative ? asUint256(number) : number;
        return temp.shr(bits);
    }

    public static getWadAtTick(tick: number): BigNumber {
        return sqrtX96ToWad(this.getSqrtRatioAtTick(tick));
    }

    public static getTickAtPWad(pWad: BigNumber): number {
        const sqrtX96 = wadToSqrtX96(pWad);
        return this.getTickAtSqrtRatio(sqrtX96);
    }

    public static calcTakenNotional(tick: number, size: BigNumber): BigNumber {
        const price = TickMath.getWadAtTick(tick);
        return wmul(price, size.abs());
    }

    public static nextInitializedTick(tickBitMap: Map<number, BigNumber>, tick: number, right: boolean): number {
        if (right) {
            const compressed = signedDiv(tick - leastNonnegativeRemainder(tick, PEARL_SPACING), PEARL_SPACING);
            const start = compressed + 1;
            // eslint-disable-next-line prefer-const
            let { wordPos, bitPos } = decompose(start);
            const word = tickBitMap.get(wordPos) ?? ZERO;
            // clear the low bitPos bits of word
            let masked = word.sub(word.mask(bitPos));
            if (!masked.isZero()) {
                return (start + leastSignificantBit(masked) - bitPos) * PEARL_SPACING;
            }
            const UPPER_BOUND = signedDiv(MAX_TICK, PEARL_SPACING) >> 8;
            while (wordPos < UPPER_BOUND) {
                wordPos++;
                masked = tickBitMap.get(wordPos) ?? ZERO;
                if (!masked.isZero()) {
                    return (wordPos * 256 + leastSignificantBit(masked)) * PEARL_SPACING;
                }
            }
            throw new Error('search tick upward, out of bound');
        } else {
            const compressed = signedDiv(tick + leastNonnegativeComplement(tick, PEARL_SPACING), PEARL_SPACING);
            const start = compressed - 1;
            // eslint-disable-next-line prefer-const
            let { wordPos, bitPos } = decompose(start);
            // clear the low (bitPos + 1) bits of word
            const word = tickBitMap.get(wordPos) ?? ZERO;
            let masked = word.mask(bitPos + 1);
            if (!masked.isZero()) {
                return (start - (bitPos - mostSignificantBit(masked))) * PEARL_SPACING;
            }
            const LOWER_BOUND = signedDiv(MIN_TICK, PEARL_SPACING) >> 8;
            while (wordPos > LOWER_BOUND) {
                wordPos--;
                masked = tickBitMap.get(wordPos) ?? ZERO;
                if (!masked.isZero()) {
                    return (wordPos * 256 + mostSignificantBit(masked)) * PEARL_SPACING;
                }
            }
            throw new Error('search tick down, out of bound');
        }
    }
}
