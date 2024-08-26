/* eslint-disable @typescript-eslint/no-explicit-any */
import { SynFutureV3Plugin, SynFuturesV3 } from '../core';
import { ConfigInterface } from './config.interface';
import { ConfigModule } from './config.module';

export interface ConfigPlugin {
    config: ConfigInterface;
}

export function configPlugin<T extends SynFuturesV3>(): SynFutureV3Plugin<T, ConfigPlugin> {
    return {
        install(synfV3: T): T & ConfigPlugin {
            (synfV3 as any).config = new ConfigModule(synfV3 as any);
            return synfV3 as any as T & ConfigPlugin;
        },
    };
}
