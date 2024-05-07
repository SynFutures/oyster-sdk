import { BigNumber } from 'ethers';
import { Observer } from './types/typechain';
import { TickMath, ZERO, SqrtPriceMath } from './math';

// get instrument's all tick bitmaps
export async function getTickBitMaps(
    observer: Observer,
    instrument: string,
    expiry: number,
): Promise<Map<number, BigNumber>> {
    const keys: Array<number> = new Array<number>();
    for (let i = -128; i < 128; i++) {
        keys.push(i);
    }
    const res: BigNumber[] = await observer.getTickBitmaps(instrument, expiry, keys);
    const ret: Map<number, BigNumber> = new Map<number, BigNumber>();
    for (let i = 0; i < keys.length; i++) {
        ret.set(keys[i], res[i]);
    }
    return ret;
}

export async function getNextInitializedTickOutside(
    observer: Observer,
    instrumentAddr: string,
    expiry: number,
    tick: number,
    right: boolean,
): Promise<number> {
    return observer.getNextInitializedTickOutside(instrumentAddr, expiry, tick, right);
}

// trade size needed to move AMM price to target tick
export async function getSizeToTargetTick(
    observer: Observer,
    instrumentAddr: string,
    expiry: number,
    targetTick: number,
): Promise<BigNumber> {
    const amm = await observer.getAmm(instrumentAddr, expiry);
    const targetPX96 = TickMath.getSqrtRatioAtTick(targetTick);
    if (targetPX96.eq(amm.sqrtPX96)) {
        return ZERO;
    }
    const long = targetTick > amm.tick;
    let size = ZERO;

    const currTickLeft = (await observer.getPearls(instrumentAddr, expiry, [amm.tick]))[0].left;
    if (long && currTickLeft.isNegative()) {
        size = size.sub(currTickLeft);
    }

    let sqrtPX96 = amm.sqrtPX96;
    let liquidity = amm.liquidity;

    let nextTick = await getNextInitializedTickOutside(
        observer,
        instrumentAddr,
        expiry,
        amm.tick + (long ? 0 : 1),
        long,
    );

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const nextPX96 = TickMath.getSqrtRatioAtTick(nextTick);
        if ((long && nextTick > targetTick) || (!long && nextTick < targetTick)) {
            // tick has been found
            const delta = SqrtPriceMath.getDeltaBaseAutoRoundUp(sqrtPX96, targetPX96, liquidity);
            // for now, add extra 1 to cover precision loss
            // todo by wwc: improve accuracy
            size = long ? size.add(delta).add(1) : size.sub(delta).sub(1);
            break;
        }
        // continue search
        const nextPearl = (await observer.getPearls(instrumentAddr, expiry, [nextTick]))[0];
        const delta = SqrtPriceMath.getDeltaBaseAutoRoundUp(sqrtPX96, nextPX96, liquidity);
        size = long ? size.add(delta) : size.sub(delta);
        if (nextTick === targetTick) {
            break;
        }
        if ((long && nextPearl.left.isNegative()) || (!long && nextPearl.left.gt(0))) {
            size = size.sub(nextPearl.left);
        }

        // update
        sqrtPX96 = nextPX96;
        if (nextPearl.liquidityGross.gt(ZERO)) {
            liquidity = liquidity.add(long ? nextPearl.liquidityNet : nextPearl.liquidityNet.mul(-1));
        }

        nextTick = await getNextInitializedTickOutside(observer, instrumentAddr, expiry, nextTick, long);
    }
    return size;
}
