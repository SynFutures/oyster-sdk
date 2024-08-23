import { BigNumber } from 'ethers';
import { BlockInfo } from '@derivation-tech/web3-core';
import {
    Amm,
    EMPTY_AMM,
    FeederType,
    InstrumentCondition,
    InstrumentInfo,
    InstrumentMarket,
    InstrumentSetting,
    MarketType,
    QuoteParam,
} from '../types';
import {
    INITIAL_MARGIN_RATIO,
    MAINTENANCE_MARGIN_RATIO,
    MIN_ORDER_MULTIPLIER,
    MIN_RANGE_MULTIPLIER,
    PERP_EXPIRY,
    RATIO_BASE,
} from '../constants';
import { ONE, r2w, safeWDiv, WAD, wdiv, wmulDown, ZERO } from '../math';

import { AccountState } from './account.model';
import { PairModel, PairState } from './pair.model';
import { ConfigManager } from '../config';

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

    setAccountState(trader: string, expiry: number, account: AccountState): void {
        let traderMap = this.accounts.get(expiry);
        if (!traderMap) {
            traderMap = new Map<string, AccountState>();
            this.accounts.set(expiry, traderMap);
        }

        traderMap.set(trader.toLowerCase(), account);
    }
}

export interface InstrumentData {
    info: InstrumentInfo;
    state: InstrumentState;
    market: InstrumentMarket;
    markPrices: Map<number, BigNumber>;
    spotPrice: BigNumber;
}
export class InstrumentModel {
    constructor(private readonly data: InstrumentData) {}

    //todo fixme info should be a param
    public static minimumInstrumentWithParam(param: QuoteParam): InstrumentModel {
        return new InstrumentModel({
            info: {} as InstrumentInfo,
            market: {} as InstrumentMarket,
            markPrices: new Map<number, BigNumber>(),
            spotPrice: ZERO,
            state: new InstrumentState(
                InstrumentCondition.NORMAL,
                INITIAL_MARGIN_RATIO,
                MAINTENANCE_MARGIN_RATIO,
                param,
            ),
        });
    }

    get wrap(): WrappedInstrumentModel {
        return new WrappedInstrumentModel(this.data);
    }

    get spotPrice(): BigNumber {
        return this.data.spotPrice;
    }

    get markPrices(): Map<number, BigNumber> {
        return this.data.markPrices;
    }

    get market(): InstrumentMarket {
        return this.data.market;
    }

    get info(): InstrumentInfo {
        return this.data.info;
    }

    get state(): InstrumentState {
        return this.data.state;
    }

    get isInverse(): boolean {
        return ConfigManager.isInversePair(this.data.info.chainId, this.data.info.addr, this.data.info.base.address);
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

    getMarkPrice(expiry: number): BigNumber {
        return this.markPrices.get(expiry) ?? ZERO;
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
        this.data.spotPrice = spotPrice;
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
                return wmulDown(rawSpotPrice, r2w(this.market.config.dailyInterestRate))
                    .mul(daysLeft)
                    .add(rawSpotPrice);
            } else {
                /* else if (this.rootInstrument.instrumentType === FeederType.BASE_STABLE)*/
                const priceChange = wmulDown(rawSpotPrice, r2w(this.market.config.dailyInterestRate)).mul(daysLeft);
                return rawSpotPrice.gt(priceChange) ? rawSpotPrice.sub(priceChange) : ZERO;
            }
        }
    }
}

export class WrappedInstrumentModel extends InstrumentModel {
    get wrap(): WrappedInstrumentModel {
        throw new Error('invalid wrap');
    }

    get spotPrice(): BigNumber {
        return this.isInverse ? safeWDiv(ONE, super.spotPrice) : super.spotPrice;
    }

    get markPrices(): Map<number, BigNumber> {
        if (!this.isInverse) {
            return super.markPrices;
        }
        const markPrices = new Map<number, BigNumber>();
        for (const key of super.markPrices.keys()) {
            markPrices.set(key, safeWDiv(ONE, super.markPrices.get(key)!));
        }
        return markPrices;
    }

    get info(): InstrumentInfo {
        if (!this.isInverse) {
            return super.info;
        }
        return {
            chainId: super.info.chainId,
            addr: super.info.addr,
            base: super.info.quote,
            quote: super.info.base,
            symbol: super.info.symbol,
        };
    }

    getMarkPrice(expiry: number): BigNumber {
        return this.markPrices.get(expiry) ?? ZERO;
    }

    getBenchmarkPrice(expiry: number): BigNumber {
        return this.isInverse ? safeWDiv(ONE, super.getBenchmarkPrice(expiry)) : super.getBenchmarkPrice(expiry);
    }
}
