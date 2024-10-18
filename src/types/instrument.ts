import { PriceFeeder, DexV2Feeder, Market } from './market';
import { FeederType, InstrumentCondition, MarketType } from './enum';
import { BaseInfo, TokenInfo } from './token';
import { BlockInfo } from '@derivation-tech/web3-core';
import { Amm, EMPTY_AMM, PairModel, PairState } from './pair';
import { BigNumber, ethers } from 'ethers';
import { WAD, ZERO, r2w, wdiv, wmulDown } from '../math';
import { EMPTY_QUOTE_PARAM, InstrumentSetting, QuoteParam } from './params';
import {
    INITIAL_MARGIN_RATIO,
    MAINTENANCE_MARGIN_RATIO,
    MIN_ORDER_MULTIPLIER,
    MIN_RANGE_MULTIPLIER,
    PERP_EXPIRY,
    RATIO_BASE,
} from '../constants';
import { AccountState } from './account';
import { deserializeSimpleObject, mustParseNumber, rangeKey, serializeSimpleObject } from '../common/util';
import { EMPTY_POSITION } from './position';
import {
    AddEventObject,
    AdjustEventObject,
    CancelEventObject,
    ClaimProtocolFeeEventObject,
    DeleteContextEventObject,
    FillEventObject,
    LiquidateEventObject,
    PlaceEventObject,
    RemoveEventObject,
    SettleEventObject,
    SweepEventObject,
    TradeEventObject,
    UpdateAmmStatusEventObject,
    UpdateConditionEventObject,
    UpdateFeeStateEventObject,
    UpdateFundingIndexEventObject,
    UpdateMarginRatioEventObject,
    UpdateParamEventObject,
    UpdateSocialLossInsuranceFundEventObject,
} from './typechain/Instrument';
import { ParsedEvent } from './common';
import { EventHandler } from './eventHandler';

export interface AssembledInstrumentData {
    instrumentAddr: string;
    symbol: string;
    market: string;

    dexV2Feeder: DexV2Feeder;
    priceFeeder: PriceFeeder;

    initialMarginRatio: number;
    maintenanceMarginRatio: number;
    param: QuoteParam;
    spotPrice: BigNumber;
    condition: InstrumentCondition;
    amms: Amm[];
    markPrices: BigNumber[];
}

export interface InstrumentInfo {
    addr: string;
    symbol: string;
    base: BaseInfo;
    quote: TokenInfo;
}

export class InstrumentState extends EventHandler {
    condition: InstrumentCondition;
    pairStates = new Map<number, PairState>(); // expiry => Pair
    accounts = new Map<number, Map<string, AccountState>>(); // expiry => address => Account;
    setting: InstrumentSetting;

    blockInfo?: BlockInfo;

    // handlers used for processing business logic outside of InstrumnetState, key: event name => value: handler function, eg:
    // UpdateFundingIndex => increase fundingPayInsurance, to support invariant test
    postHandlers: { [key: string]: (event: ParsedEvent<any>, log: ethers.providers.Log) => void } = {};

    constructor(
        condition: InstrumentCondition,
        initialMarginRatio: number,
        maintenanceMarginRatio: number,
        param: QuoteParam,
        blockInfo?: BlockInfo,
    ) {
        super();
        this.condition = condition;
        this.setting = {
            initialMarginRatio,
            maintenanceMarginRatio,
            quoteParam: { ...param },
        };
        this.blockInfo = blockInfo;
    }

    serialize(): any {
        const accounts: any = {};
        for (const [k, v] of this.accounts) {
            const _accounts: any = (accounts[k.toString()] = {});
            for (const [_k, _v] of v) {
                _accounts[_k] = _v.serialize();
            }
        }

        const pairs: any = {};
        for (const [k, v] of this.pairStates) {
            pairs[k.toString()] = v.serialize();
        }

        return {
            accounts,
            pairs,
            condition: this.condition,
            setting: serializeSimpleObject({
                initialMarginRatio: this.setting.initialMarginRatio,
                maintenanceMarginRatio: this.setting.maintenanceMarginRatio,
                quoteParam: this.setting.quoteParam,
            }),
        };
    }

