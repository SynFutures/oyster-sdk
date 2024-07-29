import {
    Amm,
    cancelOrderToPosition,
    combine,
    ContractRecord,
    EMPTY_AMM,
    EMPTY_POSITION,
    fillOrderToPosition,
    Order,
    Pearl,
    Position,
    Range,
    rangeToPosition,
    Status,
    tally,
} from '../types';
import { BigNumber, ethers } from 'ethers';
import { BlockInfo, ZERO, ZERO_ADDRESS } from '@derivation-tech/web3-core';
import {
    fracDown,
    MAX_UINT_128,
    neg,
    ONE,
    Q96,
    r2w,
    signedDiv,
    SqrtPriceMath,
    sqrtX96ToWad,
    SwapMath,
    TickMath,
    wadToSqrtX96,
    weightedAverage,
    wmul,
    wmulDown,
} from '../math';
import {
    asInt128,
    decompose,
    deserializeSimpleObject,
    formatExpiry,
    mustParseNumber,
    parseOrderTickNonce,
    parseTicks,
    serializeSimpleObject,
    withinOrderLimit,
} from '../common';
import { ORDER_SPACING, PEARL_SPACING, PERP_EXPIRY } from '../constants';
import { AccountState } from './account.model';
import { PositionStructOutput } from '../types/typechain/Observer';
import {
    AddEventObject,
    CancelEventObject,
    FillEventObject,
    RemoveEventObject,
    UpdateAmmStatusEventObject,
    UpdateFundingIndexEventObject,
} from '../types/typechain/Instrument';
import { InstrumentModel } from './instrument.model';

export class PairState {
    amm: Amm;
    pearls = new Map<number, Pearl>();
    tbitmap = new Map<number, BigNumber>();
    records = new Map<number, Map<number, ContractRecord>>();

    blockInfo?: BlockInfo;

    constructor(amm: Amm, blockInfo?: BlockInfo) {
        this.amm = { ...amm };
        this.amm.blockInfo = blockInfo;
        this.blockInfo = blockInfo;
    }

    get fairPriceWad(): BigNumber {
        return sqrtX96ToWad(this.amm.sqrtPX96);
    }

    serialize(): any {
        const amm = serializeSimpleObject(this.amm);

        const pearls: any = {};
        for (const [k, v] of this.pearls) {
            pearls[k.toString()] = serializeSimpleObject(v);
        }

        const tbitmap: any = {};
        for (const [k, v] of this.tbitmap) {
            tbitmap[k.toString()] = v.toString();
        }

        const records: any = {};
        for (const [k, v] of this.records) {
            const _records: any = (records[k.toString()] = {});
            for (const [_k, _v] of v) {
                _records[_k.toString()] = serializeSimpleObject(_v);
            }
        }

        return { amm, pearls, tbitmap, records };
    }

    deserialize(serialized: any): this {
        if (this.pearls.size > 0 || this.tbitmap.size > 0 || this.records.size > 0) {
            throw new Error('invalid deserialize');
        }

        if (
            typeof serialized !== 'object' ||
            typeof serialized.amm !== 'object' ||
            typeof serialized.pearls !== 'object' ||
            typeof serialized.tbitmap !== 'object' ||
            typeof serialized.records !== 'object'
        ) {
            throw new Error('invalid deserialize');
        }

        this.amm = deserializeSimpleObject(serialized.amm);

        for (const [k, v] of Object.entries(serialized.pearls)) {
            this.pearls.set(mustParseNumber(k), deserializeSimpleObject(v));
        }

        for (const [k, v] of Object.entries(serialized.tbitmap)) {
            this.tbitmap.set(mustParseNumber(k), BigNumber.from(v));
        }

        for (const [k, v] of Object.entries(serialized.records)) {
            if (typeof v !== 'object' || v === null) {
                throw new Error('invalid deserialize');
            }

            const _map = new Map<number, ContractRecord>();
            for (const [_k, _v] of Object.entries(v)) {
                _map.set(mustParseNumber(_k), deserializeSimpleObject(_v));
            }

            this.records.set(mustParseNumber(k), _map);
        }

        return this;
    }

    copy(): PairState {
        return new PairState(EMPTY_AMM).deserialize(this.serialize());
    }

    setPearl(tick: number, pearl: Pearl): void {
        this.pearls.set(tick, pearl);
    }

