/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ObserverInterface } from './observer.interface';
import { BigNumber, CallOverrides, ethers } from 'ethers';
import { BlockInfo, TokenInfo, ZERO_ADDRESS } from '@derivation-tech/web3-core';
import { SynFuturesV3 as SynFuturesV3Core } from '../core';
import {
    InstrumentLevelAccountModel,
    InstrumentModel,
    InstrumentState,
    PairLevelAccountModel,
    PairModel,
} from '../models';
import {
    Amm,
    AssembledInstrumentData,
    cancelOrderToPosition,
    CexMarket,
    cexMarket,
    combine,
    DexV2Feeder,
    EMPTY_POSITION,
    entryDelta,
    FeederType,
    FetchInstrumentParam,
    fillOrderToPosition,
    FundFlow,
    InstrumentCondition,
    InstrumentIdentifier,
    InstrumentInfo,
    InstrumentMarket,
    MarketConfig,
    MarketInfo,
    MarketType,
    Pending,
    Portfolio,
    Position,
    PriceFeeder,
    Quotation,
    QuoteParam,
    QuoteType,
    rangeToPosition,
    Side,
    signOfSide,
} from '../types';
import { calcMaxWithdrawable, TickMath, wdiv, ZERO } from '../math';
import {
    Combine,
    alphaWadToTickDelta,
    calcBenchmarkPrice,
    fromWad,
    getTokenInfo,
    getTokenSymbol,
    InstrumentParser,
    isEmptyPortfolio,
    trimObj,
} from '../common';
import { RANGE_SPACING } from '../constants';
import { CachePlugin } from './cache.plugin';
import { InstrumentPlugin } from './instrument.plugin';

type SynFuturesV3 = Combine<[SynFuturesV3Core, CachePlugin, InstrumentPlugin]>;

export class ObserverModule implements ObserverInterface {
    synfV3: SynFuturesV3;

    constructor(synfV3: SynFuturesV3) {
        this.synfV3 = synfV3;
    }

    estimateAPY(pairModel: PairModel, poolFee24h: BigNumber, alphaWad: BigNumber): number {
        if (pairModel.amm.liquidity.eq(ZERO)) return 0;
        const assumeAddMargin = pairModel.rootInstrument.minRangeValue;
        const tickDelta = alphaWadToTickDelta(alphaWad);

        const upperTick = RANGE_SPACING * ~~((pairModel.amm.tick + tickDelta) / RANGE_SPACING);
        const lowerTick = RANGE_SPACING * ~~((pairModel.amm.tick - tickDelta) / RANGE_SPACING);
        const { liquidity: assumeAddLiquidity } = entryDelta(
            pairModel.amm.sqrtPX96,
            lowerTick,
            upperTick,
            assumeAddMargin,
            pairModel.rootInstrument.setting.initialMarginRatio,
        );
        const assumed24HrFee: BigNumber = poolFee24h.mul(assumeAddLiquidity).div(pairModel.amm.liquidity);
        const apyWad: BigNumber = wdiv(assumed24HrFee.mul(365), assumeAddMargin);

        return fromWad(apyWad);
    }

    async fetchInstrumentBatch(params: FetchInstrumentParam[], overrides?: CallOverrides): Promise<InstrumentModel[]> {
        const [rawList, rawBlockInfo] = trimObj(
            await this.synfV3.cache.contracts.observer.getInstrumentBatch(params, overrides ?? {}),
        );
        return this.parseInstrumentData(rawList, rawBlockInfo);
    }

    async getAllInstruments(batchSize = 10, overrides?: CallOverrides): Promise<InstrumentModel[]> {
        const instrumentLists = await this.synfV3.cache.contracts.gate.getAllInstruments(overrides ?? {});
        let instrumentModels: InstrumentModel[] = [];
        const totalPage = Math.ceil(instrumentLists.length / batchSize);

        for (let i = 0; i < totalPage; i++) {
            const queryList = instrumentLists.slice(
                i * batchSize,
                (i + 1) * batchSize >= instrumentLists.length ? instrumentLists.length : (i + 1) * batchSize,
            );
            const [rawList, rawBlockInfo] = trimObj(
                await this.synfV3.cache.contracts.observer.getInstrumentByAddressList(queryList, overrides ?? {}),
            );
            instrumentModels = instrumentModels.concat(await this.parseInstrumentData(rawList, rawBlockInfo));
        }

        return instrumentModels;
    }