    deserialize(serialized: any): this {
        for (const [k, v] of Object.entries(serialized.accounts)) {
            if (typeof v !== 'object' || v === null) {
                throw new Error('invalid deserialize');
            }

            const _map = new Map<string, AccountState>();
            for (const [_k, _v] of Object.entries(v)) {
                const account = new AccountState(EMPTY_POSITION, [], [], [], []);
                _map.set(_k, account.deserialize(_v));
            }
            this.accounts.set(mustParseNumber(k), _map);
        }

        for (const [k, v] of Object.entries(serialized.pairs)) {
            const pairs = new PairState(EMPTY_AMM);
            this.pairStates.set(mustParseNumber(k), pairs.deserialize(v));
        }

        this.condition = serialized.condition;

        this.setting = deserializeSimpleObject(serialized.setting);

        return this;
    }

    copy(): InstrumentState {
        return new InstrumentState(
            InstrumentCondition.NORMAL,
            INITIAL_MARGIN_RATIO,
            MAINTENANCE_MARGIN_RATIO,
            EMPTY_QUOTE_PARAM,
        ).deserialize(this.serialize());
    }

    setAccountState(trader: string, expiry: number, account: AccountState): void {
        let traderMap = this.accounts.get(expiry);
        if (!traderMap) {
            traderMap = new Map<string, AccountState>();
            this.accounts.set(expiry, traderMap);
        }

        traderMap.set(trader.toLowerCase(), account);
    }

    getAccountState(expiry: number, trader: string): AccountState {
        trader = trader.toLowerCase();
        if (!this.accounts.has(expiry)) {
            const traderMap = new Map<string, AccountState>();
            this.accounts.set(expiry, traderMap);
        }
        if (!this.accounts.get(expiry)!.has(trader)) {
            const traderAccount = new AccountState(EMPTY_POSITION, [], [], [], []);
            this.accounts.get(expiry)!.set(trader, traderAccount);
        }
        return this.accounts.get(expiry)!.get(trader)!;
    }

    getPairState(expiry: number): PairState {
        if (expiry < 0) {
            throw new Error('expiry cannot be negative');
        }
        if (!this.pairStates.has(expiry)) {
            const pairState = new PairState(EMPTY_AMM);
            pairState.amm.expiry = expiry;
            this.pairStates.set(expiry, pairState);
        }
        return this.pairStates.get(expiry)!;
    }

    // event UpdateCondition(uint32 timestamp, Condition condition);
    handleUpdateCondition(event: ParsedEvent<UpdateConditionEventObject>, log: ethers.providers.Log): void {
        void log;
        this.condition = event.args.condition as InstrumentCondition;
    }

    // event Adjust(uint32 indexed expiry, address indexed trader, int net);
    handleAdjust(event: ParsedEvent<AdjustEventObject>, log: ethers.providers.Log): void {
        void log;
        const pair = this.getPairState(event.args.expiry);
        const account = this.getAccountState(event.args.expiry, event.args.trader);
        account.applyAdjust(event.args, pair.amm);
    }

    // event UpdateAmmStatus(uint32 indexed expiry, Status status, uint160 sqrtPX96, uint mark);
    handleUpdateAmmStatus(event: ParsedEvent<UpdateAmmStatusEventObject>, log: ethers.providers.Log): void {
        const pair = this.getPairState(event.args.expiry);
        pair.applyUpdateAmmStatus(event.args, log);
    }

    // event Add(uint32 indexed expiry, address indexed trader, int24 tickLower, int24 tickUpper, Range range);
    handleAdd(event: ParsedEvent<AddEventObject>, log: ethers.providers.Log): void {
        void log;
        const trader = event.args.trader.toLowerCase();
        const pair = this.getPairState(event.args.expiry);
        const account = this.getAccountState(event.args.expiry, trader);
        account.applyAdd(event.args);
        pair.applyAdd(event.args);
    }

    // event Remove(uint32 indexed expiry, address indexed trader, int24 tickLower, int24 tickUpper, uint fee,
    //      PositionCache pic, address operator, uint tip);
    handleRemove(event: ParsedEvent<RemoveEventObject>, log: ethers.providers.Log): void {
        void log;
        const trader = event.args.trader.toLowerCase();
        const pair = this.getPairState(event.args.expiry);
        const traderAccount = this.getAccountState(event.args.expiry, trader);
        const range = traderAccount.ranges.get(rangeKey(event.args.tickLower, event.args.tickUpper))!;
        const closedSize = traderAccount.applyRemove(event.args, pair.amm as unknown as Amm);
        pair.applyRemove(event.args, range, closedSize);
    }

