import { CHAIN_ID, GRAPH_PAGE_SIZE, now } from '@derivation-tech/web3-core';
import { concatId, fromWad } from '../common/util';
import { Subgraph } from '../subgraph';
import { ConfigManager } from '../config';

export interface VolumeChartData {
    timestamp: number;
    baseVolume: number;
    quoteVolume: number;
}

export interface IVolumeChartDataProvider {
    getVolumeData(instrumentAddr: string, expiry: number, startTs: number, endTs: number): Promise<VolumeChartData[]>;
}

export class VolumeChartDataProvider implements IVolumeChartDataProvider {
    chainId: CHAIN_ID;
    subgraph: Subgraph;

    constructor(chainId: CHAIN_ID) {
        this.chainId = chainId;
        this.subgraph = new Subgraph(ConfigManager.getSynfConfig(chainId).subgraphProxy);
    }

    async getVolumeData(
        instrumentAddr: string,
        expiry: number,
        startTs: number,
        endTs: number,
    ): Promise<VolumeChartData[]> {
        const fn = (str: string): string => `"${str}"`;
        const ammCondition = `amm: ${fn(concatId(instrumentAddr, expiry).toLowerCase())},`;
        const startTsCondition = `timestamp_gte: ${startTs || 0},`;
        const endTsCondition = `timestamp_lt: ${endTs || now()},`;

        const graphQL = `
          query($skip: Int, $first: Int, $lastID: String){
            dailyAmmDatas(first: $first, where: {${ammCondition} ${startTsCondition}${endTsCondition} id_gt: $lastID}, orderBy: timestamp, orderDirection: asc){
              id
              timestamp
              volume
              baseVolume
            }
          }`;
        const result: VolumeChartData[] = [];
        const dailyAmmDatas = await this.subgraph.queryAll(graphQL, GRAPH_PAGE_SIZE, true);
        for (const dailyData of dailyAmmDatas) {
            result.push({
                timestamp: Number(dailyData.timestamp),
                baseVolume: fromWad(dailyData.baseVolume),
                quoteVolume: fromWad(dailyData.volume),
            });
        }
        return result;
    }
}
