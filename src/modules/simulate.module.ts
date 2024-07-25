import { SynFuturesV3 } from '../synfuturesV3Core';
import {
    BatchOrderSizeDistribution,
    combine,
    NumericConverter,
    PairLevelAccountModel,
    PositionModel,
    Quotation,
    Side,
    signOfSide,
    SimulateOrderResult,
    SimulateTradeResult,
} from '../types';
import { BigNumber, ethers } from 'ethers';
import {
    getMaxLeverage,
    max,
    r2w,
    SqrtPriceMath,
    sqrtX96ToWad,
    TickMath,
    wdiv,
    wdivUp,
    wmul,
    wmulUp,
    ZERO,
} from '../math';
import {
    MAX_BATCH_ORDER_COUNT,
    MIN_BATCH_ORDER_COUNT,
    ONE_RATIO,
    PEARL_SPACING,
    PERP_EXPIRY,
    RATIO_BASE,
} from '../constants';
import { updateFundingIndex } from '../math/funding';
import { withinOrderLimit } from '../common';

export class SimulateModule {
    v3Sdk: SynFuturesV3;
    constructor(v3Sdk: SynFuturesV3) {
        this.v3Sdk = v3Sdk;
    }

    async simulateCrossMarketOrder(
        pairAccountModel: PairLevelAccountModel,
        targetTick: number,
        side: Side,
        baseSize: BigNumber,
        leverageWad: BigNumber,
        slippage: number,
    ): Promise<{
        canPlaceOrder: boolean;
        tradeQuotation: Quotation;
        tradeSize: BigNumber;
        orderSize: BigNumber;
        tradeSimulation: SimulateTradeResult;
        orderSimulation: SimulateOrderResult;
    }> {
        const sign = signOfSide(side);
        const pair = pairAccountModel.rootPair;
        const long = sign > 0;
        const currentTick = pair.amm.tick;
        if ((long && targetTick <= currentTick) || (!long && targetTick >= currentTick))
            throw Error('please place normal order');
        let swapToTick = long ? targetTick + 1 : targetTick - 1;
        let { size: swapSize, quotation: quotation } = await this.v3Sdk.contracts.observer.inquireByTick(
            pair.rootInstrument.info.addr,
            pair.amm.expiry,
            swapToTick,
        );
        if ((long && quotation.postTick <= targetTick) || (!long && quotation.postTick >= targetTick)) {
            swapToTick = long ? swapToTick + 1 : swapToTick - 1;
            const retry = await this.v3Sdk.contracts.observer.inquireByTick(
                pair.rootInstrument.info.addr,
                pair.amm.expiry,
                swapToTick,
            );
            swapSize = retry.size;
            quotation = retry.quotation;
        }
        if ((long && swapSize.lt(0)) || (!long && swapSize.gt(0))) throw Error('Wrong Side');
        const tradeSimulate = this.simulateTrade(
            pairAccountModel,
            quotation,
            side,
            swapSize.abs(),
            undefined,
            leverageWad,
            slippage,
        );
        if (pairAccountModel.getMainPosition().size.isZero() && quotation.entryNotional.lt(tradeSimulate.minTradeValue))
            throw Error('size to tick is trivial');
        const minOrderValue = pair.rootInstrument.minOrderValue;
        const targetTickPrice = TickMath.getWadAtTick(targetTick);
        const minOrderSize = wdivUp(minOrderValue, targetTickPrice);
        const quoteInfo = pair.rootInstrument.info.quote;
        const balanceInVaultWad = NumericConverter.scaleQuoteAmount(
            this.v3Sdk.getCachedVaultBalance(quoteInfo.address, pairAccountModel.traderAddr),
            quoteInfo.decimals,
        );
        function getBalanceInVaultWadOverride(
            balanceInVaultWad: BigNumber,
            depositWad: BigNumber,
            consumedWad: BigNumber,
        ): BigNumber {
            const balance = balanceInVaultWad.add(depositWad).sub(consumedWad);
            return balance.lt(0) ? ZERO : balance;
        }
        if (swapSize.abs().add(minOrderSize).gt(baseSize.abs())) {
            // in this case we can't place order since size is too small
            return {
                canPlaceOrder: false,
                tradeSize: swapSize.abs(),
                tradeQuotation: quotation,
                tradeSimulation: tradeSimulate,
                orderSize: minOrderSize,
                orderSimulation: this._simulateOrder(
                    pairAccountModel,
                    targetTick,
                    minOrderSize,
                    leverageWad,
                    getBalanceInVaultWadOverride(
                        balanceInVaultWad,
                        tradeSimulate.marginToDepositWad,
                        tradeSimulate.margin,
                    ),
                ),
            };
        } else {
            return {
                canPlaceOrder: true,
                tradeSize: swapSize.abs(),
                tradeQuotation: quotation,
                tradeSimulation: tradeSimulate,
                orderSize: baseSize.abs().sub(swapSize.abs()),
                orderSimulation: this._simulateOrder(
                    pairAccountModel,
                    targetTick,
                    baseSize.abs().sub(swapSize.abs()),
                    leverageWad,
                    getBalanceInVaultWadOverride(
                        balanceInVaultWad,
                        tradeSimulate.marginToDepositWad,
                        tradeSimulate.margin,
                    ),
                ),
            };
        }
    }

