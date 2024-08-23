// basic math calculations
import { BigNumber, BigNumberish } from 'ethers';
import {
    MAX_UINT_256,
    POWERS_OF_2,
    ONE,
    ZERO,
    TWO,
    MAX_SAFE_INTEGER,
    WAD,
    MAX_UINT_128,
    MAX_UINT_64,
    MAX_UINT_32,
    MAX_UINT_16,
    MAX_UINT_8,
    Q96,
} from './constants';
import { solidityRequire } from '../common/util';
import { TickMath } from './tickMath';
import { PEARL_SPACING, RATIO_DECIMALS } from '../constants';
import { FundFlow, Pending } from '../types';

export function mulDivRoundingUp(a: BigNumber, b: BigNumber, denominator: BigNumber): BigNumber {
    const product = a.mul(b);
    let result = product.div(denominator);
    if (!product.mod(denominator).eq(ZERO)) result = result.add(ONE);
    return result;
}

export function mulShift(val: BigNumber, mulBy: string): BigNumber {
    return val.mul(BigNumber.from(mulBy)).shr(128);
}

export function multiplyIn256(x: BigNumber, y: BigNumber): BigNumber {
    return x.mul(y).and(MAX_UINT_256);
}

export function addIn256(x: BigNumber, y: BigNumber): BigNumber {
    return x.add(y).and(MAX_UINT_256);
}

export function oppositeSigns(x: BigNumber, y: BigNumber): boolean {
    return x.mul(y).lt(ZERO) ? true : false;
}

export function mostSignificantBit(x: BigNumber): number {
    solidityRequire(x.gt(0), 'ZERO');
    solidityRequire(x.lte(MAX_UINT_256), 'MAX');

    let msb = 0;
    for (const [power, min] of POWERS_OF_2) {
        if (x.gte(min)) {
            x = x.shr(power);
            msb += power;
        }
    }
    return msb;
}

export function sqrt(value: BigNumber): BigNumber {
    solidityRequire(value.gte(0), 'NEGATIVE');

    // rely on built in sqrt if possible
    if (value.lt(MAX_SAFE_INTEGER)) {
        return BigNumber.from(Math.floor(Math.sqrt(Number(value))));
    }
    let z: BigNumber;
    let x: BigNumber;
    z = value;
    x = value.div(TWO).add(ONE);
    while (x.lt(z)) {
        z = x;
        x = value.div(x).add(x).div(TWO);
    }
    return z;
}

export function roundHalfUp(x: BigNumber, y: BigNumber): BigNumber {
    const z = y.div(TWO);
    if (x.gt(0)) {
        return x.add(z);
    }
    return x.sub(z);
}

export function neg(x: BigNumber): BigNumber {
    return ZERO.sub(x);
}

// simulate the '/' operator for signed number in Solidity language.
// This function only consider that y is positive.
// (13, 5) => 2
// (15, 5) => 3
// (17, 5) => 3
// (-13, 5) => -2
// (-15, 5) => -3
// (-17, 5) => -3
// Note that the 'x.div(y)' method of BigNumber also behave like above.
export function signedDiv(x: number, y: number): number {
    return (x - (x % y)) / y;
}

// division for unsigned WAD number, rounding to nearest
export function wdiv(x: BigNumber, y: BigNumber): BigNumber {
    return frac(x, WAD, y);
}

// division for unsigned WAD number, rounding to nearest
export function safeWDiv(x: BigNumber, y: BigNumber): BigNumber {
    if (y.eq(ZERO)) return ZERO;
    return frac(x, WAD, y);
}

// division for unsigned WAD number, rounding up
export function wdivUp(x: BigNumber, y: BigNumber): BigNumber {
    return fracUp(x, WAD, y);
}

// division for unsigned WAD number, rounding down
export function wdivDown(x: BigNumber, y: BigNumber): BigNumber {
    return fracDown(x, WAD, y);
}

// multiplication for unsigned WAD number, rounding to nearest
export function wmul(x: BigNumber, y: BigNumber): BigNumber {
    return frac(x, y, WAD);
}

