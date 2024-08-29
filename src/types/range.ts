import type { BigNumber } from 'ethers';
import type { BlockInfo } from '@derivation-tech/web3-core';

export interface Range {
    liquidity: BigNumber;
    entryFeeIndex: BigNumber;
    balance: BigNumber;
    sqrtEntryPX96: BigNumber;
    blockInfo?: BlockInfo;
}

export interface ExtendedRange extends Range {
    instrumentAddr: string;
    expiry: number;
    tickLower: number;
    tickUpper: number;
}
