/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigNumber } from 'ethers';
import { Status } from './enum';
import { BlockInfo, ZERO } from '@derivation-tech/web3-core';

export interface Amm {
    expiry: number; // timestamp of the specified expiry

    // for futures, it's the timestamp of moment switched to SETTLING
    // for perpetual, it's the timestamp of last funding fee update
    timestamp: number;
    status: Status;

    tick: number; // current tick. tick = floor(log_{1.0001}(sqrtPX96))
    sqrtPX96: BigNumber; // current price

    liquidity: BigNumber;
    totalLiquidity: BigNumber;

    involvedFund: BigNumber;
    openInterests: BigNumber;

    feeIndex: BigNumber;
    protocolFee: BigNumber;

    totalLong: BigNumber;
    totalShort: BigNumber;

    longSocialLossIndex: BigNumber;
    shortSocialLossIndex: BigNumber;

    longFundingIndex: BigNumber;
    shortFundingIndex: BigNumber;

    insuranceFund: BigNumber;
    settlementPrice: BigNumber;

    // the last updated block number of timestamp
    timestampUpdatedAt?: number;

    blockInfo?: BlockInfo;
}

export const EMPTY_AMM: Amm = {
    expiry: 0,
    timestamp: 0,
    status: Status.TRADING,
    tick: 0,
    sqrtPX96: ZERO,
    liquidity: ZERO,
    totalLiquidity: ZERO,
    involvedFund: ZERO,
    openInterests: ZERO,
    feeIndex: ZERO,
    protocolFee: ZERO,
    totalLong: ZERO,
    totalShort: ZERO,
    longSocialLossIndex: ZERO,
    shortSocialLossIndex: ZERO,
    longFundingIndex: ZERO,
    shortFundingIndex: ZERO,
    insuranceFund: ZERO,
    settlementPrice: ZERO,
};
