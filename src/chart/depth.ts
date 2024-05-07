import { CHAIN_ID, GRAPH_PAGE_SIZE, ZERO } from '@derivation-tech/web3-core';
import { concatId, normalizeTick, fromWad, alphaWadToTickDelta } from '../common/util';
import { Subgraph } from '../subgraph';
import { ConfigManager } from '../config';
import { ORDER_SPACING, RATIO_BASE, RATIO_DECIMALS } from '../constants';
import { BigNumber, ethers } from 'ethers';
import { SqrtPriceMath, TICK_DELTA_MAX, TickMath, WAD, r2w, sqrtX96ToWad, wadToSqrtX96, wdiv, wmul } from '../math';
import { Observer } from '../types';
import { MinimalPearlStructOutput } from '../types/typechain/Observer';
export interface DepthChartData {
    tick: number;
    price: number;
    base: number;
}

export interface IDepthChartDataProvider {
    getDepthData(
        instrumentAddr: string,
        expiry: number,
        liquidity: BigNumber,
        sqrtPX96: BigNumber,
        imr: number,
        length: number,
    ): Promise<{
        left: DepthChartData[];
        right: DepthChartData[];
    }>;
}

export class DepthChartDataProvider implements IDepthChartDataProvider {
    chainId: CHAIN_ID;
    subgraph: Subgraph;

    constructor(chainId: CHAIN_ID) {
        this.chainId = chainId;
        this.subgraph = new Subgraph(ConfigManager.getSynfConfig(chainId).subgraphProxy);
    }

    private _page(currTick: number, tick: number, pageAdjustmentDelta: number, size: number, right: boolean): number {
        const adjustedCurrTick = currTick - pageAdjustmentDelta;
        let tmp;
        if (right) {
            tmp = tick - adjustedCurrTick;
        } else {
            tmp = adjustedCurrTick - tick;
        }
        if (tmp <= 0) return 0;

        const page = right ? Math.ceil(tmp / size) - 1 : Math.ceil(tmp / size) - (pageAdjustmentDelta == 0 ? 1 : 0);
        return page;
    }

