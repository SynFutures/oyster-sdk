/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { BigNumber } from 'ethers';
import { WAD, safeWDiv, TickMath, wmul } from '../../math';
import { WrappedPairModel, PairModel } from '../../models';
import { reverse } from '../../common';
import { Side } from '../enum';

export interface PlaceOrderRequestData<T extends { isInverse: boolean }> {
    pair: T;
    traderAddr: string;
    side: Side; // side choose from website
    leverage: BigNumber; // leverage input from website

    // [price] from website, input orderTick or orderPrice
    priceInfo:
        | {
              tick: number; // need align input price to tick
          }
        | {
              price: BigNumber; // or pass price to sdk to calculate
          };

    // [size] from website, input baseAmount or quoteAmount
    amountInfo:
        | {
              base: BigNumber; // base size input from website
          }
        | {
              quote: BigNumber; // input by quote will calculate base amount send to deep module
          };

    referralCode?: string;
}

abstract class PlaceOrderRequestBase<T extends { isInverse: boolean }> {
    constructor(protected readonly data: PlaceOrderRequestData<T>) {}

    get isInverse(): boolean {
        return this.data.pair.isInverse;
    }

    get pair(): T {
        return this.data.pair;
    }

    get traderAddr(): string {
        return this.data.traderAddr;
    }

    get side(): Side {
        return this.data.side;
    }

    get leverage(): BigNumber {
        return this.data.leverage;
    }

    get priceInfo():
        | {
              tick: number;
          }
        | {
              price: BigNumber;
          } {
        return this.data.priceInfo;
    }

    get amountInfo():
        | {
              base: BigNumber;
          }
        | {
              quote: BigNumber;
          } {
        return this.data.amountInfo;
    }

    get referralCode(): string | undefined {
        return this.data.referralCode;
    }
}

export class PlaceOrderRequest extends PlaceOrderRequestBase<PairModel> {
    get wrap(): WrappedPlaceOrderRequest {
        return new WrappedPlaceOrderRequest({
            ...this.data,
            pair: this.data.pair.wrap,
        });
    }
}

export class WrappedPlaceOrderRequest extends PlaceOrderRequestBase<WrappedPairModel> {
    get unWrap(): PlaceOrderRequest {
        return new PlaceOrderRequest({
            ...this.data,
            pair: this.pair.unWrap,
        });
    }

    get side(): Side {
        return this.isInverse ? reverse(super.side) : super.side;
    }

    get priceInfo():
        | {
              tick: number;
          }
        | {
              price: BigNumber;
          } {
        const priceInfo = super.priceInfo;

        if ('tick' in priceInfo) {
            return priceInfo;
        } else {
            return { price: this.isInverse ? safeWDiv(WAD, priceInfo.price) : priceInfo.price };
        }
    }
}

export interface SimulateOrderResultData {
    baseSize: BigNumber;
    balance: BigNumber;
    leverageWad: BigNumber;
    marginToDepositWad: BigNumber;
    minOrderValue: BigNumber;
    minFeeRebate: BigNumber;
    tick: number;
    isInverse: boolean;
}

abstract class SimulateOrderResultBase {
    constructor(protected readonly data: SimulateOrderResultData) {}

    get isInverse(): boolean {
        return this.data.isInverse;
    }

    get baseSize(): BigNumber {
        return this.data.baseSize;
    }

    get balance(): BigNumber {
        return this.data.balance;
    }

    get leverageWad(): BigNumber {
        return this.data.leverageWad;
    }

    get marginToDepositWad(): BigNumber {
        return this.data.marginToDepositWad;
    }

    get minOrderValue(): BigNumber {
        return this.data.minOrderValue;
    }

    get minFeeRebate(): BigNumber {
        return this.data.minFeeRebate;
    }

    get tick(): number {
        return this.data.tick;
    }

    get marginRequired(): BigNumber {
        return this.data.balance;
    }

    get estimatedTradeValue(): BigNumber {
        return wmul(TickMath.getWadAtTick(this.data.tick), this.data.baseSize);
    }
}

export class SimulateOrderResult extends SimulateOrderResultBase {
    get wrap(): WrappedSimulateOrderResult {
        return new WrappedSimulateOrderResult(this.data);
    }

    get limitPrice(): BigNumber {
        return TickMath.getWadAtTick(this.tick);
    }
}

export class WrappedSimulateOrderResult extends SimulateOrderResultBase {
    get unWrap(): SimulateOrderResult {
        return new SimulateOrderResult(this.data);
    }

    get limitPrice(): BigNumber {
        const limitPrice = TickMath.getWadAtTick(this.tick);
        return this.isInverse ? safeWDiv(WAD, limitPrice) : limitPrice;
    }
}
