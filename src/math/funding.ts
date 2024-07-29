import { SECS_PER_DAY } from '@derivation-tech/web3-core';
import { Amm } from '../types';
import { frac, sqrtX96ToWad, wdiv, wmul } from './basic';
import { BigNumber } from 'ethers';

export function getLatestFundingIndex(
    amm: Amm,
    markPrice: BigNumber,
    timestamp: number,
): { longFundingIndex: BigNumber; shortFundingIndex: BigNumber } {
    return updateFundingIndex(amm, markPrice, timestamp);
}

export function updateFundingIndex(
    amm: Amm,
    mark: BigNumber,
    timestamp: number,
): { longFundingIndex: BigNumber; shortFundingIndex: BigNumber } {
    const timeElapsed = timestamp - amm.timestamp;
    if (timeElapsed == 0) return { longFundingIndex: amm.longFundingIndex, shortFundingIndex: amm.shortFundingIndex };
    const fair = sqrtX96ToWad(amm.sqrtPX96);

    const longPayShort = fair.gt(mark);
    const [payerSize, receiverSize] = longPayShort ? [amm.totalLong, amm.totalShort] : [amm.totalShort, amm.totalLong];
    const fundingFeeIndex = frac(fair.sub(mark).abs(), BigNumber.from(timeElapsed), BigNumber.from(SECS_PER_DAY));
    if (payerSize.gt(0)) {
        let [payerIndex, receiverIndex] = longPayShort
            ? [amm.longFundingIndex, amm.shortFundingIndex]
            : [amm.shortFundingIndex, amm.longFundingIndex];
        payerIndex = payerIndex.sub(fundingFeeIndex);
        const totalFundingFee = wmul(fundingFeeIndex, payerSize);
        if (receiverSize.gt(0)) {
            receiverIndex = receiverIndex.add(wdiv(totalFundingFee, receiverSize));
        }
        return longPayShort
            ? { longFundingIndex: payerIndex, shortFundingIndex: receiverIndex }
            : { longFundingIndex: receiverIndex, shortFundingIndex: payerIndex };
    }
    return { longFundingIndex: amm.longFundingIndex, shortFundingIndex: amm.shortFundingIndex };
}