    private buildDepthChartData(
        currPX96: BigNumber,
        currLiquidity: BigNumber,
        currTick: number,
        tickDelta: number,
        tick2Peral: Map<number, MinimalPearlStructOutput>,
        size: number,
        length: number,
        pageAdjustmentDelta: number,
        right: boolean,
    ): DepthChartData[] {
        // pageAdjustmentDelta is used to adjust every page's tick to aligned with ORDER_SPACING
        const ret: DepthChartData[] = [];
        const page2BaseSize: Map<number, BigNumber> = new Map();
        const lastPageTick: Map<number, number> = new Map();

        for (
            let tick = currTick;
            right ? tick < currTick + tickDelta : tick > currTick - tickDelta;
            right ? (tick += 1) : (tick -= 1)
        ) {
            const page = this._page(currTick, tick, pageAdjustmentDelta, size, right);
            if (page >= length) break;
            lastPageTick.set(page, tick);

            const pearl = tick2Peral.get(tick);
            let currBaseSize = page2BaseSize.get(page) ?? ZERO;
            if (pearl) {
                if ((right && pearl.left.isNegative()) || (!right && pearl.left.gt(0))) {
                    currBaseSize = pearl.left.abs().add(currBaseSize);
                }
                const targetPX96 = TickMath.getSqrtRatioAtTick(tick);
                currBaseSize = currBaseSize.add(SqrtPriceMath.getDeltaBase(currPX96, targetPX96, currLiquidity, false));
                currPX96 = targetPX96;
                if (!pearl.liquidityNet.isZero()) {
                    currLiquidity = currLiquidity.add(pearl.liquidityNet.mul(right ? 1 : -1));
                }
                page2BaseSize.set(page, currBaseSize);
            } else if (tick % size === 0) {
                const targetPX96 = TickMath.getSqrtRatioAtTick(tick);
                currBaseSize = currBaseSize.add(
                    SqrtPriceMath.getDeltaBase(currPX96, targetPX96, currLiquidity, !right).abs(),
                );
                currPX96 = targetPX96;
                page2BaseSize.set(page, currBaseSize);
            }
        }
        for (const [page, baseSize] of page2BaseSize) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const tick = lastPageTick.get(page)!;
            const price = fromWad(TickMath.getWadAtTick(tick));
            const base = fromWad(baseSize);
            ret.push({ tick, price, base });
        }
        return ret;
    }

    async getDepthRangeDataFromObserver(
        observer: Observer,
        instrumentAddr: string,
        expiry: number,
        stepRatio: number,
        isInverse = false,
        lowerPrice?: BigNumber,
        upperPrice?: BigNumber,
    ): Promise<{
        left: DepthChartData[];
        right: DepthChartData[];
    }> {
        const tickDelta = TICK_DELTA_MAX * 2;

        // size should be step ratio
        const size = alphaWadToTickDelta(r2w(Math.round(stepRatio + RATIO_BASE)));

        const liquidityDetails = await observer.liquidityDetails(instrumentAddr, expiry, tickDelta);
        const tick2Peral: Map<number, MinimalPearlStructOutput> = new Map();
        for (let i = 0; i < liquidityDetails.tids.length; i++) {
            tick2Peral.set(liquidityDetails.tids[i], liquidityDetails.pearls[i]);
        }
        let pageAdjustmentDelta = 0;
        if (liquidityDetails.amm.tick % ORDER_SPACING !== 0) {
            pageAdjustmentDelta =
                liquidityDetails.amm.tick > 0
                    ? liquidityDetails.amm.tick % ORDER_SPACING
                    : ORDER_SPACING - (-liquidityDetails.amm.tick % ORDER_SPACING);
        }

        const maxTick = liquidityDetails.tids.reduce((prev, curr) => (prev > curr ? prev : curr));
        const minTick = liquidityDetails.tids.reduce((prev, curr) => (prev < curr ? prev : curr));
        const bnMin = (left: BigNumber, right: BigNumber): BigNumber => (left.gt(right) ? right : left);
        let minPriceDelta: BigNumber;
        if (!isInverse) {
            minPriceDelta = bnMin(
                TickMath.getWadAtTick(maxTick).sub(TickMath.getWadAtTick(liquidityDetails.amm.tick)),
                TickMath.getWadAtTick(liquidityDetails.amm.tick).sub(TickMath.getWadAtTick(minTick)),
            );
        } else {
            minPriceDelta = bnMin(
                TickMath.getWadAtTick(-liquidityDetails.amm.tick).sub(TickMath.getWadAtTick(-maxTick)),
                TickMath.getWadAtTick(-minTick).sub(TickMath.getWadAtTick(-liquidityDetails.amm.tick)),
            );
            lowerPrice = wdiv(WAD, TickMath.getWadAtTick(-liquidityDetails.amm.tick).add(minPriceDelta));
            upperPrice = wdiv(WAD, TickMath.getWadAtTick(-liquidityDetails.amm.tick).sub(minPriceDelta));
        }
        const rightTickDelta = upperPrice
            ? TickMath.getTickAtPWad(upperPrice) - liquidityDetails.amm.tick
            : TickMath.getTickAtPWad(TickMath.getWadAtTick(liquidityDetails.amm.tick).add(minPriceDelta)) -
              liquidityDetails.amm.tick;
        const rightLength = Number(
            TickMath.getWadAtTick(rightTickDelta).div(BigNumber.from(10).pow(14)).div(stepRatio).toString(),
        );
        const right: DepthChartData[] = this.buildDepthChartData(
            liquidityDetails.amm.sqrtPX96,
            liquidityDetails.amm.liquidity,
            liquidityDetails.amm.tick,
            rightTickDelta,
            tick2Peral,
            size,
            rightLength,
            pageAdjustmentDelta,
            true,
        );
        const leftTickDelta = lowerPrice
            ? liquidityDetails.amm.tick - TickMath.getTickAtPWad(lowerPrice)
            : liquidityDetails.amm.tick -
              TickMath.getTickAtPWad(TickMath.getWadAtTick(liquidityDetails.amm.tick).sub(minPriceDelta));
        const leftLength = Number(
            TickMath.getWadAtTick(leftTickDelta).div(BigNumber.from(10).pow(14)).div(stepRatio).toString(),
        );
        const left: DepthChartData[] = this.buildDepthChartData(
            liquidityDetails.amm.sqrtPX96,
            liquidityDetails.amm.liquidity,
            liquidityDetails.amm.tick,
            leftTickDelta,
            tick2Peral,
            size,
            leftLength,
            pageAdjustmentDelta,
            false,
        );
        return { left, right };
    }

    async getDepthDataFromObserver(
        observer: Observer,
        instrumentAddr: string,
        expiry: number,
        stepRatio: number,
        length = 10,
    ): Promise<{
        left: DepthChartData[];
        right: DepthChartData[];
    }> {
        // max tick delta should be stepRatio * length, for safety, we use 1.1 * stepRatio * length
        let tickDelta = alphaWadToTickDelta(r2w(Math.round(1.1 * stepRatio * length + RATIO_BASE)));
        tickDelta = Math.ceil(tickDelta / length) * length;

        // size should be step ratio
        const size = alphaWadToTickDelta(r2w(stepRatio + RATIO_BASE));

        const liquidityDetails = await observer.liquidityDetails(instrumentAddr, expiry, tickDelta);
        const tick2Peral: Map<number, MinimalPearlStructOutput> = new Map();
        for (let i = 0; i < liquidityDetails.tids.length; i++) {
            tick2Peral.set(liquidityDetails.tids[i], liquidityDetails.pearls[i]);
        }
        let pageAdjustmentDelta = 0;
        if (liquidityDetails.amm.tick % ORDER_SPACING !== 0) {
            pageAdjustmentDelta =
                liquidityDetails.amm.tick > 0
                    ? liquidityDetails.amm.tick % ORDER_SPACING
                    : ORDER_SPACING - (-liquidityDetails.amm.tick % ORDER_SPACING);
        }

        const right: DepthChartData[] = this.buildDepthChartData(
            liquidityDetails.amm.sqrtPX96,
            liquidityDetails.amm.liquidity,
            liquidityDetails.amm.tick,
            tickDelta,
            tick2Peral,
            size,
            length,
            pageAdjustmentDelta,
            true,
        );
        const left: DepthChartData[] = this.buildDepthChartData(
            liquidityDetails.amm.sqrtPX96,
            liquidityDetails.amm.liquidity,
            liquidityDetails.amm.tick,
            tickDelta,
            tick2Peral,
            size,
            length,
            pageAdjustmentDelta,
            false,
        );
        return { left, right };
    }

    async getDepthData(
        instrumentAddr: string,
        expiry: number,
        liquidity: BigNumber,
        sqrtPX96: BigNumber,
        imr: number,
        length = 10,
    ): Promise<{
        left: DepthChartData[];
        right: DepthChartData[];
    }> {
        const fn = (str: string): string => `"${str}"`;
        const ammCondition = `amm: ${fn(concatId(instrumentAddr, expiry).toLowerCase())},`;
        // get all open orders
        const graphQL = `
          query($skip: Int, $first: Int, $lastID: String){
            orders(first: $first, where: {${ammCondition} status: "OPEN", id_gt: $lastID}){
              id
              tick
              filledSize
              size
              status
            }
          }`;
        const orders = await this.subgraph.queryAll(graphQL, GRAPH_PAGE_SIZE, true);
        const orderLiquidity: { [tick: number]: BigNumber } = {};
        for (const order of orders) {
            orderLiquidity[Number(order.tick)] = BigNumber.from(order.size)
                .abs()
                .sub(BigNumber.from(order.filledSize).abs());
        }

        const curTick = TickMath.getTickAtSqrtRatio(sqrtPX96);
        const price = sqrtX96ToWad(sqrtPX96);
        const normalizedCurTick = normalizeTick(curTick, ORDER_SPACING);

        imr = imr / 10 ** RATIO_DECIMALS;

        // calculate the right part
        const right: DepthChartData[] = [];
        for (let i = 0; i < length; i++) {
            const p = wmul(price, ethers.utils.parseEther(String(1 + ((i + 1) * imr) / length)));
            const t = TickMath.getTickAtSqrtRatio(wadToSqrtX96(p));
            let base = SqrtPriceMath.getDeltaBase(
                TickMath.getSqrtRatioAtTick(curTick),
                TickMath.getSqrtRatioAtTick(t),
                liquidity,
                false,
            );
            // search order liquidity between curTick and t
            for (let i = normalizedCurTick; i <= normalizeTick(t, ORDER_SPACING); i += ORDER_SPACING) {
                base = base.add(orderLiquidity[i] ?? ZERO);
            }
            right.push({
                tick: t,
                base: fromWad(base),
                price: fromWad(sqrtX96ToWad(TickMath.getSqrtRatioAtTick(t))),
            });
        }

        const left: DepthChartData[] = [];
        for (let i = 0; i < length; i++) {
            const p = wmul(price, ethers.utils.parseEther(String(1 - ((i + 1) * imr) / length)));
            const t = TickMath.getTickAtSqrtRatio(wadToSqrtX96(p));
            let base = SqrtPriceMath.getDeltaBase(
                TickMath.getSqrtRatioAtTick(curTick),
                TickMath.getSqrtRatioAtTick(t),
                liquidity,
                true,
            );
            // search order liquidity between t and curTick
            for (let i = normalizeTick(t, ORDER_SPACING); i < normalizedCurTick; i += ORDER_SPACING) {
                base = base.add(orderLiquidity[i] ?? ZERO);
            }
            left.push({
                tick: t,
                base: fromWad(base),
                price: fromWad(sqrtX96ToWad(TickMath.getSqrtRatioAtTick(t))),
            });
        }
        return { left, right };
    }
}
