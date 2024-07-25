import { MAX_UINT_160, ONE, Q96, ZERO } from './constants';
import { addIn256, r2w, mulDivRoundingUp, multiplyIn256, wmulUp } from './basic';
import { BigNumber } from 'ethers';
import { solidityRequire } from '../common/util';
import { Quotation, QuoteParam } from '../types';

export abstract class SqrtPriceMath {
    public static getDeltaBaseAutoRoundUp(
        sqrtRatioAX96: BigNumber,
        sqrtRatioBX96: BigNumber,
        liquidity: BigNumber,
    ): BigNumber {
        return liquidity.lt(ZERO)
            ? this.getDeltaBase(sqrtRatioAX96, sqrtRatioBX96, liquidity.mul(-1), false).mul(-1)
            : this.getDeltaBase(sqrtRatioAX96, sqrtRatioBX96, liquidity, true);
    }

    public static getDeltaQuoteAutoRoundUp(
        sqrtRatioAX96: BigNumber,
        sqrtRatioBX96: BigNumber,
        liquidity: BigNumber,
    ): BigNumber {
        return liquidity.lt(ZERO)
            ? this.getDeltaQuote(sqrtRatioAX96, sqrtRatioBX96, liquidity.mul(-1), false).mul(-1)
            : this.getDeltaQuote(sqrtRatioAX96, sqrtRatioBX96, liquidity, true);
    }

    public static getDeltaBase(
        sqrtRatioAX96: BigNumber,
        sqrtRatioBX96: BigNumber,
        liquidity: BigNumber,
        roundUp: boolean,
    ): BigNumber {
        if (sqrtRatioAX96.gt(sqrtRatioBX96)) {
            [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
        }
        const numerator1 = liquidity.shl(96);
        const numerator2 = sqrtRatioBX96.sub(sqrtRatioAX96);
        return roundUp
            ? mulDivRoundingUp(mulDivRoundingUp(numerator1, numerator2, sqrtRatioBX96), ONE, sqrtRatioAX96)
            : numerator1.mul(numerator2).div(sqrtRatioBX96).div(sqrtRatioAX96);
    }

    public static getDeltaQuote(
        sqrtRatioAX96: BigNumber,
        sqrtRatioBX96: BigNumber,
        liquidity: BigNumber,
        roundUp: boolean,
    ): BigNumber {
        if (sqrtRatioAX96.gt(sqrtRatioBX96)) {
            [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
        }
        return roundUp
            ? mulDivRoundingUp(liquidity, sqrtRatioBX96.sub(sqrtRatioAX96), Q96)
            : sqrtRatioBX96.sub(sqrtRatioAX96).mul(liquidity).div(Q96);
    }

    public static getNextSqrtPriceFromDeltaBase(
        sqrtPX96: BigNumber,
        liquidity: BigNumber,
        amount: BigNumber,
        isLong: boolean,
    ): BigNumber {
        solidityRequire(sqrtPX96.gt(ZERO));
        solidityRequire(liquidity.gt(ZERO));

        // round to make sure that we pass the target price
        return this.getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amount, !isLong);
    }

    public static getNextSqrtPriceFromInput(
        sqrtPX96: BigNumber,
        liquidity: BigNumber,
        amountIn: BigNumber,
        zeroForOne: boolean,
    ): BigNumber {
        solidityRequire(sqrtPX96.gt(ZERO));
        solidityRequire(liquidity.gt(ZERO));

        return zeroForOne
            ? this.getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amountIn, true)
            : this.getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amountIn, true);
    }

    public static getNextSqrtPriceFromOutput(
        sqrtPX96: BigNumber,
        liquidity: BigNumber,
        amountOut: BigNumber,
        zeroForOne: boolean,
    ): BigNumber {
        solidityRequire(sqrtPX96.gt(ZERO));
        solidityRequire(liquidity.gt(ZERO));

        return zeroForOne
            ? this.getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amountOut, false)
            : this.getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amountOut, false);
    }

    public static getLiquidityFromMargin(
        sqrtEntryPX96: BigNumber,
        sqrtUpperPX96: BigNumber,
        entryMargin: BigNumber,
        initialMarginRatio: number,
    ): BigNumber {
        solidityRequire(sqrtEntryPX96.gt(ZERO));
        solidityRequire(sqrtUpperPX96.gt(ZERO));
        const numerator1 = entryMargin.mul(sqrtUpperPX96);
        const numerator2 = sqrtEntryPX96;
        const denominator1 = sqrtUpperPX96.sub(sqrtEntryPX96);

        let temp = numerator1.mul(numerator2).div(denominator1);
        temp = temp.mul(Q96).div(sqrtUpperPX96);
        const denominator2 = wmulUp(sqrtUpperPX96, r2w(initialMarginRatio + 10000)).sub(sqrtEntryPX96);
        return temp.div(denominator2);
    }

    private static getNextSqrtPriceFromAmount0RoundingUp(
        sqrtPX96: BigNumber,
        liquidity: BigNumber,
        amount: BigNumber,
        add: boolean,
    ): BigNumber {
        if (amount.eq(ZERO)) return sqrtPX96;
        const numerator1 = liquidity.shl(96);
        if (add) {
            const product = multiplyIn256(amount, sqrtPX96);
            if (product.div(amount).eq(sqrtPX96)) {
                const denominator = addIn256(numerator1, product);
                if (denominator.gte(numerator1)) {
                    return mulDivRoundingUp(numerator1, sqrtPX96, denominator);
                }
            }
            return mulDivRoundingUp(numerator1, ONE, numerator1.div(sqrtPX96).add(amount));
        } else {
            const product = multiplyIn256(amount, sqrtPX96);
            solidityRequire(product.div(amount).eq(sqrtPX96));
            solidityRequire(numerator1.gt(product));
            return mulDivRoundingUp(numerator1, sqrtPX96, numerator1.sub(product));
        }
    }

    private static getNextSqrtPriceFromAmount1RoundingDown(
        sqrtPX96: BigNumber,
        liquidity: BigNumber,
        amount: BigNumber,
        add: boolean,
    ): BigNumber {
        if (add) {
            const quotient = amount.lte(MAX_UINT_160) ? amount.shl(96).div(liquidity) : amount.mul(Q96).div(liquidity);
            return sqrtPX96.add(quotient);
        } else {
            const quotient = mulDivRoundingUp(amount, Q96, liquidity);
            solidityRequire(sqrtPX96.gt(quotient));
            return sqrtPX96.sub(quotient);
        }
    }

    public static getStabilityFee(quotation: Quotation, param: QuoteParam): BigNumber {
        const feePaid = quotation.fee;
        const protocolFeePaid = wmulUp(quotation.entryNotional, r2w(param.protocolFeeRatio));
        const baseFeePaid = wmulUp(quotation.entryNotional, r2w(param.tradingFeeRatio));

        let stabilityFee = feePaid.sub(protocolFeePaid).sub(baseFeePaid);
        if (stabilityFee.lt(0)) stabilityFee = ZERO;
        return stabilityFee;
    }
}
