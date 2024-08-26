import * as ethers from 'ethers';
import { BaseInterface } from '../common';

export interface TxInterface extends BaseInterface {
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