    setRecord(tick: number, nonce: number, record: ContractRecord): void {
        if (!this.records.has(tick)) {
            this.records.set(tick, new Map<number, ContractRecord>());
        }
        const nonceMap = this.records.get(tick)!;
        nonceMap.set(nonce, record);
        this.records.set(tick, nonceMap);
    }

    setTickBitMap(wordPos: number, word: BigNumber): void {
        this.tbitmap.set(wordPos, word);
    }

    getPearl(tick: number): Pearl {
        if (!this.pearls.has(tick)) {
            this.setPearl(tick, {
                liquidityGross: ZERO,
                liquidityNet: ZERO,
                nonce: 0,
                fee: ZERO,
                left: ZERO,
                taken: ZERO,
                entrySocialLossIndex: ZERO,
                entryFundingIndex: ZERO,
            } as Pearl);
        }
        return this.pearls.get(tick)!;
    }

    getRecord(tick: number, nonce: number): ContractRecord {
        if (!this.records.has(tick)) {
            this.records.set(tick, new Map<number, ContractRecord>());
        }
        if (!this.records.get(tick)!.has(nonce)) {
            this.setRecord(tick, nonce, {
                taken: ZERO,
                fee: ZERO,
                entrySocialLossIndex: ZERO,
                entryFundingIndex: ZERO,
            });
        }
        return this.records.get(tick)!.get(nonce)!;
    }

    // int16 => uint
    getTbitmapWord(wordPos: number): BigNumber {
        if (!this.tbitmap.has(wordPos)) {
            this.setTickBitMap(wordPos, ZERO);
        }

        return this.tbitmap.get(wordPos)!;
    }

    updateTicksRange(tickLower: number, tickUpper: number, delta: BigNumber): void {
        const flippedLower: boolean = this.updateLiquidityInfo(tickLower, delta, false);
        const flippedUpper: boolean = this.updateLiquidityInfo(tickUpper, delta, true);

        if (flippedLower) this.flipTick(tickLower);
        if (flippedUpper) this.flipTick(tickUpper);
    }

    updateTickOrder(tick: number, delta: BigNumber): void {
        const pearl = this.getPearl(tick);
        const prevOrderSize = pearl.left;
        const postOrderSize = prevOrderSize.add(delta);
        const flipped: boolean = pearl.liquidityGross.eq(ZERO) && postOrderSize.eq(ZERO) != prevOrderSize.eq(ZERO);

        pearl.left = postOrderSize;
        if (flipped) {
            this.flipTick(tick);
        }
    }

    updateLiquidityInfo(tick: number, liquidityDelta: BigNumber, upper: boolean): boolean {
        const pearl = this.getPearl(tick);
        const liquidityGrossBefore = pearl.liquidityGross;
        const liquidityGrossAfter = liquidityGrossBefore.add(liquidityDelta);
        const flipped: boolean = pearl.left.eq(ZERO) && liquidityGrossAfter.eq(ZERO) != liquidityGrossBefore.eq(ZERO);

        pearl.liquidityGross = liquidityGrossAfter;
        pearl.liquidityNet = upper ? pearl.liquidityNet.sub(liquidityDelta) : pearl.liquidityNet.add(liquidityDelta);
        return flipped;
    }

    flipTick(tick: number): void {
        tick = signedDiv(tick, PEARL_SPACING);
        const { wordPos, bitPos } = decompose(tick);
        if (!this.tbitmap.has(wordPos)) {
            this.tbitmap.set(wordPos, ZERO);
        }
        const val = this.tbitmap.get(wordPos)!.xor(ONE.shl(bitPos));
        this.tbitmap.set(wordPos, val);
    }

    updateOI(delta: BigNumber): void {
        this.amm.totalLong = this.amm.totalLong.add(delta);
        this.amm.totalShort = this.amm.totalShort.add(delta);
        this.amm.openInterests = this.amm.openInterests.add(delta);
    }

    increaseInvolvedFund(delta: BigNumber): void {
        this.amm.involvedFund = this.amm.involvedFund.add(delta);
    }

    decreaseInvolvedFund(delta: BigNumber): BigNumber {
        if (delta.gt(this.amm.involvedFund)) {
            delta = this.amm.involvedFund;
        }
        this.amm.involvedFund = this.amm.involvedFund.sub(delta);
        return delta;
    }

