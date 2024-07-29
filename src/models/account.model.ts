import {
    Amm,
    combine,
    EMPTY_POSITION,
    Order,
    Portfolio,
    Position,
    positionEquity,
    QuoteParam,
    Range,
    realizeFundingIncome,
    splitPosition,
} from '../types';
import { BlockInfo } from '@derivation-tech/web3-core';
import {
    deserializeSimpleObject,
    mustParseNumber,
    orderKey,
    parseOrderTickNonce,
    parseTicks,
    rangeKey,
    serializeSimpleObject,
} from '../common';
import { neg, r2w, wmulUp, ZERO } from '../math';
import { BigNumber } from 'ethers';
import {
    AddEventObject,
    AdjustEventObject,
    CancelEventObject,
    FillEventObject,
    LiquidateEventObject,
    RemoveEventObject,
    SweepEventObject,
    TradeEventObject,
} from '../types/typechain/Instrument';
import { InstrumentModel } from './instrument.model';
import { RangeModel } from './range.model';
import { PositionModel } from './position.model';
import { OrderModel } from './order.model';
import { PairModel, PairState } from './pair.model';

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

    serialize(): any {
        const ranges: any = {};
        for (const [k, v] of this.ranges) {
            ranges[k.toString()] = serializeSimpleObject(v);
        }

        const orders: any = {};
        for (const [k, v] of this.orders) {
            orders[k.toString()] = serializeSimpleObject(v);
        }

        return {
            onumber: this.onumber,
            rnumber: this.rnumber,
            oids: [...this.oids],
            rids: [...this.rids],
            position: serializeSimpleObject(this.position),
            ranges,
            orders,
        };
    }

    deserialize(serialized: any): this {
        if (this.ranges.size > 0 || this.orders.size > 0) {
            throw new Error('invalid deserialize');
        }

        if (
            typeof serialized !== 'object' ||
            typeof serialized.onumber !== 'number' ||
            typeof serialized.rnumber !== 'number' ||
            !Array.isArray(serialized.oids) ||
            !Array.isArray(serialized.rids) ||
            typeof serialized.position !== 'object' ||
            typeof serialized.ranges !== 'object' ||
            typeof serialized.orders !== 'object'
        ) {
            throw new Error('invalid deserialize');
        }

        this.onumber = serialized.onumber;
        this.rnumber = serialized.rnumber;
        this.oids = [...serialized.oids];
        this.rids = [...serialized.rids];
        this.position = deserializeSimpleObject(serialized.position);

        for (const [k, v] of Object.entries(serialized.ranges)) {
            this.ranges.set(mustParseNumber(k), deserializeSimpleObject(v));
        }

        for (const [k, v] of Object.entries(serialized.orders)) {
            this.orders.set(mustParseNumber(k), deserializeSimpleObject(v));
        }

        return this;
    }

    copy(): AccountState {
        return new AccountState(EMPTY_POSITION, [], [], [], []).deserialize(this.serialize());
    }

    delPosition(): void {
        this.position = {
            balance: ZERO,
            size: ZERO,
            entryNotional: ZERO,
            entrySocialLossIndex: ZERO,
            entryFundingIndex: ZERO,
        };
    }

    getPosition(): Position {
        return this.position;
    }

    setPosition(position: Position): void {
        this.position = position;
    }

    addRange(tickLower: number, tickUpper: number, range: Range): void {
        const key: number = rangeKey(tickLower, tickUpper);
        this.ranges.set(key, range);
        this.rids[this.rnumber] = key;
        this.rnumber++;
    }

    delRange(tickLower: number, tickUpper: number): void {
        const key: number = rangeKey(tickLower, tickUpper);
        let i = 0;
        for (; i < this.rnumber; i++) {
            const val: BigNumber = BigNumber.from(this.rids[i]);
            if (val.eq(key)) break;
        }
        this.rids[i] = this.rids[this.rnumber - 1];
        this.rids.pop();
        this.ranges.delete(key);
        this.rnumber--;
    }

    addOrder(tick: number, nonce: number, order: Order): void {
        const key: number = orderKey(tick, nonce);
        this.orders.set(key, order);
        this.oids[this.onumber] = key;
        this.onumber++;
    }

    delOrder(tick: number, nonce: number): void {
        const key: number = orderKey(tick, nonce);
        let i = 0;
        for (; i < this.onumber; i++) {
            const val = this.oids[i];
            if (val === key) break;
        }
        this.oids[i] = this.oids[this.onumber - 1];
        this.oids.pop();
        this.orders.delete(key);
        this.onumber--;
    }

    getIthOrderIndex(i: number): { tick: number; nonce: number } {
        const key = this.oids[i];
        const tickNonceOrder = parseOrderTickNonce(key);
        return tickNonceOrder;
    }

    getIthRangeIndex(i: number): { tickLower: number; tickUpper: number } {
        const key = this.rids[i];
        return parseTicks(key);
    }

    settle(): void {
        this.onumber = 0;
        this.oids = [];
        this.rnumber = 0;
        this.rids = [];
        this.position = {
            balance: ZERO,
            size: ZERO,
            entryNotional: ZERO,
            entrySocialLossIndex: ZERO,
            entryFundingIndex: ZERO,
        };
        this.ranges = new Map<number, Range>();
        this.orders = new Map<number, Order>();
    }

    applyAdjust(e: AdjustEventObject, amm: Amm): void {
        const pos: Position = realizeFundingIncome(amm, this.getPosition());
        pos.balance = pos.balance.add(e.net);
        this.setPosition(pos);
    }

    applyAdd(e: AddEventObject): void {
        this.addRange(e.tickLower, e.tickUpper, e.range);
    }

    applyRemove(e: RemoveEventObject, amm: Amm): BigNumber {
        this.delRange(e.tickLower, e.tickUpper);
        const oldPosition = this.getPosition();
        const { position, closedSize } = combine(amm, oldPosition, e.pic);

        if (position.size.isZero()) {
            this.delPosition();
        } else {
            this.setPosition(position);
        }

        return closedSize;
    }

    applyTrade(e: TradeEventObject, state: PairState, param: QuoteParam): BigNumber {
        const oldPic = this.getPosition();
        const fee = wmulUp(e.entryNotional, r2w(e.feeRatio + param.protocolFeeRatio));
        const swapPic = {
            balance: e.amount.sub(fee),
            size: e.size,
            entryNotional: e.entryNotional,
            entrySocialLossIndex: e.size.gt(ZERO) ? state.amm.longSocialLossIndex : state.amm.shortSocialLossIndex,
            entryFundingIndex: e.size.gt(ZERO) ? state.amm.longFundingIndex : state.amm.shortFundingIndex,
        };
        const { position, closedSize } = combine(state.amm as unknown as Amm, swapPic, oldPic);
        if (position.size.eq(ZERO)) {
            // remove position
            this.delPosition();
        } else {
            // set position
            this.setPosition(position);
        }
        return closedSize;
    }

    applyCancel(e: CancelEventObject, ctx: PairState): { closedSize: BigNumber; orderSize: BigNumber } {
        return this.cancelOrFillOrder(e.tick, e.nonce, e.pic, ctx);
    }

    applyFill(e: FillEventObject, ctx: PairState): { closedSize: BigNumber; orderSize: BigNumber } {
        return this.cancelOrFillOrder(e.tick, e.nonce, e.pic, ctx);
    }

    applyLiquidateAsLiquidator(e: LiquidateEventObject, tpic: Position, ctx: PairState): BigNumber {
        const position = this.getPosition();
        if (!e.amount.eq(ZERO)) {
            position.balance = position.balance.add(e.amount);
        }
        const res = combine(ctx.amm as unknown as Amm, tpic, position);
        if (res.position.size.eq(ZERO)) {
            this.delPosition();
        } else {
            this.setPosition(res.position);
        }

        return res.closedSize;
    }

    applyLiquidateAsTarget(e: LiquidateEventObject, ctx: PairState): Position {
        const fullPic = this.getPosition();
        let tpic: Position;
        if (fullPic.size.eq(e.size)) {
            tpic = fullPic;
            // remove target's position
            this.delPosition();
        } else {
            const res = splitPosition(fullPic, e.size); // fullPic is reduced
            this.setPosition(res.finalPos);
            tpic = res.partPos;
        }
        const equity: BigNumber = positionEquity(ctx, tpic, e.mark);
        if (equity.lt(ZERO)) {
            tpic.balance = tpic.balance.sub(equity);
        }
        return tpic;
    }

    applySweep(e: SweepEventObject, ctx: PairState, param: QuoteParam): BigNumber {
        const fullPic = this.getPosition();
        let tpic: Position;
        const tsize = e.size.mul(-1);
        if (fullPic.size.eq(tsize)) {
            tpic = fullPic;
            // remove trader's position
            this.delPosition();
        } else {
            const res = splitPosition(fullPic, tsize); // fullPic is reduced
            this.setPosition(res.finalPos);
            tpic = res.partPos;
        }

        const tPostBalance: BigNumber = positionEquity(ctx, tpic, e.mark);
        if (tPostBalance.lt(ZERO)) {
            tpic.balance = tpic.balance.sub(tPostBalance);
        }

        const swapPic = {
            balance: neg(wmulUp(e.entryNotional, r2w(e.feeRatio + param.protocolFeeRatio))),
            size: e.size,
            entryNotional: e.entryNotional,
            entrySocialLossIndex: e.size.gt(ZERO) ? ctx.amm.longSocialLossIndex : ctx.amm.shortSocialLossIndex,
            entryFundingIndex: e.size.gt(ZERO) ? ctx.amm.longFundingIndex : ctx.amm.shortFundingIndex,
        };
        const res = combine(ctx.amm as unknown as Amm, swapPic, tpic);
        return res.closedSize;
    }

    applySettle(): BigNumber {
        const finalPic: Position = this.getPosition();
        this.delPosition();
        this.settle();
        return finalPic.size;
    }

    cancelOrFillOrder(
        tick: number,
        nonce: number,
        pos: Position,
        ctx: PairState,
    ): { closedSize: BigNumber; orderSize: BigNumber } {
        const oldPosition = this.getPosition();
        const order: Order | undefined = this.orders.get(orderKey(tick, nonce));
        if (!order) {
            throw new Error('order not found');
        }
        this.delOrder(tick, nonce);

        if (pos.size.eq(ZERO)) {
            // fully cancel
            this.setPosition(realizeFundingIncome(ctx.amm as unknown as Amm, oldPosition));
            return { closedSize: ZERO, orderSize: order.size };
        } else {
            const res = combine(ctx.amm as unknown as Amm, oldPosition, pos);
            if (res.position.size.isZero()) {
                this.delPosition();
                // trader's reserve in Gate should be increased if we track Gate's state
            } else {
                this.setPosition(res.position);
            }
            return { closedSize: res.closedSize, orderSize: order.size };
        }
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