    // event UpdateParam(QuoteParam param);
    handleUpdateParam(event: ParsedEvent<UpdateParamEventObject>, log: ethers.providers.Log): void {
        void log;
        this.setting.quoteParam = event.args.param;
    }

    // event Trade(
    //    uint32 indexed expiry, address indexed trader, int size, uint amount, int takenSize, uint takenValue,
    //    uint entryNotional, uint16 feeRatio, uint160 sqrtPX96, uint mark);
    handleTrade(event: ParsedEvent<TradeEventObject>, log: ethers.providers.Log): void {
        void log;
        const trader = event.args.trader.toLowerCase();
        const traderAccount = this.getAccountState(event.args.expiry, trader);
        const pair = this.getPairState(event.args.expiry);

        const closedSize = traderAccount.applyTrade(event.args, pair, this.setting.quoteParam);
        pair.applyTradeOrSweep(
            event.args.size,
            event.args.takenSize,
            event.args.sqrtPX96,
            event.args.feeRatio,
            closedSize,
        );
    }

    // event Place(uint32 indexed expiry, address indexed trader, int24 tick, uint32 nonce, Order order);
    handlePlace(event: ParsedEvent<PlaceEventObject>, log: ethers.providers.Log): void {
        void log;
        const trader = event.args.trader.toLowerCase();
        const traderAccount = this.getAccountState(event.args.expiry, trader);
        const pair = this.getPairState(event.args.expiry);

        pair.updateTickOrder(event.args.tick, event.args.order.size);

        traderAccount.addOrder(event.args.tick, event.args.nonce, event.args.order);
    }

    // event Cancel(uint32 indexed expiry, address indexed trader, int24 tick, uint32 nonce, uint fee, PositionCache pic);
    handleCancel(event: ParsedEvent<CancelEventObject>, log: ethers.providers.Log): void {
        void log;
        const trader = event.args.trader.toLowerCase();
        const pair = this.getPairState(event.args.expiry);
        const traderAccount = this.getAccountState(event.args.expiry, trader);

        const res = traderAccount.applyCancel(event.args, pair);
        pair.applyCancel(event.args, res.closedSize, res.orderSize);
    }

    // event Fill(uint32 indexed expiry, address indexed trader, int24 tick, uint32 nonce, uint fee, PositionCache pic, address operator, uint tip);
    handleFill(event: ParsedEvent<FillEventObject>, log: ethers.providers.Log): void {
        void log;
        const trader = event.args.trader.toLowerCase();

        const pair = this.getPairState(event.args.expiry);
        const traderAccount = this.getAccountState(event.args.expiry, trader);
        const res = traderAccount.applyFill(event.args, pair);
        pair.applyFill(event.args, res.closedSize);
    }

    // event DeleteContext(uint32 indexed expiry);
    handleDeleteContext(event: ParsedEvent<DeleteContextEventObject>, log: ethers.providers.Log): void {
        void log;
        this.pairStates.get(event.args.expiry)!.amm = { ...EMPTY_AMM };
    }

    // event Liquidate(uint32 indexed expiry, address indexed trader, uint amount, uint mark, address target, int size);
    handleLiquidate(event: ParsedEvent<LiquidateEventObject>, log: ethers.providers.Log): void {
        void log;
        const trader = event.args.trader.toLowerCase();

        const pair = this.getPairState(event.args.expiry);
        const liquidatorAccount = this.getAccountState(event.args.expiry, trader);
        const targetAccount = this.getAccountState(event.args.expiry, event.args.target);
        const tpic = targetAccount.applyLiquidateAsTarget(event.args, pair);

        const closedSize = liquidatorAccount.applyLiquidateAsLiquidator(event.args, tpic, pair);
        pair.applyLiquidate(closedSize);
    }

