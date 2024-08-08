import { CHAIN_ID, ChainContext } from '@derivation-tech/web3-core';
import { Context, createNullContext } from './context';
import {
    cachePlugin,
    configPlugin,
    gatePlugin,
    instrumentPlugin,
    observerPlugin,
    simulatePlugin,
    SynfuturesPlugin,
    txPlugin,
} from './plugin';

export interface SynFuturesV3Ctx extends Context {
    use(plugin: SynfuturesPlugin): SynFuturesV3Ctx;
}

export class SynFuturesV3 {
    private static instances = new Map<number, SynFuturesV3Ctx>();

    public static getInstance(chanIdOrName: CHAIN_ID | string): SynFuturesV3Ctx {
        const chainId = ChainContext.getChainInfo(chanIdOrName).chainId;
        let instance = SynFuturesV3.instances.get(chainId);
        if (!instance) {
            instance = this.getDefaultInstance(chainId);
        }
        return instance;
    }

    public static getDefaultInstance(chanIdOrName: CHAIN_ID | string): SynFuturesV3Ctx {
        const chainId = ChainContext.getChainInfo(chanIdOrName).chainId;
        return this.createSynCtx()
            .use(cachePlugin(chainId))
            .use(gatePlugin())
            .use(observerPlugin())
            .use(simulatePlugin())
            .use(instrumentPlugin())
            .use(txPlugin())
            .use(configPlugin());
    }

    public static createSynCtx(): SynFuturesV3Ctx {
        return {
            ...createNullContext(),
            use(plugin: SynfuturesPlugin): SynFuturesV3Ctx {
                plugin.install(this);
                return this;
            },
        };
    }
}