    updateRecord(tick: number, nonce: number): void {
        const pearl = this.getPearl(tick);
        const record = this.getRecord(tick, nonce);

        record.taken = pearl.taken;
        record.fee = pearl.fee;
        record.entrySocialLossIndex = pearl.entrySocialLossIndex;
        record.entryFundingIndex = pearl.entryFundingIndex;

        pearl.nonce++;
        pearl.taken = ZERO;
        pearl.fee = ZERO;
        pearl.entrySocialLossIndex = ZERO;
        pearl.entryFundingIndex = ZERO;
    }

    updateLongShortOI(size: BigNumber, totalTaken: BigNumber): void {
        const long = size.gt(0);
        if (long) {
            this.amm.totalLong = this.amm.totalLong.add(size.abs());
            const totalTakenAbs = totalTaken.abs();
            this.amm.totalShort = this.amm.totalShort.add(totalTakenAbs);
            this.amm.openInterests = this.amm.openInterests.add(totalTakenAbs);
        } else {
            this.amm.totalShort = this.amm.totalShort.add(size.abs());
            this.amm.openInterests = this.amm.openInterests.add(size.abs());
            const totalTakenAbs = totalTaken.abs();
            this.amm.totalLong = this.amm.totalLong.add(totalTakenAbs);
        }
    }

    setContextPostTakeOrder(tick: number, taken: BigNumber, feeRatio: number): BigNumber {
        const pearl = this.getPearl(tick);
        const amm = this.amm;
        const prevTaken = pearl.taken;
        pearl.taken = pearl.taken.add(taken);
        this.updateTickOrder(tick, neg(taken));

        const price = TickMath.getWadAtTick(tick);
        const takerNotional = wmul(price, taken.abs());
        pearl.fee = pearl.fee.add(wmulDown(takerNotional, r2w(feeRatio)));
        const socialLossPerTaken = taken.gt(ZERO) ? this.amm.longSocialLossIndex : this.amm.shortSocialLossIndex;
        pearl.entrySocialLossIndex = weightedAverage(
            prevTaken.abs(),
            pearl.entrySocialLossIndex,
            taken.abs(),
            socialLossPerTaken,
        );
        if (amm.expiry === PERP_EXPIRY) {
            const currentFundingIndex = taken.gt(ZERO) ? amm.longFundingIndex : amm.shortFundingIndex;
            pearl.entryFundingIndex = weightedAverage(prevTaken, pearl.entryFundingIndex, taken, currentFundingIndex);
        }
        if (pearl.left.isZero() && !pearl.taken.isZero()) {
            this.updateRecord(tick, pearl.nonce);
        }
        return takerNotional;
    }

    cancelOrder(order: Order, tick: number, nonce: number): Position {
        const pearl = this.getPearl(tick);
        const pos = cancelOrderToPosition(
            pearl.left,
            pearl.nonce,
            pearl.taken,
            pearl.fee,
            pearl.entrySocialLossIndex,
            pearl.entryFundingIndex,
            order,
            tick,
            nonce,
            this.getRecord(tick, nonce),
        );

        const cancelledSize = order.size.sub(pos.size);
        this.updateTickOrder(tick, cancelledSize.mul(-1));

        if (!pos.size.eq(0)) {
            this.updatePearlOrRecordOnFill(pos.size, pos.balance.sub(order.balance), tick, nonce);
        }

        if (pearl.left.eq(0) && !pearl.taken.eq(0)) {
            this.updateRecord(tick, pearl.nonce);
        }
        return pos;
    }

