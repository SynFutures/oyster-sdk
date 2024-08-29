/* eslint-disable @typescript-eslint/no-explicit-any */
import { SynFutureV3Plugin, SynFuturesV3 } from '../../core';
import { TradeInterface } from './trade.interface';
import { TradeModule } from './trade.module';

export interface TradePlugin {
    trade: TradeInterface;
}

export function TradePlugin<T extends SynFuturesV3>(): SynFutureV3Plugin<T, TradePlugin> {
    return {
        install(synfV3: T): T & TradePlugin {
            (synfV3 as any).earn = new TradeModule(synfV3 as any);
            return synfV3 as any as T & TradePlugin;
        },
    };
}