    simulateOrder(
        pairAccountModel: PairLevelAccountModel,
        targetTick: number,
        baseSize: BigNumber,
        side: Side,
        leverageWad: BigNumber,
    ): SimulateOrderResult {
        const pairModel = pairAccountModel.rootPair;
        const currentTick = pairModel.amm.tick;
        if (currentTick === targetTick) throw new Error('Invalid price');
        const isLong = targetTick < currentTick;
        const targetPrice = TickMath.getWadAtTick(targetTick);

        if ((side === Side.LONG && !isLong) || (side === Side.SHORT && isLong)) throw new Error('Invalid price');

        const maxLeverage = getMaxLeverage(pairModel.rootInstrument.setting.initialMarginRatio);
        if (leverageWad.gt(ethers.utils.parseEther(maxLeverage + ''))) {
            throw new Error('Insufficient margin to open position');
        }

        if (!withinOrderLimit(targetPrice, pairModel.markPrice, pairModel.rootInstrument.setting.initialMarginRatio)) {
            throw new Error('Limit order price is too far away from mark price');
        }

        return this._simulateOrder(pairAccountModel, targetTick, baseSize, leverageWad);
    }

    private _simulateOrder(
        pairAccountModel: PairLevelAccountModel,
        targetTick: number,
        baseSize: BigNumber,
        leverageWad: BigNumber,
        balanceInVaultWadOverride?: BigNumber,
    ): SimulateOrderResult {
        baseSize = baseSize.abs();
        const pairModel = pairAccountModel.rootPair;
        const targetPrice = TickMath.getWadAtTick(targetTick);
        const markPrice = pairModel.markPrice;
        let margin = wdivUp(wmulUp(targetPrice, baseSize), leverageWad);
        const minMargin = wmulUp(
            r2w(pairModel.rootInstrument.setting.initialMarginRatio),
            wmulUp(
                max(
                    markPrice
                        .mul(ONE_RATIO + 50) // add 0.5% slippage
                        .div(ONE_RATIO),
                    targetPrice,
                ),
                baseSize,
            ),
        );
        if (margin.lt(minMargin)) margin = minMargin;
        return {
            baseSize: baseSize,
            balance: margin,
            leverageWad: leverageWad,
            marginToDepositWad: this.v3Sdk.marginToDepositWad(
                pairAccountModel.traderAddr,
                pairModel.rootInstrument.info.quote,
                margin,
                balanceInVaultWadOverride,
            ),
            minOrderValue: pairModel.rootInstrument.minOrderValue,
            minFeeRebate: wmul(
                wmul(targetPrice, baseSize),
                r2w(pairModel.rootInstrument.setting.quoteParam.tradingFeeRatio),
            ),
        };
    }

