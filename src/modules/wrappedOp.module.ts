import { SynFuturesV3 } from '../synfuturesV3Core';
import { BigNumber, ethers, PayableOverrides, Signer } from 'ethers';
import { AddParam, InstrumentIdentifier, NumericConverter, Side, signOfSide } from '../types';
import { DEFAULT_REFERRAL_CODE, MAX_CANCEL_ORDER_COUNT, NATIVE_TOKEN_ADDRESS } from '../constants';
import { TickMath } from '../math';
import {
    encodeAddWithReferralParam,
    encodeAdjustWithReferralParam,
    encodeCancelParam,
    encodeDepositParam,
    encodePlaceWithReferralParam,
    encodeRemoveParam,
    encodeTradeWithReferralParam,
    encodeWithdrawParam,
    InstrumentParser,
} from '../common';
import { OrderModel, PairLevelAccountModel, PairModel, RangeModel } from '../models';
import type { Module } from '../common';

export class WrappedOpModule implements Module {
    synfV3: SynFuturesV3;

    constructor(synfV3: SynFuturesV3) {
        this.synfV3 = synfV3;
    }

    public async intuitiveTrade(
        signer: Signer,
        pair: PairModel,
        side: Side,
        base: BigNumber,
        margin: BigNumber,
        tradePrice: BigNumber,
        slippage: number,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        if (side === Side.FLAT) {
            throw new Error('Invalid Price');
        }
        const sign = signOfSide(side);
        const limitTick = TickMath.getLimitTick(tradePrice, slippage, side);
        const instrument = this.synfV3.instrumentModule.getInstrumentContract(pair.rootInstrument.info.addr, signer);

        const unsignedTx = await instrument.populateTransaction.trade(
            encodeTradeWithReferralParam(pair.amm.expiry, base.mul(sign), margin, limitTick, deadline, referralCode),
            overrides ?? {},
        );
        return this.synfV3.ctx.sendTx(signer, unsignedTx);
    }

    // @param margin: decimal 18 units, always positive
    // @param transferIn: true if transferIn, false if transferOut
    public async adjustMargin(
        signer: Signer,
        pair: PairModel,
        transferIn: boolean,
        margin: BigNumber,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const sign: number = transferIn ? 1 : -1;
        const instrument = this.synfV3.instrumentModule.getInstrumentContract(pair.rootInstrument.info.addr, signer);

        const unsignedTx = await instrument.populateTransaction.trade(
            encodeAdjustWithReferralParam(pair.amm.expiry, margin.mul(sign), deadline, referralCode),
            overrides ?? {},
        );
        return this.synfV3.ctx.sendTx(signer, unsignedTx);
    }

    // @param baseAmount: decimal 18 units, always positive for both long or short. e.g. 3e18 means 3 BASE
    // @param takeProfitRatio: 0 ~ 10000. e.g. 500 means 5%
    // @param stopLossRatio: same as takeProfitRatio
    async limitOrder(
        signer: Signer,
        pair: PairModel,
        tickNumber: number,
        baseWad: BigNumber,
        balanceWad: BigNumber,
        side: Side,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const currentTick = pair.amm.tick;
        const isLong = tickNumber < currentTick;
        if (currentTick === tickNumber) throw new Error('Invalid price');
        if (isLong !== (side === Side.LONG)) throw new Error('Invalid price');
        const sign = isLong ? 1 : -1;
        const instrument = this.synfV3.instrumentModule.getInstrumentContract(pair.rootInstrument.info.addr, signer);

        const unsignedTx = await instrument.populateTransaction.place(
            encodePlaceWithReferralParam(
                pair.amm.expiry,
                baseWad.mul(sign),
                balanceWad,
                tickNumber,
                deadline,
                referralCode,
            ),
            overrides ?? {},
        );
        return this.synfV3.ctx.sendTx(signer, unsignedTx);
    }

    async addLiquidityWithAsymmetricRange(
        signer: Signer,
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
        tickDeltaLower: number,
        tickDeltaUpper: number,
        marginWad: BigNumber,
        sqrtStrikeLowerPX96: BigNumber,
        sqrtStrikeUpperPX96: BigNumber,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const addParam = {
            expiry: expiry,
            tickDeltaLower: tickDeltaLower,
            tickDeltaUpper: tickDeltaUpper,
            amount: marginWad,
            limitTicks: TickMath.encodeLimitTicks(sqrtStrikeLowerPX96, sqrtStrikeUpperPX96),
            deadline: deadline,
        } as AddParam;
        return this._addLiquidity(signer, addParam, instrumentIdentifier, referralCode, overrides);
    }

    async addLiquidity(
        signer: Signer,
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
        tickDelta: number,
        marginWad: BigNumber,
        sqrtStrikeLowerPX96: BigNumber,
        sqrtStrikeUpperPX96: BigNumber,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const addParam = {
            expiry: expiry,
            tickDeltaLower: 0, // 0 means same as tickDeltaUpper
            tickDeltaUpper: tickDelta,
            amount: marginWad,
            limitTicks: TickMath.encodeLimitTicks(sqrtStrikeLowerPX96, sqrtStrikeUpperPX96),
            deadline: deadline,
        } as AddParam;
        return this._addLiquidity(signer, addParam, instrumentIdentifier, referralCode, overrides);
    }

