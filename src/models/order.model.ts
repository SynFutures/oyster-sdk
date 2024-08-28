import { BigNumber } from 'ethers';
import { Order, Side } from '../types';
import { orderKey, parseOrderTickNonce } from '../common';
import { TickMath, wdiv, wmul, ZERO, WAD, safeWDiv } from '../math';

import { PositionModel, WrappedPositionModel } from './position.model';
import { PairModel, PairModelBase, WrappedPairModel } from './pair.model';
import { InstrumentModel, InstrumentModelBase, WrappedInstrumentModel } from './instrument.model';

export interface OrderData {
    rootPair: PairModel;
    balance: BigNumber;
    size: BigNumber;
    taken: BigNumber;
    tick: number;
    nonce: number;
}

abstract class OrderModelBase<U extends InstrumentModelBase, T extends PairModelBase<U>> {
    constructor(protected readonly data: OrderData) {}

    abstract get rootPair(): T;

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

    get isInverse(): boolean {
        return this.rootPair.isInverse;
    }

    get limitPrice(): BigNumber {
        return TickMath.getWadAtTick(this.tick);
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
}

export class OrderModel extends OrderModelBase<InstrumentModel, PairModel> implements Order {
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

    get equity(): BigNumber {
        return this.toPositionModel().getEquity();
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

export class WrappedOrderModel extends OrderModelBase<WrappedInstrumentModel, WrappedPairModel> {
    get rootPair(): WrappedPairModel {
        return this.data.rootPair.wrap;
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
        return this.isInverse ? safeWDiv(WAD, super.limitPrice) : super.limitPrice;
    }

    get equity(): BigNumber {
        return this.toPositionModel().getEquity();
    }

    toPositionModel(): WrappedPositionModel {
        return new PositionModel({
            rootPair: this.data.rootPair,
            balance: this.balance,
            size: this.size,
            entryNotional: wmul(this.limitPrice, this.size.abs()),
            entrySocialLossIndex: BigNumber.from(0),
            entryFundingIndex: BigNumber.from(0),
        }).wrap;
    }
}
