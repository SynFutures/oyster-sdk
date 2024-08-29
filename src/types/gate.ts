/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { BigNumber } from 'ethers';

export interface FundFlow {
    totalIn: BigNumber;
    totalOut: BigNumber;
}

export interface Pending {
    timestamp: number;
    native: boolean;
    amount: BigNumber;
    exemption: BigNumber;
}
