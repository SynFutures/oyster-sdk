/* eslint-disable @typescript-eslint/no-explicit-any */
import { SynFutureV3Plugin, SynFuturesV3 } from '../core';
import { TxInterface } from './tx.interface';
import { TxModule } from './tx.module';

export interface TxPlugin {
    tx: TxInterface;
}

export function txPlugin<T extends SynFuturesV3>(): SynFutureV3Plugin<T, TxPlugin> {
    return {
        install(synfV3: T): T & TxPlugin {
            (synfV3 as any).tx = new TxModule(synfV3 as any);
            return synfV3 as any as T & TxPlugin;
        },
    };
}
