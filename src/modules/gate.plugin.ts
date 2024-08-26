/* eslint-disable @typescript-eslint/no-explicit-any */
import { SynFutureV3Plugin, SynFuturesV3 } from '../core';
import { GateInterface } from './gate.interface';
import { GateModule } from './gate.module';

export interface GatePlugin {
    gate: GateInterface;
}

export function gatePlugin<T extends SynFuturesV3>(): SynFutureV3Plugin<T, GatePlugin> {
    return {
        install(synfV3: T): T & GatePlugin {
            (synfV3 as any).gate = new GateModule(synfV3 as any);
            return synfV3 as any as T & GatePlugin;
        },
    };
}
