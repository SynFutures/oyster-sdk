import { CHAIN_ID, ChainContext, ContractParser, TokenInfo } from '@derivation-tech/web3-core';
import { SynFuturesV3Ctx } from '../synfuturesV3Core';
import {
    Beacon__factory,
    cexMarket,
    CexMarket__factory,
    Config__factory,
    DexV2Market__factory,
    EmergingFeederFactory__factory,
    EMPTY_QUOTE_PARAM,
    FetchInstrumentParam,
    Gate__factory,
    Guardian__factory,
    Instrument,
    Instrument__factory,
    InstrumentIdentifier,
    InstrumentInfo,
    MarketType,
    Observer__factory,
    PythFeederFactory__factory,
} from '../types';
import { BigNumber, CallOverrides, ethers, Signer } from 'ethers';
import { ConfigState, GateState, InstrumentModel, PairLevelAccountModel } from '../models';
import { CacheInterface } from './cache.interface';
import {
    ConfigManager,
    ContractAddress,
    FeederFactoryContracts,
    MarketContracts,
    SynfConfig,
    SynFuturesV3Contracts,
} from '../config';
import {
    CexMarketParser,
    ConfigParser,
    DexV2MarketParser,
    GateParser,
    getTokenInfo,
    GuardianParser,
    InstrumentParser,
} from '../common';
import { Provider } from '@ethersproject/providers';

export class CacheModule implements CacheInterface {
    synfV3: SynFuturesV3Ctx;
    ctx!: ChainContext;
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

    constructor(synfV3: SynFuturesV3Ctx, chainId: number) {
        this.synfV3 = synfV3;
        this.ctx = ChainContext.getInstance(chainId);
        this.gateState = new GateState(this.ctx.wrappedNativeToken.address.toLowerCase());
        this.configState = new ConfigState();
        this._init(ConfigManager.getSynfConfig(chainId));
    }

    async init(): Promise<void> {
        const list = await this.initInstruments();
        await this.initGateState(list);
        await this.updateConfigState();
    }

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

    async initInstruments(symbolToInfo?: Map<string, TokenInfo>): Promise<InstrumentModel[]> {
        this.quoteSymbolToInfo = symbolToInfo ?? new Map();
        for (const [, info] of this.quoteSymbolToInfo) {
            this.registerQuoteInfo(info);
        }
        const list = await this.synfV3.observer.getAllInstruments();

        for (const instrument of list) {
            this.instrumentMap.set(instrument.info.addr.toLowerCase(), instrument);
            this.ctx.registerAddress(instrument.info.addr, instrument.info.symbol);
            this.ctx.registerContractParser(instrument.info.addr, new InstrumentParser());
        }
        return list;
    }

    setProvider(provider: Provider, isOpSdkCompatible?: boolean): void {
        if (!isOpSdkCompatible) this.ctx.info.isOpSdkCompatible = false;
        this.ctx.setProvider(provider);
        this._initContracts(provider, this.config.contractAddress);
    }

    async updateInstrument(params: FetchInstrumentParam[], overrides?: CallOverrides): Promise<InstrumentModel[]> {
        const instrumentModels = await this.synfV3.observer.fetchInstrumentBatch(params, overrides);
        this.updateInstrumentCache(instrumentModels);
        return instrumentModels;
    }

    registerQuoteInfo(tokenInfo: TokenInfo): void {
        this.ctx.tokenInfo.set(tokenInfo.symbol.toLowerCase(), tokenInfo);
        this.ctx.tokenInfo.set(tokenInfo.address.toLowerCase(), tokenInfo);
        this.ctx.registerAddress(tokenInfo.address, tokenInfo.symbol);
    }

    async computeInitData(instrumentIdentifier: InstrumentIdentifier): Promise<string> {
        const { baseTokenInfo, quoteTokenInfo } = await getTokenInfo(instrumentIdentifier, this.ctx);
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

    public async syncGateCache(target: string, quotes: string[]): Promise<void> {
        const resp = await this.contracts.observer.getVaultBalances(target, quotes);
        for (let i = 0; i < quotes.length; ++i) {
            this.gateState.setReserve(quotes[i], target, resp[0][i]);
        }
    }

    public async syncGateCacheWithAllQuotes(target: string): Promise<void> {
        const quoteParamConfig = this.config.quotesParam;
        const quoteAddresses: string[] = [];
        for (const symbol in quoteParamConfig) {
            quoteAddresses.push(await this.ctx.getAddress(symbol));
        }
        await this.syncGateCache(target, quoteAddresses);
    }

    public getCachedGateBalance(quoteAddress: string, userAddress: string): BigNumber {
        const quote = quoteAddress.toLowerCase();
        const user = userAddress.toLowerCase();
        const balanceMap = this.gateState.reserveOf.get(quote.toLowerCase());
        if (balanceMap) {
            const balance = balanceMap.get(user);
            if (balance) {
                return balance;
            } else {
                throw new Error(`Not cached: gate balance for quote ${quote} of user ${user}`);
            }
        } else {
            throw new Error(`Not cached: gate for quote ${quote}`);
        }
    }

    public getInstrumentContract(address: string, signerOrProvider?: Signer | Provider): Instrument {
        return Instrument__factory.connect(address, signerOrProvider ?? this.ctx.provider);
    }

    private updateInstrumentCache(instrumentModels: InstrumentModel[]): void {
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
}
