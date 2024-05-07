/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigNumber } from 'ethers';
import { BlockInfo } from '@derivation-tech/web3-core';
import {
    EMPTY_POSITION,
    Position,
    calcFundingFee,
    calcLiquidationPrice,
    calcPnl,
    combine,
    positionEquity,
    realizeFundingIncome,
    splitPosition,
    tally,
} from './position';
import { Order } from './order';
import { Range, rangeToPosition } from './range';
import { InstrumentModel } from './instrument';
import { TickMath, ZERO, r2w, wdiv, wmulDown, wmulUp, wmul, neg } from '../math';
import {
    deserializeSimpleObject,
    mustParseNumber,
    orderKey,
    parseOrderTickNonce,
    parseTicks,
    rangeKey,
    serializeSimpleObject,
} from '../common/util';
import { Amm, PairModel, PairState } from './pair';
import { Side } from './enum';
import { ONE_RATIO, PERP_EXPIRY } from '../constants';
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
import { QuoteParam } from './params';

export class NumericConverter {
    public static scaleQuoteAmount(amount: BigNumber, quoteDecimals: number): BigNumber {
        const quoteAmountScaler = BigNumber.from(10).pow(18 - quoteDecimals);
        return amount.mul(quoteAmountScaler);
    }

    public static toContractQuoteAmount(amount: BigNumber, quoteDecimals: number): BigNumber {
        const quoteAmountScaler = BigNumber.from(10).pow(18 - quoteDecimals);
        return amount.div(quoteAmountScaler);
    }

    public static toContractRatio(ratioWad: BigNumber): number {
        return ratioWad.div(BigNumber.from(10).pow(14)).toNumber();
    }
}

export class PositionModel implements Position {
    public readonly rootPair: PairModel;

    balance: BigNumber;
    size: BigNumber;
    entryNotional: BigNumber;
    entrySocialLossIndex: BigNumber;
    entryFundingIndex: BigNumber;

    constructor(
        rootPair: PairModel,
        balance: BigNumber,
        size: BigNumber,
        entryNotional: BigNumber,
        entrySocialLossIndex: BigNumber,
        entryFundingIndex: BigNumber,
    ) {
        this.rootPair = rootPair;
        this.balance = balance;
        this.size = size;
        this.entryNotional = entryNotional;
        this.entrySocialLossIndex = entrySocialLossIndex;
        this.entryFundingIndex = entryFundingIndex;
    }

    public static fromRawPosition(rootPair: PairModel, pos: Position): PositionModel {
        return new PositionModel(
            rootPair,
            pos.balance,
            pos.size,
            pos.entryNotional,
            pos.entrySocialLossIndex,
            pos.entryFundingIndex,
        );
    }

    public static fromEmptyPosition(rootPair: PairModel): PositionModel {
        return new PositionModel(rootPair, ZERO, ZERO, ZERO, ZERO, ZERO);
    }

    public getMaxWithdrawableMargin(): BigNumber {
        const unrealizedPnl = this.unrealizedPnl;
        const unrealizedLoss = unrealizedPnl.gt(ZERO) ? ZERO : unrealizedPnl;

        const value = wmulUp(this.rootPair.markPrice, this.size.abs());
        const imRequirement = wmulUp(value, r2w(this.rootPair.rootInstrument.setting.initialMarginRatio));
        const maxWithdrawableMargin = this.balance.add(unrealizedLoss).sub(imRequirement);
        return maxWithdrawableMargin.gt(ZERO) ? maxWithdrawableMargin : ZERO;
    }

    get entryPrice(): BigNumber {
        return this.size.eq(ZERO) ? ZERO : wdiv(this.entryNotional, this.size.abs());
    }

    // calculate the desired mark price
    get liquidationPrice(): BigNumber {
        if (this.size.isZero() || this.balance.isZero()) return ZERO;
        return calcLiquidationPrice(
            this.rootPair.amm,
            this,
            this.rootPair.rootInstrument.setting.maintenanceMarginRatio,
        );
    }

    get unrealizedPnl(): BigNumber {
        return calcPnl(this.rootPair.amm, this, this.rootPair.markPrice);
    }

    get unrealizedFundingFee(): BigNumber {
        if (this.rootPair.amm.expiry === PERP_EXPIRY) return calcFundingFee(this.rootPair.amm, this);
        return ZERO;
    }

    public getEquity(): BigNumber {
        return this.balance.add(this.unrealizedPnl);
    }

    public getAdditionMarginToIMRSafe(increase: boolean, slippage?: number): BigNumber {
        const ratio = this.rootPair.rootInstrument.setting.initialMarginRatio;
        const positionValue = wmul(this.rootPair.markPrice, this.size.abs());
        let imrValue = wmulUp(positionValue, r2w(ratio));
        if (slippage) {
            imrValue = imrValue.mul(ONE_RATIO + slippage).div(ONE_RATIO);
        }
        let equity;
        if (increase) {
            const unrealizedLoss = this.unrealizedPnl.lt(ZERO) ? this.unrealizedPnl : ZERO;
            equity = this.balance.add(unrealizedLoss);
        } else {
            equity = this.getEquity();
        }
        const additionMargin = imrValue.sub(equity);
        return additionMargin.gt(ZERO) ? additionMargin : ZERO;
    }

