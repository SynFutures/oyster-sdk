import { CHAIN_ID, GRAPH_PAGE_SIZE, ZERO } from '@derivation-tech/web3-core';
import { concatId, fromWad } from '../common/util';
import { Subgraph } from '../subgraph';
import { ConfigManager } from '../config';
import { MAX_TICK, MIN_TICK, RANGE_SPACING } from '../constants';
import { BigNumber } from 'ethers';
import { TickMath, sqrtX96ToWad } from '../math';

export interface LiquidityChartData {
    tick: number;
    price: number;
    liquidity: BigNumber;
}

export interface ILiquidityChartDataProvider {
    getLiquidityData(instrumentAddr: string, expiry: number): Promise<LiquidityChartData[]>;
}

export class LiquidityChartDataProvider implements ILiquidityChartDataProvider {
    chainId: CHAIN_ID;
    subgraph: Subgraph;

    constructor(chainId: CHAIN_ID) {
        this.chainId = chainId;
        this.subgraph = new Subgraph(ConfigManager.getSynfConfig(chainId).subgraphProxy);
    }

    async getLiquidityData(
        instrumentAddr: string,
        expiry: number,
        spacing = RANGE_SPACING,
    ): Promise<LiquidityChartData[]> {
        const fn = (str: string): string => `"${str}"`;
        const ammCondition = `amm: ${fn(concatId(instrumentAddr, expiry).toLowerCase())},`;

        // get all open ranges
        const graphQL = `
          query($skip: Int, $first: Int, $lastID: String){
            ranges(first: $first, where: {${ammCondition} status: "OPEN", id_gt: $lastID}){
              id
              liquidity
              tickLower
              tickUpper
              status
            }
          }`;
        const ranges = await this.subgraph.queryAll(graphQL, GRAPH_PAGE_SIZE, true);
        if (!ranges || ranges.length === 0) {
            return [];
        }
        let tickLowest = MAX_TICK;
        let tickUppest = MIN_TICK;
        // calculate liquidity on a specific tick
        const liquidityDeltaMap: { [tick: number]: BigNumber } = {};
        for (const range of ranges) {
            if (Number(range.tickLower) < tickLowest) {
                tickLowest = Number(range.tickLower);
            }
            if (Number(range.tickUpper) > tickUppest) {
                tickUppest = Number(range.tickUpper);
            }
            const liq = BigNumber.from(range.liquidity);
            const liquidityDeltaLower = liquidityDeltaMap[range.tickLower] ?? ZERO;
            liquidityDeltaMap[range.tickLower] = liquidityDeltaLower.add(liq);
            const liquidityDeltaUpper = liquidityDeltaMap[range.tickUpper + 1] ?? ZERO;
            liquidityDeltaMap[range.tickUpper + 1] = liquidityDeltaUpper.sub(liq);
        }
        const result: LiquidityChartData[] = [];
        let liquidity = ZERO;

        for (let i = tickLowest; i <= tickUppest; i++) {
            let keyTick = i % spacing === 0;
            if (liquidityDeltaMap[i] !== undefined) {
                liquidity = liquidity.add(liquidityDeltaMap[i]);
                keyTick = true;
            }
            if (keyTick) {
                result.push({
                    liquidity: liquidity,
                    tick: i,
                    price: fromWad(sqrtX96ToWad(TickMath.getSqrtRatioAtTick(i))),
                });
            }
        }
        return result;
    }
}