// multiplication for signed WAD number, rounding to nearest
// equivalent to LibMathSigned.wmul(int, int)
export function wmulInt(x: BigNumber, y: BigNumber): BigNumber {
    let product = x.mul(y);
    if (product.isNegative()) {
        product = product.sub(WAD.div(2));
    } else {
        product = product.add(WAD.div(2));
    }
    return product.div(WAD);
}

// multiplication for unsigned WAD number, rounding up
export function wmulUp(x: BigNumber, y: BigNumber): BigNumber {
    return fracUp(x, y, WAD);
}

// multiplication for unsigned WAD number, rounding down
export function wmulDown(x: BigNumber, y: BigNumber): BigNumber {
    return fracDown(x, y, WAD);
}

// multiplication & division
// z = x * y / w, rounding up
export function fracUp(x: BigNumber, y: BigNumber, w: BigNumber): BigNumber {
    const prod = x.mul(y).add(w.sub(1)); // (x * y + w - 1)
    return prod.div(w); // (x * y + w - 1) / w
}

// multiplication & division
// z = x * y / w, rounding up
export function fracDown(x: BigNumber, y: BigNumber, w: BigNumber): BigNumber {
    return x.mul(y).div(w);
}

// multiplication & division
// z = x * y / w, rounding to nearest
export function frac(x: BigNumber, y: BigNumber, w: BigNumber): BigNumber {
    const prod = x.mul(y).add(w.div(2)); // (x * y + w / 2)
    return prod.div(w); // (x * y + w / 2) / w
}

export function weightedAverage(w1: BigNumber, x1: BigNumber, w2: BigNumber, x2: BigNumber): BigNumber {
    return x1.mul(w1).add(x2.mul(w2)).div(w1.add(w2));
}

// convert config ratio(r) to Wad(w)
// eg: 1000 => 1000 * 10 ** 18 / 10 ** 4
export function r2w(x: BigNumberish): BigNumber {
    x = BigNumber.from(x);
    return x.mul(BigNumber.from(10).pow(14));
}

export function s2w(x: BigNumberish): BigNumber {
    x = BigNumber.from(x);
    return x.mul(BigNumber.from(10).pow(16));
}

export function d2w(x: BigNumber, decimals: number): BigNumber {
    return x.mul(BigNumber.from(10).pow(18 - decimals));
}

export function w2d(x: BigNumber, decimals: number): BigNumber {
    return wmul(x, BigNumber.from(10).pow(decimals));
}

export function mulMod(x: BigNumber, y: BigNumber, d: BigNumber): BigNumber {
    return x.mod(d).mul(y.mod(d)).mod(d);
}

export function fullMul(x: BigNumber, y: BigNumber): { l: BigNumber; h: BigNumber } {
    const mm = mulMod(x, y, MAX_UINT_256);
    const l = x.mul(y);
    let h = mm.sub(l);
    if (mm.lt(l)) {
        h = h.sub(1);
    }
    return { l, h };
}

export function fullDiv(l: BigNumber, h: BigNumber, d: BigNumber): BigNumber {
    const negd = MAX_UINT_256.sub(d).add(1);
    const pow2 = d.and(negd);
    d = d.div(pow2);
    l = l.div(pow2);
    const negPow2 = MAX_UINT_256.sub(pow2).add(1);
    l = l.add(h.mul(negPow2.div(pow2).add(1)));
    let r = ONE;
    for (let i = 0; i < 8; i++) {
        r = r.mul(TWO.sub(d.mul(r)));
    }
    return l.mul(r);
}

export function mulDiv(x: BigNumber, y: BigNumber, d: BigNumber): BigNumber {
    let { l: _l, h: _h } = fullMul(x, y);
    const mm = mulMod(x, y, d);
    if (mm.gt(_l)) {
        _h = _h.sub(1);
    }
    _l = _l.sub(mm);
    return fullDiv(_l, _h, d);
}

export function sqrtX96ToWad(sqrtPX96: BigNumberish): BigNumber {
    sqrtPX96 = BigNumber.from(sqrtPX96);
    const px96 = mulDiv(sqrtPX96, sqrtPX96, Q96);
    return mulDiv(px96, WAD, Q96);
}

