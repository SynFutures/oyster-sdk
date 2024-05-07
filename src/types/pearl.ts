import { BlockInfo } from '@derivation-tech/web3-core';
import { BigNumber } from 'ethers';

export interface Pearl {
    liquidityGross: BigNumber; // the total position liquidity that references this tick
    liquidityNet: BigNumber; // amount of net liquidity added (subtracted) when tick is crossed from left to right (right to left)
    nonce: number;
    fee: BigNumber;
    left: BigNumber;
    taken: BigNumber;
    entrySocialLossIndex: BigNumber; // social loss per contract borne by taken but unfilled order
    entryFundingIndex: BigNumber; // funding income per contract owned by taken but unfilled order
    blockInfo?: BlockInfo;
}
