import { BaseInterFace } from './index';
import { InterfaceImplementationMissingError } from '../errors/interfaceImplementationMissing.error';
import { InstrumentInfo } from '../types';

export interface InverseInterface extends BaseInterFace {
    /**
     *Get instrument info from cache and should inverse
     * @param instrumentAddress
     */
    getInstrumentInfo(instrumentAddress: string): Promise<InstrumentInfo>;
}

export function createNullInverseModule(): InverseInterface {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const errorHandler = () => {
        throw new InterfaceImplementationMissingError('InverseInterface', 'inverse');
    };
    return {
        synfV3: null as never,
        getInstrumentInfo: errorHandler,
    };
}
