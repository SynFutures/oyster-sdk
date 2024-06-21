/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { GRAPH_PAGE_SIZE, SECS_PER_HOUR, now } from '@derivation-tech/web3-core';
import { SynFuturesV3 } from '../synfuturesV3Core';
import { PairModel } from '../types/pair';
import { BigNumber } from 'ethers';
import { wdiv } from '../math';
import { asInt128, concatId, hourIdFromTimestamp } from '../common/util';

export enum FundingChartInterval {
    HOUR = '1h',
    EIGHT_HOUR = '8h',
}

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
    async getLastHourFundingRate(pairModel: PairModel): Promise<FundingChartData> {
        const latestFundingIndex = this.synfV3.getLastestFundingIndex(
            pairModel.amm,
            pairModel.markPrice,
            pairModel.state.blockInfo!.timestamp,
        );

        const timestmapBefore = pairModel.state.blockInfo!.timestamp - 3600;
        const fundingSnapshotBefore = await this.getFundingSnapshotBefore(
            this.synfV3,
            pairModel.rootInstrument.info.addr,
            [timestmapBefore],
        );

        const instrumentBefore = (
            await this.synfV3.contracts.observer.getInstrumentByAddressList([pairModel.rootInstrument.info.addr], {
                blockTag: Number(fundingSnapshotBefore[0].blockNumber),
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

    async getFundingRateData(interval: FundingChartInterval, pairModel: PairModel): Promise<FundingChartData[]> {
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

        const fundingSnapshot = await this.getFundingSnapshotBefore(this.synfV3, pairModel.rootInstrument.info.addr, [
            lastHourlyData.timestamp,
        ]);

        const instrumentBefore = (
            await this.synfV3.contracts.observer.getInstrumentByAddressList([pairModel.rootInstrument.info.addr], {
                blockTag: Number(fundingSnapshot[0].blockNumber),
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

    async getUpdateFundingIndexEvents(
        synfV3: SynFuturesV3,
        instrumentAddr: string,
        startTs?: number,
        endTs?: number,
    ): Promise<{ timestamp: number; longFundingIndex: BigNumber; shortFundingIndex: BigNumber }[]> {
        const fn = (str: string): string => `"${str}"`;
        const graphQL = `
        query($skip: Int, $first: Int, $lastID: String){
            transactionEvents(skip: $skip, first: $first, where: {
                name_in: ["UpdateFundingIndex"],
                address_contains: ${fn(instrumentAddr)},timestamp_gte: ${startTs ?? 0},timestamp_lte: ${
            endTs ?? now()
        }, id_gt: $lastID}, ){
                id
                name
                args
                address
                logIndex
                blockNumber
                timestamp
                trader
                amm {
                    id
                    symbol
                }
                instrument {
                    id
                    symbol
                }
                transaction {
                    id
                }
            }
        }`;
        const events = await synfV3.subgraph.queryAll(graphQL, GRAPH_PAGE_SIZE, true);
        return events.map((event: { args: string; timestamp: number }) => {
            const fundingIndex = JSON.parse(event.args).fundingIndex;
            const longFundingIndex = asInt128(BigNumber.from(fundingIndex).mask(128));
            const shortFundingIndex = asInt128(BigNumber.from(fundingIndex).shr(128).mask(128));
            return {
                timestamp: event.timestamp,
                longFundingIndex,
                shortFundingIndex,
            };
        });
    }

    async getFirstFundingEvent(synfV3: SynFuturesV3, instrumentAddr: string): Promise<FundingIndexSnapshot> {
        const fn = (str: string): string => `"${str}"`;
        const graphQL = `
        query($skip: Int, $first: Int, $lastID: String){
            transactionEvents(skip: $skip, first: $first, where: {
                name_in: ["UpdateFundingIndex"],
                address_contains: ${fn(instrumentAddr)}, id_gt: $lastID},
                orderBy: timestamp, orderDirection: asc
                , ){
                id
                name
                args
                address
                logIndex
                blockNumber
                timestamp
                trader
                amm {
                    id
                    symbol
                }
                instrument {
                    id
                    symbol
                }
                transaction {
                    id
                }
            }
        }`;
        const event = (await synfV3.subgraph.query(graphQL, 0, 1)).transactionEvents[0];
        if (event) {
            const fundingIndex = JSON.parse(event.args).fundingIndex;
            const longFundingIndex = asInt128(BigNumber.from(fundingIndex).mask(128));
            const shortFundingIndex = asInt128(BigNumber.from(fundingIndex).shr(128).mask(128));
            return {
                timestamp: event.timestamp,
                blockNumber: event.blockNumber,
                longFundingIndex,
                shortFundingIndex,
            };
        } else {
            return {
                timestamp: undefined,
                blockNumber: undefined,
                longFundingIndex: undefined,
                shortFundingIndex: undefined,
            };
        }
    }

    async getFundingSnapshotBefore(
        synfV3: SynFuturesV3,
        instrumentAddr: string,
        endTimes: number[],
        BATCH_SIZE = 12,
    ): Promise<FundingIndexSnapshot[]> {
        const fn = (str: string): string => `"${str}"`;
        const batchedEndTimes = [];
        const result: FundingIndexSnapshot[] = [];

        for (let i = 0; i < endTimes.length; i += BATCH_SIZE) {
            batchedEndTimes.push(endTimes.slice(i, i + BATCH_SIZE));
        }
        const calls = [];
        for (const batch of batchedEndTimes) {
            let graphQL = `query($skip: Int, $first: Int, $lastID: String){`;
            for (const endTime of batch) {
                graphQL += `${'timestamp' + endTime}: updateFundingIndexEvents(first: 1, where: {
                address: ${fn(instrumentAddr)},
                transaction_: {timestamp_lte: ${endTime}}
            }
                orderBy: transaction__timestamp
                orderDirection: desc
            ) {
                longFundingIndex
                shortFundingIndex
                transaction{
                  timestamp
                  blockNumber
                }
              }`;
            }
            graphQL += `}`;
            calls.push(synfV3.subgraph.query(graphQL, 0, 1));
        }
        const eventsBatch: {
            [key: string]: {
                longFundingIndex: BigNumber;
                shortFundingIndex: BigNumber;
                transaction: { timestamp: number; blockNumber: number };
            }[];
        }[] = await Promise.all(calls);
        for (const events of eventsBatch) {
            for (const event of Object.values(events)) {
                if (event) {
                    result.push({
                        timestamp: event[0].transaction.timestamp,
                        blockNumber: event[0].transaction.blockNumber,
                        longFundingIndex: BigNumber.from(event[0].longFundingIndex),
                        shortFundingIndex: BigNumber.from(event[0].shortFundingIndex),
                    });
                } else {
                    result.push({
                        timestamp: undefined,
                        blockNumber: undefined,
                        longFundingIndex: undefined,
                        shortFundingIndex: undefined,
                    });
                }
            }
        }
        return result;
    }

    async getHourlyDataList(
        instrumentAddr: string,
        expiry: number,
        timestamp = now(),
        numDays = 15,
    ): Promise<HourlyData[]> {
        const fn = (str: string): string => `"${str}"`;
        const ammId = `${fn(concatId(instrumentAddr, expiry).toLowerCase())}`;

        const hourId = hourIdFromTimestamp(timestamp);
        const nDaysAgoHourId = hourId - numDays * 24 * SECS_PER_HOUR;

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
}
