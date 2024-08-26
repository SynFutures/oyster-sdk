import { TxInterface } from './tx.interface';
import { PopulatedTransaction, Signer } from 'ethers';
import { SynFuturesV3 } from '../core';
import * as ethers from 'ethers';

export class TxModule implements TxInterface {
    synfV3: SynFuturesV3;

    constructor(synfV3: SynFuturesV3) {
        this.synfV3 = synfV3;
    }

    async sendTx(
        signer: Signer,
        rawTx: PopulatedTransaction | Promise<PopulatedTransaction>,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        return await this.synfV3.ctx.sendTx(signer, rawTx);
    }
}
