/* eslint-disable @typescript-eslint/no-explicit-any */
import { SynFutureV3Plugin, SynFuturesV3 } from '../core';
import { SimulateInterface } from './simulate.interface';
import { SimulateModule } from './simulate.module';

export interface SimulatePlugin {
    simulate: SimulateInterface;
}

export function simulatePlugin<T extends SynFuturesV3>(): SynFutureV3Plugin<T, SimulatePlugin> {
    return {
        install(synfV3: T): T & SimulatePlugin {
            (synfV3 as any).simulate = new SimulateModule(synfV3 as any);
            return synfV3 as any as T & SimulatePlugin;
        },
    };
}
