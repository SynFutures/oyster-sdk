import { BigNumber, CallOverrides, ContractTransaction, ethers, Overrides, Signer } from 'ethers';
import { encodeDepositParam, encodeWithdrawParam } from '../common';
import { SynFuturesV3 as SynFuturesV3Core } from '../core';
import { NATIVE_TOKEN_ADDRESS } from '../constants';
import { NumericConverter } from '../types';
import { GateInterface } from './gate.interface';
import { CachePlugin } from './cache.plugin';

type SynFuturesV3 = SynFuturesV3Core & CachePlugin;

export class GateModule implements GateInterface {
    synfV3: SynFuturesV3;

    constructor(synfV3: SynFuturesV3) {
        this.synfV3 = synfV3;
    }

    async deposit(
        signer: Signer,
        quoteAddr: string,
        amount: BigNumber,
        overrides?: Overrides,
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
        const unsignedTx = await this.synfV3.cache.contracts.gate.populateTransaction.deposit(
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
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
        const unsignedTx = await this.synfV3.cache.contracts.gate.populateTransaction.withdraw(
            encodeWithdrawParam(quoteAddr, amount),
            overrides ?? {},
        );
        return this.synfV3.ctx.sendTx(signer, unsignedTx);
    }

    async gateOperation(
        signer: Signer,
        quoteAddress: string,
        amountWad: BigNumber,
        deposit: boolean,
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
        const gate = this.synfV3.cache.contracts.gate;
        const usingNative = quoteAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
        const quoteInfo = usingNative
            ? this.synfV3.ctx.wrappedNativeToken
            : await this.synfV3.ctx.getTokenInfo(quoteAddress);
        const decimals = quoteInfo.decimals;
        const amount = NumericConverter.toContractQuoteAmount(amountWad, decimals);
        let unsignedTx;
        if (deposit) {
            const overrides = usingNative ? { value: amount } : {};
            unsignedTx = await gate.populateTransaction.deposit(encodeDepositParam(quoteAddress, amount), overrides);
        } else {
            unsignedTx = await gate.populateTransaction.withdraw(encodeWithdrawParam(quoteAddress, amount));
        }

        return this.synfV3.ctx.sendTx(signer, unsignedTx);
    }

    async getPendingParams(
        quotes: string[],
        overrides?: CallOverrides,
    ): Promise<{
        pendingDuration: BigNumber;
        thresholds: BigNumber[];
    }> {
        const gateInterface = this.synfV3.cache.contracts.gate.interface;
        const calls = quotes.map((quote) => {
            return {
                target: this.synfV3.cache.contracts.gate.address,
                callData: gateInterface.encodeFunctionData('thresholdOf', [quote]),
            };
        });
        calls.push({
            target: this.synfV3.cache.contracts.gate.address,
            callData: gateInterface.encodeFunctionData('pendingDuration'),
        });
        const rawRet = (await this.synfV3.ctx.getMulticall3().callStatic.aggregate(calls, overrides ?? {})).returnData;
        const thresholds = rawRet
            .slice(0, quotes.length)
            .map((ret) => gateInterface.decodeFunctionResult('thresholdOf', ret)[0] as BigNumber);
        const pendingDuration = gateInterface.decodeFunctionResult(
            'pendingDuration',
            rawRet[quotes.length],
        )[0] as BigNumber;
        return { pendingDuration, thresholds };
    }
}
