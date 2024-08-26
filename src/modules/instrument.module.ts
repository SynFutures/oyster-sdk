import { TokenInfo } from '@derivation-tech/web3-core';
import { SynFuturesV3Ctx } from '../synfuturesV3Core';
import {
    AddParam,
    AdjustParam,
    BatchPlaceParam,
    CancelParam,
    cexMarket,
    FillParam,
    InstrumentIdentifier,
    MarketType,
    PlaceParam,
    Quotation,
    RemoveParam,
    Side,
    signOfSide,
    TradeParam,
} from '../types';
import {
    encodeAddWithReferralParam,
    encodeAdjustWithReferralParam,
    encodeBatchPlaceWithReferralParam,
    encodeCancelParam,
    encodeFillParam,
    encodePlaceWithReferralParam,
    encodeRemoveParam,
    encodeTradeWithReferralParam,
    encodeTradeWithRiskParam,
    getTokenSymbol,
    InstrumentParser,
    normalizeTick,
    trimObj,
} from '../common';
import { BigNumber, ContractTransaction, ethers, Overrides, PayableOverrides, Signer } from 'ethers';
import { SdkError } from '../errors/sdk.error';
import { TickMath } from '../math';
import { DEFAULT_REFERRAL_CODE, MAX_CANCEL_ORDER_COUNT, PEARL_SPACING } from '../constants';
import { OrderModel, PairLevelAccountModel, PairModel, RangeModel } from '../models';
import { InstrumentInterface } from './instrument.interface';

export class InstrumentModule implements InstrumentInterface {
    synfV3: SynFuturesV3Ctx;

    constructor(synfV3: SynFuturesV3Ctx) {
        this.synfV3 = synfV3;
    }

    async computeInstrumentAddress(
        mType: string,
        base: string | TokenInfo,
        quote: string | TokenInfo,
    ): Promise<string> {
        const gateAddress = this.synfV3.cache.config.contractAddress.gate;
        const marketType = mType as MarketType;
        const beaconAddress = this.synfV3.cache.config.contractAddress.market[marketType]!.beacon;
        const instrumentProxyByteCode = this.synfV3.cache.config.instrumentProxyByteCode;
        let salt: string;

        const { baseSymbol, quoteSymbol } = getTokenSymbol(base, quote);
        let quoteAddress: string;
        try {
            quoteAddress =
                typeof quote !== 'string'
                    ? (quote as TokenInfo).address
                    : await this.synfV3.cache.ctx.getAddress(quoteSymbol);
        } catch {
            //todo beore fetch from graph
            throw new SdkError('Get quote address failed');
        }
        if (cexMarket(marketType)) {
            salt = ethers.utils.defaultAbiCoder.encode(
                ['string', 'string', 'address'],
                [marketType, baseSymbol, quoteAddress],
            );
        } else {
            //DEXV2
            const baseAddress =
                typeof base !== 'string'
                    ? (base as TokenInfo).address
                    : await this.synfV3.cache.ctx.getAddress(baseSymbol);
            salt = ethers.utils.defaultAbiCoder.encode(
                ['string', 'address', 'address'],
                [marketType, baseAddress, quoteAddress],
            );
        }

        return ethers.utils.getCreate2Address(
            gateAddress,
            ethers.utils.keccak256(salt),
            ethers.utils.keccak256(
                ethers.utils.solidityPack(
                    ['bytes', 'bytes32'],
                    [instrumentProxyByteCode, ethers.utils.hexZeroPad(beaconAddress, 32)],
                ),
            ),
        );
    }

    // leverage is wad, margin is wad
    async getOrderMarginByLeverage(
        instrumentAddr: string,
        expiry: number,
        tick: number,
        size: BigNumber,
        leverage: number,
    ): Promise<BigNumber> {
        const limit = TickMath.getWadAtTick(tick);
        const instrument = this.synfV3.cache.getInstrumentContract(instrumentAddr);
        const swapInfo = await instrument.callStatic.inquire(expiry, 0);
        const mark = swapInfo.mark;
        const anchor = mark.gt(limit) ? mark : limit;
        return anchor.mul(size.abs()).div(ethers.utils.parseEther(leverage.toString())).add(1);
    }

