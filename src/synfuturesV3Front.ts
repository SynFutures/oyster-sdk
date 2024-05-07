import { BigNumber, Overrides, PayableOverrides, Signer, ethers } from 'ethers';
import { SynFuturesV3 } from './synfuturesV3Core';
import { ChainContext, CHAIN_ID } from '@derivation-tech/web3-core';
import { Q96, TickMath, WAD, r2w, wadToSqrtX96, wmul } from './math';
import { AddParam, InstrumentIdentifier, PairModel, PlaceParam, Side, TradeParam, signOfSide } from './types';
import { INITIAL_MARGIN_RATIO } from './constants';
import { formatEther, parseEther } from 'ethers/lib/utils';
import { encodeAddWithReferralParam, encodePlaceWithReferralParam, encodeTradeWithReferralParam } from './common/util';
import { InstrumentParser } from './common/parser';

export class SynFuturesV3Front {
    private static instances = new Map<number, SynFuturesV3Front>();
    core: SynFuturesV3;
    THREE_WAD: BigNumber = parseEther('3');
    TWO_WAD: BigNumber = parseEther('2');

    get ctx(): ChainContext {
        return this.core.ctx;
    }

    protected constructor(core: SynFuturesV3) {
        this.core = core;
    }
    public static getInstance(chanIdOrName: CHAIN_ID | string): SynFuturesV3Front {
        const chainId = ChainContext.getChainInfo(chanIdOrName).chainId;
        let instance = SynFuturesV3Front.instances.get(chainId);
        if (!instance) {
            const core = SynFuturesV3.getInstance(chainId);
            instance = new SynFuturesV3Front(core);
            SynFuturesV3Front.instances.set(chainId, instance);
        }
        return instance;
    }

    async init(): Promise<void> {
        await this.core.initInstruments();
    }

    capAlphaWad(alphaWad: BigNumber): BigNumber {
        return alphaWad.gt(this.TWO_WAD) ? this.TWO_WAD : alphaWad;
    }

