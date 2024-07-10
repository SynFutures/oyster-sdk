/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ChainContext, GRAPH_PAGE_SIZE, SECS_PER_HOUR, now } from '@derivation-tech/web3-core';
import { SynFuturesV3 } from '../synfuturesV3Core';
import { PairModel } from '../types/pair';
import { BigNumber } from 'ethers';
import { wdiv } from '../math';
import { asInt128, concatId, hourIdFromTimestamp } from '../common/util';

export enum FundingChartInterval {
    HOUR = '1h',
    EIGHT_HOUR = '8h',
}

export const BlockInterval = {
    BLAST: 2,
    BASE: 2,
};

export interface FundingIndexSnapshot {
    timestamp?: number;
    blockNumber?: number;
    longFundingIndex?: BigNumber;
    shortFundingIndex?: BigNumber;
}

export interface FundingChartData {
    timestamp: number;
    longFundingRate: BigNumber;
    shortFundingRate: BigNumber;
}

export interface HourlyData {
    timestamp: number;
    lastFundingIndex: BigNumber;
    lastMarkPrice: BigNumber;
}

export class FundingChartDataProvider {
    synfV3: SynFuturesV3;
    dataLength: Map<FundingChartInterval, number> = new Map([
        [FundingChartInterval.HOUR, 72],
        [FundingChartInterval.EIGHT_HOUR, 42],
    ]);

    constructor(synfV3: SynFuturesV3) {
        this.synfV3 = synfV3;
    }

    // funding rate = (fundingIndex[t] - fundingIndex[t-1]) / markPrice[t]
    async getLastHourFundingRate(pairModel: PairModel, ctx: ChainContext): Promise<FundingChartData> {
        const latestFundingIndex = this.synfV3.getLastestFundingIndex(
            pairModel.amm,
            pairModel.markPrice,
            pairModel.state.blockInfo!.timestamp,
        );

        const timestmapBefore = pairModel.state.blockInfo!.timestamp - 3600;

        const instrumentBefore = (
            await this.synfV3.contracts.observer.getInstrumentByAddressList([pairModel.rootInstrument.info.addr], {
                blockTag: await this.getBlockNumber(timestmapBefore, ctx),
            })
        )[0][0];
        const ammBefore = instrumentBefore.amms[0];
        const markPriceBefore = instrumentBefore.markPrices[0];
        const beforeFundingIndex = this.synfV3.getLastestFundingIndex(ammBefore, markPriceBefore, timestmapBefore);
        const longFundingRate = wdiv(
            latestFundingIndex.longFundingIndex.sub(beforeFundingIndex.longFundingIndex),
            pairModel.markPrice,
        );
        const shortFundingRate = wdiv(
            latestFundingIndex.shortFundingIndex.sub(beforeFundingIndex.shortFundingIndex),
            pairModel.markPrice,
        );
        return { timestamp: pairModel.state.blockInfo!.timestamp, longFundingRate, shortFundingRate };
    }

    async getFundingRateData(
        interval: FundingChartInterval,
        pairModel: PairModel,
        ctx: ChainContext,
    ): Promise<FundingChartData[]> {
        const intervalSeconds = this.getIntervalSeconds(interval);
        const endTs = this.roundTimestamp(interval, now());
        const startTs = endTs - intervalSeconds * this.dataLength.get(interval)!;

        // given hourly data list, while the list is not empty and the hourly data's timestmap is greater than startTs, loop
        let fundingSnapshotAtTs: (FundingIndexSnapshot & { markPrice: BigNumber })[] = [];
        let timestamp = endTs;
        const hourlyDataList = await this.getHourlyDataList(pairModel.rootInstrument.info.addr, pairModel.amm.expiry);
        // if there's still zero mark price, use the lastest mark price as fallback
        const markPriceNow = pairModel.markPrice;
        for (const hourlyData of hourlyDataList) {
            if (hourlyData.lastMarkPrice.eq(0)) {
                hourlyData.lastMarkPrice = markPriceNow;
            }
        }
        const lastHourlyData = hourlyDataList[0];
        while (hourlyDataList.length > 0 && hourlyDataList[0].timestamp > startTs) {
            while (hourlyDataList.length > 0 && hourlyDataList[0].timestamp > timestamp) {
                hourlyDataList.shift();
            }
            if (hourlyDataList.length === 0) break;
            const fundingIndex = hourlyDataList[0].lastFundingIndex;
            const longFundingIndex = asInt128(BigNumber.from(fundingIndex).mask(128));
            const shortFundingIndex = asInt128(BigNumber.from(fundingIndex).shr(128).mask(128));
            fundingSnapshotAtTs.push({
                timestamp,
                longFundingIndex,
                shortFundingIndex,
                markPrice: hourlyDataList[0].lastMarkPrice,
            });
            timestamp -= intervalSeconds;
        }
        fundingSnapshotAtTs = fundingSnapshotAtTs.reverse();

        // calculate funding rate based on funding index at ts[i] and ts[i-1]
        // funding rate = (fundingIndex[t] - fundingIndex[t-1]) / markPrice[t]
        const fundingRates: { timestamp: number; longFundingRate: BigNumber; shortFundingRate: BigNumber }[] = [];
        for (let i = 1; i < fundingSnapshotAtTs.length; i++) {
            const longFundingRate = wdiv(
                fundingSnapshotAtTs[i].longFundingIndex!.sub(fundingSnapshotAtTs[i - 1].longFundingIndex!),
                fundingSnapshotAtTs[i].markPrice,
            );
            const shortFundingRate = wdiv(
                fundingSnapshotAtTs[i].shortFundingIndex!.sub(fundingSnapshotAtTs[i - 1].shortFundingIndex!),
                fundingSnapshotAtTs[i].markPrice,
            );
            fundingRates.push({ timestamp: fundingSnapshotAtTs[i].timestamp!, longFundingRate, shortFundingRate });
        }

        const instrumentBefore = (
            await this.synfV3.contracts.observer.getInstrumentByAddressList([pairModel.rootInstrument.info.addr], {
                blockTag: await this.getBlockNumber(lastHourlyData.timestamp, ctx),
            })
        )[0][0];
        const latestFundingIndex = this.synfV3.getLastestFundingIndex(
            instrumentBefore.amms[0],
            instrumentBefore.markPrices[0],
            now(),
        );
        fundingRates.push({
            timestamp: now(),
            longFundingRate: wdiv(
                latestFundingIndex.longFundingIndex.sub(
                    fundingSnapshotAtTs[fundingSnapshotAtTs.length - 1].longFundingIndex!,
                ),
                pairModel.markPrice,
            ),
            shortFundingRate: wdiv(
                latestFundingIndex.shortFundingIndex.sub(
                    fundingSnapshotAtTs[fundingSnapshotAtTs.length - 1].shortFundingIndex!,
                ),
                pairModel.markPrice,
            ),
        });

        return fundingRates;
    }

