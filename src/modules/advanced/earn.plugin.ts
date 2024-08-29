/* eslint-disable @typescript-eslint/no-explicit-any */
import { SynFutureV3Plugin, SynFuturesV3 } from '../../core';
import { EarnInterface } from './earn.interface';
import { EarnModule } from './earn.module';

export interface EarnPlugin {
    earn: EarnInterface;
}

export function earnPlugin<T extends SynFuturesV3>(): SynFutureV3Plugin<T, EarnPlugin> {
    return {
        install(synfV3: T): T & EarnPlugin {
            (synfV3 as any).earn = new EarnModule(synfV3 as any);
            return synfV3 as any as T & EarnPlugin;
        },
    };
}