    simulateBatchPlace(
        pairAccountModel: PairLevelAccountModel,
        targetTicks: number[],
        ratios: number[],
        baseSize: BigNumber,
        side: Side,
        leverageWad: BigNumber,
    ): {
        orders: {
            baseSize: BigNumber;
            balance: BigNumber;
            leverageWad: BigNumber;
            minFeeRebate: BigNumber;
        }[];
        marginToDepositWad: BigNumber;
        minOrderValue: BigNumber;
    } {
        if (targetTicks.length < MIN_BATCH_ORDER_COUNT || targetTicks.length > MAX_BATCH_ORDER_COUNT)
            throw new Error(`order count should be between ${MIN_BATCH_ORDER_COUNT} and ${MAX_BATCH_ORDER_COUNT}`);
        if (targetTicks.length !== ratios.length) throw new Error('ticks and ratios length not equal');
        if (ratios.reduce((acc, ratio) => acc + ratio, 0) !== RATIO_BASE)
            throw new Error('ratios sum not equal to RATIO_BASE: 10000');
        // check for same tick and unaligned ticks
        if (new Set(targetTicks).size !== targetTicks.length) throw new Error('duplicated ticks');
        if (targetTicks.find((tick) => tick % PEARL_SPACING !== 0)) throw new Error('unaligned ticks');

        const orders: {
            baseSize: BigNumber;
            balance: BigNumber;
            leverageWad: BigNumber;
            minFeeRebate: BigNumber;
        }[] = targetTicks.map((targetTick, index) => {
            try {
                const res = this.simulateOrder(
                    pairAccountModel,
                    targetTick,
                    baseSize.mul(ratios[index]).div(RATIO_BASE),
                    side,
                    leverageWad,
                );
                return {
                    baseSize: res.baseSize,
                    balance: res.balance,
                    leverageWad: res.leverageWad,
                    minFeeRebate: res.minFeeRebate,
                };
            } catch (error) {
                console.log('error', error);
                return {
                    baseSize: ZERO,
                    balance: ZERO,
                    leverageWad: ZERO,
                    minFeeRebate: ZERO,
                };
            }
        });
        const pairModel = pairAccountModel.rootPair;
        return {
            orders,
            marginToDepositWad: this.v3Sdk.marginToDepositWad(
                pairAccountModel.traderAddr,
                pairModel.rootInstrument.info.quote,
                orders.reduce((acc, order) => acc.add(order.balance), ZERO),
            ),
            minOrderValue: pairModel.rootInstrument.minOrderValue,
        };
    }

    simulateBatchOrder(
        pairAccountModel: PairLevelAccountModel,
        lowerTick: number,
        upperTick: number,
        orderCount: number,
        sizeDistribution: BatchOrderSizeDistribution,
        baseSize: BigNumber,
        side: Side,
        leverageWad: BigNumber,
    ): {
        orders: {
            tick: number;
            baseSize: BigNumber;
            ratio: number;
            balance: BigNumber;
            leverageWad: BigNumber;
            minFeeRebate: BigNumber;
            minOrderSize: BigNumber;
        }[];
        marginToDepositWad: BigNumber;
        minOrderValue: BigNumber;
        totalMinSize: BigNumber;
    } {
        if (orderCount < MIN_BATCH_ORDER_COUNT || orderCount > MAX_BATCH_ORDER_COUNT)
            throw new Error(`order count should be between ${MIN_BATCH_ORDER_COUNT} and ${MAX_BATCH_ORDER_COUNT}`);
        const targetTicks = this.v3Sdk.getBatchOrderTicks(lowerTick, upperTick, orderCount);
        let ratios = this.v3Sdk.getBatchOrderRatios(sizeDistribution, orderCount);
        // if sizeDistribution is random, we need to adjust the ratios to make sure orderValue meet minOrderValue with best effort
        const minOrderValue = pairAccountModel.rootPair.rootInstrument.minOrderValue;
        const minSizes = targetTicks.map((tick) => wdivUp(minOrderValue, TickMath.getWadAtTick(tick)));
        if (sizeDistribution === BatchOrderSizeDistribution.RANDOM) {
            // check if any baseSize * ratio is less than minSize
            let needNewRatios = false;
            for (let i = 0; i < minSizes.length; i++) {
                if (baseSize.mul(ratios[i]).div(RATIO_BASE).lt(minSizes[i])) {
                    needNewRatios = true;
                    break;
                }
            }
            // only adjust sizes if possible
            if (needNewRatios && minSizes.reduce((acc, minSize) => acc.add(minSize), ZERO).lt(baseSize)) {
                ratios = this.v3Sdk.getBatchOrderRatios(BatchOrderSizeDistribution.FLAT, orderCount);
            }
        }

        // calculate totalMinSize
        const sizes = ratios.map((ratio) => baseSize.mul(ratio).div(RATIO_BASE));
        const bnMax = (a: BigNumber, b: BigNumber): BigNumber => (a.gt(b) ? a : b);
        // pick the max minSize/size ratio
        const minSizeToSizeRatio = minSizes
            .map((minSize, i) => bnMax(wdivUp(minSize, sizes[i]), ZERO))
            .reduce((acc, ratio) => bnMax(acc, ratio), ZERO);
        const totalMinSize = wmulUp(baseSize, minSizeToSizeRatio);

        const res = this.simulateBatchPlace(pairAccountModel, targetTicks, ratios, baseSize, side, leverageWad);
        return {
            ...res,
            orders: targetTicks.map((tick: number, index: number) => {
                return {
                    tick: tick,
                    baseSize: res.orders[index].baseSize,
                    ratio: ratios[index],
                    balance: res.orders[index].balance,
                    leverageWad: res.orders[index].leverageWad,
                    minFeeRebate: res.orders[index].minFeeRebate,
                    minOrderSize: minSizes[index],
                };
            }),
            totalMinSize,
        };
    }

