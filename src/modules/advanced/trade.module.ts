import { Combine } from '../../common';
import { SynFuturesV3 as SynFuturesV3Core } from '../../core';
import { InstrumentPlugin } from '../instrument.plugin';
import { SimulatePlugin } from '../simulate.plugin';
import { ObserverPlugin } from '../observer.plugin';
import { TradeInterface } from './trade.interface';

type SynFuturesV3 = Combine<[SynFuturesV3Core, InstrumentPlugin, SimulatePlugin, ObserverPlugin]>;

export class TradeModule implements TradeInterface {
    synfV3: SynFuturesV3;

    constructor(synfV3: SynFuturesV3) {
        this.synfV3 = synfV3;
    }
}
