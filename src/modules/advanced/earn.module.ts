import { Combine } from '../../common';
import { SynFuturesV3 as SynFuturesV3Core } from '../../core';
import { InstrumentPlugin } from '../instrument.plugin';
import { SimulatePlugin } from '../simulate.plugin';
import { ObserverPlugin } from '../observer.plugin';
import { EarnInterface } from './earn.interface';

type SynFuturesV3 = Combine<[SynFuturesV3Core, InstrumentPlugin, SimulatePlugin, ObserverPlugin]>;

export class EarnModule implements EarnInterface {
    synfV3: SynFuturesV3;

    constructor(synfV3: SynFuturesV3) {
        this.synfV3 = synfV3;
    }
}