    // @param quotation: can be accessed through inquireByBase/inquireByQuote
    // four scenarios here: see examples in testMocks.ts
    public simulateTrade(
        pairAccountModel: PairLevelAccountModel,
        quotation: Quotation,
        side: Side,
        baseSize: BigNumber,
        margin: BigNumber | undefined,
        leverageWad: BigNumber | undefined,
        slippage: number,
    ): SimulateTradeResult {
        const sign = signOfSide(side);
        const tradePrice = wdiv(quotation.entryNotional, baseSize.abs());
        const limitTick = TickMath.getLimitTick(tradePrice, slippage, side);
        const markPrice = pairAccountModel.rootPair.markPrice;
        const amm = pairAccountModel.rootPair.amm;
        // update funding index if expiry is perp
        if (amm.expiry === PERP_EXPIRY) {
            const { longFundingIndex, shortFundingIndex } = updateFundingIndex(
                amm,
                pairAccountModel.rootPair.markPrice,
                pairAccountModel.rootPair.rootInstrument.state.blockInfo!.timestamp,
            );
            amm.longFundingIndex = longFundingIndex;
            amm.shortFundingIndex = shortFundingIndex;
        }

        let exceedMaxLeverage = false;
        if (baseSize.lte(0)) throw new Error('Invalid trade size');

        // calculate tradeLoss by limitPrice
        const limitPrice = TickMath.getWadAtTick(limitTick);
        const worstNotional = wmul(limitPrice, baseSize);
        const tradeLoss =
            sign > 0 ? worstNotional.sub(wmul(markPrice, baseSize)) : wmul(markPrice, baseSize).sub(worstNotional);

        let minTradeValue = ZERO;
        const position = pairAccountModel.getMainPosition();
        if (position.size.isZero()) minTradeValue = pairAccountModel.rootPair.rootInstrument.minTradeValue;
        const oldEquity = position.getEquity();
        const rawSize = baseSize.mul(sign);
        if (!margin && leverageWad) {
            // calc margin required by fixed leverage
            // newEquity = oldEquity + margin - tradeLoss - fee
            // margin = newEquity - oldEquity + tradeLoss + fee
            const newEquity = wdiv(wmul(markPrice, baseSize.mul(sign).add(position.size)).abs(), leverageWad);
            margin = newEquity.sub(oldEquity).add(tradeLoss).add(quotation.fee);
        } else if (margin && !leverageWad) {
            const newEquity = oldEquity.add(margin).sub(tradeLoss).sub(quotation.fee);
            leverageWad = wdiv(wmul(markPrice, baseSize.mul(sign).add(position.size)).abs(), newEquity);
        } else {
            margin = ZERO;
            const newEquity = oldEquity.add(ZERO).sub(tradeLoss).sub(quotation.fee);
            leverageWad = wdiv(wmul(markPrice, baseSize.mul(sign).add(position.size)).abs(), newEquity);
        }
        const positionSwapped = {
            balance: margin.lt(0) ? quotation.fee.mul(-1) : margin.sub(quotation.fee),
            size: rawSize,
            entryNotional: quotation.entryNotional,
            entrySocialLossIndex: sign > 0 ? amm.longSocialLossIndex : amm.shortSocialLossIndex,
            entryFundingIndex: sign > 0 ? amm.longFundingIndex : amm.shortFundingIndex,
        };
        const { position: rawPosition, realized: realized } = combine(amm, position, positionSwapped);
        const simulationMainPosition = PositionModel.fromRawPosition(pairAccountModel.rootPair, rawPosition);
        if (margin.lt(ZERO)) {
            const maxWithdrawableMargin = simulationMainPosition.size.eq(ZERO)
                ? ZERO
                : simulationMainPosition.getMaxWithdrawableMargin();
            if (margin.abs().gt(maxWithdrawableMargin)) {
                margin = maxWithdrawableMargin.mul(-1);
                exceedMaxLeverage = true;
            }
            // to avoid the case that the margin cant meet the imr requirement
            margin = margin.mul(999).div(1000);
            simulationMainPosition.balance = simulationMainPosition.balance.add(margin);
        }
        //
        // as for creating new position or increasing a position: if leverage < 0 or leverage > 10, the position is not IMR safe
        // as for closing or decreasing a position: if leverage < 0 or leverage > 20, the position is not MMR safe
        if (
            simulationMainPosition.size.eq(ZERO) ||
            (position.size.mul(sign).lt(ZERO) && baseSize.abs().lt(position.size.abs()))
        ) {
            if (!simulationMainPosition.isPositionMMSafe()) throw new Error('Insufficient margin to open position');
        } else {
            if (!simulationMainPosition.isPositionIMSafe(true)) {
                // throw new Error('Insufficient margin to open position');
                console.log('exceed max leverage, sdk will use max leverage to simulate trade');
                exceedMaxLeverage = true;

                const additionalMargin = simulationMainPosition.getAdditionMarginToIMRSafe(true, slippage);
                simulationMainPosition.balance = simulationMainPosition.balance.add(additionalMargin);
                margin = margin.add(additionalMargin);
                leverageWad = simulationMainPosition.leverageWad;
            }
        }
        // price impact = (postFair - preFair) / preFair
        const priceImpactWad = wdiv(
            sqrtX96ToWad(quotation.sqrtPostFairPX96).sub(sqrtX96ToWad(quotation.sqrtFairPX96)),
            sqrtX96ToWad(quotation.sqrtFairPX96),
        );

        const stabilityFee = SqrtPriceMath.getStabilityFee(
            quotation,
            pairAccountModel.rootPair.rootInstrument.setting.quoteParam,
        );
        return {
            tradePrice: tradePrice,
            estimatedTradeValue: quotation.entryNotional,
            minTradeValue: minTradeValue,
            tradingFee: quotation.fee.sub(stabilityFee),
            stabilityFee: stabilityFee,
            margin:
                simulationMainPosition.size.eq(ZERO) && simulationMainPosition.balance.gt(ZERO)
                    ? simulationMainPosition.balance.mul(-1)
                    : margin,
            leverageWad: simulationMainPosition.size.eq(ZERO) ? ZERO : leverageWad,
            priceImpactWad: priceImpactWad,
            simulationMainPosition: simulationMainPosition,
            realized: realized,
            marginToDepositWad: this.v3Sdk.marginToDepositWad(
                pairAccountModel.traderAddr,
                pairAccountModel.rootPair.rootInstrument.info.quote,
                margin,
            ),
            limitTick: limitTick,
            exceedMaxLeverage: exceedMaxLeverage,
        };
    }
}