    async getFundFlows(
        quoteAddrs: string[],
        trader: string,
        overrides?: CallOverrides,
    ): Promise<{
        fundFlows: FundFlow[];
        blockInfo: BlockInfo;
    }> {
        const gateInterface = this.synfV3.cache.contracts.gate.interface;
        const observerInterface = this.synfV3.cache.contracts.observer.interface;

        const calls: { target: string; callData: string }[] = [];

        calls.push(
            ...quoteAddrs.map((quote) => {
                return {
                    target: this.synfV3.cache.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('fundFlowOf', [quote, trader]),
                };
            }),
        );
        // just to get the block info
        calls.push({
            target: this.synfV3.cache.contracts.observer.address,
            callData: observerInterface.encodeFunctionData('getVaultBalances', [trader, quoteAddrs]),
        });
        const rawRet = (await this.synfV3.ctx.getMulticall3().callStatic.aggregate(calls, overrides ?? {})).returnData;
        const fundFlows = rawRet.slice(0, quoteAddrs.length).map((ret) => {
            return trimObj(gateInterface.decodeFunctionResult('fundFlowOf', ret)[0]) as FundFlow;
        });
        const blockInfo = trimObj(
            observerInterface.decodeFunctionResult('getVaultBalances', rawRet[quoteAddrs.length])[1],
        );
        return { fundFlows, blockInfo: blockInfo as BlockInfo };
    }

    async getInstrumentLevelAccounts(
        target: string,
        overrides?: CallOverrides,
    ): Promise<InstrumentLevelAccountModel[]> {
        const allInstrumentAddr = [...this.synfV3.cache.instrumentMap.keys()];
        const quotes = Array.from(
            new Set(
                allInstrumentAddr.map(
                    (instrument) => this.synfV3.cache.instrumentMap.get(instrument.toLowerCase())!.info.quote.address,
                ),
            ),
        );
        await this.synfV3.cache.syncGateCache(target, quotes);

        const observerInterface = this.synfV3.cache.contracts.observer.interface;
        const calls = [];
        //todo optimise by observer
        for (const instrument of allInstrumentAddr) {
            calls.push({
                target: this.synfV3.cache.contracts.observer.address,
                callData: observerInterface.encodeFunctionData('getPortfolios', [target, instrument]),
            });
        }
        const rawRet = (await this.synfV3.ctx.getMulticall3().callStatic.aggregate(calls, overrides ?? {})).returnData;

        const map = new Map<string, InstrumentLevelAccountModel>(); // instrument address in lowercase => InstrumentLevelAccount
        for (let i = 0; i < rawRet.length; i++) {
            const decoded = observerInterface.decodeFunctionResult('getPortfolios', rawRet[i]);
            const expiries = decoded.expiries;
            const portfolios = decoded.portfolios;
            const blockInfo = trimObj(decoded.blockInfo);

            const instrumentAddr = allInstrumentAddr[i];
            const instrumentModel = this.synfV3.cache.instrumentMap.get(instrumentAddr);
            if (instrumentModel) {
                for (let j = 0; j < expiries.length; j++) {
                    const portfolio = portfolios[j] as Portfolio;
                    // skip empty portfolio
                    if (isEmptyPortfolio(portfolio)) continue;

                    let instrumentLevelAccount = map.get(instrumentAddr);
                    if (!instrumentLevelAccount) {
                        instrumentLevelAccount = new InstrumentLevelAccountModel(
                            instrumentModel,
                            instrumentAddr,
                            target.toLowerCase(),
                        );
                        map.set(instrumentAddr, instrumentLevelAccount);
                    }
                    const pair = instrumentModel.getPairModel(expiries[j]);
                    if (pair) {
                        instrumentLevelAccount.addPairLevelAccount(pair, portfolios[j], blockInfo);
                    }
                }
            }
        }
        return Array.from(map.values());
    }