    settleAccount(account: AccountState, markPrice: BigNumber): BigNumber {
        const amm = this.amm;

        let finalPic: Position = Object.assign({}, EMPTY_POSITION);
        // range settle part
        for (let i = 0; i < account.rnumber; i++) {
            const { tickLower, tickUpper } = parseTicks(account.rids[i]);
            const range = account.ranges.get(account.rids[i])!;
            const position: Position = rangeToPosition(
                amm.sqrtPX96,
                amm.tick,
                amm.feeIndex,
                amm.longSocialLossIndex,
                amm.shortSocialLossIndex,
                amm.longFundingIndex,
                amm.shortFundingIndex,
                tickLower,
                tickUpper,
                range,
            );
            const res = combine(amm, finalPic, position);
            this.applyRemove(
                {
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    pic: position as PositionStructOutput,
                    // The following attributes not used in applyRemove
                    expiry: this.amm.expiry,
                    trader: ZERO_ADDRESS,
                    fee: ZERO,
                    operator: ZERO_ADDRESS,
                    tip: ZERO,
                },
                range,
                res.closedSize,
            );

            finalPic = res.position;
        }

        // order settle part
        for (let i = 0; i < account.onumber; i++) {
            const oid = account.oids[i];
            const { tick, nonce } = parseOrderTickNonce(oid);
            const order = account.orders.get(oid)!;
            const pearl = this.getPearl(tick)!;
            let position: Position;
            if (pearl.nonce === nonce) {
                position = this.cancelOrder(order, tick, nonce);
            } else {
                position = this.fillOrder(order, tick, nonce, order.size);
            }
            const res = combine(amm, finalPic, position);
            finalPic = res.position;
            this.updateOI(res.closedSize.mul(-1));
        }
        // position settle part
        const res = combine(amm, finalPic, account.position);
        finalPic = res.position;
        this.updateOI(res.closedSize.mul(-1));

        const { equity } = tally(amm, finalPic, markPrice);
        return equity;
    }

    fillOrder(order: Order, tick: number, nonce: number, fillSize: BigNumber): Position {
        const pearl = this.getPearl(tick);
        const position = fillOrderToPosition(
            pearl.nonce,
            pearl.taken,
            pearl.fee,
            pearl.entrySocialLossIndex,
            pearl.entryFundingIndex,
            order,
            tick,
            nonce,
            fillSize,
            this.getRecord(tick, nonce),
        );

        const makerFee = position.balance.sub(order.balance);
        fillSize = position.size;

        this.updatePearlOrRecordOnFill(fillSize, makerFee, tick, nonce);
        return position;
    }

    updatePearlOrRecordOnFill(fillSize: BigNumber, makerFee: BigNumber, tick: number, nonce: number): void {
        if (fillSize.eq(0)) return;
        const pearl = this.getPearl(tick);
        if (nonce < pearl.nonce) {
            const record = this.getRecord(tick, nonce);
            record.fee = record.fee.sub(makerFee);
            record.taken = record.taken.sub(fillSize);
        } else {
            pearl.fee = pearl.fee.sub(makerFee);
            pearl.taken = pearl.taken.sub(fillSize);
        }
    }

    applyUpdateAmmStatus(e: UpdateAmmStatusEventObject, log: ethers.providers.Log): void {
        this.amm.expiry = e.expiry;
        this.amm.status = e.status;
        if (e.status === Status.SETTLING || (e.status === Status.TRADING && e.expiry === PERP_EXPIRY)) {
            this.amm.timestampUpdatedAt = log.blockNumber;
        } else if (e.status == Status.SETTLED) {
            this.amm.settlementPrice = e.mark;
        }
    }

    applyAdd(e: AddEventObject): void {
        // update pearl
        this.updateTicksRange(e.tickLower, e.tickUpper, e.range.liquidity);

        // calculate entryDeltaBase
        const sqrtUpperPX96 = TickMath.getSqrtRatioAtTick(e.tickUpper);
        const entryDeltaBase = SqrtPriceMath.getDeltaBaseAutoRoundUp(
            e.range.sqrtEntryPX96,
            sqrtUpperPX96,
            e.range.liquidity,
        );
        // adjust state
        this.amm.openInterests = this.amm.openInterests.add(entryDeltaBase);
        this.amm.liquidity = this.amm.liquidity.add(e.range.liquidity);
        this.amm.totalLiquidity = this.amm.totalLiquidity.add(e.range.liquidity);
        if (this.amm.sqrtPX96.eq(ZERO)) {
            // init amm with range price
            this.amm.sqrtPX96 = e.range.sqrtEntryPX96;
            this.amm.tick = TickMath.getTickAtSqrtRatio(e.range.sqrtEntryPX96);
            this.amm.expiry = e.expiry;
            this.amm.status = Status.TRADING;
        }
    }

