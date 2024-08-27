/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { BigNumber } from 'ethers';
import { ONE, safeWDiv, TickMath, wmul } from '../../math';
import { WrappedPairModel, PairModel } from '../../models';
import { Side } from '../enum';

abstract class PlaceOrderRequestBase<T extends { isInverse: boolean }> {
    constructor(
        public readonly pair: T,
        public readonly traderAddr: string,
        public readonly side: Side, // side choose from website
        public readonly leverage: BigNumber, // leverage input from website
        public readonly deadline: number,

        // [price] from website, input orderTick or orderPrice
        protected readonly _priceInfo:
            | {
                  tick: number; // need align input price to tick
              }
            | {
                  price: BigNumber; // or pass price to sdk to calculate
              },

        // [size] from website, input baseAmount or quoteAmount
        protected readonly _amountInfo:
            | {
                  base: BigNumber; // base size input from website
              }
            | {
                  quote: BigNumber; // input by quote will calculate base amount send to deep module
              },
    ) {}

    get isInverse(): boolean {
        return this.pair.isInverse;
    }

    get priceInfo(): { tick: number; price: undefined } | { tick: undefined; price: BigNumber } {
        const tick = 'tick' in this._priceInfo ? this._priceInfo.tick : undefined;
        const price = 'price' in this._priceInfo ? this._priceInfo.price : undefined;

        return { tick, price } as { tick: number; price: undefined } | { tick: undefined; price: BigNumber };
    }

    get amountInfo():
        | { baseAmount: BigNumber; quoteAmount: undefined }
        | { baseAmount: undefined; quoteAmount: BigNumber } {
        const baseAmount = 'base' in this._amountInfo ? this._amountInfo.base : undefined;
        const quoteAmount = 'quote' in this._priceInfo ? this._priceInfo.quote : undefined;

        return { baseAmount, quoteAmount } as
            | { baseAmount: BigNumber; quoteAmount: undefined }
            | { baseAmount: undefined; quoteAmount: BigNumber };
    }
}

export class PlaceOrderRequest extends PlaceOrderRequestBase<PairModel> {
    get wrap(): WrappedPlaceOrderRequest {
        // eslint-disable-next-line prefer-const
        let { tick, price } = this.priceInfo;

        if (price) {
            price = safeWDiv(ONE, price);
        }

        return new WrappedPlaceOrderRequest(
            this.pair.wrap,
            this.traderAddr,
            this.isInverse
                ? this.side === Side.LONG
                    ? Side.SHORT
                    : this.side === Side.SHORT
                    ? Side.LONG
                    : Side.FLAT
                : this.side,
            this.leverage,
            this.deadline,
            price ? { price } : { tick: tick! },
            this._amountInfo,
        );
    }
}

export class WrappedPlaceOrderRequest extends PlaceOrderRequestBase<WrappedPairModel> {
    get unWrap(): PlaceOrderRequest {
        // eslint-disable-next-line prefer-const
        let { tick, price } = this.priceInfo;

        if (price) {
            price = safeWDiv(ONE, price);
        }

        return new PlaceOrderRequest(
            this.pair.wrap,
            this.traderAddr,
            this.isInverse
                ? this.side === Side.LONG
                    ? Side.SHORT
                    : this.side === Side.SHORT
                    ? Side.LONG
                    : Side.FLAT
                : this.side,
            this.leverage,
            this.deadline,
            price ? { price } : { tick: tick! },
            this._amountInfo,
        );
    }
}

abstract class SimulateOrderResultBase {
    constructor(
        public readonly baseSize: BigNumber,
        public readonly balance: BigNumber,
        public readonly leverageWad: BigNumber,
        public readonly marginToDepositWad: BigNumber,
        public readonly minOrderValue: BigNumber,
        public readonly minFeeRebate: BigNumber,
        public readonly tick: number,
        public readonly isInverse: boolean,
    ) {}

    get marginRequired(): BigNumber {
        return this.balance;
    }

    get estimatedTradeValue(): BigNumber {
        return wmul(TickMath.getWadAtTick(this.tick), this.baseSize);
    }
}

export class SimulateOrderResult extends SimulateOrderResultBase {
    get wrap(): WrappedSimulateOrderResult {
        return new WrappedSimulateOrderResult(
            this.baseSize,
            this.balance,
            this.leverageWad,
            this.marginToDepositWad,
            this.minOrderValue,
            this.minFeeRebate,
            this.tick,
            this.isInverse,
        );
    }

    get limitPrice(): BigNumber {
        return TickMath.getWadAtTick(this.tick);
    }
}

export class WrappedSimulateOrderResult extends SimulateOrderResultBase {
    get unWrap(): SimulateOrderResult {
        return new SimulateOrderResult(
            this.baseSize,
            this.balance,
            this.leverageWad,
            this.marginToDepositWad,
            this.minOrderValue,
            this.minFeeRebate,
            this.tick,
            this.isInverse,
        );
    }

    get limitPrice(): BigNumber {
        const limitPrice = TickMath.getWadAtTick(this.tick);
        return this.isInverse ? safeWDiv(ONE, limitPrice) : limitPrice;
    }
}
