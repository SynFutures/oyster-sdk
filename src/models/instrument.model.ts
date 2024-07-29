import {
    Amm,
    EMPTY_AMM,
    EMPTY_POSITION,
    EMPTY_QUOTE_PARAM,
    FeederType,
    InstrumentCondition,
    InstrumentInfo,
    InstrumentMarket,
    InstrumentSetting,
    MarketType,
    QuoteParam,
} from '../types';
import { BlockInfo } from '@derivation-tech/web3-core';
import { BigNumber } from 'ethers';
import { deserializeSimpleObject, mustParseNumber, serializeSimpleObject } from '../common';
import {
    INITIAL_MARGIN_RATIO,
    MAINTENANCE_MARGIN_RATIO,
    MIN_ORDER_MULTIPLIER,
    MIN_RANGE_MULTIPLIER,
    PERP_EXPIRY,
    RATIO_BASE,
} from '../constants';
import { r2w, WAD, wdiv, wmulDown, ZERO } from '../math';
import { AccountState } from './account.model';
import { PairModel, PairState } from './pair.model';

export class InstrumentState {
    condition: InstrumentCondition;
    pairStates = new Map<number, PairState>(); // expiry => Pair
    accounts = new Map<number, Map<string, AccountState>>(); // expiry => address => Account;
    setting: InstrumentSetting;

    blockInfo?: BlockInfo;

    constructor(
        condition: InstrumentCondition,
        initialMarginRatio: number,
        maintenanceMarginRatio: number,
        param: QuoteParam,
        blockInfo?: BlockInfo,
    ) {
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
}

export class InstrumentModel {
    info: InstrumentInfo;
    state: InstrumentState;
    market: InstrumentMarket;

    markPrices = new Map<number, BigNumber>();

    spotPrice: BigNumber;

    constructor(info: InstrumentInfo, market: InstrumentMarket, state: InstrumentState, spotPrice: BigNumber) {
        this.info = info;
        this.market = market;
        this.state = state;
        this.spotPrice = spotPrice;
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
        return wdiv(spotPriceWad, this.spotPrice).sub(WAD);
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