export function wadToSqrtX96(price: BigNumber): BigNumber {
    const x96 = price.mul(Q96).div(WAD);
    return sqrt(x96.mul(Q96));
}

export function wadToTick(price: BigNumber): number {
    const sqrtX96 = wadToSqrtX96(price);
    return TickMath.getTickAtSqrtRatio(sqrtX96);
}

export function leastSignificantBit(x: BigNumber): number {
    let r = 255;
    if (x.and(MAX_UINT_128).gt(ZERO)) {
        r -= 128;
    } else {
        x = x.shr(128);
    }
    if (x.and(MAX_UINT_64).gt(ZERO)) {
        r -= 64;
    } else {
        x = x.shr(64);
    }
    if (x.and(MAX_UINT_32).gt(ZERO)) {
        r -= 32;
    } else {
        x = x.shr(32);
    }
    if (x.and(MAX_UINT_16).gt(ZERO)) {
        r -= 16;
    } else {
        x = x.shr(16);
    }
    if (x.and(MAX_UINT_8).gt(ZERO)) {
        r -= 8;
    } else {
        x = x.shr(8);
    }
    if (x.and(BigNumber.from('0xf')).gt(ZERO)) {
        r -= 4;
    } else {
        x = x.shr(4);
    }
    if (x.and(BigNumber.from('0x3')).gt(ZERO)) {
        r -= 2;
    } else {
        x = x.shr(2);
    }
    if (x.and(BigNumber.from('0x1')).gt(ZERO)) r -= 1;
    return r;
}

export function leastNonnegativeRemainder(x: number, modulus: number): number {
    return ((x % modulus) + modulus) % modulus;
}

export function leastNonnegativeComplement(x: number, modulus: number): number {
    return (modulus - (x % modulus)) % modulus;
}

export function maxAmongThree(a: BigNumber, b: BigNumber, c: BigNumber): BigNumber {
    return (a.gt(b) ? a : b).gt(c) ? (a.gt(b) ? a : b) : c;
}

export function max(left: BigNumber, right: BigNumber): BigNumber {
    return left.gt(right) ? left : right;
}

export function min(left: BigNumber, right: BigNumber): BigNumber {
    return left.gt(right) ? right : left;
}

export function relativeDiffRatioWadAbs(wadA: BigNumber, wadB: BigNumber): BigNumber {
    return wdivUp(wadA.sub(wadB).abs(), wadA.lt(wadB) ? wadA : wadB);
}

export function getOrderLeverageByMargin(targetTick: number, baseSize: BigNumber, margin: BigNumber): BigNumber {
    return wdiv(wmul(TickMath.getWadAtTick(targetTick), baseSize.abs()), margin);
}

export function getMaxLeverage(imr: number): number {
    return 1 / (imr / 10 ** RATIO_DECIMALS);
}

export function calcMaxWithdrawable(
    threshold: BigNumber,
    pending: Pending,
    fundFlow: FundFlow,
    reserve: BigNumber,
): BigNumber {
    // exceed threshold condition
    // totalOut - totalIn + amount + quantity > threshold + exemption
    // quantity = threshold + exemption - totalOut + totalIn - amount
    const maxWithdrawable = threshold
        .add(pending.exemption)
        .sub(fundFlow.totalOut)
        .add(fundFlow.totalIn)
        .sub(pending.amount);
    // should be capped by 0 and reserve
    if (maxWithdrawable.lte(0)) return ZERO;
    if (maxWithdrawable.gt(reserve)) return reserve;
    return maxWithdrawable;
}

export function alignPriceWadToTick(priceWad: BigNumber): { tick: number; priceWad: BigNumber } {
    let tick = wadToTick(priceWad);
    tick = Math.round(tick / PEARL_SPACING) * PEARL_SPACING;

    const alignedPriceWad = TickMath.getWadAtTick(tick);
    return { tick: tick, priceWad: alignedPriceWad };
}

export function calcBoost(alpha: number, imr: number): number {
    if (alpha === 1) {
        throw new Error('Invalid alpha');
    }
    imr = imr / 10 ** RATIO_DECIMALS;
    return -2 / (alpha * (imr + 1) - Math.sqrt(alpha)) / (1 / Math.sqrt(alpha) - 1);
}
