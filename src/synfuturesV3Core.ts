/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    ConfigManager,
    ContractAddress,
    FeederFactoryContracts,
    MarketContracts,
    SynfConfig,
    SynFuturesV3Contracts,
} from './config';
import { BigNumber, CallOverrides, Overrides, PayableOverrides, Signer, ethers } from 'ethers';
import { Provider } from '@ethersproject/providers';
import { BlockInfo, CHAIN_ID, ContractParser, ZERO_ADDRESS } from '@derivation-tech/web3-core';
import {
    Instrument__factory,
    Observer__factory,
    DexV2Market__factory,
    Instrument,
    Config__factory,
    Gate__factory,
    CexMarket__factory,
    Beacon__factory,
    CexMarket,
    Guardian__factory,
    PythFeederFactory__factory,
    EmergingFeederFactory__factory,
} from './types/typechain';
import { getNextInitializedTickOutside, getSizeToTargetTick, getTickBitMaps } from './query';
import { ChainContext } from '@derivation-tech/web3-core';
import {
    alphaWadToTickDelta,
    calcBenchmarkPrice,
    encodeRemoveParam,
    encodeFillParam,
    encodeCancelParam,
    encodeDepositParam,
    encodeWithdrawParam,
    fromWad,
    normalizeTick,
    rangeKey,
    trimObj,
    withinOrderLimit,
    tickDeltaToAlphaWad,
    encodeTradeWithReferralParam,
    encodeAddWithReferralParam,
    encodePlaceWithReferralParam,
    encodeAdjustWithReferralParam,
    encodeTradeWithRiskParam,
    encodeBatchPlaceWithReferralParam,
    alignTick,
} from './common/util';
import {
    AddParam,
    AdjustParam,
    Amm,
    CancelParam,
    InstrumentIdentifier,
    FillParam,
    InstrumentLevelAccountModel,
    InstrumentMarket,
    LiquidateParam,
    PlaceParam,
    PairModel,
    RemoveParam,
    SweepParam,
    TradeParam,
    QuoteParam,
    PriceFeeder,
    DexV2Feeder,
    MarketInfo,
    MarketConfig,
    FetchInstrumentParam,
    PairLevelAccountModel,
    Quotation,
    NumericConverter,
    PositionModel,
    OrderModel,
    entryDelta,
    RangeModel,
    combine,
    TokenInfo,
    Portfolio,
    getMarginFromLiquidity,
    EMPTY_POSITION,
    Position,
    rangeToPosition,
    cancelOrderToPosition,
    fillOrderToPosition,
    InstrumentSetting,
    alignRangeTick,
    EMPTY_QUOTE_PARAM,
    BatchPlaceParam,
    SimulateTradeResult,
    SimulateOrderResult,
} from './types';
import { r2w, sqrtX96ToWad, TickMath, wadToTick, wdiv, wmul, wmulDown, wmulUp, ZERO, wdivUp, max } from './math';
import {
    BatchOrderSizeDistribution,
    cexMarket,
    FeederType,
    InstrumentCondition,
    MarketType,
    QuoteType,
    Side,
    signOfSide,
} from './types/enum';
import { AssembledInstrumentData, InstrumentInfo, InstrumentModel, InstrumentState } from './types/instrument';
import {
    DEFAULT_REFERRAL_CODE,
    INT24_MAX,
    INT24_MIN,
    MAX_BATCH_ORDER_COUNT,
    MAX_CANCEL_ORDER_COUNT,
    MIN_BATCH_ORDER_COUNT,
    NATIVE_TOKEN_ADDRESS,
    ONE_RATIO,
    ORDER_SPACING,
    PEARL_SPACING,
    PERP_EXPIRY,
    RANGE_SPACING,
    RATIO_BASE,
    RATIO_DECIMALS,
} from './constants';
import {
    CexMarketParser,
    ConfigParser,
    DexV2MarketParser,
    GateParser,
    GuardianParser,
    InstrumentParser,
} from './common/parser';
import { FundFlow, GateState, Pending } from './types/gate';
import { ConfigState } from './types/config';
import { updateFundingIndex } from './math/funding';
import { SdkError } from './errors/sdk.error';

export const synfV3Utils = {
    parseInstrumentSymbol: function (symbol: string): InstrumentIdentifier {
        const [prefix, baseSymbol, quoteSymbol, marketType] = symbol.split('-');
        if (prefix !== 'SynFuturesV3') {
            throw new Error('Technically the instrument symbol should start with SynFuturesV3');
        }
        return {
            marketType: marketType as MarketType,
            baseSymbol: baseSymbol,
            quoteSymbol: quoteSymbol,
        };
    },

    isEmptyPortfolio: function (portfolio: Portfolio): boolean {
        return portfolio.oids.length === 0 && portfolio.rids.length === 0 && portfolio.position.size.isZero();
    },
};

export class SynFuturesV3 {
    private static instances = new Map<number, SynFuturesV3>();
    ctx: ChainContext;
    // this is not initialized in constructor, but in _init().
    config!: SynfConfig;
    contracts!: SynFuturesV3Contracts;
    gateState: GateState;
    configState: ConfigState;
    // update <-- new block info
    instrumentMap: Map<string, InstrumentModel> = new Map(); // lowercase address => instrument

    // lowercase address user => lowercase instrument address => expiry => PairLevelAccountModel
    accountCache: Map<string, Map<string, Map<number, PairLevelAccountModel>>> = new Map();

    // quote symbol => quote token info
    quoteSymbolToInfo: Map<string, TokenInfo> = new Map();

    protected constructor(ctx: ChainContext) {
        this.ctx = ctx;
        this.gateState = new GateState(ctx.wrappedNativeToken.address.toLowerCase());
        this.configState = new ConfigState();
    }

    public static getInstance(chanIdOrName: CHAIN_ID | string): SynFuturesV3 {
        const chainId = ChainContext.getChainInfo(chanIdOrName).chainId;
        let instance = SynFuturesV3.instances.get(chainId);
        if (!instance) {
            const ctx = ChainContext.getInstance(chainId);
            instance = new SynFuturesV3(ctx);
            instance._init(ConfigManager.getSynfConfig(chainId));
        }
        return instance;
    }

    private _init(config: SynfConfig): void {
        this.config = config;

        const provider = this.ctx.provider;
        if (provider) {
            this._initContracts(provider, config.contractAddress);
        }

        const contractAddress = this.config.contractAddress;
        this.ctx.registerAddress(contractAddress.gate, 'Gate');
        this.ctx.registerAddress(contractAddress.observer, 'Observer');
        this.ctx.registerAddress(contractAddress.config, 'Config');
        this.ctx.registerContractParser(contractAddress.gate, new GateParser(this.ctx));
        this.ctx.registerContractParser(contractAddress.config, new ConfigParser());
        if (contractAddress.guardian) {
            this.ctx.registerAddress(contractAddress.guardian, 'Guardian');
            this.ctx.registerContractParser(contractAddress.guardian, new GuardianParser());
        }

        for (const marketType in contractAddress.market) {
            const marketAddress = contractAddress.market[marketType as MarketType]!;
            this.ctx.registerAddress(marketAddress.market, `${marketType}-Market`);
            this.ctx.registerAddress(marketAddress.beacon, `${marketType}-InstrumentBeacon`);
            if (cexMarket(marketType as MarketType)) {
                this.ctx.registerContractParser(marketAddress.market, new CexMarketParser());
            } else {
                this.ctx.registerContractParser(marketAddress.market, new DexV2MarketParser());
            }
        }
        for (const marketType in contractAddress.feederFactory) {
            const feederFactoryAddress = contractAddress.feederFactory[marketType as MarketType]!;
            if (feederFactoryAddress.factory !== '' && feederFactoryAddress.beacon !== '') {
                this.ctx.registerAddress(feederFactoryAddress.factory, `${marketType}-FeederFactory`);
                this.ctx.registerAddress(feederFactoryAddress.beacon, `${marketType}-FeederBeacon`);
                if (marketType === MarketType.PYTH) {
                    this.ctx.registerContractParser(
                        feederFactoryAddress.factory,
                        new ContractParser(PythFeederFactory__factory.createInterface()),
                    );
                } else if (marketType === MarketType.EMG) {
                    this.ctx.registerContractParser(
                        feederFactoryAddress.factory,
                        new ContractParser(EmergingFeederFactory__factory.createInterface()),
                    );
                }
            }
        }
        if (this.config.tokenInfo) {
            for (const token of this.config.tokenInfo) {
                this.registerQuoteInfo(token);
            }
        }
    }

    private _initContracts(provider: Provider, contractAddress: ContractAddress): void {
        // At present, beacon for chainlink instrument and dexV2 instrument are the same contract (in InstrumentBeacon.sol).
        const marketContracts: { [key in MarketType]?: MarketContracts } = {};
        for (const marketType in contractAddress.market) {
            const mType = marketType as MarketType;
            const marketAddress = contractAddress.market[mType]!;
            marketContracts[mType] = {
                market: cexMarket(mType)
                    ? CexMarket__factory.connect(marketAddress.market, provider)
                    : DexV2Market__factory.connect(marketAddress.market, provider),
                beacon: Beacon__factory.connect(marketAddress.beacon, provider),
            };
        }
        const feederFactoryContracts: { [key in MarketType]?: FeederFactoryContracts } = {};
        for (const marketType in contractAddress.feederFactory) {
            const mType = marketType as MarketType;
            const feederFactoryAddress = contractAddress.feederFactory[mType]!;
            if (feederFactoryAddress.factory !== '' && feederFactoryAddress.beacon !== '') {
                if (mType === MarketType.PYTH) {
                    feederFactoryContracts[mType] = {
                        factory: PythFeederFactory__factory.connect(feederFactoryAddress.factory, provider),
                        beacon: Beacon__factory.connect(feederFactoryAddress.beacon, provider),
                    };
                } else if (mType === MarketType.EMG) {
                    feederFactoryContracts[mType] = {
                        factory: EmergingFeederFactory__factory.connect(feederFactoryAddress.factory, provider),
                        beacon: Beacon__factory.connect(feederFactoryAddress.beacon, provider),
                    };
                } else {
                    throw new Error(`Invalid market type ${mType}`);
                }
            }
        }

        this.contracts = {
            gate: Gate__factory.connect(contractAddress.gate, provider),
            observer: Observer__factory.connect(contractAddress.observer, provider),
            config: Config__factory.connect(contractAddress.config, provider),
            guardian: contractAddress.guardian
                ? Guardian__factory.connect(contractAddress.guardian, provider)
                : undefined,
            marketContracts: marketContracts,
            feederFactoryContracts: feederFactoryContracts,
        };
    }

    public setProvider(provider: Provider, isOpSdkCompatible = false): void {
        if (!isOpSdkCompatible) this.ctx.info.isOpSdkCompatible = false;
        this.ctx.setProvider(provider);
        this._initContracts(provider, this.config.contractAddress);
    }

    public getCachedVaultBalance(quoteAddress: string, userAddress: string): BigNumber {
        const quote = quoteAddress.toLowerCase();
        const user = userAddress.toLowerCase();
        const balanceMap = this.gateState.reserveOf.get(quote.toLowerCase());
        if (balanceMap) {
            const balance = balanceMap.get(user);
            if (balance) {
                return balance;
            } else {
                throw new Error(`Not cached: vault balance for quote ${quote} of user ${user}`);
            }
        } else {
            throw new Error(`Not cached: vault for quote ${quote}`);
        }
    }

