import { SynFuturesV3 } from '../synfuturesV3Core';
import { BigNumber, ethers, Overrides, Signer } from 'ethers';
import {
    encodeAddWithReferralParam,
    encodeAdjustWithReferralParam,
    encodeBatchPlaceWithReferralParam,
    encodeCancelParam,
    encodeDepositParam,
    encodeFillParam,
    encodePlaceWithReferralParam,
    encodeRemoveParam,
    encodeTradeWithReferralParam,
    encodeTradeWithRiskParam,
    encodeWithdrawParam,
} from '../common';
import {
    AddParam,
    AdjustParam,
    BatchPlaceParam,
    CancelParam,
    FillParam,
    PlaceParam,
    RemoveParam,
    TradeParam,
} from '../types';
import { DEFAULT_REFERRAL_CODE } from '../constants';

export class OpModule {
    synfV3: SynFuturesV3;

    constructor(synfV3: SynFuturesV3) {
        this.synfV3 = synfV3;
    }

    async deposit(
        signer: Signer,
        quoteAddr: string,
        amount: BigNumber,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const unsignedTx = await this.synfV3.contracts.gate.populateTransaction.deposit(
            encodeDepositParam(quoteAddr, amount),
            overrides ?? {},
        );
        return this.synfV3.ctx.sendTx(signer, unsignedTx);
    }

    async withdraw(
        signer: Signer,
        quoteAddr: string,
        amount: BigNumber,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const unsignedTx = await this.synfV3.contracts.gate.populateTransaction.withdraw(
            encodeWithdrawParam(quoteAddr, amount),
            overrides ?? {},
        );
        return this.synfV3.ctx.sendTx(signer, unsignedTx);
    }

    async adjust(
        signer: Signer,
        instrumentAddr: string,
        param: AdjustParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.instrumentModule.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.trade(
            encodeAdjustWithReferralParam(param.expiry, param.net, param.deadline, referralCode),
            overrides ?? {},
        );
        return this.synfV3.ctx.sendTx(signer, unsignedTx);
    }

    async add(
        signer: Signer,
        instrumentAddr: string,
        param: AddParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.instrumentModule.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.add(
            encodeAddWithReferralParam(param, referralCode),
            overrides ?? {},
        );
        return this.synfV3.ctx.sendTx(signer, unsignedTx);
    }

    async remove(
        signer: Signer,
        instrumentAddr: string,
        param: RemoveParam,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.instrumentModule.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.remove(encodeRemoveParam(param), overrides ?? {});
        return this.synfV3.ctx.sendTx(signer, unsignedTx);
    }

    async trade(
        signer: Signer,
        instrumentAddr: string,
        param: TradeParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.instrumentModule.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.trade(
            encodeTradeWithReferralParam(
                param.expiry,
                param.size,
                param.amount,
                param.limitTick,
                param.deadline,
                referralCode,
            ),
            overrides ?? {},
        );
        return this.synfV3.ctx.sendTx(signer, unsignedTx);
    }

    // WARNING: this function is not recommended to use, because it may cause penalty fee during trade
    async tradeWithRisk(
        signer: Signer,
        instrumentAddr: string,
        param: TradeParam,
        limitStabilityFeeRatio: number,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.instrumentModule.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.trade(
            encodeTradeWithRiskParam(
                param.expiry,
                param.size,
                param.amount,
                param.limitTick,
                param.deadline,
                limitStabilityFeeRatio,
                referralCode,
            ),
            overrides ?? {},
        );
        return this.synfV3.ctx.sendTx(signer, unsignedTx);
    }

    async place(
        signer: Signer,
        instrumentAddr: string,
        param: PlaceParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.instrumentModule.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.place(
            encodePlaceWithReferralParam(
                param.expiry,
                param.size,
                param.amount,
                param.tick,
                param.deadline,
                referralCode,
            ),
            overrides ?? {},
        );
        return this.synfV3.ctx.sendTx(signer, unsignedTx);
    }

    async batchPlace(
        signer: Signer,
        instrumentAddr: string,
        params: BatchPlaceParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.instrumentModule.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.batchPlace(
            encodeBatchPlaceWithReferralParam(
                params.expiry,
                params.size,
                params.leverage,
                params.ticks,
                params.ratios,
                params.deadline,
                referralCode,
            ),
            overrides ?? {},
        );
        return this.synfV3.ctx.sendTx(signer, unsignedTx);
    }

    async fill(
        signer: Signer,
        instrumentAddr: string,
        param: FillParam,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.instrumentModule.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.fill(
            encodeFillParam(param.expiry, param.target, param.tick, param.nonce),
            overrides ?? {},
        );
        return this.synfV3.ctx.sendTx(signer, unsignedTx);
    }

    async cancel(
        signer: Signer,
        instrumentAddr: string,
        param: CancelParam,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.instrumentModule.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.cancel(
            encodeCancelParam(param.expiry, [param.tick], param.deadline),
            overrides ?? {},
        );
        return this.synfV3.ctx.sendTx(signer, unsignedTx);
    }

    async donateInsuranceFund(
        signer: Signer,
        instrumentAddr: string,
        expiry: number,
        amount: BigNumber,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.instrumentModule.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.donateInsuranceFund(expiry, amount, overrides ?? {});
        return this.synfV3.ctx.sendTx(signer, unsignedTx);
    }
}
