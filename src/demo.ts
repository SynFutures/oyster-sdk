/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { CHAIN_ID, formatWad, fromWad, now } from '@derivation-tech/web3-core';
import { parseEther } from 'ethers/lib/utils';
import { PERP_EXPIRY } from './constants';
import { IKlineDataProvider, KlineDataProvider, KlineInterval } from './chart/kline';
import { SynFuturesV3 } from './synfuturesV3Core';
import { DepthChartDataProvider } from './chart/depth';
import { FundingChartDataProvider, FundingChartInterval } from './chart/funding';
import { wdiv, wmul } from './math';
import { BigNumber } from 'ethers';

export async function demoKline(): Promise<void> {
    const synfV3 = SynFuturesV3.getInstance('Blast');
    const allInstruments = await synfV3.getAllInstruments();
    const instrument = allInstruments.find((i) => i.info.symbol.includes('BTC-USDB'))!;
    const klineProvider: IKlineDataProvider = new KlineDataProvider(CHAIN_ID.BLAST);
    // enum KlineInterval {
    //     MINUTE = '1m',
    //     FIVE_MINUTE = '5m',
    //     FIFTEEN_MINUTE = '15m',
    //     THIRTY_MINUTE = '30m',
    //     HOUR = '1h',
    //     FOUR_HOUR = '4h',
    //     WEEK = '1w',
    //     DAY = '1d',
    // }
    const klineData = await klineProvider.getKlineData(
        instrument.info.addr,
        PERP_EXPIRY,
        KlineInterval.HOUR,
        0, // start time
        now(), // end time, use now() to get the latest timestamp in seconds
        parseEther('0.01'), // filter out trade value less 0.1 quote token
    );
    console.log(klineData);
}

// demoKline().catch(console.error);

export async function demoDepth(): Promise<void> {
    const synfV3 = SynFuturesV3.getInstance('Blast');
    const allInstruments = await synfV3.getAllInstruments();
    const instrument = allInstruments.find((i) => i.info.symbol.includes('BTC-USDB'))!;
    const depthProvider = new DepthChartDataProvider(CHAIN_ID.BLAST);
    const pair = instrument.state.pairStates.get(PERP_EXPIRY)!;

    // get depth chart data from subgraph
    const depth1 = await depthProvider.getDepthData(
        instrument.info.addr,
        PERP_EXPIRY,
        pair.amm.liquidity,
        pair.amm.sqrtPX96,
        instrument.setting.initialMarginRatio,
    );
    console.log(depth1);

    const IMR_STEP_RATIO_MAP = {
        100: [5, 10, 15],
        300: [5, 15, 35],
        500: [5, 25, 50],
        1000: [5, 50, 100],
    };

    // get default range depth chart data from Observer contract's onchain query
    const depth2 = await depthProvider.getDepthDataFromObserver(
        synfV3.contracts.observer,
        instrument.info.addr,
        PERP_EXPIRY,
        IMR_STEP_RATIO_MAP[instrument.setting.initialMarginRatio as keyof typeof IMR_STEP_RATIO_MAP][1],
    );
    console.log(depth2);

    // get full range depth chart data from Observer
    const depth3 = await depthProvider.getDepthRangeDataFromObserver(
        synfV3.contracts.observer,
        instrument.info.addr,
        PERP_EXPIRY,
        IMR_STEP_RATIO_MAP[instrument.setting.initialMarginRatio as keyof typeof IMR_STEP_RATIO_MAP][1],
    );
    console.log(depth3);

    // get custom price range depth chart data from Observer
    const depth4 = await depthProvider.getDepthRangeDataFromObserver(
        synfV3.contracts.observer,
        instrument.info.addr,
        PERP_EXPIRY,
        IMR_STEP_RATIO_MAP[instrument.setting.initialMarginRatio as keyof typeof IMR_STEP_RATIO_MAP][1],
        false, // set to true when pair's price is inverted, e.g., pair is USDB-WETH-PYTH-PERP, but the price is shown as WETH-USDB
        parseEther('50000'), // lower price in WAD
        parseEther('70000'), // upper price in WAD
    );
    console.log(depth4);

    // get order book data, (price, size, size sum)
    const orderBook: {
        left: { price: number; size: number; sizeSum: number }[];
        right: { price: number; size: number; sizeSum: number }[];
    } = {
        left: [],
        right: [],
    };
    for (const data of depth3.left) {
        orderBook.left.push({
            price: data.price,
            size: data.base,
            sizeSum:
                orderBook.left.length === 0 ? data.base : orderBook.left[orderBook.left.length - 1].sizeSum + data.base,
        });
    }
    for (const data of depth3.right) {
        orderBook.right.push({
            price: data.price,
            size: data.base,
            sizeSum:
                orderBook.right.length === 0
                    ? data.base
                    : orderBook.right[orderBook.right.length - 1].sizeSum + data.base,
        });
    }
    console.log(orderBook);
}

// demoDepth().catch(console.error);