    async computeInitData(instrumentIdentifier: InstrumentIdentifier): Promise<string> {
        const { baseTokenInfo, quoteTokenInfo } = await this.getTokenInfo(instrumentIdentifier);

        const quoteAddress = quoteTokenInfo.address;

        let data;
        if (cexMarket(instrumentIdentifier.marketType)) {
            const baseSymbol =
                typeof instrumentIdentifier.baseSymbol === 'string'
                    ? instrumentIdentifier.baseSymbol
                    : instrumentIdentifier.baseSymbol.symbol;

            data = ethers.utils.defaultAbiCoder.encode(['string', 'address'], [baseSymbol, quoteAddress]);
        } else {
            data = ethers.utils.defaultAbiCoder.encode(['address', 'address'], [baseTokenInfo.address, quoteAddress]);
        }
        return data;
    }

    async computeInstrumentAddress(
        mType: string,
        base: string | TokenInfo,
        quote: string | TokenInfo,
    ): Promise<string> {
        const gateAddress = this.config.contractAddress.gate;
        const marketType = mType as MarketType;
        const beaconAddress = this.config.contractAddress.market[marketType]!.beacon;
        const instrumentProxyByteCode = this.config.instrumentProxyByteCode;
        let salt: string;

        const { baseSymbol, quoteSymbol } = this.getTokenSymbol(base, quote);
        let quoteAddress: string;
        try {
            quoteAddress =
                typeof quote !== 'string' ? (quote as TokenInfo).address : await this.ctx.getAddress(quoteSymbol);
        } catch {
            //todo beore fetch from graph
            throw new SdkError('Get quote address failed');
        }
        if (cexMarket(marketType)) {
            salt = ethers.utils.defaultAbiCoder.encode(
                ['string', 'string', 'address'],
                [marketType, baseSymbol, quoteAddress],
            );
        } else {
            //DEXV2
            const baseAddress =
                typeof base !== 'string' ? (base as TokenInfo).address : await this.ctx.getAddress(baseSymbol);
            salt = ethers.utils.defaultAbiCoder.encode(
                ['string', 'address', 'address'],
                [marketType, baseAddress, quoteAddress],
            );
        }

        return ethers.utils.getCreate2Address(
            gateAddress,
            ethers.utils.keccak256(salt),
            ethers.utils.keccak256(
                ethers.utils.solidityPack(
                    ['bytes', 'bytes32'],
                    [instrumentProxyByteCode, ethers.utils.hexZeroPad(beaconAddress, 32)],
                ),
            ),
        );
    }

    async init(): Promise<void> {
        const list = await this.initInstruments();
        await this.initGateState(list);
        await this.updateConfigState();
    }

    async initInstruments(symbolToInfo?: Map<string, TokenInfo>): Promise<InstrumentModel[]> {
        this.quoteSymbolToInfo = symbolToInfo ?? new Map();
        for (const [, info] of this.quoteSymbolToInfo) {
            this.registerQuoteInfo(info);
        }
        const list = await this.getAllInstruments();

        for (const instrument of list) {
            this.instrumentMap.set(instrument.info.addr.toLowerCase(), instrument);
            this.ctx.registerAddress(instrument.info.addr, instrument.info.symbol);
            this.ctx.registerContractParser(instrument.info.addr, new InstrumentParser());
        }
        return list;
    }

    async updateConfigState(): Promise<void> {
        this.configState.openLp = true;
        if (this.ctx.chainId !== CHAIN_ID.BASE) {
            try {
                this.configState.openLp = await this.contracts.config.openLp();
            } catch (e) {
                // ignore error since the contract on some network may not have this function
            }
        }
        this.configState.openLiquidator = await this.contracts.config.openLiquidator();
        for (const [symbol, param] of Object.entries(this.config.quotesParam)) {
            const quoteInfo = await this.ctx.getTokenInfo(symbol);
            this.configState.setQuoteParam(quoteInfo.address, param ?? EMPTY_QUOTE_PARAM);
        }

        for (const type of Object.keys(this.config.marketConfig)) {
            const info = await this.contracts.config.getMarketInfo(type);
            this.configState.marketsInfo.set(type as MarketType, {
                addr: info.market,
                beacon: info.beacon,
                type: type,
            });
        }
    }

    async initGateState(instrumentList: InstrumentModel[]): Promise<void> {
        this.gateState.allInstruments = instrumentList.map((i) => i.info.addr);
        for (const addr of this.gateState.allInstruments) {
            const index = await this.contracts.gate.indexOf(addr);
            this.gateState.indexOf.set(addr.toLowerCase(), index);
        }
    }

    // first try to find in cache, if not found, then fetch from chain
    async getInstrumentInfo(instrumentAddress: string): Promise<InstrumentInfo> {
        if (!this.instrumentMap.has(instrumentAddress.toLowerCase())) {
            await this.initInstruments();
        }
        const instrument = this.instrumentMap.get(instrumentAddress.toLowerCase());
        if (!instrument) {
            throw new Error(`Invalid instrument`);
        }
        return instrument.info;
    }

    async getAllInstruments(batchSize = 10, overrides?: CallOverrides): Promise<InstrumentModel[]> {
        const instrumentLists = await this.contracts.gate.getAllInstruments(overrides ?? {});
        let instrumentModels: InstrumentModel[] = [];
        const totalPage = Math.ceil(instrumentLists.length / batchSize);

        for (let i = 0; i < totalPage; i++) {
            const queryList = instrumentLists.slice(
                i * batchSize,
                (i + 1) * batchSize >= instrumentLists.length ? instrumentLists.length : (i + 1) * batchSize,
            );
            const [rawList, rawBlockInfo] = trimObj(
                await this.contracts.observer.getInstrumentByAddressList(queryList, overrides ?? {}),
            );
            instrumentModels = instrumentModels.concat(await this.parseInstrumentData(rawList, rawBlockInfo));
        }

        return instrumentModels;
    }

    async fetchInstrumentBatch(params: FetchInstrumentParam[], overrides?: CallOverrides): Promise<InstrumentModel[]> {
        const [rawList, rawBlockInfo] = trimObj(
            await this.contracts.observer.getInstrumentBatch(params, overrides ?? {}),
        );
        return this.parseInstrumentData(rawList, rawBlockInfo);
    }

    async parseInstrumentData(rawList: AssembledInstrumentData[], blockInfo: BlockInfo): Promise<InstrumentModel[]> {
        const instrumentModels: InstrumentModel[] = [];
        for (const rawInstrument of rawList) {
            const [baseSymbol, quoteSymbol, marketType] = rawInstrument.symbol.split('-');
            const quoteTokenInfo = await this.getQuoteTokenInfo(quoteSymbol, rawInstrument.instrumentAddr);
            let baseInfo: TokenInfo = { symbol: baseSymbol, address: ethers.constants.AddressZero, decimals: 0 };
            if (!cexMarket(marketType as MarketType)) {
                // fetch base token info from ctx
                const onCtxBaseInfo = await this.ctx.getTokenInfo(baseSymbol);
                if (onCtxBaseInfo) {
                    baseInfo = onCtxBaseInfo;
                }
            }
            const instrumentInfo: InstrumentInfo = {
                addr: rawInstrument.instrumentAddr,
                symbol: rawInstrument.symbol,
                base: baseInfo,
                quote: quoteTokenInfo,
            };
            const marketInfo: MarketInfo = {
                addr: rawInstrument.market,
                type: marketType,
                beacon: this.config.contractAddress.market[marketType as MarketType]!.beacon,
            };
            const marketConfig: MarketConfig = this.config.marketConfig[marketType as MarketType]!;
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

            const instrumentModel = new InstrumentModel(
                instrumentInfo,
                market,
                instrumentState,
                rawInstrument.spotPrice,
            );
            for (let i = 0; i < rawInstrument.amms.length; i++) {
                const rawAmm = rawInstrument.amms[i];
                if (rawAmm.expiry === 0) {
                    continue;
                }
                instrumentModel.updatePair(rawAmm as Amm, rawInstrument.markPrices[i], blockInfo);
            }
            this.ctx.registerAddress(instrumentInfo.addr, instrumentInfo.symbol);
            this.ctx.registerContractParser(instrumentInfo.addr, new InstrumentParser());
            instrumentModels.push(instrumentModel);
        }
        return instrumentModels;
    }

    /// will update all expiries when params.expiry.length is 0
    public async updateInstrument(
        params: FetchInstrumentParam[],
        overrides?: CallOverrides,
    ): Promise<InstrumentModel[]> {
        const instrumentModels = await this.fetchInstrumentBatch(params, overrides);
        this.updateInstrumentCache(instrumentModels);
        return instrumentModels;
    }

    public async syncVaultCacheWithAllQuotes(target: string): Promise<void> {
        const quoteParamConfig = this.config.quotesParam;
        const quoteAddresses: string[] = [];
        for (const symbol in quoteParamConfig) {
            quoteAddresses.push(await this.ctx.getAddress(symbol));
        }
        await this.syncVaultCache(target, quoteAddresses);
    }

    public async syncVaultCache(target: string, quotes: string[]): Promise<void> {
        const resp = await this.contracts.observer.getVaultBalances(target, quotes);
        for (let i = 0; i < quotes.length; ++i) {
            this.gateState.setReserve(quotes[i], target, resp[0][i]);
        }
    }

