import { SynFuturesV3Ctx } from './synfuturesV3Core';
import { CacheModule, ObserverModule, GateModule, SimulateModule, InstrumentModule, TxModule } from './modules';
import { ConfigModule } from './modules/config.module';

export type SynfuturesPlugin = {
    install(synf: SynFuturesV3Ctx): void;
};

export function cachePlugin(chainId: number): SynfuturesPlugin {
    return {
        install(ctx: SynFuturesV3Ctx): void {
            ctx.cache = new CacheModule(ctx, chainId);
        },
    };
}

export function gatePlugin(): SynfuturesPlugin {
    return {
        install(ctx: SynFuturesV3Ctx): void {
            ctx.gate = new GateModule(ctx);
        },
    };
}

export function observerPlugin(): SynfuturesPlugin {
    return {
        install(ctx: SynFuturesV3Ctx): void {
            ctx.observer = new ObserverModule(ctx);
        },
    };
}

export function simulatePlugin(): SynfuturesPlugin {
    return {
        install(ctx: SynFuturesV3Ctx): void {
            ctx.simulate = new SimulateModule(ctx);
        },
    };
}

export function instrumentPlugin(): SynfuturesPlugin {
    return {
        install(ctx: SynFuturesV3Ctx): void {
            ctx.instrument = new InstrumentModule(ctx);
        },
    };
}

export function txPlugin(): SynfuturesPlugin {
    return {
        install(ctx: SynFuturesV3Ctx): void {
            ctx.tx = new TxModule(ctx);
        },
    };
}

export function configPlugin(): SynfuturesPlugin {
    return {
        install(ctx: SynFuturesV3Ctx): void {
            ctx.config = new ConfigModule(ctx);
        },
    };
}
