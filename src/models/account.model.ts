/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { BigNumber } from 'ethers';
import { BlockInfo } from '@derivation-tech/web3-core';
import { EMPTY_POSITION, Order, Portfolio, Position, Range } from '../types';
import { rangeKey } from '../common';
import { ZERO } from '../math';

import { InstrumentModelBase, InstrumentModel, WrappedInstrumentModel } from './instrument.model';
import { RangeModel, WrappedRangeModel } from './range.model';
import { PositionModel, WrappedPositionModel } from './position.model';
import { OrderModel, WrappedOrderModel } from './order.model';
import { PairModelBase, PairModel, WrappedPairModel } from './pair.model';

export class AccountState {
    onumber = 0;
    rnumber = 0;
    oids: number[];
    rids: number[];
    position: Position;

    ranges = new Map<number, Range>();
    orders = new Map<number, Order>();

    blockInfo?: BlockInfo;

    constructor(
        position: Position,
        oids: number[],
        rids: number[],
        orders: Order[],
        ranges: Range[],
        blockInfo?: BlockInfo,
    ) {
        this.position = { ...position };
        this.oids = oids;
        this.rids = rids;
        this.onumber = oids.length;
        this.rnumber = rids.length;
        for (let i = 0; i < rids.length; i++) {
            this.ranges.set(rids[i], ranges[i]);
        }

        for (let i = 0; i < oids.length; i++) {
            this.orders.set(oids[i], orders[i]);
        }

        this.blockInfo = blockInfo;
    }
}

export interface PairLevelAccountData {
    rootPair: PairModel;
    // address of trader
    traderAddr: string;
    account: AccountState;
    ordersTaken?: BigNumber[];
    blockInfo?: BlockInfo;
}

abstract class PairLevelAccountModelBase<U extends InstrumentModelBase, T extends PairModelBase<U>> {
    constructor(protected readonly data: PairLevelAccountData) {}

    abstract get rootPair(): T;

    get traderAddr(): string {
        return this.data.traderAddr;
    }

    get account(): AccountState {
        return this.data.account;
    }

    get ordersTaken(): BigNumber[] {
        return this.data.ordersTaken ?? [];
    }

    get blockInfo(): BlockInfo | undefined {
        return this.data.blockInfo;
    }

    containsRange(lowerTick: number, upperTick: number): boolean {
        return this.account.rids.some((rid) => rid == rangeKey(lowerTick, upperTick));
    }
}

export class PairLevelAccountModel extends PairLevelAccountModelBase<InstrumentModel, PairModel> {
    static fromRawPortfolio(
        rootPair: PairModel,
        traderAddr: string,
        portfolio: Portfolio,
        blockInfo?: BlockInfo,
    ): PairLevelAccountModel {
        return new PairLevelAccountModel({
            rootPair,
            traderAddr,
            account: new AccountState(
                portfolio.position,
                portfolio.oids,
                portfolio.rids,
                portfolio.orders,
                portfolio.ranges,
                blockInfo,
            ),
            ordersTaken: portfolio.ordersTaken,
            blockInfo,
        });
    }

    static fromEmptyPortfolio(rootPair: PairModel, traderAddr: string): PairLevelAccountModel {
        return new PairLevelAccountModel({
            rootPair,
            traderAddr,
            account: new AccountState(EMPTY_POSITION, [], [], [], []),
            ordersTaken: [],
        });
    }

    get rootPair(): PairModel {
        return this.data.rootPair;
    }

    get wrap(): WrapppedPairLevelAccount {
        return new WrapppedPairLevelAccount(this.data);
    }

    get ranges(): RangeModel[] {
        const res = [];
        for (const rid of this.account.rids) {
            const range = this.account.ranges.get(rid)!;
            res.push(RangeModel.fromRawRange(this.rootPair, range, rid));
        }
        return res;
    }

    get orders(): OrderModel[] {
        const res = [];
        for (let i = 0; i < this.account.oids.length; i++) {
            const oid = this.account.oids[i];
            const order = this.account.orders.get(oid)!;
            res.push(OrderModel.fromRawOrder(this.rootPair, order, this.ordersTaken[i] ?? ZERO, oid));
        }
        return res;
    }

    get position(): PositionModel {
        return this.getMainPosition();
    }

    get accountValue(): BigNumber {
        let accountValue = ZERO;
        accountValue = accountValue.add(this.position.getEquity());
        for (const order of this.orders) {
            accountValue = accountValue.add(order.balance);
        }
        for (const range of this.ranges) {
            accountValue = accountValue.add(range.valueLocked);
        }
        return accountValue;
    }

    getMainPosition(): PositionModel {
        // TODO by @jinxi: add a cache and read from it?
        return PositionModel.fromRawPosition(this.rootPair, this.account.position);
    }
}

export class WrapppedPairLevelAccount extends PairLevelAccountModelBase<WrappedInstrumentModel, WrappedPairModel> {
    get rootPair(): WrappedPairModel {
        return this.data.rootPair.wrap;
    }

    get unWrap(): PairLevelAccountModel {
        return new PairLevelAccountModel(this.data);
    }

    get ranges(): WrappedRangeModel[] {
        const res = [];
        for (const rid of this.account.rids) {
            const range = this.account.ranges.get(rid)!;
            res.push(RangeModel.fromRawRange(this.data.rootPair, range, rid).wrap);
        }
        return res;
    }

    get orders(): WrappedOrderModel[] {
        const res = [];
        for (let i = 0; i < this.account.oids.length; i++) {
            const oid = this.account.oids[i];
            const order = this.account.orders.get(oid)!;
            res.push(OrderModel.fromRawOrder(this.data.rootPair, order, this.ordersTaken[i] ?? ZERO, oid).wrap);
        }
        return res;
    }

    get position(): WrappedPositionModel {
        return this.getMainPosition();
    }

    get accountValue(): BigNumber {
        let accountValue = ZERO;
        accountValue = accountValue.add(this.position.getEquity());
        for (const order of this.orders) {
            accountValue = accountValue.add(order.balance);
        }
        for (const range of this.ranges) {
            accountValue = accountValue.add(range.valueLocked);
        }
        return accountValue;
    }

    getMainPosition(): WrappedPositionModel {
        // TODO by @jinxi: add a cache and read from it?
        return PositionModel.fromRawPosition(this.data.rootPair, this.account.position).wrap;
    }
}

export class InstrumentLevelAccountModel {
    public readonly rootInstrument: InstrumentModel;

    // address of instrument
    instrumentAddr: string;
    // address of trader
    traderAddr: string;

    // expiry => portfolio
    portfolios: Map<number, PairLevelAccountModel>;

    constructor(rootInstrument: InstrumentModel, instrumentAddr: string, traderAddr: string) {
        this.rootInstrument = rootInstrument;
        this.instrumentAddr = instrumentAddr.toLowerCase();
        this.traderAddr = traderAddr.toLowerCase();
        this.portfolios = new Map();
    }

    public addPairLevelAccount(pair: PairModel, portfolio: Portfolio, blockInfo?: BlockInfo): void {
        const pairLevelAccount = PairLevelAccountModel.fromRawPortfolio(pair, this.traderAddr, portfolio, blockInfo);
        this.rootInstrument.state.setAccountState(this.traderAddr, pair.amm.expiry, pairLevelAccount.account);
        this.portfolios.set(pair.amm.expiry, pairLevelAccount);
    }
}