export async function demoFundingRate(): Promise<void> {
    const synfV3 = SynFuturesV3.getInstance('blast');
    const allInstruments = await synfV3.getAllInstruments();
    const instrument = allInstruments.find((i) => i.info.symbol.includes('BTC-USDB'))!;
    console.log(instrument.info.symbol);
    const pair = instrument.getPairModel(PERP_EXPIRY)!;
    console.log(pair.amm.status);
    const fundingProvider = new FundingChartDataProvider(synfV3);

    // get last hour funding rate
    const lastHourFundingRate = await fundingProvider.getLastHourFundingRate(pair);
    console.log(
        `last hour funding rate: ${fromWad(lastHourFundingRate.longFundingRate)}, ${fromWad(
            lastHourFundingRate.shortFundingRate,
        )}`,
    );

    // get history funding rate chart data
    console.log(`history one hour funding rate: `);
    const oneHourFundingRate = await fundingProvider.getFundingRateData(FundingChartInterval.HOUR, pair);
    console.log(oneHourFundingRate.length);
    for (const rate of oneHourFundingRate) {
        console.log(rate.timestamp, formatWad(rate.longFundingRate), formatWad(rate.shortFundingRate));
    }
    console.log(`history eight hour funding rate: `);
    const eightHourFundingRate = await fundingProvider.getFundingRateData(FundingChartInterval.EIGHT_HOUR, pair);
    console.log(eightHourFundingRate.length);
    for (const rate of eightHourFundingRate) {
        console.log(rate.timestamp, formatWad(rate.longFundingRate), formatWad(rate.shortFundingRate));
    }

    // get estimated projected funding rate
    const fair = pair.fairPriceWad;
    const mark = pair.markPrice;
    const projectedFundingRate = wdiv(fair.sub(mark), mark).div(24);
    const longPayShort = fair.gt(mark);
    let projectedLongFundingRate: BigNumber;
    let projectedShortFundingRate: BigNumber;
    if (longPayShort) {
        projectedLongFundingRate = projectedFundingRate.mul(-1);
        projectedShortFundingRate = projectedFundingRate.mul(pair.amm.totalLong).div(pair.amm.totalShort);
    } else {
        projectedShortFundingRate = projectedFundingRate;
        projectedLongFundingRate = projectedFundingRate.mul(pair.amm.totalShort).div(pair.amm.totalLong).mul(-1);
    }
    console.log(
        `projected one hour funding rate is for long: ${fromWad(projectedLongFundingRate)}, for short: ${fromWad(
            projectedShortFundingRate,
        )}`,
    );
}

// demoFundingRate().catch(console.error);

export async function demoTradePageUserInfo(): Promise<void> {
    const synfV3 = SynFuturesV3.getInstance('blast');
    const allInstruments = await synfV3.getAllInstruments();
    const instrument = allInstruments.find((i) => i.info.symbol.includes('BTC-USDB'))!;
    console.log(instrument.info.symbol);
    const pair = instrument.getPairModel(PERP_EXPIRY)!;
    const trader = ''; // TODO: fill in the trader address

    // get user trade history
    const userTradeHistory = await synfV3.subgraph.getVirtualTrades({
        traders: [trader],
        instrumentAddr: instrument.info.addr,
        expiry: pair.amm.expiry,
        // to get all history, just ignore startTs and endTs
        startTs: now() - 3600 * 24 * 30, // 30 days ago, get 1 month history
        endTs: now(),
    });
    console.log(userTradeHistory);

    // get user order history
    const userOrderHistory = await synfV3.subgraph.getUserOrders({
        traders: [trader],
        instrumentAddr: instrument.info.addr,
        expiry: pair.amm.expiry,
        // to get all history, just ignore startTs and endTs
        startTs: now() - 3600 * 24 * 30, // 30 days ago, get 1 month history
        endTs: now(),
    });
    console.log(userOrderHistory);

    // get user funding history
    const userFundingHistory = await synfV3.subgraph.getTransactionEvents({
        eventNames: ['FundingFee'],
        traders: [trader],
        instrumentAddr: instrument.info.addr,
        expiry: pair.amm.expiry,
        // to get all history, just ignore startTs and endTs
        startTs: now() - 3600 * 24 * 30, // 30 days ago, get 1 month history
        endTs: now(),
    });
    console.log(userFundingHistory);

    // get user position
    const userAccount = await synfV3.getPairLevelAccount(trader, instrument.info.addr, pair.amm.expiry);
    console.log(userAccount.getMainPosition());
    console.log(userAccount.orders);
}

// demoTradePageUserInfo().catch(console.error);

export async function demoMarketInfoPage(): Promise<void> {
    const synfV3 = SynFuturesV3.getInstance('blast');
    const allInstruments = await synfV3.getAllInstruments();
    const allPairsData = await synfV3.subgraph.getPairsData();
    for (const pairData of allPairsData) {
        const pair = allInstruments
            .find((i) => i.info.addr.toLowerCase() === pairData.instrumentAddr.toLowerCase())!
            .getPairModel(pairData.expiry)!;
        console.log(
            `${pair.symbol}, ${formatWad(pair.fairPriceWad)}, ${formatWad(pairData.priceChange24h)}, ${formatWad(
                pairData.high24h,
            )}, ${formatWad(pairData.low24h)}, ${formatWad(pairData.volume24h)}, ${formatWad(
                wmul(pair.amm.openInterests, pair.fairPriceWad), // represented in quote token, need to convert to dollar value
            )}`,
        );
    }
}

// demoMarketInfoPage().catch(console.error);
