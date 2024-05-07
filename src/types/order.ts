import { BigNumber } from 'ethers';
import { Position } from './position';
import { r2w, fracDown, TickMath, wmul, wmulUp, ZERO } from '../math';

export interface Order {
    balance: BigNumber;
    size: BigNumber;
}

// correspond Record in contract
// "Record" is a reserved keyword in TypeScript, so we can't use it as a type name.
export interface ContractRecord {
    taken: BigNumber;
    fee: BigNumber;
    entrySocialLossIndex: BigNumber;
    entryFundingIndex: BigNumber;
}

export function requiredMarginForOrder(limit: BigNumber, sizeWad: BigNumber, ratio: number): BigNumber {
    const marginValue: BigNumber = wmul(limit, sizeWad);
    const minAmount: BigNumber = wmulUp(marginValue, r2w(ratio));
    return minAmount;
}

export function fillOrderToPosition(
    pearlNonce: number,
    pearlTaken: BigNumber,
    pearlFee: BigNumber,
    pearlSocialLoss: BigNumber,
    pearlFundingIndex: BigNumber,
    order: Order,
    tick: number,
    nonce: number,
    fillSize: BigNumber,
    record: ContractRecord,
): Position {
    // TODO: check pearlSocialLoss this is correct

    if (fillSize.eq(ZERO)) {
        fillSize = order.size;
    }
    const usize = fillSize.abs();
    let makerFee: BigNumber;
    let entrySocialLossIndex: BigNumber;
    let entryFundingIndex: BigNumber;
    if (nonce < pearlNonce) {
        const utaken0 = record.taken.abs();
        makerFee = record.taken.eq(fillSize) ? record.fee : fracDown(record.fee, usize, utaken0);
        entrySocialLossIndex = record.entrySocialLossIndex;
        entryFundingIndex = record.entryFundingIndex;
    } else {
        const utaken1 = pearlTaken.abs();
        makerFee = pearlTaken.eq(fillSize) ? pearlFee : fracDown(pearlFee, usize, utaken1);
        entrySocialLossIndex = pearlSocialLoss;
        entryFundingIndex = pearlFundingIndex;
    }
    const srtikePrice = TickMath.getWadAtTick(tick);

    const pic: Position = {
        balance: order.balance.add(makerFee),
        size: fillSize,
        entryNotional: wmul(srtikePrice, fillSize.abs()),
        entrySocialLossIndex: entrySocialLossIndex,
        entryFundingIndex: entryFundingIndex,
    };
    return pic;
}

export function cancelOrderToPosition(
    pearlLeft: BigNumber,
    pearlNonce: number,
    pearlTaken: BigNumber,
    pearlFee: BigNumber,
    pearlSocialLoss: BigNumber,
    pearlFundingIndex: BigNumber,
    order: Order,
    tick: number,
    nonce: number,
    record: ContractRecord,
): Position {
    let pic: Position = {
        balance: order.balance,
        size: ZERO,
        entryNotional: ZERO,
        entrySocialLossIndex: ZERO,
        entryFundingIndex: ZERO,
    };
    const uleft: BigNumber = pearlLeft.abs();
    const usize: BigNumber = order.size.abs();
    if (uleft.lt(usize)) {
        // partially cancelled
        const tLeft = pearlLeft;
        pic = fillOrderToPosition(
            pearlNonce,
            pearlTaken,
            pearlFee,
            pearlSocialLoss,
            pearlFundingIndex,
            order,
            tick,
            nonce,
            order.size.sub(tLeft),
            record,
        );
    }
    // fully cancelled, no position generated
    return pic;
}