    async getNextInitializedTickOutside(
        instrumentAddr: string,
        expiry: number,
        tick: number,
        right: boolean,
    ): Promise<number> {
        const observer = this.synfV3.cache.contracts.observer;
        return await TickMath.getNextInitializedTickOutside(observer, instrumentAddr, expiry, tick, right);
    }

    async getPairLevelAccount(
        target: string,
        instrument: string,
        expiry: number,
        useCache: boolean,
    ): Promise<PairLevelAccountModel> {
        instrument = instrument.toLowerCase();
        target = target.toLowerCase();
        if (!useCache) {
            return this.updatePairLevelAccount(target, instrument, expiry);
        }
        // check whether cache has the info
        const targetInstrumentMap = this.synfV3.cache.accountCache.get(target);
        if (targetInstrumentMap) {
            const instrumentExpiryMap = targetInstrumentMap.get(instrument);
            if (instrumentExpiryMap) {
                const pairLevelAccountModel = instrumentExpiryMap.get(expiry);
                if (pairLevelAccountModel) {
                    return pairLevelAccountModel;
                }
            }
        }
        // get info on chain and load into cache
        return await this.updatePairLevelAccount(target, instrument, expiry);
    }

    async getPositionIfSettle(traderAccount: PairLevelAccountModel): Promise<Position> {
        let finalPic: Position = Object.assign({}, EMPTY_POSITION);
        const amm = traderAccount.rootPair.amm;
        const instrumentAddr = traderAccount.rootPair.rootInstrument.info.addr;
        const expiry = amm.expiry;
        // range settle part
        for (const range of traderAccount.ranges) {
            const position: Position = rangeToPosition(
                amm.sqrtPX96,
                amm.tick,
                amm.feeIndex,
                amm.longSocialLossIndex,
                amm.shortSocialLossIndex,
                amm.longFundingIndex,
                amm.shortFundingIndex,
                range.tickLower,
                range.tickUpper,
                range,
            );
            finalPic = combine(amm, finalPic, position).position;
        }
        const ticks = traderAccount.orders.map((o) => o.tick);
        const nonces = traderAccount.orders.map((o) => o.nonce);
        const pearls = await this.synfV3.cache.contracts.observer.getPearls(instrumentAddr, expiry, ticks);
        const records = await this.synfV3.cache.contracts.observer.getRecords(instrumentAddr, expiry, ticks, nonces);
        // order settle part
        for (let i = 0; i < traderAccount.orders.length; i++) {
            const order = traderAccount.orders[i];
            const pearl = pearls[i];
            const record = records[i];
            let position: Position;
            if (pearl.nonce === order.nonce) {
                position = cancelOrderToPosition(
                    pearl.left,
                    pearl.nonce,
                    pearl.taken,
                    pearl.fee,
                    pearl.entrySocialLossIndex,
                    pearl.entryFundingIndex,
                    order,
                    order.tick,
                    order.nonce,
                    record,
                );
            } else {
                position = fillOrderToPosition(
                    pearl.nonce,
                    pearl.taken,
                    pearl.fee,
                    pearl.entrySocialLossIndex,
                    pearl.entryFundingIndex,
                    order,
                    order.tick,
                    order.nonce,
                    order.size,
                    record,
                );
            }
            finalPic = combine(amm, finalPic, position).position;
        }
        // position settle part
        finalPic = combine(amm, finalPic, traderAccount.position).position;
        return finalPic;
    }

    async getQuoteTokenInfo(quoteSymbol: string, instrumentAddr: string): Promise<TokenInfo> {
        return (
            this.synfV3.cache.quoteSymbolToInfo.get(quoteSymbol) ??
            (await this.synfV3.ctx.getTokenInfo(quoteSymbol)) ??
            (await this.synfV3.ctx.getTokenInfo(
                (
                    await this.synfV3.cache.contracts.observer.getSetting(instrumentAddr)
                ).quote,
            ))
        );
    }

