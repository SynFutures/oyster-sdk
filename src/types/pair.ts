/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BigNumber } from 'ethers';
import type { BlockInfo } from '@derivation-tech/web3-core';
import type { Status } from './enum';

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
