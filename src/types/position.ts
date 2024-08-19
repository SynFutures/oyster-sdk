import { BigNumber } from 'ethers';
import { frac, oppositeSigns, wdivDown, wdivUp, wmulUp, wmulInt, r2w, wmulDown, wmul } from '../math';
import { ZERO, ONE } from '../math/constants';
import { Amm, PairState } from './pair';
import { MAX_POSITION_NUM, PERP_EXPIRY } from '../constants';

export interface Position {
    balance: BigNumber;
    size: BigNumber;
    entryNotional: BigNumber;
    entrySocialLossIndex: BigNumber;
    entryFundingIndex: BigNumber;
}

export interface Quotation {
    benchmark: BigNumber;
    sqrtFairPX96: BigNumber;
    tick: number;
    mark: BigNumber;
    entryNotional: BigNumber;
    fee: BigNumber;
    minAmount: BigNumber;
    sqrtPostFairPX96: BigNumber;
    postTick: number;
}

export const EMPTY_POSITION: Position = {
    balance: ZERO,
    size: ZERO,
    entryNotional: ZERO,
    entrySocialLossIndex: ZERO,
    entryFundingIndex: ZERO,
};

// e.g. 0b1101 => [0, 2, 3]
export function decomposePbitmap(pbitmap: BigNumber): number[] {
    const bits: number[] = [];
    for (let i = 0; i < MAX_POSITION_NUM; i++) {
        if (!pbitmap.and(ONE.shl(i)).isZero()) {
            bits.push(i);
        }
    }
    return bits;
}

export function tally(
    amm: Amm,
    position: Position,
    mark: BigNumber,
): { equity: BigNumber; pnl: BigNumber; socialLoss: BigNumber } {
    let fundingFee: BigNumber = ZERO;
    const value: BigNumber = wmul(mark, position.size.abs());
    const socialLoss: BigNumber = wmulUp(
        (position.size.gt(ZERO) ? amm.longSocialLossIndex : amm.shortSocialLossIndex).sub(
            position.entrySocialLossIndex,
        ),
        position.size.abs(),
    );

    // perp should consider funding fee
    if (amm.expiry === PERP_EXPIRY) fundingFee = calcFundingFee(amm, position);

    const pnl = (position.size.gt(ZERO) ? value.sub(position.entryNotional) : position.entryNotional.sub(value))
        .add(fundingFee)
        .sub(socialLoss);

    const equity = pnl.add(position.balance);
    return { equity: equity, pnl: pnl, socialLoss: socialLoss };
}

export function calcLiquidationPrice(amm: Amm, position: Position, maintenanceMarginRatio = 500): BigNumber {
    // if LONG:
    // price * size - entryNotional - socialLoss + balance + fundingFee = price * size * mmr
    // price = (entryNotional + socialLoss - balance - fundingFee) / (1 - mmr)*size
    // if SHORT:
    // entryNotional - price * size - socialLoss + balance + fundingFee = price * size * mmr
    // price = (entryNotional - socialLoss + balance + fundingFee) / (1 + mmr)*size
    const socialLoss: BigNumber = wmulUp(
        (position.size.gt(ZERO) ? amm.longSocialLossIndex : amm.shortSocialLossIndex).sub(
            position.entrySocialLossIndex,
        ),
        position.size.abs(),
    );
    const fundingFee = calcFundingFee(amm, position);
    let price: BigNumber;

    if (position.size.gt(ZERO)) {
        const numerator = position.entryNotional.add(socialLoss).sub(position.balance).sub(fundingFee);
        if (numerator.lte(ZERO)) return ZERO;
        price = wdivDown(numerator, wmulUp(position.size.abs(), r2w(10000 - maintenanceMarginRatio)));
    } else {
        const numerator = position.entryNotional.sub(socialLoss).add(position.balance).add(fundingFee);
        if (numerator.lte(ZERO)) return ZERO; // highly unlikely to happen
        price = wdivUp(numerator, wmulDown(position.size.abs(), r2w(10000 + maintenanceMarginRatio)));
    }
    return price;
}