    async _addLiquidity(
        signer: Signer,
        addParam: AddParam,
        instrumentIdentifier: InstrumentIdentifier,
        referralCode: string,
        overrides?: PayableOverrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrumentAddress = await this.synfV3.instrumentModule.computeInstrumentAddress(
            instrumentIdentifier.marketType,
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        let unsignedTx;
        const gate = this.synfV3.contracts.gate.connect(signer);
        const indexOfInstrument = await gate.indexOf(instrumentAddress);
        if (BigNumber.from(indexOfInstrument).isZero()) {
            this.synfV3.ctx.registerContractParser(instrumentAddress, new InstrumentParser());
            this.synfV3.ctx.registerAddress(
                instrumentAddress,
                instrumentIdentifier.baseSymbol +
                    '-' +
                    instrumentIdentifier.quoteSymbol +
                    '-' +
                    instrumentIdentifier.marketType,
            );
            // need to create instrument
            unsignedTx = await gate.populateTransaction.launch(
                instrumentIdentifier.marketType,
                instrumentAddress,
                await this.synfV3.computeInitData(instrumentIdentifier),
                encodeAddWithReferralParam(addParam, referralCode),
                overrides ?? {},
            );
        } else {
            const instrument = this.synfV3.instrumentModule.getInstrumentContract(instrumentAddress, signer);
            unsignedTx = await instrument.populateTransaction.add(
                encodeAddWithReferralParam(addParam, referralCode),
                overrides ?? {},
            );
        }

        return this.synfV3.ctx.sendTx(signer, unsignedTx);
    }

    async removeLiquidity(
        signer: Signer,
        pairModel: PairModel,
        targetAddress: string,
        rangeModel: RangeModel,
        sqrtStrikeLowerPX96: BigNumber,
        sqrtStrikeUpperPX96: BigNumber,
        deadline: number,
        overrides?: PayableOverrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.instrumentModule.getInstrumentContract(
            pairModel.rootInstrument.info.addr,
            signer,
        );

        const calldata = [];
        calldata.push(
            instrument.interface.encodeFunctionData('remove', [
                encodeRemoveParam({
                    expiry: pairModel.amm.expiry,
                    target: targetAddress,
                    tickLower: rangeModel.tickLower,
                    tickUpper: rangeModel.tickUpper,
                    limitTicks: TickMath.encodeLimitTicks(sqrtStrikeLowerPX96, sqrtStrikeUpperPX96),
                    deadline: deadline,
                }),
            ]),
        );
        const unsignedTx = await instrument.populateTransaction.remove(
            encodeRemoveParam({
                expiry: pairModel.amm.expiry,
                target: targetAddress,
                tickLower: rangeModel.tickLower,
                tickUpper: rangeModel.tickUpper,
                limitTicks: TickMath.encodeLimitTicks(sqrtStrikeLowerPX96, sqrtStrikeUpperPX96),
                deadline: deadline,
            }),
            overrides ?? {},
        );
        return this.synfV3.ctx.sendTx(signer, unsignedTx);
    }

    public async batchCancelOrder(
        signer: Signer,
        account: PairLevelAccountModel,
        ordersToCancel: OrderModel[],
        deadline: number,
        overrides?: PayableOverrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const expiry = account.rootPair.amm.expiry;
        const instrument = this.synfV3.instrumentModule.getInstrumentContract(
            account.rootPair.rootInstrument.info.addr,
            signer,
        );

        const ticks = ordersToCancel.map((order) => order.tick);

        if (ticks.length <= MAX_CANCEL_ORDER_COUNT) {
            const unsignedTx = await instrument.populateTransaction.cancel(
                encodeCancelParam(expiry, ticks, deadline),
                overrides ?? {},
            );
            return this.synfV3.ctx.sendTx(signer, unsignedTx);
        } else {
            // split ticks by size of MAX_CANCEL_ORDER_COUNT
            const tickGroups = [];
            for (let i = 0; i < ticks.length; i += MAX_CANCEL_ORDER_COUNT) {
                tickGroups.push(ticks.slice(i, i + MAX_CANCEL_ORDER_COUNT));
            }
            const calldatas = tickGroups.map((group) => {
                return instrument.interface.encodeFunctionData('cancel', [encodeCancelParam(expiry, group, deadline)]);
            });
            const unsignedTx = await instrument.populateTransaction.multicall(calldatas, overrides ?? {});
            return this.synfV3.ctx.sendTx(signer, unsignedTx);
        }
    }

    public async gateOperation(
        signer: Signer,
        quoteAddress: string,
        amountWad: BigNumber,
        deposit: boolean,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const gate = this.synfV3.contracts.gate;
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
}
