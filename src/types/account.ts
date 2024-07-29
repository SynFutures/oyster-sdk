/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigNumber } from 'ethers';
import { Position } from './position';
import { Order } from './order';
import { Range } from './range';

export class NumericConverter {
    public static scaleQuoteAmount(amount: BigNumber, quoteDecimals: number): BigNumber {
        const quoteAmountScaler = BigNumber.from(10).pow(18 - quoteDecimals);
        return amount.mul(quoteAmountScaler);
    }

    public static toContractQuoteAmount(amount: BigNumber, quoteDecimals: number): BigNumber {
        const quoteAmountScaler = BigNumber.from(10).pow(18 - quoteDecimals);
        return amount.div(quoteAmountScaler);
    }

    public static toContractRatio(ratioWad: BigNumber): number {
        return ratioWad.div(BigNumber.from(10).pow(14)).toNumber();
    }
}

export interface Portfolio {
    oids: number[];
    rids: number[];
    position: Position;
    orders: Order[];
    ranges: Range[];
    ordersTaken: BigNumber[];
}

export default {};
