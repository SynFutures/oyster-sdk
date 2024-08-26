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
    CacheModule,
    GateModule,
    ObserverModule,
    SimulateModule,
    InstrumentModule,
    TxModule,
    ConfigModule,
} from './modules';
import { Combine, mount } from './common';

export interface SynFutureV3Plugin<T extends SynFuturesV3, U> {
    install(synfV3: T): T & U;
}

export type DefaultSynFuturesV3 = Combine<
    [SynFuturesV3, CachePlugin, GatePlugin, ObserverPlugin, SimulatePlugin, InstrumentPlugin, TxPlugin, ConfigPlugin]
>;

export type MountedDefaultSynFuturesV3 = Combine<
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

export class SynFuturesV3 {
    private static instances = new Map<number, DefaultSynFuturesV3>();

    static getInstance(chanIdOrName: CHAIN_ID | string): DefaultSynFuturesV3 {
        const chainId = ChainContext.getChainInfo(chanIdOrName).chainId;
        let instance = SynFuturesV3.instances.get(chainId);
        if (!instance) {
            instance = new SynFuturesV3(chanIdOrName)
                .use(cachePlugin())
                .use(gatePlugin())
                .use(observerPlugin())
                .use(simulatePlugin())
                .use(instrumentPlugin())
                .use(txPlugin())
                .use(configPlugin());

            // In order to be fully compatible with the old usage,
            // member functions and member variables are mounted on the SDK instance
            mount(instance, CacheModule, instance.cache);
            mount(instance, GateModule, instance.gate);
            mount(instance, ObserverModule, instance.observer);
            mount(instance, SimulateModule, instance.simulate);
            mount(instance, InstrumentModule, instance.instrument);
            mount(instance, TxModule, instance.tx);
            mount(instance, ConfigModule, instance.config);
        }
        return instance;
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
}
