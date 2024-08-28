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
        public readonly priceInfo:
            | {
                  tick: number; // need align input price to tick
              }
            | {
                  price: BigNumber; // or pass price to sdk to calculate
              },

        // [size] from website, input baseAmount or quoteAmount
        public readonly amountInfo:
            | {
                  base: BigNumber; // base size input from website
              }
            | {
                  quote: BigNumber; // input by quote will calculate base amount send to deep module
              },

        public readonly referralCode?: string,
    ) {}

    get isInverse(): boolean {
        return this.pair.isInverse;
    }
}

export class PlaceOrderRequest extends PlaceOrderRequestBase<PairModel> {
    get wrap(): WrappedPlaceOrderRequest {
        const priceInfo =
            'tick' in this.priceInfo
                ? { ...this.priceInfo }
                : {
                      price: this.isInverse ? safeWDiv(ONE, this.priceInfo.price) : this.priceInfo.price,
                  };

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
            priceInfo,
            this.amountInfo,
            this.referralCode,
        );
    }
}

export class WrappedPlaceOrderRequest extends PlaceOrderRequestBase<WrappedPairModel> {
    get unWrap(): PlaceOrderRequest {
        const priceInfo =
            'tick' in this.priceInfo
                ? { ...this.priceInfo }
                : {
                      price: this.isInverse ? safeWDiv(ONE, this.priceInfo.price) : this.priceInfo.price,
                  };

        return new PlaceOrderRequest(
            this.pair.unWrap,
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
            priceInfo,
            this.amountInfo,
            this.referralCode,
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
