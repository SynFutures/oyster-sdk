import { CallOverrides } from 'ethers';
import { BaseInterface } from '../types';
import { InterfaceImplementationMissingError } from '../errors/interfaceImplementationMissing.error';

export interface ConfigInterface extends BaseInterface {
    /**
     *Open Lp
     * @param quoteAddr the quote address
     * @param overrides overrides with ethers types
     */
    openLp(quoteAddr?: string, overrides?: CallOverrides): Promise<boolean>;

    /**
     *Is in white list lp
     * @param quoteAddr the quote address
     * @param traders the trader address list
     * @param overrides overrides with ethers types
     */
    inWhiteListLps(quoteAddr: string, traders: string[], overrides?: CallOverrides): Promise<boolean[]>;
}

export function createNullConfigModule(): ConfigInterface {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const errorHandler = () => {
        throw new InterfaceImplementationMissingError('ConfigInterface', 'config');
    };
    return {
        synfV3: null as never,
        openLp: errorHandler,
        inWhiteListLps: errorHandler,
    };
}
