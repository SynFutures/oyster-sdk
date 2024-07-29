/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    ConfigManager,
    ContractAddress,
    FeederFactoryContracts,
    MarketContracts,
    SynfConfig,
    SynFuturesV3Contracts,
} from './config';
import { CallOverrides, ethers } from 'ethers';
import { Provider } from '@ethersproject/providers';
import { CHAIN_ID, ContractParser } from '@derivation-tech/web3-core';
import {
    Observer__factory,
    DexV2Market__factory,
    Config__factory,
    Gate__factory,
    CexMarket__factory,
    Beacon__factory,
    Guardian__factory,
    PythFeederFactory__factory,
    EmergingFeederFactory__factory,
} from './types';
import { ChainContext } from '@derivation-tech/web3-core';
import { getTokenInfo } from './common';
import { InstrumentIdentifier, TokenInfo } from './types';
import { cexMarket, MarketType } from './types';
import { CexMarketParser, ConfigParser, DexV2MarketParser, GateParser, GuardianParser } from './common';
import {
    CacheModule,
    InstrumentModule,
    AccountModule,
    SimulateModule,
    PriceModule,
    OpModule,
    WrappedOpModule,
    UtilityModule,
} from './modules';

export class SynFuturesV3 {
    private static instances = new Map<number, SynFuturesV3>();
    ctx: ChainContext;
    config!: SynfConfig;
    // this is not initialized in constructor, but in _init().
    contracts!: SynFuturesV3Contracts;

    cacheModule!: CacheModule;
    instrumentModule!: InstrumentModule;
    accountModule!: AccountModule;
    simulateModule!: SimulateModule;
    priceModule!: PriceModule;
    opModule!: OpModule;
    wrappedOpModule!: WrappedOpModule;
    utilityModule!: UtilityModule;

    protected constructor(ctx: ChainContext) {
        this.ctx = ctx;
        this._initModules();
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

    private _initModules(): void {
        this.cacheModule = new CacheModule(this);
        this.instrumentModule = new InstrumentModule(this);
        this.accountModule = new AccountModule(this);
        this.simulateModule = new SimulateModule(this);
        this.priceModule = new PriceModule(this);
        this.opModule = new OpModule(this);
        this.wrappedOpModule = new WrappedOpModule(this);
        this.utilityModule = new UtilityModule(this);
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

    registerQuoteInfo(tokenInfo: TokenInfo): void {
        this.ctx.tokenInfo.set(tokenInfo.symbol.toLowerCase(), tokenInfo);
        this.ctx.tokenInfo.set(tokenInfo.address.toLowerCase(), tokenInfo);
        this.ctx.registerAddress(tokenInfo.address, tokenInfo.symbol);
    }

    public setProvider(provider: Provider, isOpSdkCompatible = false): void {
        if (!isOpSdkCompatible) this.ctx.info.isOpSdkCompatible = false;
        this.ctx.setProvider(provider);
        this._initContracts(provider, this.config.contractAddress);
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

    async init(): Promise<void> {
        const list = await this.instrumentModule.initInstruments();
        await this.cacheModule.initGateState(list);
        await this.cacheModule.updateConfigState();
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
}
