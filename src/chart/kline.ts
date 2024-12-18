import {
    CHAIN_ID,
    GRAPH_PAGE_SIZE,
    SECS_PER_DAY,
    SECS_PER_HOUR,
    SECS_PER_MINUTE,
    SECS_PER_WEEK,
} from '@derivation-tech/web3-core';
import { Subgraph } from '../subgraph';
import { ConfigManager } from '../config';
import { concatId, dayIdFromTimestamp, fromWad, hourIdFromTimestamp, weekIdFromTimestamp } from '../common/util';
import { BigNumber } from 'ethers';

export enum KlineInterval {
    MINUTE = '1m',
    FIVE_MINUTE = '5m',
    FIFTEEN_MINUTE = '15m',
    THIRTY_MINUTE = '30m',
    HOUR = '1h',
    FOUR_HOUR = '4h',
    WEEK = '1w',
    DAY = '1d',
}

export interface KlineData {
    timestamp: number;

    open: number;
    close: number;
    low: number;
    high: number;

    baseVolume: number;
    quoteVolume: number;
}

export interface IKlineDataProvider {
    getKlineData(
        instrumentAddr: string,
        expiry: number,
        interval: KlineInterval,
        startTs: number,
        endTs: number,
        minTradeValue: BigNumber,
    ): Promise<KlineData[]>;
}

// get interval statement for subgraph query
function getIntervalStatement(interval: KlineInterval): string {
    switch (interval) {
        case KlineInterval.HOUR:
            return 'hourlyAmmDatas';
        case KlineInterval.DAY:
            return 'dailyAmmDatas';
        case KlineInterval.WEEK:
            return 'weeklyAmmDatas';
        case KlineInterval.FOUR_HOUR:
            return 'per4HourAmmDatas';
        default:
            throw new Error('unsupported kline interval' + interval);
    }
}

// round timestamp to the start of the interval
function roundTimestamp(interval: KlineInterval, ts: number): number {
    switch (interval) {
        case KlineInterval.HOUR:
            return hourIdFromTimestamp(ts);
        case KlineInterval.DAY:
            return dayIdFromTimestamp(ts);
        case KlineInterval.WEEK:
            return weekIdFromTimestamp(ts);
        case KlineInterval.MINUTE:
        case KlineInterval.FIVE_MINUTE:
        case KlineInterval.FIFTEEN_MINUTE:
        case KlineInterval.THIRTY_MINUTE: {
            const date = new Date(ts * 1000);
            const mintues = getIntervalSeconds(interval) / SECS_PER_MINUTE;
            const startMinutes = Math.floor(date.getMinutes() / mintues) * mintues;
            date.setMinutes(startMinutes, 0, 0);
            return date.getTime() / 1000;
        }
        default:
            throw new Error('unsupported kline interval');
    }
}

function getIntervalSeconds(interval: KlineInterval): number {
    switch (interval) {
        case KlineInterval.HOUR:
            return SECS_PER_HOUR;
        case KlineInterval.DAY:
            return SECS_PER_DAY;
        case KlineInterval.WEEK:
            return SECS_PER_WEEK;
        case KlineInterval.MINUTE:
            return SECS_PER_MINUTE;
        case KlineInterval.FIVE_MINUTE:
            return 5 * SECS_PER_MINUTE;
        case KlineInterval.FIFTEEN_MINUTE:
            return 15 * SECS_PER_MINUTE;
        case KlineInterval.THIRTY_MINUTE:
            return 30 * SECS_PER_MINUTE;
        case KlineInterval.FOUR_HOUR:
            return 4 * SECS_PER_HOUR;
        default:
            throw new Error('unsupported kline interval');
    }
}

export class KlineDataProvider implements IKlineDataProvider {
    chainId: CHAIN_ID;
    subgraph: Subgraph;

    constructor(chainId: CHAIN_ID) {
        this.chainId = chainId;
        this.subgraph = new Subgraph(ConfigManager.getSynfConfig(chainId).subgraphProxy);
    }

    async getKlineData(
        instrumentAddr: string,
        expiry: number,
        interval: KlineInterval,
        startTs: number,
        endTs: number,
        minTradeValue: BigNumber,
    ): Promise<KlineData[]> {
        const _interval = getIntervalSeconds(interval);

        startTs = Math.floor(startTs / _interval) * _interval;
        endTs = Math.ceil(endTs / _interval) * _interval;

        let candles;
        if (
            interval === KlineInterval.DAY ||
            interval === KlineInterval.WEEK ||
            interval === KlineInterval.HOUR ||
            interval === KlineInterval.FOUR_HOUR
        ) {
            candles = await this.getKlinesDirectly(instrumentAddr, expiry, interval, startTs, endTs);
        } else {
            candles = await this.getKlinesFromRawEvents(
                instrumentAddr,
                expiry,
                interval,
                startTs,
                endTs,
                minTradeValue,
            );
        }

        return this.completeKlines(interval, endTs, candles);
    }

