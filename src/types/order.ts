import type { BigNumber } from 'ethers';

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
