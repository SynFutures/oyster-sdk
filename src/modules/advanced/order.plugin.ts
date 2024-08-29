/* eslint-disable @typescript-eslint/no-explicit-any */
import { SynFutureV3Plugin, SynFuturesV3 } from '../../core';
import { OrderInterface } from './order.interface';
import { OrderModule } from './order.module';

export interface OrderPlugin {
    order: OrderInterface;
}

export function orderPlugin<T extends SynFuturesV3>(): SynFutureV3Plugin<T, OrderPlugin> {
    return {
        install(synfV3: T): T & OrderPlugin {
            (synfV3 as any).order = new OrderModule(synfV3 as any);
            return synfV3 as any as T & OrderPlugin;
        },
    };
}
