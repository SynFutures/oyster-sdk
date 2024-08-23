import { InverseInterface } from './inverse.interface';
import { SynFuturesV3Ctx } from '../synfuturesV3Core';
import { InstrumentInfo } from '../types';

export class InverseModule implements InverseInterface {
    synfV3: SynFuturesV3Ctx;

    constructor(synfV3: SynFuturesV3Ctx) {
        this.synfV3 = synfV3;
    }

    async getInstrumentInfo(instrumentAddress: string): Promise<InstrumentInfo> {
        if (!this.synfV3.cache.instrumentMap.has(instrumentAddress.toLowerCase())) {
            await this.synfV3.cache.initInstruments();
        }
        const instrument = this.synfV3.cache.instrumentMap.get(instrumentAddress.toLowerCase());
        if (!instrument) {
            throw new Error(`Invalid instrument`);
        }
        return instrument.wrap.info;
    }
}