    // @param alphaWad: decimal 18 units 1.3e18 means 1.3
    // @param liquidity: can get from simulateAddLiquidity
    // @param accountBoost : 10000 means 1
    // @param poolFactor : 10000 means 1
    // @param quotePriceWad : 1e18 means price 1 usd
    public async simulateRangePointPerDay(
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
        alphaWad: BigNumber,
        liquidity: BigNumber,
        balance: BigNumber,
        accountBoost: number,
        poolFactor: number,
        quotePriceWad: BigNumber,
        isStable = false,
    ): Promise<BigNumber> {
        const instrumentAddress = await this.core.computeInstrumentAddress(
            instrumentIdentifier.marketType,
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        const instrument = this.core.instrumentMap.get(instrumentAddress.toLowerCase());
        let initialMarginRatio;
        let currentSqrtPX96;
        if (!instrument || !instrument.state.pairStates.has(expiry)) {
            if (instrument) {
                initialMarginRatio = instrument.setting.initialMarginRatio;
            } else {
                initialMarginRatio = INITIAL_MARGIN_RATIO;
            }
            const benchmarkPrice = await this.core.simulateBenchmarkPrice(instrumentIdentifier, expiry);
            currentSqrtPX96 = wadToSqrtX96(benchmarkPrice);
        } else {
            initialMarginRatio = instrument.setting.initialMarginRatio;
            currentSqrtPX96 = instrument.getPairModel(expiry).amm.sqrtPX96;
        }
        // liquidity = sqrt(vx * vy) = sqrt(vx * vy)  = sqrt(vy*vy/ entryPrice)
        // liquidity = vy/ sqrt(entryPrice)
        // vy = liquidity * sqrt(entryPrice) = liquidity * sqrtPriceX96 / 2^96
        const vy = liquidity.mul(currentSqrtPX96).div(Q96);
        // we can directly use wad here, because mul then div will not change the value
        let pointPower = BigNumber.from(0);
        if (initialMarginRatio === 100 || isStable) {
            // 100x leverage pair use simple formula
            pointPower = balance.div(86400).div(365);
        } else {
            pointPower = vy
                .mul(2)
                .mul(r2w(initialMarginRatio))
                .div(this.capAlphaWad(alphaWad).sub(WAD))
                .div(86400)
                .div(365);
        }

        console.log(
            'rangeDetails: alpha',
            formatEther(alphaWad),
            ', balance',
            formatEther(balance),
            ', virtual_y',
            formatEther(vy),
            ', pointPower',
            formatEther(pointPower),
        );
        let pointPerDay = pointPower.mul(86400);
        pointPerDay = wmul(pointPerDay, r2w(accountBoost));
        pointPerDay = wmul(pointPerDay, r2w(poolFactor));
        pointPerDay = wmul(pointPerDay, quotePriceWad);
        return pointPerDay;
    }

    // @param accountBoost : 10000 means 1
    // @param poolFactor : 10000 means 1
    // @param quotePriceWad : 1e18 means price 1 usd
    public async simulateOrderPointPerDay(
        targetTick: number,
        baseSize: BigNumber,
        accountBoost: number,
        poolFactor: number,
        quotePriceWad: BigNumber,
    ): Promise<BigNumber> {
        const pointPower = wmul(TickMath.getWadAtTick(targetTick), baseSize.abs()).div(86400).div(365);
        console.log(
            'orderDetails: price',
            formatEther(TickMath.getWadAtTick(targetTick)),
            'baseSize',
            formatEther(baseSize),
            ' pointPower',
            formatEther(pointPower),
        );
        let pointPerDay = pointPower.mul(86400); // 1 day
        pointPerDay = wmul(pointPerDay, r2w(accountBoost));
        pointPerDay = wmul(pointPerDay, r2w(poolFactor));
        pointPerDay = wmul(pointPerDay, quotePriceWad);
        return pointPerDay;
    }

    async tradeWithReferral(
        signer: Signer,
        instrumentAddr: string,
        param: TradeParam,
        referralCode: string,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.core.getInstrumentContract(instrumentAddr, signer);
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
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async addWithReferral(
        signer: Signer,
        instrumentAddr: string,
        param: AddParam,
        referralCode: string,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.core.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.add(
            encodeAddWithReferralParam(param, referralCode),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async placeWithReferral(
        signer: Signer,
        instrumentAddr: string,
        param: PlaceParam,
        referralCode: string,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.core.getInstrumentContract(instrumentAddr, signer);
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
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async addLiquidityWithReferral(
        signer: Signer,
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
        tickDelta: number,
        marginWad: BigNumber,
        sqrtStrikeLowerPX96: BigNumber,
        sqrtStrikeUpperPX96: BigNumber,
        deadline: number,
        referralCode: string,
        overrides?: PayableOverrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const addParam = {
            expiry: expiry,
            tickDelta: tickDelta,
            amount: marginWad,
            limitTicks: this.core.encodeLimitTicks(sqrtStrikeLowerPX96, sqrtStrikeUpperPX96),
            deadline: deadline,
        } as AddParam;

        const instrumentAddress = await this.core.computeInstrumentAddress(
            instrumentIdentifier.marketType,
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        let unsignedTx;
        const gate = this.core.contracts.gate.connect(signer);
        const indexOfInstrument = await gate.indexOf(instrumentAddress);
        if (BigNumber.from(indexOfInstrument).isZero()) {
            this.ctx.registerContractParser(instrumentAddress, new InstrumentParser());
            this.ctx.registerAddress(
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
                await this.core.computeInitData(instrumentIdentifier),
                encodeAddWithReferralParam(addParam, referralCode),
                overrides ?? {},
            );
        } else {
            const instrument = this.core.getInstrumentContract(instrumentAddress, signer);
            unsignedTx = await instrument.populateTransaction.add(
                encodeAddWithReferralParam(addParam, referralCode),
                overrides ?? {},
            );
        }

        return this.ctx.sendTx(signer, unsignedTx);
    }

    public async intuitiveTradeWithReferral(
        signer: Signer,
        pair: PairModel,
        side: Side,
        base: BigNumber,
        margin: BigNumber,
        tradePrice: BigNumber,
        slippage: number,
        deadline: number,
        referralCode: string,

        overrides?: PayableOverrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        if (side === Side.FLAT) {
            throw new Error('Invalid Price');
        }
        const sign = signOfSide(side);
        const limitTick = this.core.getLimitTick(tradePrice, slippage, side);
        const instrument = this.core.getInstrumentContract(pair.rootInstrument.info.addr, signer);

        const unsignedTx = await instrument.populateTransaction.trade(
            encodeTradeWithReferralParam(pair.amm.expiry, base.mul(sign), margin, limitTick, deadline, referralCode),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }
}