    roundTimestamp(interval: FundingChartInterval, ts: number): number {
        switch (interval) {
            case FundingChartInterval.HOUR:
                return hourIdFromTimestamp(ts);
            case FundingChartInterval.EIGHT_HOUR: {
                const date = new Date(ts * 1000);
                const hours = this.getIntervalSeconds(interval) / SECS_PER_HOUR;
                const startHours = Math.floor(date.getHours() / hours) * hours;
                date.setHours(startHours, 0, 0);
                return date.getTime() / 1000;
            }
            default:
                throw new Error('unsupported funding chart interval');
        }
    }

    getIntervalSeconds(interval: FundingChartInterval): number {
        switch (interval) {
            case FundingChartInterval.HOUR:
                return SECS_PER_HOUR;
            case FundingChartInterval.EIGHT_HOUR:
                return 8 * SECS_PER_HOUR;
            default:
                throw new Error('unsupported funding chart interval');
        }
    }

    async getHourlyDataList(
        instrumentAddr: string,
        expiry: number,
        timestamp = now(),
        numDays = 14,
    ): Promise<HourlyData[]> {
        const fn = (str: string): string => `"${str}"`;
        const ammId = `${fn(concatId(instrumentAddr, expiry).toLowerCase())}`;

        const hourId = hourIdFromTimestamp(timestamp);
        const nDaysAgoHourId = hourId - numDays * 24 * SECS_PER_HOUR - 1;

        // console.info(timestamp, dayId, hourId, _7d, _24h);
        const graphQL = `
            query($skip: Int, $first: Int, $lastID: String){
                hourlyAmmDatas(skip: $skip, first: $first, where: {
                    amm_contains: ${ammId} timestamp_gt: ${nDaysAgoHourId}, timestamp_lte: ${hourId}
                }, orderBy: timestamp, orderDirection: desc) {
                    id
                    timestamp
                    firstFundingIndex
                    lastFundingIndex
                    firstMarkPrice
                    lastMarkPrice
                }
            }`;
        const result: HourlyData[] = [];
        const resp = await this.synfV3.subgraph.query(graphQL, 0, GRAPH_PAGE_SIZE);

        for (let i = 0; i < resp.hourlyAmmDatas.length; i++) {
            const hourlyData = resp.hourlyAmmDatas[i];

            let lastMarkPrice = BigNumber.from(hourlyData.lastMarkPrice);
            let offset = 1;
            while (lastMarkPrice.eq(0) && (i + offset < resp.hourlyAmmDatas.length || i - offset >= 0)) {
                if (i + offset < resp.hourlyAmmDatas.length) {
                    lastMarkPrice = BigNumber.from(resp.hourlyAmmDatas[i + offset].lastMarkPrice);
                }
                if (lastMarkPrice.eq(0) && i - offset >= 0) {
                    lastMarkPrice = BigNumber.from(resp.hourlyAmmDatas[i - offset].lastMarkPrice);
                }
                offset++;
            }
            result.push({
                timestamp: Number(hourlyData.timestamp),
                lastFundingIndex: BigNumber.from(hourlyData.lastFundingIndex),
                lastMarkPrice,
            });
        }

        return result;
    }

    async getBlockNumber(timestamp: number, ctx: ChainContext): Promise<number> {
        const blockNumber = await ctx.provider.getBlockNumber();
        return (
            blockNumber -
            Math.ceil((now() - timestamp) / BlockInterval[ctx.chainName.toUpperCase() as keyof typeof BlockInterval])
        );
    }
}