    // event Sweep(uint32 indexed expiry, address indexed trader, int size, int takenSize, uint takenValue, uint entryNotional, uint16 feeRatio, uint160 sqrtPX96, uint mark, address operator);
    handleSweep(event: ParsedEvent<SweepEventObject>, log: ethers.providers.Log): void {
        void log;
        const trader = event.args.trader.toLowerCase();

        const pair = this.getPairState(event.args.expiry);
        const targetAccount = this.getAccountState(event.args.expiry, trader);

        const closedSize = targetAccount.applySweep(event.args, pair, this.setting.quoteParam);
        pair.applyTradeOrSweep(
            event.args.size,
            event.args.takenSize,
            event.args.sqrtPX96,
            event.args.feeRatio,
            closedSize,
        );
    }

    // event Settle(uint32 indexed expiry, address indexed trader, uint settlement, uint balance, address operator);
    handleSettle(event: ParsedEvent<SettleEventObject>, log: ethers.providers.Log): void {
        void log;
        const trader = event.args.trader.toLowerCase();

        const pair = this.getPairState(event.args.expiry);
        const traderAccount = this.getAccountState(event.args.expiry, trader);
        // only handle position here
        // since the settle function also emit event such as "Fill", "Cancel", "Remove"
        // and the event handler will handle the portfolio of the trader
        const closedSize = traderAccount.applySettle();
        pair.applySettle(closedSize);
    }

    // event ClaimProtocolFee(uint32 indexed expiry, uint amount);
    handleClaimProtocolFee(event: ParsedEvent<ClaimProtocolFeeEventObject>, log: ethers.providers.Log): void {
        void log;
        const pair = this.getPairState(event.args.expiry);
        pair.amm.protocolFee = ZERO;
    }

    // event UpdateFundingIndex(uint fundingIndex);    // fundingIndex = (shortFundingIndex << 128) | longFundingIndex
    handleUpdateFundingIndex(event: ParsedEvent<UpdateFundingIndexEventObject>, log: ethers.providers.Log): void {
        void log;
        const pair = this.getPairState(PERP_EXPIRY);
        pair.applyUpdateFundingIndex(event.args, log);
    }

    // event UpdateSocialLossInsuranceFund(
    //      uint32 indexed expiry, uint128 longSocialLossIndex, uint128 shortSocialLossIndex, uint128 insuranceFund
    //  );
    handleUpdateSocialLossInsuranceFund(
        event: ParsedEvent<UpdateSocialLossInsuranceFundEventObject>,
        log: ethers.providers.Log,
    ): void {
        void log;
        const pair = this.getPairState(event.args.expiry);
        pair.amm.longSocialLossIndex = event.args.longSocialLossIndex;
        pair.amm.shortSocialLossIndex = event.args.shortSocialLossIndex;
        pair.amm.insuranceFund = event.args.insuranceFund;
    }

    // event UpdateFeeState(uint32 indexed expiry, uint128 protocolFee, uint128 feeIndex);
    handleUpdateFeeState(event: ParsedEvent<UpdateFeeStateEventObject>, log: ethers.providers.Log): void {
        void log;
        const pair = this.getPairState(event.args.expiry);
        pair.amm.protocolFee = event.args.protocolFee;
        pair.amm.feeIndex = event.args.feeIndex;
    }

    // event UpdateMarginRatio(uint16 initialMarginRatio, uint16 maintenanceMarginRatio)
    handleUpdateMarginRatio(event: ParsedEvent<UpdateMarginRatioEventObject>, log: ethers.providers.Log): void {
        void log;
        this.setting.initialMarginRatio = event.args.initialMarginRatio;
        this.setting.maintenanceMarginRatio = event.args.maintenanceMarginRatio;
    }
}

export interface InstrumentMarket extends Market {
    feeder: PriceFeeder | DexV2Feeder;
}

export interface InstrumentMisc {
    placePaused: boolean;
    fundingHour: number;
}

export class InstrumentModel {
    info: InstrumentInfo;
    state: InstrumentState;
    market: InstrumentMarket;

    markPrices = new Map<number, BigNumber>();

    misc?: InstrumentMisc;

    spotPrice: BigNumber;

    constructor(
        info: InstrumentInfo,
        market: InstrumentMarket,
        state: InstrumentState,
        spotPrice: BigNumber,
        misc?: InstrumentMisc,
    ) {
        this.info = info;
        this.market = market;
        this.state = state;
        this.spotPrice = spotPrice;
        if (misc) this.misc = misc;
    }

