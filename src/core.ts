import { CHAIN_ID, ChainContext } from '@derivation-tech/web3-core';
import {
    cachePlugin,
    gatePlugin,
    observerPlugin,
    simulatePlugin,
    instrumentPlugin,
    txPlugin,
    configPlugin,
} from './modules';

export interface SynFutureV3Plugin<T extends SynFuturesV3, U> {
    install(synfV3: T): T & U;
}

export class SynFuturesV3 {
    private static instances = new Map<number, SynFuturesV3>();

    static getInstance(chanIdOrName: CHAIN_ID | string): SynFuturesV3 {
        const chainId = ChainContext.getChainInfo(chanIdOrName).chainId;
        let instance = SynFuturesV3.instances.get(chainId);
        if (!instance) {
            instance = this.getDefaultInstance(chainId);
        }
        return instance;
    }

    // TODO: type
    static getDefaultInstance(chanIdOrName: CHAIN_ID | string): SynFuturesV3 {
        return new SynFuturesV3(chanIdOrName)
            .use(cachePlugin())
            .use(gatePlugin())
            .use(observerPlugin())
            .use(simulatePlugin())
            .use(instrumentPlugin())
            .use(txPlugin())
            .use(configPlugin());
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
