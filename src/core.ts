/* eslint-disable @typescript-eslint/no-explicit-any */
import { CHAIN_ID, ChainContext } from '@derivation-tech/web3-core';
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
import { Combine, mount } from './common';

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

export type WrappedSynFutureV3 = Combine<[Omit<LegacySynFuturesV3, keyof InverseInterface>, InverseInterface]>;

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

    constructor(chainId: CHAIN_ID | string) {
        this.ctx = ChainContext.getInstance(chainId);
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