    applyRemove(e: RemoveEventObject, range: Range, closedSize: BigNumber): void {
        if (this.amm.tick >= e.tickLower && this.amm.tick < e.tickUpper) {
            this.amm.liquidity = this.amm.liquidity.sub(range.liquidity);
        }
        this.amm.totalLiquidity = this.amm.totalLiquidity.sub(range.liquidity);

        // update pearl
        this.updateTicksRange(e.tickLower, e.tickUpper, range.liquidity.mul(-1));

        // calculate entryDeltaBase
        const sqrtUpperPX96 = TickMath.getSqrtRatioAtTick(e.tickUpper);
        const entryDeltaBase = SqrtPriceMath.getDeltaBaseAutoRoundUp(
            range.sqrtEntryPX96,
            sqrtUpperPX96,
            range.liquidity,
        );

        if (!e.pic.size.eq(ZERO)) {
            const usize: BigNumber = e.pic.size.abs();
            if (e.pic.size.lt(ZERO)) {
                this.amm.openInterests = this.amm.openInterests.sub(entryDeltaBase.sub(usize));
                this.amm.totalShort = this.amm.totalShort.add(usize);
            } else {
                this.amm.openInterests = this.amm.openInterests.sub(entryDeltaBase);
                this.amm.totalLong = this.amm.totalLong.add(usize);
            }
        } else {
            // size == 0
            this.amm.openInterests = this.amm.openInterests.sub(entryDeltaBase);
        }

        // sub closedSize due to position's combine
        if (!closedSize.isZero()) {
            this.updateOI(closedSize.mul(BigNumber.from(-1)));
        }
    }

    applyTradeOrSweep(
        size: BigNumber,
        takenSize: BigNumber,
        sqrtPX96: BigNumber,
        feeRatio: number,
        closedSize: BigNumber,
    ): void {
        const res = SwapMath.swapCrossRange(this, size);

        for (let i = 0; i < res.ticks.length; i++) {
            this.setContextPostTakeOrder(res.ticks[i], res.takens[i], feeRatio);
        }

        // update curve
        this.amm.sqrtPX96 = sqrtPX96;
        this.amm.tick = TickMath.getTickAtSqrtRatio(sqrtPX96);
        this.amm.liquidity = res.liquidity;

        this.updateLongShortOI(size, takenSize);
        // update OI due to closedSize in combine
        this.updateOI(closedSize.mul(BigNumber.from(-1)));
    }

    applyCancel(e: CancelEventObject, closedSize: BigNumber, orderSize: BigNumber): void {
        const pearl = this.getPearl(e.tick);

        if (e.pic.size.eq(ZERO)) {
            // fully cancel
            this.updateTickOrder(e.tick, orderSize.mul(-1));
        } else {
            // partially cancel, new position created
            this.updateTickOrder(e.tick, pearl.left.mul(-1));

            const takenSize = e.pic.size;
            const usize = takenSize.abs();
            let makerFee: BigNumber;
            if (e.nonce < pearl.nonce) {
                const record: ContractRecord = this.getRecord(e.tick, e.nonce);
                const utaken0 = record.taken.abs();
                makerFee = record.taken.eq(takenSize) ? record.fee : fracDown(record.fee, usize, utaken0);
                record.fee = record.fee.sub(makerFee);
                record.taken = record.taken.sub(takenSize);
            } else {
                const utaken1 = pearl.taken.abs();
                makerFee = pearl.taken.eq(takenSize) ? pearl.fee : fracDown(pearl.fee, usize, utaken1);
                pearl.fee = pearl.fee.sub(makerFee);
                pearl.taken = pearl.taken.sub(takenSize);
            }
        }
        if (pearl.left.eq(0) && !pearl.taken.eq(0)) {
            this.updateRecord(e.tick, pearl.nonce);
        }
        this.updateOI(closedSize.mul(-1));
    }

    applyFill(e: FillEventObject, closedSize: BigNumber): void {
        const pearl = this.getPearl(e.tick);
        if (e.nonce < pearl.nonce) {
            const record = this.getRecord(e.tick, e.nonce);
            record.fee = record.fee.sub(e.fee);
            record.taken = record.taken.sub(e.pic.size);
        } else {
            pearl.fee = pearl.fee.sub(e.fee);
            pearl.taken = pearl.taken.sub(e.pic.size);
        }
        this.updateOI(closedSize.mul(-1));
    }

