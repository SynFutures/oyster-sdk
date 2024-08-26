/* eslint-disable @typescript-eslint/no-explicit-any */
import { SynFutureV3Plugin, SynFuturesV3 } from '../core';
import { CacheInterface } from './cache.interface';
import { CacheModule } from './cache.module';

export interface CachePlugin {
    cache: CacheInterface;
}

export function cachePlugin<T extends SynFuturesV3>(): SynFutureV3Plugin<T, CachePlugin> {
    return {
        install(synfV3: T): T & CachePlugin {
            (synfV3 as any).cache = new CacheModule(synfV3 as any);
            return synfV3 as any as T & CachePlugin;
        },
    };
}