    async getTick(instrumentAddr: string, expiry: number): Promise<number> {
        const swapInfo = await this.inquire(instrumentAddr, expiry, BigNumber.from(0));
        return normalizeTick(swapInfo.tick, PEARL_SPACING);
    }

    async getSqrtFairPX96(instrumentAddr: string, expiry: number): Promise<BigNumber> {
        const swapInfo = await this.inquire(instrumentAddr, expiry, BigNumber.from(0));
        return swapInfo.sqrtFairPX96;
    }

    async inquire(instrumentAddr: string, expiry: number, size: BigNumber): Promise<Quotation> {
        const instrument = this.synfV3.cache.getInstrumentContract(instrumentAddr);
        return trimObj(await instrument.callStatic.inquire(expiry, size));
    }

    async add(
        signer: Signer,
        instrumentAddr: string,
        param: AddParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.cache.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.add(
            encodeAddWithReferralParam(param, referralCode),
            overrides ?? {},
        );
        return this.synfV3.tx.sendTx(signer, unsignedTx);
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
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
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
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
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

    async adjust(
        signer: Signer,
        instrumentAddr: string,
        param: AdjustParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.cache.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.trade(
            encodeAdjustWithReferralParam(param.expiry, param.net, param.deadline, referralCode),
            overrides ?? {},
        );
        return this.synfV3.tx.sendTx(signer, unsignedTx);
    }

    async adjustMargin(
        signer: Signer,
        pair: PairModel,
        transferIn: boolean,
        margin: BigNumber,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
        const sign: number = transferIn ? 1 : -1;
        const instrument = this.synfV3.cache.getInstrumentContract(pair.rootInstrument.info.addr, signer);

        const unsignedTx = await instrument.populateTransaction.trade(
            encodeAdjustWithReferralParam(pair.amm.expiry, margin.mul(sign), deadline, referralCode),
            overrides ?? {},
        );
        return this.synfV3.tx.sendTx(signer, unsignedTx);
    }

    async batchCancelOrder(
        signer: Signer,
        account: PairLevelAccountModel,
        ordersToCancel: OrderModel[],
        deadline: number,
        overrides?: PayableOverrides,
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
        const expiry = account.rootPair.amm.expiry;
        const instrument = this.synfV3.cache.getInstrumentContract(account.rootPair.rootInstrument.info.addr, signer);

        const ticks = ordersToCancel.map((order) => order.tick);

        if (ticks.length <= MAX_CANCEL_ORDER_COUNT) {
            const unsignedTx = await instrument.populateTransaction.cancel(
                encodeCancelParam(expiry, ticks, deadline),
                overrides ?? {},
            );
            return this.synfV3.tx.sendTx(signer, unsignedTx);
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
            return this.synfV3.tx.sendTx(signer, unsignedTx);
        }
    }

    async batchPlace(
        signer: Signer,
        instrumentAddr: string,
        params: BatchPlaceParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.cache.getInstrumentContract(instrumentAddr, signer);
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
        return this.synfV3.tx.sendTx(signer, unsignedTx);
    }

    async cancel(
        signer: Signer,
        instrumentAddr: string,
        param: CancelParam,
        overrides?: Overrides,
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.cache.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.cancel(
            encodeCancelParam(param.expiry, [param.tick], param.deadline),
            overrides ?? {},
        );
        return this.synfV3.tx.sendTx(signer, unsignedTx);
    }

    async donateInsuranceFund(
        signer: Signer,
        instrumentAddr: string,
        expiry: number,
        amount: BigNumber,
        overrides?: Overrides,
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.cache.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.donateInsuranceFund(expiry, amount, overrides ?? {});
        return this.synfV3.tx.sendTx(signer, unsignedTx);
    }

    async fill(
        signer: Signer,
        instrumentAddr: string,
        param: FillParam,
        overrides?: Overrides,
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.cache.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.fill(
            encodeFillParam(param.expiry, param.target, param.tick, param.nonce),
            overrides ?? {},
        );
        return this.synfV3.tx.sendTx(signer, unsignedTx);
    }

    async intuitiveTrade(
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
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
        if (side === Side.FLAT) {
            throw new Error('Invalid Price');
        }
        const sign = signOfSide(side);
        const limitTick = TickMath.getLimitTick(tradePrice, slippage, side);
        const param: TradeParam = {
            expiry: pair.amm.expiry,
            size: base.mul(sign),
            amount: margin,
            limitTick: limitTick,
            deadline: deadline,
        };
        return this.trade(signer, pair.rootInstrument.info.addr, param, overrides, referralCode);
    }

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
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
        const currentTick = pair.amm.tick;
        const isLong = tickNumber < currentTick;
        if (currentTick === tickNumber) throw new Error('Invalid price');
        if (isLong !== (side === Side.LONG)) throw new Error('Invalid price');
        const sign = isLong ? 1 : -1;
        const param: PlaceParam = {
            expiry: pair.amm.expiry,
            size: baseWad.mul(sign),
            amount: balanceWad,
            tick: tickNumber,
            deadline: deadline,
        };
        return this.place(signer, pair.rootInstrument.info.addr, param, overrides, referralCode);
    }

