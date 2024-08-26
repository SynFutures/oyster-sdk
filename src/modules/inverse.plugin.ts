/* eslint-disable @typescript-eslint/no-explicit-any */
import { SynFutureV3Plugin, SynFuturesV3 } from '../core';
import { InverseInterface } from './inverse.interface';
import { InverseModule } from './inverse.module';

export interface InversePlugin {
    inverse: InverseInterface;
}

export function inversePlugin<T extends SynFuturesV3>(): SynFutureV3Plugin<T, InversePlugin> {
    return {
        install(synfV3: T): T & InversePlugin {
            (synfV3 as any).inverse = new InverseModule(synfV3 as any);
            return synfV3 as any as T & InversePlugin;
        },
    };
}
