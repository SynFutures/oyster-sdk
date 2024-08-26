/* eslint-disable @typescript-eslint/no-explicit-any */
import { SynFutureV3Plugin, SynFuturesV3 } from '../core';
import { InstrumentInterface } from './instrument.interface';
import { InstrumentModule } from './instrument.module';

export interface InstrumentPlugin {
    instrument: InstrumentInterface;
}

export function instrumentPlugin<T extends SynFuturesV3>(): SynFutureV3Plugin<T, InstrumentPlugin> {
    return {
        install(synfV3: T): T & InstrumentPlugin {
            (synfV3 as any).instrument = new InstrumentModule(synfV3 as any);
            return synfV3 as any as T & InstrumentPlugin;
        },
    };
}
