import { TxInterface } from './tx.interface';
import { PopulatedTransaction, Signer } from 'ethers';
import { SynFuturesV3Ctx } from '../synfuturesV3Core';
import * as ethers from 'ethers';

export class TxModule implements TxInterface {
    synfV3: SynFuturesV3Ctx;

    constructor(synfV3: SynFuturesV3Ctx) {
        this.synfV3 = synfV3;
    }

    async sendTx(
        signer: Signer,
        rawTx: PopulatedTransaction | Promise<PopulatedTransaction>,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        return await this.synfV3.cache.ctx.sendTx(signer, rawTx);
    }
}
