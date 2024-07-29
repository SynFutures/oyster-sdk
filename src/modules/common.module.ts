import { SynFuturesV3 } from '../synfuturesV3Core';
import { calcMaxWithdrawable, TickMath, wdiv, wmul, ZERO } from '../math';
import { BigNumber, CallOverrides } from 'ethers';
import {
    cancelOrderToPosition,
    combine,
    EMPTY_POSITION,
    entryDelta,
    fillOrderToPosition,
    FundFlow,
    PairModel,
    Pending,
    Position,
    Quotation,
    rangeToPosition,
    Side,
    signOfSide,
} from '../types';
import { BlockInfo } from '@derivation-tech/web3-core';
import { alphaWadToTickDelta, fromWad, trimObj } from '../common';
import { PairLevelAccountModel, PositionModel } from '../models';
import { RANGE_SPACING } from '../constants';

export class CommonModule {
    synfV3: SynFuturesV3;

    constructor(synfV3: SynFuturesV3) {
        this.synfV3 = synfV3;
    }

    async getNextInitializedTickOutside(
        instrumentAddr: string,
        expiry: number,
        tick: number,
        right: boolean,
    ): Promise<number> {
        const observer = this.synfV3.contracts.observer;
        return await TickMath.getNextInitializedTickOutside(observer, instrumentAddr, expiry, tick, right);
    }

    // trade size needed to move AMM price to target tick
    async getSizeToTargetTick(instrumentAddr: string, expiry: number, targetTick: number): Promise<BigNumber> {
        const observer = this.synfV3.contracts.observer;
        return await TickMath.getSizeToTargetTick(observer, instrumentAddr, expiry, targetTick);
    }