    // given single trader address, return multiple instrument level account which he/she is involved
    public async getInstrumentLevelAccounts(
        target: string,
        overrides?: CallOverrides,
    ): Promise<InstrumentLevelAccountModel[]> {
        const allInstrumentAddr = [...this.instrumentMap.keys()];
        const quotes = Array.from(
            new Set(
                allInstrumentAddr.map(
                    (instrument) => this.instrumentMap.get(instrument.toLowerCase())!.info.quote.address,
                ),
            ),
        );
        await this.syncVaultCache(target, quotes);

        const observerInterface = this.contracts.observer.interface;
        const calls = [];
        for (const instrument of allInstrumentAddr) {
            calls.push({
                target: this.contracts.observer.address,
                callData: observerInterface.encodeFunctionData('getPortfolios', [target, instrument]),
            });
        }
        const rawRet = (await this.ctx.getMulticall3().callStatic.aggregate(calls, overrides ?? {})).returnData;

        const map = new Map<string, InstrumentLevelAccountModel>(); // instrument address in lowercase => InstrumentLevelAccount
        for (let i = 0; i < rawRet.length; i++) {
            const decoded = observerInterface.decodeFunctionResult('getPortfolios', rawRet[i]);
            const expiries = decoded.expiries;
            const portfolios = decoded.portfolios;
            const blockInfo = trimObj(decoded.blockInfo);

            const instrumentAddr = allInstrumentAddr[i];
            const instrumentModel = this.instrumentMap.get(instrumentAddr);
            if (instrumentModel) {
                for (let j = 0; j < expiries.length; j++) {
                    const portfolio = portfolios[j] as Portfolio;
                    // skip empty portfolio
                    if (synfV3Utils.isEmptyPortfolio(portfolio)) continue;

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

    public async updatePairLevelAccount(
        target: string,
        instrument: string,
        expiry: number,
        overrides?: CallOverrides,
    ): Promise<PairLevelAccountModel> {
        instrument = instrument.toLowerCase();
        target = target.toLowerCase();
        await this.updateInstrument([{ instrument: instrument, expiries: [expiry] }]);
        const resp = await this.contracts.observer.getAcc(instrument, expiry, target, overrides ?? {});
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const pair: PairModel = this.instrumentMap.get(instrument)!.getPairModel(expiry);
        const pairLevelAccountModel = PairLevelAccountModel.fromRawPortfolio(
            pair,
            target,
            resp.portfolio,
            trimObj(resp.blockInfo),
        );
        this.instrumentMap.get(instrument)?.state.setAccountState(target, expiry, pairLevelAccountModel.account);

        // load into cache
        const newTargetInstrumentMap = this.accountCache.get(target) || new Map();
        const newInstrumentExpiryMap = newTargetInstrumentMap.get(instrument) || new Map();
        newInstrumentExpiryMap.set(expiry, pairLevelAccountModel);
        newTargetInstrumentMap.set(instrument, newInstrumentExpiryMap);
        this.accountCache.set(target, newTargetInstrumentMap);
        return pairLevelAccountModel;
    }

    public async getPairLevelAccount(
        target: string,
        instrument: string,
        expiry: number,
        useCache = false,
    ): Promise<PairLevelAccountModel> {
        instrument = instrument.toLowerCase();
        target = target.toLowerCase();
        if (!useCache) {
            return this.updatePairLevelAccount(target, instrument, expiry);
        }
        // check whether cache has the info
        const targetInstrumentMap = this.accountCache.get(target);
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
        const pairLevelAccountModel = await this.updatePairLevelAccount(target, instrument, expiry);
        return pairLevelAccountModel;
    }

    public getLastestFundingIndex(
        amm: Amm,
        markPrice: BigNumber,
        timestamp: number,
    ): { longFundingIndex: BigNumber; shortFundingIndex: BigNumber } {
        return updateFundingIndex(amm, markPrice, timestamp);
    }

    getInstrumentContract(address: string, signerOrProvider?: Signer | Provider): Instrument {
        return Instrument__factory.connect(address, signerOrProvider ?? this.ctx.provider);
    }

    // get instrument's all tick bitmaps
    async getTickBitMaps(instrument: string, expiry: number): Promise<Map<number, BigNumber>> {
        const observer = this.contracts.observer;
        return await getTickBitMaps(observer, instrument, expiry);
    }

    async getNextInitializedTickOutside(
        instrumentAddr: string,
        expiry: number,
        tick: number,
        right: boolean,
    ): Promise<number> {
        const observer = this.contracts.observer;
        return await getNextInitializedTickOutside(observer, instrumentAddr, expiry, tick, right);
    }

    // leverage is wad, margin is wad
    async getOrderMarginByLeverage(
        instrumentAddr: string,
        expiry: number,
        tick: number,
        size: BigNumber,
        leverage: number,
    ): Promise<BigNumber> {
        const limit = TickMath.getWadAtTick(tick);
        const instrument = this.getInstrumentContract(instrumentAddr);
        const swapInfo = await instrument.callStatic.inquire(expiry, 0);
        const mark = swapInfo.mark;
        const anchor = mark.gt(limit) ? mark : limit;
        return anchor.mul(size.abs()).div(ethers.utils.parseEther(leverage.toString())).add(1);
    }

    // trade size needed to move AMM price to target tick
    async getSizeToTargetTick(instrumentAddr: string, expiry: number, targetTick: number): Promise<BigNumber> {
        const observer = this.contracts.observer;
        return await getSizeToTargetTick(observer, instrumentAddr, expiry, targetTick);
    }

    async getTick(instrumentAddr: string, expiry: number): Promise<number> {
        const swapInfo = await this.getInstrumentContract(instrumentAddr).callStatic.inquire(expiry, 0);
        return normalizeTick(swapInfo.tick, PEARL_SPACING);
    }

    async getSqrtFairPX96(instrumentAddr: string, expiry: number): Promise<BigNumber> {
        const swapInfo = await this.getInstrumentContract(instrumentAddr).callStatic.inquire(expiry, 0);
        return swapInfo.sqrtFairPX96;
    }

    async inquire(instrumentAddr: string, expiry: number, size: BigNumber): Promise<Quotation> {
        const instrument = this.getInstrumentContract(instrumentAddr);
        return trimObj(await instrument.callStatic.inquire(expiry, size));
    }

    async openLp(quoteAddr?: string, overrides?: CallOverrides): Promise<boolean> {
        if ((this.ctx.chainId === CHAIN_ID.BASE || this.ctx.chainId === CHAIN_ID.LOCAL) && quoteAddr) {
            try {
                const restricted = await this.contracts.config.restrictLp(quoteAddr, overrides ?? {});
                return !restricted;
            } catch (e) {
                // ignore error since the contract on some network may not have this function
            }
        }
        return this.contracts.config.openLp(overrides ?? {});
    }

    async inWhiteListLps(quoteAddr: string, traders: string[], overrides?: CallOverrides): Promise<boolean[]> {
        let calls = [];
        let results: boolean[] = [];
        let configInterface: ethers.utils.Interface = this.contracts.config.interface;
        if ((this.ctx.chainId === CHAIN_ID.BASE || this.ctx.chainId === CHAIN_ID.LOCAL) && quoteAddr) {
            for (const trader of traders) {
                calls.push({
                    target: this.contracts.config.address,
                    callData: configInterface.encodeFunctionData('lpWhitelist', [quoteAddr, trader]),
                });
            }
            try {
                const rawData = await this.ctx.multicall3.callStatic.aggregate(calls, overrides ?? {});
                for (const data of rawData.returnData) {
                    results.push(configInterface.decodeFunctionResult('lpWhitelist', data)[0]);
                }
                return results;
            } catch (e) {
                // ignore error since the contract on some network may not have this function
            }
        }
        // legacy function for other networks
        calls = [];
        results = [];
        configInterface = new ethers.utils.Interface([
            'function lpWhitelist(address user) external view returns (bool)',
        ]);

        for (const trader of traders) {
            calls.push({
                target: this.contracts.config.address,
                callData: configInterface.encodeFunctionData('lpWhitelist', [trader]),
            });
        }
        const rawData = await this.ctx.multicall3.callStatic.aggregate(calls, overrides ?? {});
        for (const data of rawData.returnData) {
            results.push(configInterface.decodeFunctionResult('lpWhitelist', data)[0]);
        }
        return results;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////
    // interaction with contracts
    ////////////////////////////////////////////////////////////////////////////////////////////
    async deposit(
        signer: Signer,
        quoteAddr: string,
        amount: BigNumber,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const unsignedTx = await this.contracts.gate.populateTransaction.deposit(
            encodeDepositParam(quoteAddr, amount),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async withdraw(
        signer: Signer,
        quoteAddr: string,
        amount: BigNumber,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const unsignedTx = await this.contracts.gate.populateTransaction.withdraw(
            encodeWithdrawParam(quoteAddr, amount),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async adjust(
        signer: Signer,
        instrumentAddr: string,
        param: AdjustParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.trade(
            encodeAdjustWithReferralParam(param.expiry, param.net, param.deadline, referralCode),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async add(
        signer: Signer,
        instrumentAddr: string,
        param: AddParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.add(
            encodeAddWithReferralParam(param, referralCode),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async remove(
        signer: Signer,
        instrumentAddr: string,
        param: RemoveParam,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.remove(encodeRemoveParam(param), overrides ?? {});
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async trade(
        signer: Signer,
        instrumentAddr: string,
        param: TradeParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.trade(
            encodeTradeWithReferralParam(
                param.expiry,
                param.size,
                param.amount,
                param.limitTick,
                param.deadline,
                referralCode,
            ),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    // WARNING: this function is not recommended to use, because it may cause penalty fee during trade
    async tradeWithRisk(
        signer: Signer,
        instrumentAddr: string,
        param: TradeParam,
        limitStabilityFeeRatio: number,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.trade(
            encodeTradeWithRiskParam(
                param.expiry,
                param.size,
                param.amount,
                param.limitTick,
                param.deadline,
                limitStabilityFeeRatio,
                referralCode,
            ),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async place(
        signer: Signer,
        instrumentAddr: string,
        param: PlaceParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.place(
            encodePlaceWithReferralParam(
                param.expiry,
                param.size,
                param.amount,
                param.tick,
                param.deadline,
                referralCode,
            ),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async batchPlace(
        signer: Signer,
        instrumentAddr: string,
        params: BatchPlaceParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.batchPlace(
            encodeBatchPlaceWithReferralParam(
                params.expiry,
                params.size,
                params.leverage,
                params.ticks,
                params.ratios,
                params.deadline,
                referralCode,
            ),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async fill(
        signer: Signer,
        instrumentAddr: string,
        param: FillParam,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.fill(
            encodeFillParam(param.expiry, param.target, param.tick, param.nonce),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async cancel(
        signer: Signer,
        instrumentAddr: string,
        param: CancelParam,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.cancel(
            encodeCancelParam(param.expiry, [param.tick], param.deadline),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async sweep(
        signer: Signer,
        instrumentAddr: string,
        param: SweepParam,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.sweep(
            param.expiry,
            param.target,
            param.size,
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async liquidate(
        signer: Signer,
        instrumentAddr: string,
        param: LiquidateParam,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.liquidate(
            param.expiry,
            param.target,
            param.size,
            param.amount,
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async update(
        signer: Signer,
        instrumentAddr: string,
        expiry: number,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.update(expiry, overrides ?? {});
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async settle(
        signer: Signer,
        instrumentAddr: string,
        expiry: number,
        target: string,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.settle(expiry, target, overrides ?? {});
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async donateInsuranceFund(
        signer: Signer,
        instrumentAddr: string,
        expiry: number,
        amount: BigNumber,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.donateInsuranceFund(expiry, amount, overrides ?? {});
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async claimProtocolFee(
        signer: Signer,
        instrumentAddr: string,
        expiry: number,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.claimProtocolFee(expiry, overrides ?? {});
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async release(
        signer: Signer,
        quote: string,
        trader: string,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const unsignedTx = await this.contracts.gate.populateTransaction.release(quote, trader, overrides ?? {});
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async getPendingParams(
        quotes: string[],
        overrides?: CallOverrides,
    ): Promise<{ pendingDuration: BigNumber; thresholds: BigNumber[] }> {
        const gateInterface = this.contracts.gate.interface;
        const calls = quotes.map((quote) => {
            return {
                target: this.contracts.gate.address,
                callData: gateInterface.encodeFunctionData('thresholdOf', [quote]),
            };
        });
        calls.push({
            target: this.contracts.gate.address,
            callData: gateInterface.encodeFunctionData('pendingDuration'),
        });
        const rawRet = (await this.ctx.getMulticall3().callStatic.aggregate(calls, overrides ?? {})).returnData;
        const thresholds = rawRet
            .slice(0, quotes.length)
            .map((ret) => gateInterface.decodeFunctionResult('thresholdOf', ret)[0] as BigNumber);
        const pendingDuration = gateInterface.decodeFunctionResult(
            'pendingDuration',
            rawRet[quotes.length],
        )[0] as BigNumber;
        return { pendingDuration, thresholds };
    }

    async getFundFlows(
        quoteAddrs: string[],
        trader: string,
        overrides?: CallOverrides,
    ): Promise<{ fundFlows: FundFlow[]; blockInfo: BlockInfo }> {
        const gateInterface = this.contracts.gate.interface;
        const observerInterface = this.contracts.observer.interface;

        const calls: { target: string; callData: string }[] = [];

        calls.push(
            ...quoteAddrs.map((quote) => {
                return {
                    target: this.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('fundFlowOf', [quote, trader]),
                };
            }),
        );
        // just to get the block info
        calls.push({
            target: this.contracts.observer.address,
            callData: observerInterface.encodeFunctionData('getVaultBalances', [trader, quoteAddrs]),
        });
        const rawRet = (await this.ctx.getMulticall3().callStatic.aggregate(calls, overrides ?? {})).returnData;
        const fundFlows = rawRet.slice(0, quoteAddrs.length).map((ret) => {
            return trimObj(gateInterface.decodeFunctionResult('fundFlowOf', ret)[0]) as FundFlow;
        });
        const blockInfo = trimObj(
            observerInterface.decodeFunctionResult('getVaultBalances', rawRet[quoteAddrs.length])[1],
        );
        return { fundFlows, blockInfo: blockInfo as BlockInfo };
    }

    async getUserPendings(
        quotes: string[],
        trader: string,
        overrides?: CallOverrides,
    ): Promise<{ pendings: { maxWithdrawable: BigNumber; pending: Pending }[]; blockInfo: BlockInfo }> {
        const gateInterface = this.contracts.gate.interface;
        const observerInterface = this.contracts.observer.interface;
        const calls: { target: string; callData: string }[] = [];
        calls.push(
            ...quotes.map((quote) => {
                return {
                    target: this.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('fundFlowOf', [quote, trader]),
                };
            }),
        );
        calls.push(
            ...quotes.map((quote) => {
                return {
                    target: this.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('thresholdOf', [quote]),
                };
            }),
        );
        calls.push(
            ...quotes.map((quote) => {
                return {
                    target: this.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('reserveOf', [quote, trader]),
                };
            }),
        );
        calls.push({
            target: this.contracts.observer.address,
            callData: observerInterface.encodeFunctionData('getPendings', [quotes, trader]),
        });
        const rawRet = (await this.ctx.getMulticall3().callStatic.aggregate(calls, overrides ?? {})).returnData;
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
                    maxWithdrawable: this.calcMaxWithdrawable(
                        thresholds[index],
                        pending,
                        fundFlows[index],
                        reserves[index],
                    ),
                    pending,
                };
            }),
            blockInfo,
        };
    }

    calcMaxWithdrawable(threshold: BigNumber, pending: Pending, fundFlow: FundFlow, reserve: BigNumber): BigNumber {
        // exceed threshold condition
        // totalOut - totalIn + amount + quantity > threshold + exemption
        // quantity = threshold + exemption - totalOut + totalIn - amount
        const maxWithdrawable = threshold
            .add(pending.exemption)
            .sub(fundFlow.totalOut)
            .add(fundFlow.totalIn)
            .sub(pending.amount);
        // should be capped by 0 and reserve
        if (maxWithdrawable.lte(0)) return ZERO;
        if (maxWithdrawable.gt(reserve)) return reserve;
        return maxWithdrawable;
    }

    //////////////////////////////////////////////////////////
    // Frontend API
    //////////////////////////////////////////////////////////

    //////////////////////////////////////////////////////////
    // Utils
    //////////////////////////////////////////////////////////
    public alignPriceWadToTick(priceWad: BigNumber): { tick: number; priceWad: BigNumber } {
        let tick = wadToTick(priceWad);
        tick = Math.round(tick / PEARL_SPACING) * PEARL_SPACING;

        const alignedPriceWad = TickMath.getWadAtTick(tick);
        return { tick: tick, priceWad: alignedPriceWad };
    }
    //////////////////////////////////////////////////////////
    // Trade inquire
    //////////////////////////////////////////////////////////
    public async inquireByBase(
        pair: PairModel,
        side: Side,
        baseAmount: BigNumber,
        overrides?: CallOverrides,
    ): Promise<{ quoteAmount: BigNumber; quotation: Quotation }> {
        const instrument = this.getInstrumentContract(pair.rootInstrument.info.addr, this.ctx.provider);
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

    public async inquireByQuote(
        pair: PairModel,
        side: Side,
        quoteAmount: BigNumber,
        overrides?: CallOverrides,
    ): Promise<{ baseAmount: BigNumber; quotation: Quotation }> {
        const expiry = pair.amm.expiry;
        const long = side === Side.LONG;
        const { size, quotation } = await this.contracts.observer.inquireByNotional(
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

    // @param transferAmount: decimal 18 units, always positive
    // @param transferIn: true if in, false if out
    // @return leverageWad: decimal 18 units
    public inquireLeverageFromTransferAmount(
        position: PositionModel,
        transferIn: boolean,
        transferAmount: BigNumber,
    ): BigNumber {
        const sign: number = transferIn ? 1 : -1;
        const value = wmul(position.rootPair.markPrice, position.size.abs());
        const oldEquity = position.getEquity();
        const Amount = transferAmount.mul(sign);
        const newEquity = oldEquity.add(Amount);
        // leverage is 18 decimal
        return wdiv(value, newEquity);
    }

    // @param targetLeverage: decimal 18 units
    // @return transferAmount: decimal 18 units, positive means transferIn, negative means transferOut
    public inquireTransferAmountFromTargetLeverage(position: PositionModel, targetLeverage: BigNumber): BigNumber {
        const value = wmul(position.rootPair.markPrice, position.size.abs());
        const targetEquity = wdiv(value, targetLeverage);
        const currentEquity = position.getEquity();
        const transferAmount = targetEquity.sub(currentEquity);
        return transferAmount;
    }

    //////////////////////////////////////////////////////////
    // Frontend Simulation API
    //////////////////////////////////////////////////////////

    async simulateCrossMarketOrder(
        pairAccountModel: PairLevelAccountModel,
        targetTick: number,
        side: Side,
        baseSize: BigNumber,
        leverageWad: BigNumber,
        slippage: number,
    ): Promise<{
        canPlaceOrder: boolean;
        tradeQuotation: Quotation;
        tradeSize: BigNumber;
        orderSize: BigNumber;
        tradeSimulation: SimulateTradeResult;
        orderSimulation: SimulateOrderResult;
    }> {
        const sign = signOfSide(side);
        const pair = pairAccountModel.rootPair;
        const long = sign > 0;
        const currentTick = pair.amm.tick;
        if ((long && targetTick <= currentTick) || (!long && targetTick >= currentTick))
            throw Error('please place normal order');
        let swapToTick = long ? targetTick + 1 : targetTick - 1;
        let { size: swapSize, quotation: quotation } = await this.contracts.observer.inquireByTick(
            pair.rootInstrument.info.addr,
            pair.amm.expiry,
            swapToTick,
        );
        if ((long && quotation.postTick <= targetTick) || (!long && quotation.postTick >= targetTick)) {
            swapToTick = long ? swapToTick + 1 : swapToTick - 1;
            const retry = await this.contracts.observer.inquireByTick(
                pair.rootInstrument.info.addr,
                pair.amm.expiry,
                swapToTick,
            );
            swapSize = retry.size;
            quotation = retry.quotation;
        }
        if ((long && swapSize.lt(0)) || (!long && swapSize.gt(0))) throw Error('Wrong Side');
        const tradeSimulate = this.simulateTrade(
            pairAccountModel,
            quotation,
            side,
            swapSize.abs(),
            undefined,
            leverageWad,
            slippage,
        );
        if (pairAccountModel.getMainPosition().size.isZero() && quotation.entryNotional.lt(tradeSimulate.minTradeValue))
            throw Error('size to tick is trivial');
        const minOrderValue = pair.rootInstrument.minOrderValue;
        const targetTickPrice = TickMath.getWadAtTick(targetTick);
        const minOrderSize = wdivUp(minOrderValue, targetTickPrice);
        const quoteInfo = pair.rootInstrument.info.quote;
        const balanceInVaultWad = NumericConverter.scaleQuoteAmount(
            this.getCachedVaultBalance(quoteInfo.address, pairAccountModel.traderAddr),
            quoteInfo.decimals,
        );
        function getBalanceInVaultWadOverride(
            balanceInVaultWad: BigNumber,
            depositWad: BigNumber,
            consumedWad: BigNumber,
        ): BigNumber {
            const balance = balanceInVaultWad.add(depositWad).sub(consumedWad);
            return balance.lt(0) ? ZERO : balance;
        }
        if (swapSize.abs().add(minOrderSize).gt(baseSize.abs())) {
            // in this case we can't place order since size is too small
            return {
                canPlaceOrder: false,
                tradeSize: swapSize.abs(),
                tradeQuotation: quotation,
                tradeSimulation: tradeSimulate,
                orderSize: minOrderSize,
                orderSimulation: this._simulateOrder(
                    pairAccountModel,
                    targetTick,
                    minOrderSize,
                    leverageWad,
                    getBalanceInVaultWadOverride(
                        balanceInVaultWad,
                        tradeSimulate.marginToDepositWad,
                        tradeSimulate.margin,
                    ),
                ),
            };
        } else {
            return {
                canPlaceOrder: true,
                tradeSize: swapSize.abs(),
                tradeQuotation: quotation,
                tradeSimulation: tradeSimulate,
                orderSize: baseSize.abs().sub(swapSize.abs()),
                orderSimulation: this._simulateOrder(
                    pairAccountModel,
                    targetTick,
                    baseSize.abs().sub(swapSize.abs()),
                    leverageWad,
                    getBalanceInVaultWadOverride(
                        balanceInVaultWad,
                        tradeSimulate.marginToDepositWad,
                        tradeSimulate.margin,
                    ),
                ),
            };
        }
    }

    async placeCrossMarketOrder(
        signer: Signer,
        pair: PairModel,
        side: Side,

        swapSize: BigNumber,
        swapMargin: BigNumber,
        swapTradePrice: BigNumber,

        orderTickNumber: number,
        orderBaseWad: BigNumber,
        orderMargin: BigNumber,

        slippage: number,
        deadline: number,
        referralCode = DEFAULT_REFERRAL_CODE,
        overrides?: PayableOverrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const sign = signOfSide(side);
        const instrument = this.getInstrumentContract(pair.rootInstrument.info.addr);
        const swapLimitTick = this.getLimitTick(swapTradePrice, slippage, side);

        const callData = [];
        callData.push(
            instrument.interface.encodeFunctionData('trade', [
                encodeTradeWithReferralParam(
                    pair.amm.expiry,
                    swapSize.mul(sign),
                    swapMargin,
                    swapLimitTick,
                    deadline,
                    referralCode,
                ),
            ]),
        );

        callData.push(
            instrument.interface.encodeFunctionData('place', [
                encodePlaceWithReferralParam(
                    pair.amm.expiry,
                    orderBaseWad.mul(sign),
                    orderMargin,
                    orderTickNumber,
                    deadline,
                    referralCode,
                ),
            ]),
        );
        // const results = await instrument.callStatic.multicall(
        //     callData,
        //     overrides ?? { from: '' },
        // );
        // const decode0 = instrument.interface.decodeFunctionResult('trade', results[0]);
        // const decode1 = instrument.interface.decodeFunctionResult('place', results[1]);
        // console.log('trade', decode0);
        // console.log('place', decode1);

        // signer;
        // return undefined as any;
        const tx = await instrument.populateTransaction.multicall(callData, overrides ?? {});
        return await this.ctx.sendTx(signer, tx);
    }

    // @param quotation: can be accessed through inquireByBase/inquireByQuote
    // four scenarios here: see examples in testMocks.ts
    public simulateTrade(
        pairAccountModel: PairLevelAccountModel,
        quotation: Quotation,
        side: Side,
        baseSize: BigNumber,
        margin: BigNumber | undefined,
        leverageWad: BigNumber | undefined,
        slippage: number,
    ): SimulateTradeResult {
        const sign = signOfSide(side);
        const tradePrice = wdiv(quotation.entryNotional, baseSize.abs());
        const limitTick = this.getLimitTick(tradePrice, slippage, side);
        const markPrice = pairAccountModel.rootPair.markPrice;
        const amm = pairAccountModel.rootPair.amm;
        // update funding index if expiry is perp
        if (amm.expiry === PERP_EXPIRY) {
            const { longFundingIndex, shortFundingIndex } = updateFundingIndex(
                amm,
                pairAccountModel.rootPair.markPrice,
                pairAccountModel.rootPair.rootInstrument.state.blockInfo!.timestamp,
            );
            amm.longFundingIndex = longFundingIndex;
            amm.shortFundingIndex = shortFundingIndex;
        }

        let exceedMaxLeverage = false;
        if (baseSize.lte(0)) throw new Error('Invalid trade size');

        // calculate tradeLoss by limitPrice
        const limitPrice = TickMath.getWadAtTick(limitTick);
        const worstNotional = wmul(limitPrice, baseSize);
        const tradeLoss =
            sign > 0 ? worstNotional.sub(wmul(markPrice, baseSize)) : wmul(markPrice, baseSize).sub(worstNotional);

        let minTradeValue = ZERO;
        const position = pairAccountModel.getMainPosition();
        if (position.size.isZero()) minTradeValue = pairAccountModel.rootPair.rootInstrument.minTradeValue;
        const oldEquity = position.getEquity();
        const rawSize = baseSize.mul(sign);
        if (!margin && leverageWad) {
            // calc margin required by fixed leverage
            // newEquity = oldEquity + margin - tradeLoss - fee
            // margin = newEquity - oldEquity + tradeLoss + fee
            const newEquity = wdiv(wmul(markPrice, baseSize.mul(sign).add(position.size)).abs(), leverageWad);
            margin = newEquity.sub(oldEquity).add(tradeLoss).add(quotation.fee);
        } else if (margin && !leverageWad) {
            const newEquity = oldEquity.add(margin).sub(tradeLoss).sub(quotation.fee);
            leverageWad = wdiv(wmul(markPrice, baseSize.mul(sign).add(position.size)).abs(), newEquity);
        } else {
            margin = ZERO;
            const newEquity = oldEquity.add(ZERO).sub(tradeLoss).sub(quotation.fee);
            leverageWad = wdiv(wmul(markPrice, baseSize.mul(sign).add(position.size)).abs(), newEquity);
        }
        const positionSwapped = {
            balance: margin.lt(0) ? quotation.fee.mul(-1) : margin.sub(quotation.fee),
            size: rawSize,
            entryNotional: quotation.entryNotional,
            entrySocialLossIndex: sign > 0 ? amm.longSocialLossIndex : amm.shortSocialLossIndex,
            entryFundingIndex: sign > 0 ? amm.longFundingIndex : amm.shortFundingIndex,
        };
        const { position: rawPosition, realized: realized } = combine(amm, position, positionSwapped);
        const simulationMainPosition = PositionModel.fromRawPosition(pairAccountModel.rootPair, rawPosition);
        if (margin.lt(ZERO)) {
            const maxWithdrawableMargin = simulationMainPosition.size.eq(ZERO)
                ? ZERO
                : simulationMainPosition.getMaxWithdrawableMargin();
            if (margin.abs().gt(maxWithdrawableMargin)) {
                margin = maxWithdrawableMargin.mul(-1);
                exceedMaxLeverage = true;
            }
            // to avoid the case that the margin cant meet the imr requirement
            margin = margin.mul(999).div(1000);
            simulationMainPosition.balance = simulationMainPosition.balance.add(margin);
        }
        //
        // as for creating new position or increasing a position: if leverage < 0 or leverage > 10, the position is not IMR safe
        // as for closing or decreasing a position: if leverage < 0 or leverage > 20, the position is not MMR safe
        if (
            simulationMainPosition.size.eq(ZERO) ||
            (position.size.mul(sign).lt(ZERO) && baseSize.abs().lt(position.size.abs()))
        ) {
            if (!simulationMainPosition.isPositionMMSafe()) throw new Error('Insufficient margin to open position');
        } else {
            if (!simulationMainPosition.isPositionIMSafe(true)) {
                // throw new Error('Insufficient margin to open position');
                console.log('exceed max leverage, sdk will use max leverage to simulate trade');
                exceedMaxLeverage = true;

                const additionalMargin = simulationMainPosition.getAdditionMarginToIMRSafe(true, slippage);
                simulationMainPosition.balance = simulationMainPosition.balance.add(additionalMargin);
                margin = margin.add(additionalMargin);
                leverageWad = simulationMainPosition.leverageWad;
            }
        }
        // price impact = (postFair - preFair) / preFair
        const priceImpactWad = wdiv(
            sqrtX96ToWad(quotation.sqrtPostFairPX96).sub(sqrtX96ToWad(quotation.sqrtFairPX96)),
            sqrtX96ToWad(quotation.sqrtFairPX96),
        );

        const stabilityFee = this.getStabilityFee(
            quotation,
            pairAccountModel.rootPair.rootInstrument.setting.quoteParam,
        );
        return {
            tradePrice: tradePrice,
            estimatedTradeValue: quotation.entryNotional,
            minTradeValue: minTradeValue,
            tradingFee: quotation.fee.sub(stabilityFee),
            stabilityFee: stabilityFee,
            margin:
                simulationMainPosition.size.eq(ZERO) && simulationMainPosition.balance.gt(ZERO)
                    ? simulationMainPosition.balance.mul(-1)
                    : margin,
            leverageWad: simulationMainPosition.size.eq(ZERO) ? ZERO : leverageWad,
            priceImpactWad: priceImpactWad,
            simulationMainPosition: simulationMainPosition,
            realized: realized,
            marginToDepositWad: this.marginToDepositWad(
                pairAccountModel.traderAddr,
                pairAccountModel.rootPair.rootInstrument.info.quote,
                margin,
            ),
            limitTick: limitTick,
            exceedMaxLeverage: exceedMaxLeverage,
        };
    }

    getOrderLeverageByMargin(targetTick: number, baseSize: BigNumber, margin: BigNumber): BigNumber {
        return wdiv(wmul(TickMath.getWadAtTick(targetTick), baseSize.abs()), margin);
    }

    simulateOrder(
        pairAccountModel: PairLevelAccountModel,
        targetTick: number,
        baseSize: BigNumber,
        side: Side,
        leverageWad: BigNumber,
    ): SimulateOrderResult {
        const pairModel = pairAccountModel.rootPair;
        const currentTick = pairModel.amm.tick;
        if (currentTick === targetTick) throw new Error('Invalid price');
        const isLong = targetTick < currentTick;
        const targetPrice = TickMath.getWadAtTick(targetTick);

        if ((side === Side.LONG && !isLong) || (side === Side.SHORT && isLong)) throw new Error('Invalid price');

        const maxLeverage = this.getMaxLeverage(pairModel.rootInstrument.setting.initialMarginRatio);
        if (leverageWad.gt(ethers.utils.parseEther(maxLeverage + ''))) {
            throw new Error('Insufficient margin to open position');
        }

        if (!withinOrderLimit(targetPrice, pairModel.markPrice, pairModel.rootInstrument.setting.initialMarginRatio)) {
            throw new Error('Limit order price is too far away from mark price');
        }

        return this._simulateOrder(pairAccountModel, targetTick, baseSize, leverageWad);
    }

    private _simulateOrder(
        pairAccountModel: PairLevelAccountModel,
        targetTick: number,
        baseSize: BigNumber,
        leverageWad: BigNumber,
        balanceInVaultWadOverride?: BigNumber,
    ): SimulateOrderResult {
        baseSize = baseSize.abs();
        const pairModel = pairAccountModel.rootPair;
        const targetPrice = TickMath.getWadAtTick(targetTick);
        const markPrice = pairModel.markPrice;
        let margin = wdivUp(wmulUp(targetPrice, baseSize), leverageWad);
        const minMargin = wmulUp(
            r2w(pairModel.rootInstrument.setting.initialMarginRatio),
            wmulUp(
                max(
                    markPrice
                        .mul(ONE_RATIO + 50) // add 0.5% slippage
                        .div(ONE_RATIO),
                    targetPrice,
                ),
                baseSize,
            ),
        );
        if (margin.lt(minMargin)) margin = minMargin;
        return {
            baseSize: baseSize,
            balance: margin,
            leverageWad: leverageWad,
            marginToDepositWad: this.marginToDepositWad(
                pairAccountModel.traderAddr,
                pairModel.rootInstrument.info.quote,
                margin,
                balanceInVaultWadOverride,
            ),
            minOrderValue: pairModel.rootInstrument.minOrderValue,
            minFeeRebate: wmul(
                wmul(targetPrice, baseSize),
                r2w(pairModel.rootInstrument.setting.quoteParam.tradingFeeRatio),
            ),
        };
    }

    simulateBatchPlace(
        pairAccountModel: PairLevelAccountModel,
        targetTicks: number[],
        ratios: number[],
        baseSize: BigNumber,
        side: Side,
        leverageWad: BigNumber,
    ): {
        orders: {
            baseSize: BigNumber;
            balance: BigNumber;
            leverageWad: BigNumber;
            minFeeRebate: BigNumber;
        }[];
        marginToDepositWad: BigNumber;
        minOrderValue: BigNumber;
    } {
        if (targetTicks.length < MIN_BATCH_ORDER_COUNT || targetTicks.length > MAX_BATCH_ORDER_COUNT)
            throw new Error(`order count should be between ${MIN_BATCH_ORDER_COUNT} and ${MAX_BATCH_ORDER_COUNT}`);
        if (targetTicks.length !== ratios.length) throw new Error('ticks and ratios length not equal');
        if (ratios.reduce((acc, ratio) => acc + ratio, 0) !== RATIO_BASE)
            throw new Error('ratios sum not equal to RATIO_BASE: 10000');
        // check for same tick and unaligned ticks
        if (new Set(targetTicks).size !== targetTicks.length) throw new Error('duplicated ticks');
        if (targetTicks.find((tick) => tick % PEARL_SPACING !== 0)) throw new Error('unaligned ticks');

        const orders: {
            baseSize: BigNumber;
            balance: BigNumber;
            leverageWad: BigNumber;
            minFeeRebate: BigNumber;
        }[] = targetTicks.map((targetTick, index) => {
            try {
                const res = this.simulateOrder(
                    pairAccountModel,
                    targetTick,
                    baseSize.mul(ratios[index]).div(RATIO_BASE),
                    side,
                    leverageWad,
                );
                return {
                    baseSize: res.baseSize,
                    balance: res.balance,
                    leverageWad: res.leverageWad,
                    minFeeRebate: res.minFeeRebate,
                };
            } catch (error) {
                console.log('error', error);
                return {
                    baseSize: ZERO,
                    balance: ZERO,
                    leverageWad: ZERO,
                    minFeeRebate: ZERO,
                };
            }
        });
        const pairModel = pairAccountModel.rootPair;
        return {
            orders,
            marginToDepositWad: this.marginToDepositWad(
                pairAccountModel.traderAddr,
                pairModel.rootInstrument.info.quote,
                orders.reduce((acc, order) => acc.add(order.balance), ZERO),
            ),
            minOrderValue: pairModel.rootInstrument.minOrderValue,
        };
    }

    simulateBatchOrder(
        pairAccountModel: PairLevelAccountModel,
        lowerTick: number,
        upperTick: number,
        orderCount: number,
        sizeDistribution: BatchOrderSizeDistribution,
        baseSize: BigNumber,
        side: Side,
        leverageWad: BigNumber,
    ): {
        orders: {
            tick: number;
            baseSize: BigNumber;
            ratio: number;
            balance: BigNumber;
            leverageWad: BigNumber;
            minFeeRebate: BigNumber;
            minOrderSize: BigNumber;
        }[];
        marginToDepositWad: BigNumber;
        minOrderValue: BigNumber;
        totalMinSize: BigNumber;
    } {
        if (orderCount < MIN_BATCH_ORDER_COUNT || orderCount > MAX_BATCH_ORDER_COUNT)
            throw new Error(`order count should be between ${MIN_BATCH_ORDER_COUNT} and ${MAX_BATCH_ORDER_COUNT}`);
        const targetTicks = this.getBatchOrderTicks(lowerTick, upperTick, orderCount);
        let ratios = this.getBatchOrderRatios(sizeDistribution, orderCount);
        // if sizeDistribution is random, we need to adjust the ratios to make sure orderValue meet minOrderValue with best effort
        const minOrderValue = pairAccountModel.rootPair.rootInstrument.minOrderValue;
        const minSizes = targetTicks.map((tick) => wdivUp(minOrderValue, TickMath.getWadAtTick(tick)));
        if (sizeDistribution === BatchOrderSizeDistribution.RANDOM) {
            // check if any baseSize * ratio is less than minSize
            let needNewRatios = false;
            for (let i = 0; i < minSizes.length; i++) {
                if (baseSize.mul(ratios[i]).div(RATIO_BASE).lt(minSizes[i])) {
                    needNewRatios = true;
                    break;
                }
            }
            // only adjust sizes if possible
            if (needNewRatios && minSizes.reduce((acc, minSize) => acc.add(minSize), ZERO).lt(baseSize)) {
                ratios = this.getBatchOrderRatios(BatchOrderSizeDistribution.FLAT, orderCount);
            }
        }

        // calculate totalMinSize
        const sizes = ratios.map((ratio) => baseSize.mul(ratio).div(RATIO_BASE));
        const bnMax = (a: BigNumber, b: BigNumber): BigNumber => (a.gt(b) ? a : b);
        // pick the max minSize/size ratio
        const minSizeToSizeRatio = minSizes
            .map((minSize, i) => bnMax(wdivUp(minSize, sizes[i]), ZERO))
            .reduce((acc, ratio) => bnMax(acc, ratio), ZERO);
        const totalMinSize = wmulUp(baseSize, minSizeToSizeRatio);

        const res = this.simulateBatchPlace(pairAccountModel, targetTicks, ratios, baseSize, side, leverageWad);
        return {
            ...res,
            orders: targetTicks.map((tick: number, index: number) => {
                return {
                    tick: tick,
                    baseSize: res.orders[index].baseSize,
                    ratio: ratios[index],
                    balance: res.orders[index].balance,
                    leverageWad: res.orders[index].leverageWad,
                    minFeeRebate: res.orders[index].minFeeRebate,
                    minOrderSize: minSizes[index],
                };
            }),
            totalMinSize,
        };
    }

    // given lower price and upper price, return the ticks for batch orders
    // last tick should be upper tick
    getBatchOrderTicks(lowerTick: number, upperTick: number, orderCount: number): number[] {
        // adapt reserve price pair
        [lowerTick, upperTick] = [lowerTick, upperTick].sort((a, b) => a - b);
        lowerTick = alignTick(lowerTick, ORDER_SPACING);
        upperTick = alignTick(upperTick, ORDER_SPACING);
        const tickDiff = upperTick - lowerTick;
        const step = Math.floor(tickDiff / (orderCount - 1) / ORDER_SPACING);
        const ticks = [];
        for (let i = 0; i < orderCount; i++) {
            ticks.push(lowerTick + step * i * ORDER_SPACING);
        }
        ticks[ticks.length - 1] = upperTick;
        return ticks;
    }

    // given size distribution, return the ratios for batch orders
    getBatchOrderRatios(sizeDistribution: BatchOrderSizeDistribution, orderCount: number): number[] {
        let ratios: number[] = [];
        switch (sizeDistribution) {
            case BatchOrderSizeDistribution.FLAT: {
                ratios = Array(orderCount).fill(Math.floor(RATIO_BASE / orderCount));
                break;
            }
            case BatchOrderSizeDistribution.UPPER: {
                // first order is 1, second order is 2, ..., last order is orderCount pieces
                const sum = Array.from({ length: orderCount }, (_, i) => i + 1).reduce((acc, i) => acc + i, 0);
                ratios = Array.from({ length: orderCount }, (_, i) => Math.floor((i + 1) * (RATIO_BASE / sum)));
                break;
            }
            case BatchOrderSizeDistribution.LOWER: {
                // first order is orderCount, second order is orderCount - 1, ..., last order is 1 piece
                const sum = Array.from({ length: orderCount }, (_, i) => orderCount - i).reduce((acc, i) => acc + i, 0);
                ratios = Array.from({ length: orderCount }, (_, i) =>
                    Math.floor((orderCount - i) * (RATIO_BASE / sum)),
                );
                break;
            }
            case BatchOrderSizeDistribution.RANDOM: {
                // Generate initial ratios within a target range
                let totalRatio = 0;
                const averageRatio = RATIO_BASE / orderCount;
                const minRatio = Math.ceil(averageRatio * 0.95);
                const maxRatio = Math.floor(averageRatio * 1.05);

                // Generate initial ratios
                for (let i = 0; i < orderCount; i++) {
                    let ratio = Math.floor(averageRatio * (1 - 0.05 + Math.random() * 0.1));
                    ratio = Math.max(minRatio, Math.min(maxRatio, ratio));
                    ratios.push(ratio);
                    totalRatio += ratio;
                }

                // Adjust the ratios to ensure the sum is RATIO_BASE
                let adjustment = RATIO_BASE - totalRatio;
                const increment = adjustment > 0 ? 1 : -1;

                // Randomly adjust each ratio slightly to balance to RATIO_BASE
                while (adjustment !== 0) {
                    for (let i = 0; i < orderCount && adjustment !== 0; i++) {
                        const newRatio = ratios[i] + increment;
                        if (newRatio >= minRatio && newRatio <= maxRatio) {
                            ratios[i] = newRatio;
                            adjustment -= increment;
                        }
                    }
                }
                break;
            }
            default:
                throw new Error('Invalid size distribution');
        }
        // make sure the sum of ratios is 10000
        ratios[ratios.length - 1] =
            RATIO_BASE - ratios.slice(0, ratios.length - 1).reduce((acc, ratio) => acc + ratio, 0);
        return ratios;
    }

    // @param transferAmount: decimal in 18 units; positive if transferIn, negative if transferOut
    // @param leverageWad: decimal in 18 units
    // @param vaultBalanceWad: decimal in 18 units
    public simulateAdjustMargin(
        pairAccountModel: PairLevelAccountModel,
        transferAmount: BigNumber | undefined,
        leverageWad: BigNumber | undefined,
    ): {
        transferAmount: BigNumber;
        simulationMainPosition: PositionModel;
        marginToDepositWad: BigNumber;
        leverageWad: BigNumber;
    } {
        const position = PositionModel.fromRawPosition(pairAccountModel.rootPair, pairAccountModel.getMainPosition());
        const vaultBalance = this.getCachedVaultBalance(
            pairAccountModel.rootPair.rootInstrument.info.quote.address,
            pairAccountModel.traderAddr,
        );
        const quoteDecimals = position.rootPair.rootInstrument.info.quote.decimals;
        const vaultBalanceWad = NumericConverter.scaleQuoteAmount(vaultBalance, quoteDecimals);
        const maxWithdrawableMargin = position.getMaxWithdrawableMargin();
        let marginToDepositWad: BigNumber = ZERO;

        if (!transferAmount && leverageWad) {
            transferAmount = this.inquireTransferAmountFromTargetLeverage(position, leverageWad);
            if (transferAmount.gt(vaultBalanceWad)) marginToDepositWad = transferAmount.sub(vaultBalanceWad);
        } else if (!leverageWad && transferAmount) {
            if (transferAmount.gt(vaultBalanceWad)) marginToDepositWad = transferAmount.sub(vaultBalanceWad);
            const value = wmul(position.rootPair.markPrice, position.size.abs());
            const equity = position.getEquity().add(transferAmount);
            leverageWad = wdiv(value, equity);
        } else {
            throw new Error('Invalid input');
        }
        if (transferAmount.lt(ZERO) && transferAmount.abs().gt(maxWithdrawableMargin)) {
            throw new Error('Invalid input');
        }

        position.balance = position.balance.add(transferAmount);
        return {
            marginToDepositWad: marginToDepositWad,
            simulationMainPosition: position,
            transferAmount: transferAmount,
            leverageWad: leverageWad,
        };
    }

    // @dev: get benchmark price of an uncreated instrument
    async simulateBenchmarkPrice(instrumentIdentifier: InstrumentIdentifier, expiry: number): Promise<BigNumber> {
        let benchmarkPrice;
        if (cexMarket(instrumentIdentifier.marketType)) {
            benchmarkPrice = await this.inspectCexMarketBenchmarkPrice(instrumentIdentifier, expiry);
        } else {
            benchmarkPrice = await this.inspectDexV2MarketBenchmarkPrice(instrumentIdentifier, expiry);
        }
        return benchmarkPrice;
    }

    // @param alphaWad: decimal 18 units 1.3e18 means 1.3
    // @param marginWad: decimal 18 units
    // @param slippage: 0 ~ 10000. e.g. 500 means 5%
    async simulateAddLiquidity(
        targetAddress: string,
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
        alphaWad: BigNumber,
        margin: BigNumber,
        slippage: number,
        currentSqrtPX96?: BigNumber,
    ): Promise<{
        tickDelta: number;
        liquidity: BigNumber;
        upperPrice: BigNumber;
        lowerPrice: BigNumber;
        lowerPosition: PositionModel;
        lowerLeverageWad: BigNumber;
        upperPosition: PositionModel;
        upperLeverageWad: BigNumber;
        sqrtStrikeLowerPX96: BigNumber;
        sqrtStrikeUpperPX96: BigNumber;
        marginToDepositWad: BigNumber;
        minMargin: BigNumber;
        minEffectiveQuoteAmount: BigNumber;
        equivalentAlpha: BigNumber;
    }> {
        const res = await this.simulateAddLiquidityWithAsymmetricRange(
            targetAddress,
            instrumentIdentifier,
            expiry,
            alphaWad,
            alphaWad,
            margin,
            slippage,
            currentSqrtPX96,
        );

        return {
            ...res,
            tickDelta: res.tickDeltaUpper,
            equivalentAlpha: tickDeltaToAlphaWad(
                ~~((TickMath.getTickAtPWad(res.upperPrice) - TickMath.getTickAtPWad(res.lowerPrice)) / 2),
            ),
        };
    }

    // @param alphaWad: decimal 18 units 1.3e18 means 1.3
    // @param marginWad: decimal 18 units
    // @param slippage: 0 ~ 10000. e.g. 500 means 5%
    async simulateAddLiquidityWithAsymmetricRange(
        targetAddress: string,
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
        alphaWadLower: BigNumber,
        alphaWadUpper: BigNumber,
        margin: BigNumber,
        slippage: number,
        currentSqrtPX96?: BigNumber,
    ): Promise<{
        tickDeltaLower: number;
        tickDeltaUpper: number;
        liquidity: BigNumber;
        upperPrice: BigNumber;
        lowerPrice: BigNumber;
        lowerPosition: PositionModel;
        lowerLeverageWad: BigNumber;
        upperPosition: PositionModel;
        upperLeverageWad: BigNumber;
        sqrtStrikeLowerPX96: BigNumber;
        sqrtStrikeUpperPX96: BigNumber;
        marginToDepositWad: BigNumber;
        minMargin: BigNumber;
        minEffectiveQuoteAmount: BigNumber;
        equivalentAlphaLower: BigNumber;
        equivalentAlphaUpper: BigNumber;
    }> {
        const instrumentAddress = await this.computeInstrumentAddress(
            instrumentIdentifier.marketType,
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        let quoteInfo: TokenInfo;
        let pairModel: PairModel;
        let setting: InstrumentSetting;
        // see if this instrument is created
        let instrument = this.instrumentMap.get(instrumentAddress.toLowerCase());
        if (!instrument || !instrument.state.pairStates.has(expiry)) {
            // need uncreated instrument
            const benchmarkPrice = await this.simulateBenchmarkPrice(instrumentIdentifier, expiry);
            const { quoteTokenInfo } = await this.getTokenInfo(instrumentIdentifier);
            quoteInfo = quoteTokenInfo;
            if (instrument) {
                setting = instrument.setting;
            } else {
                const quoteParam = this.config.quotesParam[quoteInfo.symbol]!;
                instrument = InstrumentModel.minimumInstrumentWithParam(quoteParam);
                setting = instrument.setting;
            }
            pairModel = PairModel.minimalPairWithAmm(instrument, benchmarkPrice);
        } else {
            pairModel = instrument.getPairModel(expiry);
            quoteInfo = pairModel.rootInstrument.info.quote;
            setting = pairModel.rootInstrument.setting;
        }
        const amm = pairModel.amm;
        const tickDeltaLower = alphaWadToTickDelta(alphaWadLower);
        const tickDeltaUpper = alphaWadToTickDelta(alphaWadUpper);

        const upperTick = alignRangeTick(amm.tick + tickDeltaUpper, false);
        const lowerTick = alignRangeTick(amm.tick - tickDeltaLower, true);

        // if (pairAccountModel.containsRange(lowerTick, upperTick)) throw new Error('range is occupied');
        const upperPrice = TickMath.getWadAtTick(upperTick);
        const lowerPrice = TickMath.getWadAtTick(lowerTick);
        const { liquidity: liquidity } = entryDelta(
            amm.sqrtPX96,
            lowerTick,
            upperTick,
            margin,
            setting.initialMarginRatio,
        );
        const simulationRangeModel: RangeModel = RangeModel.fromRawRange(
            pairModel,
            {
                liquidity: liquidity,
                balance: margin,
                sqrtEntryPX96: amm.sqrtPX96,
                entryFeeIndex: amm.feeIndex,
            },
            rangeKey(lowerTick, upperTick),
        );
        const lowerPositionModel = simulationRangeModel.lowerPositionModelIfRemove;
        const upperPositionModel = simulationRangeModel.upperPositionModelIfRemove;
        const minMargin = getMarginFromLiquidity(
            amm.sqrtPX96,
            upperTick,
            pairModel.getMinLiquidity(amm.sqrtPX96),
            setting.initialMarginRatio,
        );
        const basedPX96 = currentSqrtPX96 ? currentSqrtPX96 : amm.sqrtPX96;
        return {
            tickDeltaLower,
            tickDeltaUpper,
            liquidity: liquidity,
            upperPrice: simulationRangeModel.upperPrice,
            lowerPrice: simulationRangeModel.lowerPrice,
            lowerPosition: lowerPositionModel,
            lowerLeverageWad: lowerPositionModel.size.mul(lowerPrice).div(lowerPositionModel.balance).abs(),
            upperPosition: upperPositionModel,
            upperLeverageWad: upperPositionModel.size.mul(upperPrice).div(upperPositionModel.balance).abs(),
            sqrtStrikeLowerPX96: basedPX96.sub(wmulDown(basedPX96, r2w(slippage))),
            sqrtStrikeUpperPX96: basedPX96.add(wmulDown(basedPX96, r2w(slippage))),
            marginToDepositWad: this.marginToDepositWad(targetAddress, quoteInfo, margin),
            minMargin: minMargin,
            minEffectiveQuoteAmount: instrument.minRangeValue,
            equivalentAlphaLower: tickDeltaToAlphaWad(~~(upperTick - amm.tick)),
            equivalentAlphaUpper: tickDeltaToAlphaWad(~~(amm.tick - lowerTick)),
        };
    }

    simulateRemoveLiquidity(
        pairAccountModel: PairLevelAccountModel,
        rangeModel: RangeModel,
        slippage: number,
    ): {
        simulatePositionRemoved: PositionModel;
        simulationMainPosition: PositionModel;
        sqrtStrikeLowerPX96: BigNumber;
        sqrtStrikeUpperPX96: BigNumber;
    } {
        const amm = pairAccountModel.rootPair.amm;
        const rawPositionRemoved = rangeModel.rawPositionIfRemove(amm);
        const rawMainPosition = combine(amm, rawPositionRemoved, pairAccountModel.getMainPosition()).position;
        const mainPosition = PositionModel.fromRawPosition(pairAccountModel.rootPair, rawMainPosition);
        const positionRemoved = PositionModel.fromRawPosition(pairAccountModel.rootPair, rawPositionRemoved);
        return {
            simulatePositionRemoved: positionRemoved,
            simulationMainPosition: mainPosition,
            sqrtStrikeLowerPX96: amm.sqrtPX96.sub(wmulDown(amm.sqrtPX96, r2w(slippage))),
            sqrtStrikeUpperPX96: amm.sqrtPX96.add(wmulDown(amm.sqrtPX96, r2w(slippage))),
        };
    }
    //////////////////////////////////////////////////////////
    // Frontend Transaction API
    //////////////////////////////////////////////////////////

    // @param baseAmount: decimal 18 units, always positive for both long or short. e.g. 3e18 means 3 BASE
    // @param slippage: 0 ~ 10000. e.g. 500 means 5%
    public async intuitiveTrade(
        signer: Signer,
        pair: PairModel,
        side: Side,
        base: BigNumber,
        margin: BigNumber,
        tradePrice: BigNumber,
        slippage: number,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        if (side === Side.FLAT) {
            throw new Error('Invalid Price');
        }
        const sign = signOfSide(side);
        const limitTick = this.getLimitTick(tradePrice, slippage, side);
        const instrument = this.getInstrumentContract(pair.rootInstrument.info.addr, signer);

        const unsignedTx = await instrument.populateTransaction.trade(
            encodeTradeWithReferralParam(pair.amm.expiry, base.mul(sign), margin, limitTick, deadline, referralCode),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    // @param margin: decimal 18 units, always positive
    // @param transferIn: true if transferIn, false if transferOut
    public async adjustMargin(
        signer: Signer,
        pair: PairModel,
        transferIn: boolean,
        margin: BigNumber,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const sign: number = transferIn ? 1 : -1;
        const instrument = this.getInstrumentContract(pair.rootInstrument.info.addr, signer);

        const unsignedTx = await instrument.populateTransaction.trade(
            encodeAdjustWithReferralParam(pair.amm.expiry, margin.mul(sign), deadline, referralCode),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    // @param baseAmount: decimal 18 units, always positive for both long or short. e.g. 3e18 means 3 BASE
    // @param takeProfitRatio: 0 ~ 10000. e.g. 500 means 5%
    // @param stopLossRatio: same as takeProfitRatio
    async limitOrder(
        signer: Signer,
        pair: PairModel,
        tickNumber: number,
        baseWad: BigNumber,
        balanceWad: BigNumber,
        side: Side,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const currentTick = pair.amm.tick;
        const isLong = tickNumber < currentTick;
        if (currentTick === tickNumber) throw new Error('Invalid price');
        if (isLong !== (side === Side.LONG)) throw new Error('Invalid price');
        const sign = isLong ? 1 : -1;
        const instrument = this.getInstrumentContract(pair.rootInstrument.info.addr, signer);

        const unsignedTx = await instrument.populateTransaction.place(
            encodePlaceWithReferralParam(
                pair.amm.expiry,
                baseWad.mul(sign),
                balanceWad,
                tickNumber,
                deadline,
                referralCode,
            ),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async addLiquidityWithAsymmetricRange(
        signer: Signer,
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
        tickDeltaLower: number,
        tickDeltaUpper: number,
        marginWad: BigNumber,
        sqrtStrikeLowerPX96: BigNumber,
        sqrtStrikeUpperPX96: BigNumber,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const addParam = {
            expiry: expiry,
            tickDeltaLower: tickDeltaLower,
            tickDeltaUpper: tickDeltaUpper,
            amount: marginWad,
            limitTicks: this.encodeLimitTicks(sqrtStrikeLowerPX96, sqrtStrikeUpperPX96),
            deadline: deadline,
        } as AddParam;
        return this._addLiquidity(signer, addParam, instrumentIdentifier, referralCode, overrides);
    }

    async addLiquidity(
        signer: Signer,
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
        tickDelta: number,
        marginWad: BigNumber,
        sqrtStrikeLowerPX96: BigNumber,
        sqrtStrikeUpperPX96: BigNumber,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const addParam = {
            expiry: expiry,
            tickDeltaLower: 0, // 0 means same as tickDeltaUpper
            tickDeltaUpper: tickDelta,
            amount: marginWad,
            limitTicks: this.encodeLimitTicks(sqrtStrikeLowerPX96, sqrtStrikeUpperPX96),
            deadline: deadline,
        } as AddParam;
        return this._addLiquidity(signer, addParam, instrumentIdentifier, referralCode, overrides);
    }

    async _addLiquidity(
        signer: Signer,
        addParam: AddParam,
        instrumentIdentifier: InstrumentIdentifier,
        referralCode: string,
        overrides?: PayableOverrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrumentAddress = await this.computeInstrumentAddress(
            instrumentIdentifier.marketType,
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        let unsignedTx;
        const gate = this.contracts.gate.connect(signer);
        const indexOfInstrument = await gate.indexOf(instrumentAddress);
        if (BigNumber.from(indexOfInstrument).isZero()) {
            this.ctx.registerContractParser(instrumentAddress, new InstrumentParser());
            this.ctx.registerAddress(
                instrumentAddress,
                instrumentIdentifier.baseSymbol +
                    '-' +
                    instrumentIdentifier.quoteSymbol +
                    '-' +
                    instrumentIdentifier.marketType,
            );
            // need to create instrument
            unsignedTx = await gate.populateTransaction.launch(
                instrumentIdentifier.marketType,
                instrumentAddress,
                await this.computeInitData(instrumentIdentifier),
                encodeAddWithReferralParam(addParam, referralCode),
                overrides ?? {},
            );
        } else {
            const instrument = this.getInstrumentContract(instrumentAddress, signer);
            unsignedTx = await instrument.populateTransaction.add(
                encodeAddWithReferralParam(addParam, referralCode),
                overrides ?? {},
            );
        }

        return this.ctx.sendTx(signer, unsignedTx);
    }

    async removeLiquidity(
        signer: Signer,
        pairModel: PairModel,
        targetAddress: string,
        rangeModel: RangeModel,
        sqrtStrikeLowerPX96: BigNumber,
        sqrtStrikeUpperPX96: BigNumber,
        deadline: number,
        overrides?: PayableOverrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(pairModel.rootInstrument.info.addr, signer);

        const calldata = [];
        calldata.push(
            instrument.interface.encodeFunctionData('remove', [
                encodeRemoveParam({
                    expiry: pairModel.amm.expiry,
                    target: targetAddress,
                    tickLower: rangeModel.tickLower,
                    tickUpper: rangeModel.tickUpper,
                    limitTicks: this.encodeLimitTicks(sqrtStrikeLowerPX96, sqrtStrikeUpperPX96),
                    deadline: deadline,
                }),
            ]),
        );
        const unsignedTx = await instrument.populateTransaction.remove(
            encodeRemoveParam({
                expiry: pairModel.amm.expiry,
                target: targetAddress,
                tickLower: rangeModel.tickLower,
                tickUpper: rangeModel.tickUpper,
                limitTicks: this.encodeLimitTicks(sqrtStrikeLowerPX96, sqrtStrikeUpperPX96),
                deadline: deadline,
            }),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    public async batchCancelOrder(
        signer: Signer,
        account: PairLevelAccountModel,
        ordersToCancel: OrderModel[],
        deadline: number,
        overrides?: PayableOverrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const expiry = account.rootPair.amm.expiry;
        const instrument = this.getInstrumentContract(account.rootPair.rootInstrument.info.addr, signer);

        const ticks = ordersToCancel.map((order) => order.tick);

        if (ticks.length <= MAX_CANCEL_ORDER_COUNT) {
            const unsignedTx = await instrument.populateTransaction.cancel(
                encodeCancelParam(expiry, ticks, deadline),
                overrides ?? {},
            );
            return this.ctx.sendTx(signer, unsignedTx);
        } else {
            // split ticks by size of MAX_CANCEL_ORDER_COUNT
            const tickGroups = [];
            for (let i = 0; i < ticks.length; i += MAX_CANCEL_ORDER_COUNT) {
                tickGroups.push(ticks.slice(i, i + MAX_CANCEL_ORDER_COUNT));
            }
            const calldatas = tickGroups.map((group) => {
                return instrument.interface.encodeFunctionData('cancel', [encodeCancelParam(expiry, group, deadline)]);
            });
            const unsignedTx = await instrument.populateTransaction.multicall(calldatas, overrides ?? {});
            return this.ctx.sendTx(signer, unsignedTx);
        }
    }

    public async vaultOperation(
        signer: Signer,
        quoteAddress: string,
        amountWad: BigNumber,
        deposit: boolean,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const vault = this.contracts.gate;
        const usingNative = quoteAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
        const quoteInfo = usingNative ? this.ctx.wrappedNativeToken : await this.ctx.getTokenInfo(quoteAddress);
        const decimals = quoteInfo.decimals;
        const amount = NumericConverter.toContractQuoteAmount(amountWad, decimals);
        let unsignedTx;
        if (deposit) {
            const overrides = usingNative ? { value: amount } : {};
            unsignedTx = await vault.populateTransaction.deposit(encodeDepositParam(quoteAddress, amount), overrides);
        } else {
            unsignedTx = await vault.populateTransaction.withdraw(encodeWithdrawParam(quoteAddress, amount));
        }

        return this.ctx.sendTx(signer, unsignedTx);
    }

    private marginToDepositWad(
        traderAddress: string,
        quoteInfo: TokenInfo,
        marginNeedWad: BigNumber,
        balanceInVaultWadOverride?: BigNumber,
    ): BigNumber {
        let balanceInVaultWad;
        if (balanceInVaultWadOverride) {
            balanceInVaultWad = balanceInVaultWadOverride;
        } else {
            balanceInVaultWad = NumericConverter.scaleQuoteAmount(
                this.getCachedVaultBalance(quoteInfo.address, traderAddress),
                quoteInfo.decimals,
            );
        }
        if (marginNeedWad.gt(balanceInVaultWad)) {
            return marginNeedWad.sub(balanceInVaultWad);
        } else {
            return ZERO;
        }
    }

    /// @dev only for internal use, update instrumentMap with params
    public updateInstrumentCache(instrumentModels: InstrumentModel[]): void {
        for (let i = 0; i < instrumentModels.length; ++i) {
            const instrument = instrumentModels[i].info.addr.toLowerCase();
            const oldModel = this.instrumentMap.get(instrument);
            if (oldModel) {
                oldModel.updateInstrumentState(instrumentModels[i].state, instrumentModels[i].spotPrice);
                for (const pair of instrumentModels[i].state.pairStates.values()) {
                    oldModel.updatePair(pair.amm, instrumentModels[i].getMarkPrice(pair.amm.expiry), pair.blockInfo);
                }
            } else {
                this.instrumentMap.set(instrument, instrumentModels[i]);
            }
        }
    }

    getLimitTick(tradePrice: BigNumber, slippage: number, side: Side): number {
        const sign = signOfSide(side);
        const limitPrice = tradePrice.mul(ONE_RATIO + sign * slippage).div(ONE_RATIO);
        const limitTick = TickMath.getTickAtPWad(limitPrice);
        // to narrow price range compared to using limit price
        // if LONG, use limitTick where getWadAtTick(limitTick) <= limitPrice,
        // otherwise use limitTick + 1 where getWadAtTick(limitTick + 1) > limitPrice
        return side == Side.LONG ? limitTick : limitTick + 1;
    }

    // decomposeFee(
    //     size: BigNumber,
    //     quotation: Quotation,
    //     param: QuoteParam,
    // ): {
    //     basicFee: BigNumber;
    //     stabilityFee: BigNumber;
    //     protocolFee: BigNumber;
    // } {
    //     const entryNotional = wmul(quotation.strikePrice, size.abs());
    //     const protocolFee = wmulUp(entryNotional, c2w(param.protocolFeeRatio));

    //     const priceChangeRatioWad = relativeDiffRatioWadAbs(
    //         sqrtX96ToWad(quotation.sqrtFairPX96),
    //         sqrtX96ToWad(quotation.sqrtPostFairPX96),
    //     );
    //     const basicFeeRatioWad = priceChangeRatioWad.lte(c2w(param.initialMarginRatio))
    //         ? c2w(param.tradingFeeRatio)
    //         : c2w(param.highFeeRatio);

    //     const basicFee = wmulUp(entryNotional, basicFeeRatioWad);

    //     const stabilityFee = quotation.fee.sub(protocolFee).sub(basicFee);

    //     return { basicFee, stabilityFee, protocolFee };
    // }
    // return stability fee ratio in 4 decimal form
    getStabilityFeeRatio(quotation: Quotation, param: QuoteParam, maintenanceMarginRatio: number): number {
        // maintenanceMarginRatio is no more needed
        maintenanceMarginRatio;
        const stabilityFee = this.getStabilityFee(quotation, param);
        const ratioTemp = wdiv(stabilityFee, quotation.entryNotional);
        const scaler = BigNumber.from(10).pow(14);
        const ratio = ratioTemp.add(scaler.sub(1)).div(scaler);

        return ratio.toNumber();
    }

    getStabilityFee(quotation: Quotation, param: QuoteParam): BigNumber {
        const feePaid = quotation.fee;
        const protocolFeePaid = wmulUp(quotation.entryNotional, r2w(param.protocolFeeRatio));
        const baseFeePaid = wmulUp(quotation.entryNotional, r2w(param.tradingFeeRatio));

        let stabilityFee = feePaid.sub(protocolFeePaid).sub(baseFeePaid);
        if (stabilityFee.lt(0)) stabilityFee = ZERO;
        return stabilityFee;
    }

    private async inspectDexV2MarketBenchmarkPrice(
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
    ): Promise<BigNumber> {
        const { baseSymbol, quoteSymbol } = this.getTokenSymbol(
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        const baseParam = this.config.quotesParam[baseSymbol];
        const quoteParam = this.config.quotesParam[quoteSymbol];

        const baseStable = baseParam && baseParam.qtype === QuoteType.STABLE;
        const quoteStable = quoteParam && quoteParam.qtype === QuoteType.STABLE;

        const feederType: FeederType = ((baseStable ? 2 : 0) + (quoteStable ? 1 : 0)) as FeederType;

        const rawSpotPrice = await this.getDexV2RawSpotPrice(instrumentIdentifier);

        return calcBenchmarkPrice(expiry, rawSpotPrice, feederType, this.config.marketConfig.DEXV2!.dailyInterestRate);
    }

    private async inspectCexMarketBenchmarkPrice(
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
    ): Promise<BigNumber> {
        const instrumentAddress = await this.computeInstrumentAddress(
            instrumentIdentifier.marketType,
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        const market = this.contracts.marketContracts[instrumentIdentifier.marketType]?.market as CexMarket;
        let benchmarkPrice;
        try {
            benchmarkPrice = await market.getBenchmarkPrice(instrumentAddress, expiry);
        } catch (e) {
            console.error('fetch chainlink market price error', e);
            benchmarkPrice = ZERO;
        }
        return benchmarkPrice;
    }

    async getRawSpotPrice(identifier: InstrumentIdentifier): Promise<BigNumber> {
        if (identifier.marketType === MarketType.DEXV2) {
            return this.getDexV2RawSpotPrice(identifier);
        } else if (cexMarket(identifier.marketType)) {
            return this.getCexRawSpotPrice(identifier);
        } else {
            throw new Error('Unsupported market type');
        }
    }

    async getDexV2RawSpotPrice(identifier: InstrumentIdentifier): Promise<BigNumber> {
        const { baseTokenInfo, quoteTokenInfo } = await this.getTokenInfo(identifier);

        const baseScaler = BigNumber.from(10).pow(18 - baseTokenInfo.decimals);
        const quoteScaler = BigNumber.from(10).pow(18 - quoteTokenInfo.decimals);

        const isToken0Quote = BigNumber.from(baseTokenInfo.address).gt(BigNumber.from(quoteTokenInfo.address));

        const dexV2PairInfo = await this.contracts.observer.inspectMaxReserveDexV2Pair(
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
        const instrumentAddress = await this.computeInstrumentAddress(
            instrumentIdentifier.marketType,
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        const market = this.contracts.marketContracts[instrumentIdentifier.marketType]?.market as CexMarket;
        let rawSpotPrice;
        try {
            rawSpotPrice = await market.getRawPrice(instrumentAddress);
        } catch (e) {
            console.error('fetch chainlink spot price error', e);
            rawSpotPrice = ZERO;
        }
        return rawSpotPrice;
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
        const pearls = await this.contracts.observer.getPearls(instrumentAddr, expiry, ticks);
        const records = await this.contracts.observer.getRecords(instrumentAddr, expiry, ticks, nonces);
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

    calcBoost(alpha: number, imr: number): number {
        if (alpha === 1) {
            throw new Error('Invalid alpha');
        }
        imr = imr / 10 ** RATIO_DECIMALS;
        return -2 / (alpha * (imr + 1) - Math.sqrt(alpha)) / (1 / Math.sqrt(alpha) - 1);
    }

    getMaxLeverage(imr: number): number {
        return 1 / (imr / 10 ** RATIO_DECIMALS);
    }

    encodeLimitTicks(sqrtStrikeLowerPX96: BigNumber, sqrtStrikeUpperPX96: BigNumber): BigNumber {
        let strikeLowerTick = sqrtStrikeLowerPX96.eq(0)
            ? INT24_MIN
            : TickMath.getTickAtSqrtRatio(sqrtStrikeLowerPX96) + 1;
        strikeLowerTick = strikeLowerTick < 0 ? (1 << 24) + strikeLowerTick : strikeLowerTick;

        let strikeUpperTick = sqrtStrikeUpperPX96.eq(0) ? INT24_MAX : TickMath.getTickAtSqrtRatio(sqrtStrikeUpperPX96);
        strikeUpperTick = strikeUpperTick < 0 ? (1 << 24) + strikeUpperTick : strikeUpperTick;

        return BigNumber.from(strikeLowerTick).mul(BigNumber.from(2).pow(24)).add(strikeUpperTick);
    }

    getTickRangeByAlpha(alphaWad: BigNumber, curTick: number): [number, number] {
        const tickDelta = alphaWadToTickDelta(alphaWad);
        const upperTick = RANGE_SPACING * ~~((curTick + tickDelta) / RANGE_SPACING);
        const lowerTick = RANGE_SPACING * ~~((curTick - tickDelta) / RANGE_SPACING);
        return [lowerTick, upperTick];
    }

    async getTokenInfo(instrumentIdentifier: InstrumentIdentifier): Promise<{
        baseTokenInfo: TokenInfo;
        quoteTokenInfo: TokenInfo;
    }> {
        const call1 =
            typeof instrumentIdentifier.baseSymbol === 'string'
                ? this.ctx.getTokenInfo(instrumentIdentifier.baseSymbol)
                : (instrumentIdentifier.baseSymbol as TokenInfo);
        const call2 =
            typeof instrumentIdentifier.quoteSymbol === 'string'
                ? this.ctx.getTokenInfo(instrumentIdentifier.quoteSymbol)
                : (instrumentIdentifier.quoteSymbol as TokenInfo);
        const [baseTokenInfo, quoteTokenInfo] = await Promise.all([call1, call2]);
        return { baseTokenInfo, quoteTokenInfo };
    }

    getTokenSymbol(
        base: string | TokenInfo,
        quote: string | TokenInfo,
    ): {
        baseSymbol: string;
        quoteSymbol: string;
    } {
        const baseSymbol = typeof base === 'string' ? base : base.symbol;
        const quoteSymbol = typeof quote === 'string' ? quote : quote.symbol;
        return { baseSymbol, quoteSymbol };
    }

    async getQuoteTokenInfo(quoteSymbol: string, instrumentAddr: string): Promise<TokenInfo> {
        return (
            this.quoteSymbolToInfo.get(quoteSymbol) ??
            (await this.ctx.getTokenInfo(quoteSymbol)) ??
            (await this.ctx.getTokenInfo((await this.contracts.observer.getSetting(instrumentAddr)).quote))
        );
    }

    registerQuoteInfo(tinfo: TokenInfo): void {
        this.ctx.tokenInfo.set(tinfo.symbol.toLowerCase(), tinfo);
        this.ctx.tokenInfo.set(tinfo.address.toLowerCase(), tinfo);
        this.ctx.registerAddress(tinfo.address, tinfo.symbol);
    }
}