    applyLiquidate(closedSize: BigNumber): void {
        this.updateOI(closedSize.mul(-1));
    }

    applySettle(closedSize: BigNumber): void {
        if (closedSize.lt(ZERO)) {
            this.amm.totalShort = this.amm.totalShort.add(closedSize);
            this.amm.openInterests = this.amm.openInterests.add(closedSize);
        } else {
            this.amm.totalLong = this.amm.totalLong.add(closedSize.mul(-1));
        }
    }

    applyUpdateFundingIndex(e: UpdateFundingIndexEventObject, log: ethers.providers.Log): void {
        void log;
        const amm = this.amm;
        [amm.longFundingIndex, amm.shortFundingIndex] = [
            asInt128(e.fundingIndex.and(MAX_UINT_128)),
            asInt128(e.fundingIndex.shr(128)),
        ];
        amm.timestampUpdatedAt = log.blockNumber;
    }
}

export class PairModel {
    public readonly rootInstrument: InstrumentModel;
    state: PairState;

    markPrice: BigNumber;

    constructor(rootInstrument: InstrumentModel, amm: Amm, markPrice: BigNumber, blockInfo?: BlockInfo) {
        this.rootInstrument = rootInstrument;
        this.state = new PairState(amm, blockInfo);
        this.markPrice = markPrice;
    }

    public static minimalPairWithAmm(instrumentModel: InstrumentModel, initPairPrice: BigNumber): PairModel {
        const amm = {
            expiry: 0,
            timestamp: 0,
            status: Status.TRADING,
            tick: 0,
            sqrtPX96: ZERO,
            liquidity: ZERO,
            totalLiquidity: ZERO,
            involvedFund: ZERO,
            insuranceFund: ZERO,
            openInterests: ZERO,
            feeIndex: ZERO,
            protocolFee: ZERO,
            totalLong: ZERO,
            totalShort: ZERO,
            longSocialLossIndex: ZERO,
            shortSocialLossIndex: ZERO,
            longFundingIndex: ZERO,
            shortFundingIndex: ZERO,
            settlementPrice: ZERO,
        };
        amm.sqrtPX96 = wadToSqrtX96(initPairPrice);
        amm.tick = TickMath.getTickAtPWad(initPairPrice);

        return new PairModel(instrumentModel, amm, ZERO);
    }

    get amm(): Amm {
        return this.state.amm;
    }

    get symbol(): string {
        return `${this.rootInstrument.info.symbol}-${formatExpiry(this.amm.expiry)}`;
    }

    get fairPriceWad(): BigNumber {
        // p * 10^(d-8) * 10^18 => p * 10^18
        return sqrtX96ToWad(this.amm.sqrtPX96);
    }

    get benchmarkPrice(): BigNumber {
        return this.rootInstrument.getBenchmarkPrice(this.amm.expiry);
    }

    get openInterests(): BigNumber {
        return this.amm.openInterests;
    }

    get placeOrderLimit(): {
        upperTick: number;
        lowerTick: number;
    } {
        const currentImr = this.rootInstrument.setting.initialMarginRatio;
        const maxDiff = wmul(this.markPrice, r2w(currentImr)).mul(2);
        const rawUpperTick = TickMath.getTickAtPWad(this.markPrice.add(maxDiff));
        const rawLowerTick = TickMath.getTickAtPWad(this.markPrice.sub(maxDiff));
        let upperTick = ORDER_SPACING * Math.floor(rawUpperTick / ORDER_SPACING);
        let lowerTick = ORDER_SPACING * Math.ceil(rawLowerTick / ORDER_SPACING);
        if (!withinOrderLimit(TickMath.getWadAtTick(rawUpperTick), this.markPrice, currentImr)) {
            upperTick = upperTick - ORDER_SPACING;
        }

        if (!withinOrderLimit(TickMath.getWadAtTick(rawLowerTick), this.markPrice, currentImr)) {
            lowerTick = lowerTick + ORDER_SPACING;
        }
        return {
            upperTick,
            lowerTick,
        };
    }

    getMinLiquidity(px96?: BigNumber): BigNumber {
        const sqrtPX96 = px96 ? px96 : this.amm.sqrtPX96;
        return this.rootInstrument.minRangeValue.mul(Q96).div(sqrtPX96.mul(2));
    }
}
