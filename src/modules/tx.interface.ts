import * as ethers from 'ethers';
import { InterfaceImplementationMissingError } from '../errors/interfaceImplementationMissing.error';
import { BaseInterFace } from './index';

export interface TxInterface extends BaseInterFace {
    /**
     * Send transaction
     * @param signer custom signer,can change it in this method whatever you want
     * @param rawTx the raw transaction(unsigned transaction)
     */
    sendTx(
        signer: ethers.Signer,
        rawTx: ethers.PopulatedTransaction | Promise<ethers.PopulatedTransaction>,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;
}

export function createNullTransactionModule(): TxInterface {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const errorHandler = () => {
        throw new InterfaceImplementationMissingError('TxInterface', 'tx');
    };
    return {
        synfV3: null as never,
        sendTx: errorHandler,
    };
}
