import type { BigNumber } from 'ethers';

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
