/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ChainContext, SECS_PER_HOUR, now } from '@derivation-tech/web3-core';
import { SynFuturesV3 } from '../synfuturesV3Core';
import { PairModel } from '../types/pair';
import { BigNumber } from 'ethers';
import { wdiv } from '../math';
import { asInt128, concatId, hourIdFromTimestamp } from '../common/util';
import retry from 'async-retry';
import fetch, { RequestInit } from 'node-fetch';

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
        numDays = 15,
    ): Promise<HourlyData[]> {
        const fn = (str: string): string => `"${str}"`;

        const hourId = hourIdFromTimestamp(timestamp);
        const nDaysAgoHourId = hourId - numDays * 24 * SECS_PER_HOUR;
        const PAYLOAD_SIZE = 20;
        const result: HourlyData[] = [];

        const temp = [];
        for (let i = hourId; i >= nDaysAgoHourId; i -= PAYLOAD_SIZE * SECS_PER_HOUR) {
            let graphQL = `{`;

            for (let j = 0; j < PAYLOAD_SIZE && i - j * SECS_PER_HOUR >= nDaysAgoHourId; j++) {
                const currentHourId = i - j * SECS_PER_HOUR;
                const ammId = `${fn(concatId(concatId(instrumentAddr, expiry), currentHourId).toLowerCase())}`;
                graphQL += `
                    a${currentHourId}: hourlyAmmData(id: ${ammId}) {
                        id
                        timestamp
                        firstFundingIndex
                        lastFundingIndex
                        firstMarkPrice
                        lastMarkPrice
                    }`;
            }

            graphQL += `}`;

            const graphql = JSON.stringify({
                query: `${graphQL}`,
            });

            // requestOptions
            const opts: RequestInit = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: graphql,
                redirect: 'follow',
                timeout: 100000,
            };

            const resp = await retry(async () => {
                const response = await fetch(this.synfV3.subgraph.endpoint, opts);
                const json = await response.json();
                if (!json.data || json.errors) {
                    this.synfV3.subgraph.logger.error('subgraph query error:', json);
                    throw new Error('subgraph query error' + JSON.stringify(json.errors));
                }
                return json.data;
            }, this.synfV3.subgraph.retryOption);

            // Process response and add to result
            for (const key in resp) {
                if (Object.prototype.hasOwnProperty.call(resp, key)) {
                    temp.push(resp[key]);
                }
            }
        }

        for (let i = 0; i < temp.length; i++) {
            const hourlyData = temp[i];

            let lastMarkPrice = BigNumber.from(hourlyData.lastMarkPrice);
            let offset = 1;
            while (lastMarkPrice.eq(0) && (i + offset < temp.length || i - offset >= 0)) {
                if (i + offset < temp.length) {
                    lastMarkPrice = BigNumber.from(temp[i + offset].lastMarkPrice);
                }
                if (lastMarkPrice.eq(0) && i - offset >= 0) {
                    lastMarkPrice = BigNumber.from(temp[i - offset].lastMarkPrice);
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