    async getPendingParams(
        quotes: string[],
        overrides?: CallOverrides,
    ): Promise<{ pendingDuration: BigNumber; thresholds: BigNumber[] }> {
        const gateInterface = this.synfV3.contracts.gate.interface;
        const calls = quotes.map((quote) => {
            return {
                target: this.synfV3.contracts.gate.address,
                callData: gateInterface.encodeFunctionData('thresholdOf', [quote]),
            };
        });
        calls.push({
            target: this.synfV3.contracts.gate.address,
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

    async getFundFlows(
        quoteAddrs: string[],
        trader: string,
        overrides?: CallOverrides,
    ): Promise<{ fundFlows: FundFlow[]; blockInfo: BlockInfo }> {
        const gateInterface = this.synfV3.contracts.gate.interface;
        const observerInterface = this.synfV3.contracts.observer.interface;

        const calls: { target: string; callData: string }[] = [];

        calls.push(
            ...quoteAddrs.map((quote) => {
                return {
                    target: this.synfV3.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('fundFlowOf', [quote, trader]),
                };
            }),
        );
        // just to get the block info
        calls.push({
            target: this.synfV3.contracts.observer.address,
            callData: observerInterface.encodeFunctionData('getVaultBalances', [trader, quoteAddrs]),
        });
        const rawRet = (await this.synfV3.ctx.getMulticall3().callStatic.aggregate(calls, overrides ?? {})).returnData;
        const fundFlows = rawRet.slice(0, quoteAddrs.length).map((ret) => {
            return trimObj(gateInterface.decodeFunctionResult('fundFlowOf', ret)[0]) as FundFlow;
        });
        const blockInfo = trimObj(
            observerInterface.decodeFunctionResult('getVaultBalances', rawRet[quoteAddrs.length])[1],
        );
        return { fundFlows, blockInfo: blockInfo as BlockInfo };
    }

    async getUserPendings(
        quotes: string[],
        trader: string,
        overrides?: CallOverrides,
    ): Promise<{ pendings: { maxWithdrawable: BigNumber; pending: Pending }[]; blockInfo: BlockInfo }> {
        const gateInterface = this.synfV3.contracts.gate.interface;
        const observerInterface = this.synfV3.contracts.observer.interface;
        const calls: { target: string; callData: string }[] = [];
        calls.push(
            ...quotes.map((quote) => {
                return {
                    target: this.synfV3.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('fundFlowOf', [quote, trader]),
                };
            }),
        );
        calls.push(
            ...quotes.map((quote) => {
                return {
                    target: this.synfV3.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('thresholdOf', [quote]),
                };
            }),
        );
        calls.push(
            ...quotes.map((quote) => {
                return {
                    target: this.synfV3.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('reserveOf', [quote, trader]),
                };
            }),
        );
        calls.push({
            target: this.synfV3.contracts.observer.address,
            callData: observerInterface.encodeFunctionData('getPendings', [quotes, trader]),
        });
        const rawRet = (await this.synfV3.ctx.getMulticall3().callStatic.aggregate(calls, overrides ?? {})).returnData;
        const fundFlows = rawRet
            .slice(0, quotes.length)
            .map((ret) => gateInterface.decodeFunctionResult('fundFlowOf', ret)[0] as FundFlow);
        const thresholds = rawRet
            .slice(quotes.length, quotes.length * 2)
            .map((ret) => gateInterface.decodeFunctionResult('thresholdOf', ret)[0] as BigNumber);
        const reserves = rawRet
            .slice(quotes.length * 2, quotes.length * 3)
            .map((ret) => gateInterface.decodeFunctionResult('reserveOf', ret)[0] as BigNumber);
        const decoded = observerInterface.decodeFunctionResult('getPendings', rawRet[quotes.length * 3]);
        const pendings = decoded[0] as Pending[];
        const blockInfo = trimObj(decoded[1]) as BlockInfo;
        return {
            pendings: pendings.map((pending, index) => {
                return {
                    maxWithdrawable: calcMaxWithdrawable(thresholds[index], pending, fundFlows[index], reserves[index]),
                    pending,
                };
            }),
            blockInfo,
        };
    }

    //////////////////////////////////////////////////////////
    // Trade inquire
    //////////////////////////////////////////////////////////
    public async inquireByBase(
        pair: PairModel,
        side: Side,
        baseAmount: BigNumber,
        overrides?: CallOverrides,
    ): Promise<{ quoteAmount: BigNumber; quotation: Quotation }> {
        const instrument = this.synfV3.instrumentModule.getInstrumentContract(
            pair.rootInstrument.info.addr,
            this.synfV3.ctx.provider,
        );
        const expiry = pair.amm.expiry;
        const sign = signOfSide(side);
        const size = baseAmount.mul(sign);
        const quotation = await instrument.inquire(expiry, size, overrides ?? {});
        const entryNotional = quotation.entryNotional;
        return {
            quoteAmount: entryNotional,
            quotation: quotation,
        };
    }

    public async inquireByQuote(
        pair: PairModel,
        side: Side,
        quoteAmount: BigNumber,
        overrides?: CallOverrides,
    ): Promise<{ baseAmount: BigNumber; quotation: Quotation }> {
        const expiry = pair.amm.expiry;
        const long = side === Side.LONG;
        const { size, quotation } = await this.synfV3.contracts.observer.inquireByNotional(
            pair.rootInstrument.info.addr,
            expiry,
            quoteAmount,
            long,
            overrides ?? {},
        );
        return {
            baseAmount: size.abs(),
            quotation: quotation,
        };
    }

    // @param transferAmount: decimal 18 units, always positive
    // @param transferIn: true if in, false if out
    // @return leverageWad: decimal 18 units
    public inquireLeverageFromTransferAmount(
        position: PositionModel,
        transferIn: boolean,
        transferAmount: BigNumber,
    ): BigNumber {
        const sign: number = transferIn ? 1 : -1;
        const value = wmul(position.rootPair.markPrice, position.size.abs());
        const oldEquity = position.getEquity();
        const Amount = transferAmount.mul(sign);
        const newEquity = oldEquity.add(Amount);
        // leverage is 18 decimal
        return wdiv(value, newEquity);
    }

    //////////////////////////////////////////////////////////
    // Frontend Transaction API
    //////////////////////////////////////////////////////////

    async getPositionIfSettle(traderAccount: PairLevelAccountModel): Promise<Position> {
        let finalPic: Position = Object.assign({}, EMPTY_POSITION);
        const amm = traderAccount.rootPair.amm;
        const instrumentAddr = traderAccount.rootPair.rootInstrument.info.addr;
        const expiry = amm.expiry;
        // range settle part
        for (const range of traderAccount.ranges) {
            const position: Position = rangeToPosition(
                amm.sqrtPX96,
                amm.tick,
                amm.feeIndex,
                amm.longSocialLossIndex,
                amm.shortSocialLossIndex,
                amm.longFundingIndex,
                amm.shortFundingIndex,
                range.tickLower,
                range.tickUpper,
                range,
            );
            finalPic = combine(amm, finalPic, position).position;
        }
        const ticks = traderAccount.orders.map((o) => o.tick);
        const nonces = traderAccount.orders.map((o) => o.nonce);
        const pearls = await this.synfV3.contracts.observer.getPearls(instrumentAddr, expiry, ticks);
        const records = await this.synfV3.contracts.observer.getRecords(instrumentAddr, expiry, ticks, nonces);
        // order settle part
        for (let i = 0; i < traderAccount.orders.length; i++) {
            const order = traderAccount.orders[i];
            const pearl = pearls[i];
            const record = records[i];
            let position: Position;
            if (pearl.nonce === order.nonce) {
                position = cancelOrderToPosition(
                    pearl.left,
                    pearl.nonce,
                    pearl.taken,
                    pearl.fee,
                    pearl.entrySocialLossIndex,
                    pearl.entryFundingIndex,
                    order,
                    order.tick,
                    order.nonce,
                    record,
                );
            } else {
                position = fillOrderToPosition(
                    pearl.nonce,
                    pearl.taken,
                    pearl.fee,
                    pearl.entrySocialLossIndex,
                    pearl.entryFundingIndex,
                    order,
                    order.tick,
                    order.nonce,
                    order.size,
                    record,
                );
            }
            finalPic = combine(amm, finalPic, position).position;
        }
        // position settle part
        finalPic = combine(amm, finalPic, traderAccount.position).position;
        return finalPic;
    }

    estimateAPY(pairModel: PairModel, poolFee24h: BigNumber, alphaWad: BigNumber): number {
        if (pairModel.amm.liquidity.eq(ZERO)) return 0;
        const assumeAddMargin = pairModel.rootInstrument.minRangeValue;
        const tickDelta = alphaWadToTickDelta(alphaWad);

        const upperTick = RANGE_SPACING * ~~((pairModel.amm.tick + tickDelta) / RANGE_SPACING);
        const lowerTick = RANGE_SPACING * ~~((pairModel.amm.tick - tickDelta) / RANGE_SPACING);
        const { liquidity: assumeAddLiquidity } = entryDelta(
            pairModel.amm.sqrtPX96,
            lowerTick,
            upperTick,
            assumeAddMargin,
            pairModel.rootInstrument.setting.initialMarginRatio,
        );
        const assumed24HrFee: BigNumber = poolFee24h.mul(assumeAddLiquidity).div(pairModel.amm.liquidity);
        const apyWad: BigNumber = wdiv(assumed24HrFee.mul(365), assumeAddMargin);

        return fromWad(apyWad);
    }
}