export function calculatePriceFromPnl(amm: Amm, position: Position, pnl: BigNumber): BigNumber {
    // if LONG:
    // price = (pnl - fundingFee + socialLoss + entryNotional) / size
    // if SHORT:
    // price = (entryNotional + fundingFee - socialLoss - pnl) / size
    const socialLoss: BigNumber = wmulUp(
        (position.size.gt(ZERO) ? amm.longSocialLossIndex : amm.shortSocialLossIndex).sub(
            position.entrySocialLossIndex,
        ),
        position.size.abs(),
    );
    const fundingFee = calcFundingFee(amm, position);
    const value = position.size.gt(ZERO)
        ? pnl.add(socialLoss).add(position.entryNotional).sub(fundingFee)
        : position.entryNotional.sub(socialLoss).sub(pnl).add(fundingFee);

    const price = position.size.gt(ZERO) ? wdivUp(value, position.size.abs()) : wdivDown(value, position.size.abs());
    return price;
}

export function calcFundingFee(amm: Amm, position: Position): BigNumber {
    return wmulInt(
        (position.size.gte(ZERO) ? amm.longFundingIndex : amm.shortFundingIndex).sub(position.entryFundingIndex),
        position.size.abs(),
    );
}

export function calcPnl(amm: Amm, position: Position, mark: BigNumber): BigNumber {
    return tally(amm, position, mark).pnl;
}

export function realizeFundingWithPnl(amm: Amm, pos: Position): { position: Position; pnl: BigNumber } {
    if (pos.size.eq(0)) return { position: pos, pnl: ZERO };
    const position: Position = Object.assign({}, pos);

    const currentFundingIndex = position.size.gt(ZERO) ? amm.longFundingIndex : amm.shortFundingIndex;
    let pnl = ZERO;
    if (!currentFundingIndex.eq(position.entryFundingIndex)) {
        const funding = wmulInt(currentFundingIndex.sub(position.entryFundingIndex), position.size.abs());
        pnl = funding;

        position.entryFundingIndex = currentFundingIndex;
        position.balance = position.balance.add(funding);
    }
    return { position, pnl };
}

export function realizeFundingIncome(amm: Amm, pos: Position): Position {
    return realizeFundingWithPnl(amm, pos).position;
}

export function realizeSocialLossWithPnl(amm: Amm, pos: Position): { position: Position; pnl: BigNumber } {
    const long = pos.size.gt(ZERO);
    const usize = pos.size.abs();
    const socialLossIndex = long ? amm.longSocialLossIndex : amm.shortSocialLossIndex;
    const socialLoss = wmulUp(socialLossIndex.sub(pos.entrySocialLossIndex), usize);
    const pnl = socialLoss.mul(-1);
    pos.balance = pos.balance.sub(socialLoss);
    pos.entrySocialLossIndex = socialLossIndex;
    return { position: pos, pnl };
}

export function realizeSocialLoss(amm: Amm, pos: Position): Position {
    return realizeSocialLossWithPnl(amm, pos).position;
}