    getRawSpotPrice(identifier: InstrumentIdentifier): Promise<BigNumber> {
        if (identifier.marketType === MarketType.DEXV2) {
            return this.getDexV2RawSpotPrice(identifier);
        } else if (cexMarket(identifier.marketType)) {
            return this.getCexRawSpotPrice(identifier);
        } else {
            throw new Error('Unsupported market type');
        }
    }

    async getSizeToTargetTick(instrumentAddr: string, expiry: number, targetTick: number): Promise<BigNumber> {
        const observer = this.synfV3.cache.contracts.observer;
        return await TickMath.getSizeToTargetTick(observer, instrumentAddr, expiry, targetTick);
    }

    async getUserPendings(
        quotes: string[],
        trader: string,
        overrides?: CallOverrides,
    ): Promise<{
        pendings: { maxWithdrawable: BigNumber; pending: Pending }[];
        blockInfo: BlockInfo;
    }> {
        const gateInterface = this.synfV3.cache.contracts.gate.interface;
        const observerInterface = this.synfV3.cache.contracts.observer.interface;
        const calls: { target: string; callData: string }[] = [];
        calls.push(
            ...quotes.map((quote) => {
                return {
                    target: this.synfV3.cache.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('fundFlowOf', [quote, trader]),
                };
            }),
        );
        calls.push(
            ...quotes.map((quote) => {
                return {
                    target: this.synfV3.cache.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('thresholdOf', [quote]),
                };
            }),
        );
        calls.push(
            ...quotes.map((quote) => {
                return {
                    target: this.synfV3.cache.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('reserveOf', [quote, trader]),
                };
            }),
        );
        calls.push({
            target: this.synfV3.cache.contracts.observer.address,
            callData: observerInterface.encodeFunctionData('getPendings', [quotes, trader]),
        });
        const rawRet = (await this.synfV3.ctx.getMulticall3().callStatic.aggregate(calls, overrides ?? {})).returnData;
        const fundFlows = rawRet
            .slice(0, quotes.length)
            .map((ret) => gateInterface.decodeFunctionResult('fundFlowOf', ret)[0] as FundFlow);
        const thresholds = rawRet
            .slice(quotes.length, quotes.length * 2)
            .map((ret) => gateInterface.decodeFunctionResult('thresholdOf', ret)[0] as BigNumber);
        const reserves = rawRet
            .slice(quotes.length * 2, quotes.length * 3)
            .map((ret) => gateInterface.decodeFunctionResult('reserveOf', ret)[0] as BigNumber);
        const decoded = observerInterface.decodeFunctionResult('getPendings', rawRet[quotes.length * 3]);
        const pendings = decoded[0] as Pending[];
        const blockInfo = trimObj(decoded[1]) as BlockInfo;
        return {
            pendings: pendings.map((pending, index) => {
                return {
                    maxWithdrawable: calcMaxWithdrawable(thresholds[index], pending, fundFlows[index], reserves[index]),
                    pending,
                };
            }),
            blockInfo,
        };
    }

    async inquireByBase(
        pair: PairModel,
        side: Side,
        baseAmount: BigNumber,
        overrides?: CallOverrides,
    ): Promise<{
        quoteAmount: BigNumber;
        quotation: Quotation;
    }> {
        const instrument = this.synfV3.cache.getInstrumentContract(
            pair.rootInstrument.info.addr,
            this.synfV3.ctx.provider,
        );
        const expiry = pair.amm.expiry;
        const sign = signOfSide(side);
        const size = baseAmount.mul(sign);
        const quotation = await instrument.inquire(expiry, size, overrides ?? {});
        const entryNotional = quotation.entryNotional;
        return {
            quoteAmount: entryNotional,
            quotation: quotation,
        };
    }

    async inquireByQuote(
        pair: PairModel,
        side: Side,
        quoteAmount: BigNumber,
        overrides?: CallOverrides,
    ): Promise<{
        baseAmount: BigNumber;
        quotation: Quotation;
    }> {
        const expiry = pair.amm.expiry;
        const long = side === Side.LONG;
        const { size, quotation } = await this.synfV3.cache.contracts.observer.inquireByNotional(
            pair.rootInstrument.info.addr,
            expiry,
            quoteAmount,
            long,
            overrides ?? {},
        );
        return {
            baseAmount: size.abs(),
            quotation: quotation,
        };
    }