    // get klines data directly from subgraph, applicable for 1h, 4h, 1d, 1w
    async getKlinesDirectly(
        instrumentAddr: string,
        expiry: number,
        interval: KlineInterval,
        startTs: number,
        endTs: number,
    ): Promise<{ [ts: number]: KlineData }> {
        const ammId = concatId(instrumentAddr, expiry).toLowerCase();
        const condition = `amm: "${ammId}", open_gt: 0, id_gt: $lastID, timestamp_gte: ${startTs}, timestamp_lte: ${endTs}`;
        const intervalStatement = getIntervalStatement(interval);
        const graphQL = `
            query($skip: Int, $first: Int, $lastID: String){
              ${intervalStatement}(first: $first, where: {${condition}}, orderBy: timestamp, orderDirection: asc){
                id
                timestamp
                open
                high
                low
                close
                volume
                baseVolume
              }
            }`;
        console.info(graphQL);
        const candles = await this.subgraph.queryAll(graphQL, GRAPH_PAGE_SIZE, true);
        const candleMap: { [ts: number]: KlineData } = {};
        for (const candle of candles) {
            candleMap[Number(candle.timestamp)] = {
                timestamp: Number(candle.timestamp),
                open: fromWad(candle.open),
                high: fromWad(candle.high),
                close: fromWad(candle.close),
                low: fromWad(candle.low),
                baseVolume: fromWad(candle.baseVolume),
                quoteVolume: fromWad(candle.volume),
            };
        }
        return candleMap;
    }

    // get klines data from raw events, applicable for 5m, 15m, 30m
    async getKlinesFromRawEvents(
        instrumentAddr: string,
        expiry: number,
        interval: KlineInterval,
        startTs: number,
        endTs: number,
        minTradeValue: BigNumber,
    ): Promise<{ [ts: number]: KlineData }> {
        const ammId = concatId(instrumentAddr, expiry).toLowerCase();
        // only consider Trade & Sweep event
        const condition = `type_in: [LIQUIDATION, MARKET], fee_gt: 0, amm: "${ammId}", timestamp_gte: ${startTs}, timestamp_lte: ${endTs}`;
        const graphQL = `query($skip: Int, $first: Int, $lastID: String){
            virtualTrades(first: $first, where: { ${condition}, id_gt: $lastID }){
                id
                price
                size
                timestamp
                tradeValue
            }
        }`;
        const FILTER_RATIO = 10;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const minTradeValueAccountedInCandles = minTradeValue.div(FILTER_RATIO);
        const events = (await this.subgraph.queryAll(graphQL, 1000, true)).filter((event) =>
            BigNumber.from(event.tradeValue).gt(minTradeValueAccountedInCandles),
        );
        const candleMap: { [ts: number]: KlineData } = {};
        for (const event of events) {
            const ts = roundTimestamp(interval, Number(event.timestamp));
            const candle = candleMap[ts];
            const px = fromWad(event.price);
            const size = Math.abs(fromWad(event.size));
            const volume = px * size;
            if (candle) {
                candle.close = px;
                candle.high = Math.max(candle.high, px);
                candle.low = Math.min(candle.low, px);
                candle.baseVolume += size;
                candle.quoteVolume += volume;
            } else {
                candleMap[ts] = {
                    timestamp: ts,
                    open: px,
                    close: px,
                    high: px,
                    low: px,
                    baseVolume: size,
                    quoteVolume: volume,
                };
            }
        }
        return candleMap;
    }

    // complete missing kline data
    completeKlines(interval: KlineInterval, endTs: number, data: { [ts: number]: KlineData }): KlineData[] {
        if (Object.keys(data).length === 0) {
            return [];
        }

        // sort by ts asc
        const keys = Object.keys(data);
        keys.sort();

        const result: KlineData[] = [];

        const startTs = data[Number(keys[0])].timestamp;
        // const endTs = data[Number(keys[keys.length - 1])].timestamp;

        let prev: KlineData = data[startTs];
        for (let i = startTs; i <= endTs; i += getIntervalSeconds(interval)) {
            if (data[i] && data[i].open > 0) {
                result.push(data[i]);
                prev = data[i];
            } else {
                const px = prev.close;
                // copy data from prev
                const ohlc = { timestamp: i, open: px, high: px, close: px, low: px, baseVolume: 0, quoteVolume: 0 };
                result.push(ohlc);
                prev = ohlc;
            }
        }
        return result;
    }
}

// export async function test(): Promise<void> {
//     const provider = new KlineDataProvider(CHAIN_ID.BLAST);
//     const ts = Math.floor(new Date().getTime() / 1000);
//     console.info(ts);
//     const data = await provider.getKlineData(
//         '0x0e1b878f5eddb7170b0a25ca63cb985291eb53d8',
//         4294967295,
//         KlineInterval.FOUR_HOUR,
//         ts - 60 * 60 * 8,
//         ts,
//         ZERO,
//     );
//     // print last 100 data
//     console.info(data);
//     // console.info(data);
//     // console.info(roundTimestamp(KlineInterval.THIRTY_MINUTE, 1698387300));
// }
// test().catch((err) => console.error(err));
// // // console.info(roundTimestamp(KlineInterval.FIVE_MINUTE, 1698658895));