export function combine(
    amm: Amm,
    position_1: Position,
    position_2: Position,
): { position: Position; closedSize: BigNumber; realized: BigNumber } {
    let position1 = Object.assign({}, position_1);
    let position2 = Object.assign({}, position_2);
    let realized = ZERO;

    if (amm.expiry === PERP_EXPIRY) {
        const { position: realizedPosition1, pnl: realizedPnl1 } = realizeFundingWithPnl(amm, position1);
        const { position: realizedPosition2, pnl: realizedPnl2 } = realizeFundingWithPnl(amm, position2);
        position1 = realizedPosition1;
        position2 = realizedPosition2;
        realized = realized.add(realizedPnl1);
        realized = realized.add(realizedPnl2);
    }

    const { position: realizedPosition1, pnl: realizedPnl1 } = realizeSocialLossWithPnl(amm, position1);
    const { position: realizedPosition2, pnl: realizedPnl2 } = realizeSocialLossWithPnl(amm, position2);
    position1 = realizedPosition1;
    position2 = realizedPosition2;
    realized = realized.add(realizedPnl1);
    realized = realized.add(realizedPnl2);

    let pic: Position = {
        balance: ZERO,
        size: ZERO,
        entryNotional: ZERO,
        entrySocialLossIndex: ZERO,
        entryFundingIndex: ZERO,
    };
    let closedSize = ZERO;
    if (position1.size.eq(ZERO) || position2.size.eq(ZERO)) {
        pic = position1.size.eq(ZERO) ? position2 : position1;
        pic.balance = position1.balance.add(position2.balance);
        return { position: pic, closedSize: closedSize, realized: realized };
    }

    pic.size = position1.size.add(position2.size);
    if (oppositeSigns(position1.size, position2.size)) {
        closedSize = position1.size.abs().lt(position2.size.abs()) ? position1.size.abs() : position2.size.abs();

        const LongPic: Position = position1.size.gt(ZERO) ? position1 : position2;
        const shortPic: Position = position1.size.gt(ZERO) ? position2 : position1;
        let closedLongNotional: BigNumber = ZERO;
        let closedShortNotional: BigNumber = ZERO;

        if (pic.size.gt(ZERO)) {
            closedLongNotional = frac(LongPic.entryNotional, closedSize, LongPic.size.abs());
            closedShortNotional = shortPic.entryNotional;
            pic.entryNotional = LongPic.entryNotional.sub(closedLongNotional);
            pic.entrySocialLossIndex = LongPic.entrySocialLossIndex;
            pic.entryFundingIndex = LongPic.entryFundingIndex;
        } else if (pic.size.lt(ZERO)) {
            closedLongNotional = LongPic.entryNotional;
            closedShortNotional = frac(shortPic.entryNotional, closedSize, shortPic.size.abs());
            pic.entryNotional = shortPic.entryNotional.sub(closedShortNotional);
            pic.entrySocialLossIndex = shortPic.entrySocialLossIndex;
            pic.entryFundingIndex = shortPic.entryFundingIndex;
        } else {
            closedLongNotional = LongPic.entryNotional;
            closedShortNotional = shortPic.entryNotional;
        }
        const realizedPnl = closedShortNotional.sub(closedLongNotional);
        pic.balance = pic.balance.add(LongPic.balance).add(shortPic.balance).add(realizedPnl);
        realized = realized.add(realizedPnl);
    } else {
        pic.entryNotional = position1.entryNotional.add(position2.entryNotional);
        pic.entrySocialLossIndex = pic.size.gt(ZERO) ? amm.longSocialLossIndex : amm.shortSocialLossIndex;
        pic.entryFundingIndex = position1.size.gt(ZERO) ? amm.longFundingIndex : amm.shortFundingIndex;
        pic.balance = position1.balance.add(position2.balance);
    }

    return { position: pic, closedSize: closedSize, realized: realized };
}

export function positionEquity(ctx: PairState, p: Position, mark: BigNumber): BigNumber {
    const tallyRet = tally(ctx.amm as unknown as Amm, p, mark);
    return tallyRet.equity;
}

export function splitPosition(pos: Position, partSize: BigNumber): { partPos: Position; finalPos: Position } {
    const uFullSize = pos.size.abs();
    const uPartSize = partSize.abs();

    const partPos = {} as Position;
    const finalPos = pos;

    partPos.size = partSize;
    finalPos.size = pos.size.sub(partSize);

    partPos.balance = frac(pos.balance, uPartSize, uFullSize);
    finalPos.balance = pos.balance.sub(partPos.balance);

    partPos.entryNotional = frac(pos.entryNotional, uPartSize, uFullSize);
    finalPos.entryNotional = pos.entryNotional.sub(partPos.entryNotional);

    partPos.entrySocialLossIndex = pos.entrySocialLossIndex;
    partPos.entryFundingIndex = pos.entryFundingIndex;

    return { partPos, finalPos };
}