    async inspectCexMarketBenchmarkPrice(
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
    ): Promise<BigNumber> {
        const instrumentAddress = await this.synfV3.instrument.computeInstrumentAddress(
            instrumentIdentifier.marketType,
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        const market = this.synfV3.cache.contracts.marketContracts[instrumentIdentifier.marketType]
            ?.market as CexMarket;
        let benchmarkPrice;
        try {
            benchmarkPrice = await market.getBenchmarkPrice(instrumentAddress, expiry);
        } catch (e) {
            console.error('fetch chainlink market price error', e);
            benchmarkPrice = ZERO;
        }
        return benchmarkPrice;
    }

    async inspectDexV2MarketBenchmarkPrice(
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
    ): Promise<BigNumber> {
        const { baseSymbol, quoteSymbol } = getTokenSymbol(
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        const baseParam = this.synfV3.cache.config.quotesParam[baseSymbol];
        const quoteParam = this.synfV3.cache.config.quotesParam[quoteSymbol];

        const baseStable = baseParam && baseParam.qtype === QuoteType.STABLE;
        const quoteStable = quoteParam && quoteParam.qtype === QuoteType.STABLE;

        const feederType: FeederType = ((baseStable ? 2 : 0) + (quoteStable ? 1 : 0)) as FeederType;

        const rawSpotPrice = await this.getDexV2RawSpotPrice(instrumentIdentifier);

        return calcBenchmarkPrice(
            expiry,
            rawSpotPrice,
            feederType,
            this.synfV3.cache.config.marketConfig.DEXV2!.dailyInterestRate,
        );
    }

    async parseInstrumentData(rawList: AssembledInstrumentData[], blockInfo: BlockInfo): Promise<InstrumentModel[]> {
        const instrumentModels: InstrumentModel[] = [];
        for (const rawInstrument of rawList) {
            const [baseSymbol, quoteSymbol, marketType] = rawInstrument.symbol.split('-');
            const quoteTokenInfo = await this.getQuoteTokenInfo(quoteSymbol, rawInstrument.instrumentAddr);
            let baseInfo: TokenInfo = { symbol: baseSymbol, address: ethers.constants.AddressZero, decimals: 0 };
            if (!cexMarket(marketType as MarketType)) {
                // fetch base token info from ctx
                const onCtxBaseInfo = await this.synfV3.ctx.getTokenInfo(baseSymbol);
                if (onCtxBaseInfo) {
                    baseInfo = onCtxBaseInfo;
                }
            }
            const instrumentInfo: InstrumentInfo = {
                chainId: this.synfV3.ctx.chainId,
                addr: rawInstrument.instrumentAddr,
                symbol: rawInstrument.symbol,
                base: baseInfo,
                quote: quoteTokenInfo,
            };
            const marketInfo: MarketInfo = {
                addr: rawInstrument.market,
                type: marketType,
                beacon: this.synfV3.cache.config.contractAddress.market[marketType as MarketType]!.beacon,
            };
            const marketConfig: MarketConfig = this.synfV3.cache.config.marketConfig[marketType as MarketType]!;
            const feeder = cexMarket(marketType as MarketType)
                ? (rawInstrument.priceFeeder as PriceFeeder)
                : (rawInstrument.dexV2Feeder as DexV2Feeder);
            // we assume that marketConfig is not null
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const market: InstrumentMarket = { info: marketInfo, config: marketConfig, feeder: feeder };
            const param: QuoteParam = rawInstrument.param;
            const instrumentState: InstrumentState = new InstrumentState(
                rawInstrument.condition as InstrumentCondition,
                rawInstrument.initialMarginRatio,
                rawInstrument.maintenanceMarginRatio,
                param,
                blockInfo,
            );
            const instrumentModel = new InstrumentModel({
                info: instrumentInfo,
                market: market,
                state: instrumentState,
                spotPrice: rawInstrument.spotPrice,
                markPrices: new Map<number, BigNumber>(),
            });
            for (let i = 0; i < rawInstrument.amms.length; i++) {
                const rawAmm = rawInstrument.amms[i];
                if (rawAmm.expiry === 0) {
                    continue;
                }
                instrumentModel.updatePair(rawAmm as Amm, rawInstrument.markPrices[i], blockInfo);
            }
            this.synfV3.ctx.registerAddress(instrumentInfo.addr, instrumentInfo.symbol);
            this.synfV3.ctx.registerContractParser(instrumentInfo.addr, new InstrumentParser());
            instrumentModels.push(instrumentModel);
        }
        return instrumentModels;
    }

    public async updatePairLevelAccount(
        target: string,
        instrument: string,
        expiry: number,
        overrides?: CallOverrides,
    ): Promise<PairLevelAccountModel> {
        instrument = instrument.toLowerCase();
        target = target.toLowerCase();
        await this.synfV3.cache.updateInstrument([{ instrument: instrument, expiries: [expiry] }]);
        const resp = await this.synfV3.cache.contracts.observer.getAcc(instrument, expiry, target, overrides ?? {});
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const pair: PairModel = this.synfV3.cache.instrumentMap.get(instrument)!.getPairModel(expiry);
        const pairLevelAccountModel = PairLevelAccountModel.fromRawPortfolio(
            pair,
            target,
            resp.portfolio,
            trimObj(resp.blockInfo),
        );
        this.synfV3.cache.instrumentMap
            .get(instrument)
            ?.state.setAccountState(target, expiry, pairLevelAccountModel.account);

        // load into cache
        const newTargetInstrumentMap = this.synfV3.cache.accountCache.get(target) || new Map();
        const newInstrumentExpiryMap = newTargetInstrumentMap.get(instrument) || new Map();
        newInstrumentExpiryMap.set(expiry, pairLevelAccountModel);
        newTargetInstrumentMap.set(instrument, newInstrumentExpiryMap);
        this.synfV3.cache.accountCache.set(target, newTargetInstrumentMap);
        return pairLevelAccountModel;
    }

    async getDexV2RawSpotPrice(identifier: InstrumentIdentifier): Promise<BigNumber> {
        const { baseTokenInfo, quoteTokenInfo } = await getTokenInfo(identifier, this.synfV3.ctx);

        const baseScaler = BigNumber.from(10).pow(18 - baseTokenInfo.decimals);
        const quoteScaler = BigNumber.from(10).pow(18 - quoteTokenInfo.decimals);

        const isToken0Quote = BigNumber.from(baseTokenInfo.address).gt(BigNumber.from(quoteTokenInfo.address));

        const dexV2PairInfo = await this.synfV3.cache.contracts.observer.inspectMaxReserveDexV2Pair(
            baseTokenInfo.address,
            quoteTokenInfo.address,
        );
        if (
            dexV2PairInfo.maxReservePair === ZERO_ADDRESS ||
            dexV2PairInfo.reserve0.isZero() ||
            dexV2PairInfo.reserve1.isZero()
        ) {
            // no liquidity
            return ZERO;
        }

        return isToken0Quote
            ? wdiv(dexV2PairInfo.reserve0.mul(quoteScaler), dexV2PairInfo.reserve1.mul(baseScaler))
            : wdiv(dexV2PairInfo.reserve1.mul(quoteScaler), dexV2PairInfo.reserve0.mul(baseScaler));
    }

    async getCexRawSpotPrice(instrumentIdentifier: InstrumentIdentifier): Promise<BigNumber> {
        const instrumentAddress = await this.synfV3.instrument.computeInstrumentAddress(
            instrumentIdentifier.marketType,
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        const market = this.synfV3.cache.contracts.marketContracts[instrumentIdentifier.marketType]
            ?.market as CexMarket;
        let rawSpotPrice;
        try {
            rawSpotPrice = await market.getRawPrice(instrumentAddress);
        } catch (e) {
            console.error('fetch chainlink spot price error', e);
            rawSpotPrice = ZERO;
        }
        return rawSpotPrice;
    }
}
