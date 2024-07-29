import { Order, PairModel, Side } from '../types';
import { BigNumber } from 'ethers';
import { orderKey, parseOrderTickNonce } from '../common';
import { TickMath, wdiv, wmul, ZERO } from '../math';
import { PositionModel } from './position.model';

export class OrderModel implements Order {
    public readonly rootPair: PairModel;

    balance: BigNumber;
    size: BigNumber;

    taken: BigNumber;
    tick: number;
    nonce: number;

    constructor(
        rootPair: PairModel,
        balance: BigNumber,
        size: BigNumber,
        taken: BigNumber,
        tick: number,
        nonce: number,
    ) {
        this.rootPair = rootPair;
        this.balance = balance;
        this.size = size;
        this.taken = taken;
        this.tick = tick;
        this.nonce = nonce;
    }

    public static fromRawOrder(rootPair: PairModel, order: Order, taken: BigNumber, oid: number): OrderModel {
        const { tick, nonce } = parseOrderTickNonce(oid);
        return new OrderModel(rootPair, order.balance, order.size, taken, tick, nonce);
    }

    get limitPrice(): BigNumber {
        return TickMath.getWadAtTick(this.tick);
    }

    public toPositionModel(): PositionModel {
        return new PositionModel(
            this.rootPair,
            this.balance,
            this.size,
            wmul(this.limitPrice, this.size.abs()),
            BigNumber.from(0),
            BigNumber.from(0),
        );
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
}