    public isPositionIMSafe(increase: boolean): boolean {
        let equity;
        if (increase) {
            const unrealizedLoss = this.unrealizedPnl.lt(ZERO) ? this.unrealizedPnl : ZERO;
            equity = this.balance.add(unrealizedLoss);
        } else {
            equity = this.getEquity();
        }

        if (equity.isNegative()) return false;
        const positionValue = wmulUp(this.rootPair.markPrice, this.size.abs());
        const ratio = this.rootPair.rootInstrument.setting.initialMarginRatio;
        return equity.gte(wmulUp(positionValue, r2w(ratio)));
    }

    public isPositionMMSafe(): boolean {
        const equity = this.getEquity();
        if (equity.isNegative()) return false;
        const positionValue = wmulUp(this.rootPair.markPrice, this.size.abs());
        const ratio = this.rootPair.rootInstrument.setting.maintenanceMarginRatio;
        return equity.gte(wmulUp(positionValue, r2w(ratio)));
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
        const value = wmul(this.rootPair.markPrice, this.size.abs());
        const equity = this.getEquity();
        if (equity.isZero()) {
            return ZERO;
        }
        return wdiv(value, equity);
    }
}

export class RangeModel {
    public readonly rootPair: PairModel;

    liquidity: BigNumber;
    balance: BigNumber;
    sqrtEntryPX96: BigNumber;
    entryFeeIndex: BigNumber;

    tickLower: number;
    tickUpper: number;

    constructor(
        rootPair: PairModel,
        liquidity: BigNumber,
        balance: BigNumber,
        sqrtEntryPX96: BigNumber,
        entryFeeIndex: BigNumber,
        tickLower: number,
        tickUpper: number,
    ) {
        this.rootPair = rootPair;
        this.liquidity = liquidity;
        this.balance = balance;
        this.sqrtEntryPX96 = sqrtEntryPX96;
        this.entryFeeIndex = entryFeeIndex;
        this.tickLower = tickLower;
        this.tickUpper = tickUpper;
    }

    public static fromRawRange(rootPair: PairModel, range: Range, rid: number): RangeModel {
        const { tickLower, tickUpper } = parseTicks(rid);
        return new RangeModel(
            rootPair,
            range.liquidity,
            range.balance,
            range.sqrtEntryPX96,
            range.entryFeeIndex,
            tickLower,
            tickUpper,
        );
    }

    get rid(): number {
        return rangeKey(this.tickLower, this.tickUpper);
    }

    get lowerPrice(): BigNumber {
        return TickMath.getWadAtTick(this.tickLower);
    }

    get upperPrice(): BigNumber {
        return TickMath.getWadAtTick(this.tickUpper);
    }

    get valueLocked(): BigNumber {
        const position = this.rawPositionIfRemove(this.rootPair.amm);
        const total = tally(this.rootPair.amm, position, this.rootPair.markPrice);
        return total.equity;
    }

    get feeEarned(): BigNumber {
        const amm = this.rootPair.amm;
        const fee = wmulDown(amm.feeIndex.sub(this.entryFeeIndex), this.liquidity);
        return fee;
    }

    get lowerPositionModelIfRemove(): PositionModel {
        const amm = this.customAmm(this.tickLower, this.rootPair.amm);
        const rawPositionLower = this.rawPositionIfRemove(amm);
        return PositionModel.fromRawPosition(this.rootPair, rawPositionLower);
    }

    get upperPositionModelIfRemove(): PositionModel {
        const amm = this.customAmm(this.tickUpper, this.rootPair.amm);
        const rawPositionLower = this.rawPositionIfRemove(amm);
        return PositionModel.fromRawPosition(this.rootPair, rawPositionLower);
    }

    public rawPositionIfRemove(amm: Amm): Position {
        const positionIfMoved = rangeToPosition(
            amm.sqrtPX96,
            amm.tick,
            amm.feeIndex,
            amm.longSocialLossIndex,
            amm.shortSocialLossIndex,
            amm.longFundingIndex,
            amm.shortFundingIndex,
            this.tickLower,
            this.tickUpper,
            this,
        );
        return positionIfMoved;
    }

    private customAmm(tick: number, input: Amm): Amm {
        const amm = Object.assign({}, input);
        amm.tick = tick;
        amm.sqrtPX96 = TickMath.getSqrtRatioAtTick(tick);
        return amm;
    }
}

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
        // todo: cannot be done yet until PairModel has tick and record info
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

export interface Portfolio {
    oids: number[];
    rids: number[];
    position: Position;
    orders: Order[];
    ranges: Range[];
    ordersTaken: BigNumber[];
}

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
        const tickRange = parseTicks(key);
        return tickRange;
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

export default {};
