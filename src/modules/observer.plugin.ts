/* eslint-disable @typescript-eslint/no-explicit-any */
import { SynFutureV3Plugin, SynFuturesV3 } from '../core';
import { ObserverInterface } from './observer.interface';
import { ObserverModule } from './observer.module';

export interface ObserverPlugin {
    observer: ObserverInterface;
}

export function observerPlugin<T extends SynFuturesV3>(): SynFutureV3Plugin<T, ObserverPlugin> {
    return {
        install(synfV3: T): T & ObserverPlugin {
            (synfV3 as any).observer = new ObserverModule(synfV3 as any);
            return synfV3 as any as T & ObserverPlugin;
        },
    };
}
