import { BigNumber } from 'ethers';
import { Order, Side } from '../types';
import { orderKey, parseOrderTickNonce } from '../common';
import { TickMath, wdiv, wmul, ZERO, ONE, safeWDiv } from '../math';

import { PositionModel } from './position.model';
import { PairModel } from './pair.model';

export interface OrderData {
    rootPair: PairModel;
    balance: BigNumber;
    size: BigNumber;
    taken: BigNumber;
    tick: number;
    nonce: number;
}

export class OrderModel implements Order {
    constructor(protected readonly data: OrderData) {}

    static fromRawOrder(rootPair: PairModel, order: Order, taken: BigNumber, oid: number): OrderModel {
        const { tick, nonce } = parseOrderTickNonce(oid);
        return new OrderModel({
            rootPair,
            balance: order.balance,
            size: order.size,
            taken: taken,
            tick,
            nonce,
        });
    }

    get rootPair(): PairModel {
        return this.data.rootPair;
    }

    get balance(): BigNumber {
        return this.data.balance;
    }

    get size(): BigNumber {
        return this.data.size;
    }

    get taken(): BigNumber {
        return this.data.taken;
    }

    get tick(): number {
        return this.data.tick;
    }

    get nonce(): number {
        return this.data.nonce;
    }

    get wrap(): WrappedOrderModel {
        return new WrappedOrderModel(this.data);
    }

    get isInverse(): boolean {
        return this.rootPair.isInverse;
    }

    get limitPrice(): BigNumber {
        return TickMath.getWadAtTick(this.tick);
    }

    get equity(): BigNumber {
        return this.toPositionModel().getEquity();
    }

    get oid(): number {
        return orderKey(this.tick, this.nonce);
    }

    get side(): Side {
        if (this.size.isNegative()) {
            return Side.SHORT;
        } else if (this.size.isZero()) {
            return Side.FLAT;
        } else {
            return Side.LONG;
        }
    }

    get leverageWad(): BigNumber {
        const px = this.taken.eq(ZERO) ? this.limitPrice : this.rootPair.markPrice;
        const value = wmul(px, this.size.abs());
        return wdiv(value, this.balance);
    }

    toPositionModel(): PositionModel {
        return new PositionModel({
            rootPair: this.rootPair,
            balance: this.balance,
            size: this.size,
            entryNotional: wmul(this.limitPrice, this.size.abs()),
            entrySocialLossIndex: BigNumber.from(0),
            entryFundingIndex: BigNumber.from(0),
        });
    }
}

export class WrappedOrderModel extends OrderModel {
    get wrap(): WrappedOrderModel {
        throw new Error('invalid wrap');
    }

    get unWrap(): OrderModel {
        return new OrderModel(this.data);
    }

    get size(): BigNumber {
        return this.isInverse ? super.size.mul(-1) : super.size;
    }

    get side(): Side {
        return this.isInverse
            ? super.side === Side.LONG
                ? Side.SHORT
                : super.side === Side.SHORT
                ? Side.LONG
                : Side.FLAT
            : super.side;
    }

    get limitPrice(): BigNumber {
        return this.isInverse ? safeWDiv(ONE, super.limitPrice) : super.limitPrice;
    }
}
