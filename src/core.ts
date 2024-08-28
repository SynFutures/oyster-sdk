/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Provider } from '@ethersproject/providers';
import { CHAIN_ID, ChainContext, TokenInfo, ContractParser } from '@derivation-tech/web3-core';
import {
    Beacon__factory,
    cexMarket,
    CexMarket__factory,
    Config__factory,
    DexV2Market__factory,
    EmergingFeederFactory__factory,
    Gate__factory,
    Guardian__factory,
    MarketType,
    Observer__factory,
    PythFeederFactory__factory,
} from './types';
import {
    cachePlugin,
    gatePlugin,
    observerPlugin,
    simulatePlugin,
    instrumentPlugin,
    txPlugin,
    configPlugin,
    inversePlugin,
    CachePlugin,
    GatePlugin,
    ObserverPlugin,
    SimulatePlugin,
    InstrumentPlugin,
    TxPlugin,
    ConfigPlugin,
    InversePlugin,
    CacheInterface,
    GateInterface,
    ObserverInterface,
    SimulateInterface,
    InstrumentInterface,
    TxInterface,
    ConfigInterface,
    InverseInterface,
    CacheModule,
    GateModule,
    ObserverModule,
    SimulateModule,
    InstrumentModule,
    TxModule,
    ConfigModule,
    InverseModule,
} from './modules';
import {
    ConfigManager,
    ContractAddress,
    FeederFactoryContracts,
    MarketContracts,
    SynFuturesConfig,
    SynFuturesV3Contracts,
} from './config';
import { Combine, mount, CexMarketParser, ConfigParser, DexV2MarketParser, GateParser, GuardianParser } from './common';

export interface SynFutureV3Plugin<T extends SynFuturesV3, U> {
    install(synfV3: T): T & U;
}

export type DefaultSynFuturesV3 = Combine<
    [SynFuturesV3, CachePlugin, GatePlugin, ObserverPlugin, SimulatePlugin, InstrumentPlugin, TxPlugin, ConfigPlugin]
>;

export type LegacySynFuturesV3 = Combine<
    [
        DefaultSynFuturesV3,
        CacheInterface,
        GateInterface,
        ObserverInterface,
        SimulateInterface,
        InstrumentInterface,
        TxInterface,
        ConfigInterface,
    ]
>;

export type WrappedSynFutureV3 = Combine<
    [Omit<LegacySynFuturesV3, keyof InverseInterface>, InverseInterface, InversePlugin]
>;

export class SynFuturesV3 {
    private static instances = new Map<number, LegacySynFuturesV3>();
    private static wrappedInstances = new Map<number, WrappedSynFutureV3>();

    static getInstance(chanIdOrName: CHAIN_ID | string): LegacySynFuturesV3 {
        const chainId = ChainContext.getChainInfo(chanIdOrName).chainId;

        let instance = SynFuturesV3.instances.get(chainId);

        if (!instance) {
            const _instance = new SynFuturesV3(chanIdOrName).useDefault();

            // In order to be fully compatible with the old usage,
            // member functions and member variables are mounted on the SDK instance
            mount(_instance, CacheModule, _instance.cache);
            mount(_instance, GateModule, _instance.gate);
            mount(_instance, ObserverModule, _instance.observer);
            mount(_instance, SimulateModule, _instance.simulate);
            mount(_instance, InstrumentModule, _instance.instrument);
            mount(_instance, TxModule, _instance.tx);
            mount(_instance, ConfigModule, _instance.config);

            SynFuturesV3.instances.set(chainId, (instance = _instance as unknown as LegacySynFuturesV3));
        }

        return instance;
    }

    static getWrappedInstance(chanIdOrName: CHAIN_ID | string): WrappedSynFutureV3 {
        const chainId = ChainContext.getChainInfo(chanIdOrName).chainId;

        let wrappedInstance = SynFuturesV3.wrappedInstances.get(chainId);

        if (!wrappedInstance) {
            const _instance = SynFuturesV3.getInstance(chainId).use(inversePlugin());

            // In order to be fully compatible with the old usage,
            // member functions and member variables are mounted on the SDK instance
            mount(_instance, InverseModule, _instance.inverse);

            SynFuturesV3.wrappedInstances.set(chainId, (wrappedInstance = _instance as unknown as WrappedSynFutureV3));
        }

        return wrappedInstance;
    }

    ctx: ChainContext;
    conf!: SynFuturesConfig;
    contracts!: SynFuturesV3Contracts;

    constructor(chainId: CHAIN_ID | string) {
        this.ctx = ChainContext.getInstance(chainId);
        this._init(ConfigManager.getSynfConfig(this.ctx.chainId));
    }

    private _init(config: SynFuturesConfig): void {
        this.conf = config;
        const provider = this.ctx.provider;
        if (provider) {
            this._initContracts(provider, config.contractAddress);
        }
        const contractAddress = this.conf.contractAddress;
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
        if (this.conf.tokenInfo) {
            for (const token of this.conf.tokenInfo) {
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

    /**
     * Set provider for sdk and ChainContext
     * @param provider Ethers provider
     * @param isOpSdkCompatible Is it the OP technology stack?
     */
    setProvider(provider: Provider, isOpSdkCompatible?: boolean): void {
        if (!isOpSdkCompatible) this.ctx.info.isOpSdkCompatible = false;
        this.ctx.setProvider(provider);
        this._initContracts(provider, this.conf.contractAddress);
    }

    /**
     * Register new quote info
     * @param tokenInfo {@link TokenInfo}
     */
    registerQuoteInfo(tokenInfo: TokenInfo): void {
        this.ctx.tokenInfo.set(tokenInfo.symbol.toLowerCase(), tokenInfo);
        this.ctx.tokenInfo.set(tokenInfo.address.toLowerCase(), tokenInfo);
        this.ctx.registerAddress(tokenInfo.address, tokenInfo.symbol);
    }

    /**
     * Use plugin
     * @param plugin Plugin instance
     * @returns Installed sdk instance
     */
    use<U>(plugin: SynFutureV3Plugin<this, U>): this & U {
        return plugin.install(this);
    }

    /**
     * Use default plugins
     * @returns Installed sdk instance
     */
    useDefault(): DefaultSynFuturesV3 {
        return this.use(cachePlugin())
            .use(gatePlugin())
            .use(observerPlugin())
            .use(simulatePlugin())
            .use(instrumentPlugin())
            .use(txPlugin())
            .use(configPlugin()) as unknown as DefaultSynFuturesV3;
    }
}
