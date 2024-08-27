/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { BigNumber } from 'ethers';
import { BlockInfo } from '@derivation-tech/web3-core';
import { EMPTY_POSITION, Order, Portfolio, Position, Range } from '../types';
import { rangeKey } from '../common';
import { ZERO } from '../math';

import { InstrumentModel } from './instrument.model';
import { RangeModel } from './range.model';
import { PositionModel } from './position.model';
import { OrderModel } from './order.model';
import { PairModel } from './pair.model';

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

export class PairLevelAccountModel {
    public readonly rootPair: PairModel;
    // address of trader
    traderAddr: string;
    account: AccountState;

    ordersTaken: BigNumber[];
    blockInfo?: BlockInfo;

    constructor(
        rootPair: PairModel, // address of trader
        traderAddr: string,
        account: AccountState,
        ordersTaken?: BigNumber[],
        blockInfo?: BlockInfo,
    ) {
        this.rootPair = rootPair;
        this.traderAddr = traderAddr;
        this.account = account;

        this.ordersTaken = ordersTaken ?? [];
        this.blockInfo = blockInfo;
    }

    public static fromRawPortfolio(
        rootPair: PairModel,
        traderAddr: string,
        portfolio: Portfolio,
        blockInfo?: BlockInfo,
    ): PairLevelAccountModel {
        return new PairLevelAccountModel(
            rootPair,
            traderAddr,
            new AccountState(
                portfolio.position,
                portfolio.oids,
                portfolio.rids,
                portfolio.orders,
                portfolio.ranges,
                blockInfo,
            ),
            portfolio.ordersTaken,
            blockInfo,
        );
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

    public static fromEmptyPortfolio(rootPair: PairModel, traderAddr: string): PairLevelAccountModel {
        return new PairLevelAccountModel(rootPair, traderAddr, new AccountState(EMPTY_POSITION, [], [], [], []), []);
    }

    public getMainPosition(): PositionModel {
        // TODO by @jinxi: add a cache and read from it?
        return PositionModel.fromRawPosition(this.rootPair, this.account.position);
    }

    public containsRange(lowerTick: number, upperTick: number): boolean {
        return this.account.rids.some((rid) => rid == rangeKey(lowerTick, upperTick));
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