    public static minimumInstrumentWithParam(param: QuoteParam): InstrumentModel {
        return new InstrumentModel(
            {} as InstrumentInfo,
            {} as InstrumentMarket,
            new InstrumentState(InstrumentCondition.NORMAL, INITIAL_MARGIN_RATIO, MAINTENANCE_MARGIN_RATIO, param),
            ZERO,
        );
    }

    get setting(): InstrumentSetting {
        return this.state.setting;
    }

    get instrumentType(): FeederType {
        return this.market.feeder.ftype;
    }

    get marketType(): MarketType {
        return this.market.info.type as MarketType;
    }

    get minTradeValue(): BigNumber {
        return this.setting.quoteParam.minMarginAmount.mul(RATIO_BASE).div(this.setting.initialMarginRatio);
    }

    get minOrderValue(): BigNumber {
        return this.minTradeValue.mul(MIN_ORDER_MULTIPLIER);
    }

    get minRangeValue(): BigNumber {
        return this.minTradeValue.mul(MIN_RANGE_MULTIPLIER);
    }

    get pairs(): Map<number, PairModel> {
        const pairs = new Map<number, PairModel>();
        for (const [k, v] of this.state.pairStates) {
            pairs.set(k, new PairModel(this, v.amm, this.markPrices.get(k) ?? ZERO, v.blockInfo));
        }
        return pairs;
    }

    getPairModel(expiry: number): PairModel {
        const state = this.state.pairStates.get(expiry);
        return new PairModel(
            this,
            state ? state.amm : EMPTY_AMM,
            this.markPrices.get(expiry) ?? ZERO,
            state ? state.blockInfo : undefined,
        );
    }

    updateInstrumentState(state: InstrumentState, spotPrice: BigNumber): void {
        if (state.blockInfo) this.state.blockInfo = state.blockInfo;
        this.state.condition = state.condition;
        this.state.setting = state.setting;
        this.spotPrice = spotPrice;
    }

    updatePair(amm: Amm, markPrice: BigNumber, blockInfo?: BlockInfo): void {
        this.markPrices.set(amm.expiry, markPrice);
        const pair = this.state.pairStates.get(amm.expiry);
        if (pair) {
            pair.amm = amm;
            pair.amm.blockInfo = blockInfo;
            pair.blockInfo = blockInfo;
        } else {
            this.state.pairStates.set(amm.expiry, new PairState(amm, blockInfo));
        }
    }

    getMarkPrice(expiry: number): BigNumber {
        return this.markPrices.get(expiry) ?? ZERO;
    }

    // calc pair funding rate: fairPrice / spotIndex - 1
    getFundingRate(expiry: number): BigNumber {
        if (this.spotPrice.eq(0)) throw new Error('spot price can not be zero');
        const pairState = this.state.pairStates.get(expiry);
        if (!pairState) throw new Error('pair not found');
        const spotPriceWad = pairState.fairPriceWad;
        const period = this.misc ? this.misc.fundingHour * 3600 : 86400;
        return wdiv(spotPriceWad, this.spotPrice).sub(WAD).mul(86400).div(period);
    }

    getBenchmarkPrice(expiry: number): BigNumber {
        if (expiry == PERP_EXPIRY) {
            return this.spotPrice;
        } else {
            const rawSpotPrice = this.spotPrice;
            const daysLeft = Date.now() / 1000 >= expiry ? 0 : ~~(expiry * 1000 - Date.now()) / (86400 * 1000) + 1;
            if (this.instrumentType === FeederType.BOTH_STABLE || this.instrumentType === FeederType.NONE_STABLE) {
                return this.spotPrice;
            } else if (this.instrumentType === FeederType.QUOTE_STABLE) {
                const rawBenchmarkPrice = wmulDown(rawSpotPrice, r2w(this.market.config.dailyInterestRate))
                    .mul(daysLeft)
                    .add(rawSpotPrice);
                return rawBenchmarkPrice;
            } else {
                /* else if (this.rootInstrument.instrumentType === FeederType.BASE_STABLE)*/
                const priceChange = wmulDown(rawSpotPrice, r2w(this.market.config.dailyInterestRate)).mul(daysLeft);
                return rawSpotPrice.gt(priceChange) ? rawSpotPrice.sub(priceChange) : ZERO;
            }
        }
    }
}