    async place(
        signer: Signer,
        instrumentAddr: string,
        param: PlaceParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.cache.getInstrumentContract(instrumentAddr, signer);
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
        return this.synfV3.tx.sendTx(signer, unsignedTx);
    }

    async remove(
        signer: Signer,
        instrumentAddr: string,
        param: RemoveParam,
        overrides?: Overrides,
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.cache.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.remove(encodeRemoveParam(param), overrides ?? {});
        return this.synfV3.tx.sendTx(signer, unsignedTx);
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
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
        const param = {
            expiry: pairModel.amm.expiry,
            target: targetAddress,
            tickLower: rangeModel.tickLower,
            tickUpper: rangeModel.tickUpper,
            limitTicks: TickMath.encodeLimitTicks(sqrtStrikeLowerPX96, sqrtStrikeUpperPX96),
            deadline: deadline,
        };
        return this.remove(signer, pairModel.rootInstrument.info.addr, param, overrides);
    }

    async trade(
        signer: Signer,
        instrumentAddr: string,
        param: TradeParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.cache.getInstrumentContract(instrumentAddr, signer);
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
        return this.synfV3.tx.sendTx(signer, unsignedTx);
    }

    async tradeWithRisk(
        signer: Signer,
        instrumentAddr: string,
        param: TradeParam,
        limitStabilityFeeRatio: number,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.synfV3.cache.getInstrumentContract(instrumentAddr, signer);
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
        return this.synfV3.tx.sendTx(signer, unsignedTx);
    }

    private async _addLiquidity(
        signer: Signer,
        addParam: AddParam,
        instrumentIdentifier: InstrumentIdentifier,
        referralCode: string,
        overrides?: PayableOverrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrumentAddress = await this.computeInstrumentAddress(
            instrumentIdentifier.marketType,
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        let unsignedTx;
        const gate = this.synfV3.cache.contracts.gate.connect(signer);
        const indexOfInstrument = await gate.indexOf(instrumentAddress);
        if (BigNumber.from(indexOfInstrument).isZero()) {
            this.synfV3.cache.ctx.registerContractParser(instrumentAddress, new InstrumentParser());
            this.synfV3.cache.ctx.registerAddress(
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
                await this.synfV3.cache.computeInitData(instrumentIdentifier),
                encodeAddWithReferralParam(addParam, referralCode),
                overrides ?? {},
            );
            return this.synfV3.tx.sendTx(signer, unsignedTx);
        } else {
            return this.add(signer, instrumentAddress, addParam, overrides, referralCode);
        }
    }
}
