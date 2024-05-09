# SynFutures V3 SDK

SDK for SynFutures V3

## 💻 Getting Started

npm:

```
npm install @synfutures/oyster-sdk
```

yarn:

```
yarn add @synfutures/oyster-sdk
```

## 📝 Environment Variables Requirement

This package depends on the more fundamental package `@derivation-tech/web3-core`. Therefore, some environment variables need to be provided as required during runtime. Please refer to [here](https://www.npmjs.com/package/@derivation-tech/web3-core).

## 👀 Note

1. Before carrying out operations like trade, place, etc., please check the user's allowance for `Gate`.
2. When interacting with `Gate` (such as deposit, withdraw), the precision of the token is its own precision. However, when interacting with `Instrument`, the precision of the token is fixed at 18.

## Examples

1. [Query instruments and pairs information](#query-instruments-and-pairs-information)
2. [Query accout information](#query-accout-information)
3. [Deposit to `Gate`](#deposit-to-gate)
4. [Withdraw from `Gate`](#withdraw-from-gate)
5. [Trade](#trade)
6. [Adjust position, withdraw half of the available margin](#adjust-position-withdraw-half-of-the-available-margin)
7. [Place order](#place-order)
8. [Bulk cancel order](#bulk-cancel-order)
9. [Fill order](#fill-order)
10. [Add liquidity](#add-liquidity)
11. [Remove liquidity](#remove-liquidity)
12. [Query user operation history](#query-user-operation-history)
13. [Query pair kline chart data](#query-pair-kline)
14. [Query pair depth chart data](#query-pair-depth)
15. [Query pair funding rate data](#query-pair-funding-rate)
16. [Query user single pair info](#query-user-single-pair-info)
17. [Query market info](#query-market-info)
18. [Direct trade interface](#direct-trade-interface)
19. [Direct place interface](#direct-place-interface)
20. [Direct add interface](#direct-add-interface)
21. [Direct remove interface](#direct-remove-interface)
22. [Direct cancel interface](#direct-cancel-interface)
23. [Update pair](#update-pair)
24. [Settle trader](#settle-trader)

### Prerequisites

To successfully run the blew examples:

-   Please put BLAST_RPC=https://rpc.ankr.com/blast into the .env file where you run your command.
-   Also set your private key ALICE_PRIVATE_KEY=your_own_private_key if you want to send transactions.

### Query instruments and pairs information

```ts
import { ethers } from 'ethers';
import { InstrumentCondition, SynFuturesV3 } from '@synfutures/oyster-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('blast');

    const instruments = await sdk.getAllInstruments();

    for (const instrument of instruments) {
        // only show instruments spot price in NORMAL condition
        if (instrument.state.condition === InstrumentCondition.NORMAL) {
            console.log(instrument.info.symbol, ethers.utils.formatEther(instrument.spotPrice));
        }
        // show all pairs symbol, mark price and fair price
        for (const [expiry, pair] of instrument.pairs) {
            console.log(
                pair.symbol,
                expiry,
                ethers.utils.formatEther(pair.markPrice),
                ethers.utils.formatEther(pair.fairPriceWad),
            );
        }
    }
}

// ts-node src/demo.ts
main().catch(console.error);
```

### Query accout information

```ts
import { ethers } from 'ethers';
import { SynFuturesV3, PERP_EXPIRY } from '@synfutures/oyster-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('blast');

    // get signer address
    const signer = process.argv[2];

    const instruments = await sdk.getAllInstruments();

    function getInstrumentBySymbol(symbol: string) {
        const instrument = instruments.find((i) => i.info.symbol === symbol);
        if (!instrument) {
            throw new Error('unknown symbol: ' + symbol);
        }
        return instrument;
    }

    const instrument = getInstrumentBySymbol('BTC-USDB-PYTH');

    // get user account
    const account = await sdk.getPairLevelAccount(signer, instrument.info.addr, PERP_EXPIRY);

    console.log(
        `Position balance: ${ethers.utils.formatUnits(account.position.balance)}, size: ${ethers.utils.formatUnits(
            account.position.size,
        )}, entryNotional: ${ethers.utils.formatUnits(
            account.position.entryNotional,
        )}, entrySocialLossIndex: ${ethers.utils.formatUnits(
            account.position.entrySocialLossIndex,
        )}, entryFundingIndex: ${ethers.utils.formatUnits(account.position.entryFundingIndex, 18)}`,
    );

    for (const order of account.orders) {
        console.log(
            `Order id: ${order.oid}, size: ${ethers.utils.formatUnits(
                order.size,
                18,
            )}, balance: ${ethers.utils.formatUnits(order.balance, 18)}, tick: ${order.tick}, nonce: ${order.nonce}`,
        );
    }

    for (const range of account.ranges) {
        console.log(
            `Range id: ${range.rid}, size: ${ethers.utils.formatUnits(range.balance, 18)}, from: ${
                range.tickLower
            }, to: ${range.tickLower}`,
        );
    }
}

// ts-node src/demo.ts 0x0e038f13d9d5732223cf9b4b61eed264ccd44641
main().catch(console.error);
```

### Deposit to `Gate`

```ts
import { ethers } from 'ethers';
import { SynFuturesV3 } from '@synfutures/oyster-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('blast');

    // get your own signer
    const signer = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY as string, sdk.ctx.provider);

    // get USDB token info
    const usdb = await sdk.ctx.getTokenInfo('USDB');

    // approve
    await sdk.ctx.erc20.approveIfNeeded(
        signer,
        usdb.address,
        sdk.config.contractAddress.gate,
        ethers.constants.MaxUint256,
    );

    // deposit
    await sdk.deposit(signer, usdb.address, ethers.utils.parseUnits('10', usdb.decimals));

    console.log('Deposit 10 USDB to gate');
}

main().catch(console.error);
```

### Withdraw from `Gate`

```ts
import { SynFuturesV3 } from '@synfutures/oyster-sdk';
import { ethers } from 'ethers';

async function main() {
    const sdk = SynFuturesV3.getInstance('blast');

    // get your own signer
    const signer = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY as string, sdk.ctx.provider);

    // get USDB token info
    const usdb = await sdk.ctx.getTokenInfo('USDB');

    await sdk.withdraw(signer, usdb.address, ethers.utils.parseUnits('10', usdb.decimals));

    console.log('Withdraw 10 USDB from the gate');
}

main().catch(console.error);
```

### Trade

```ts
import { ethers } from 'ethers';
import { SynFuturesV3, PERP_EXPIRY, Side } from '@synfutures/oyster-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('blast');

    await sdk.init();

    // get your own signer
    const signer = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY as string, sdk.ctx.provider);

    const instruments = await sdk.getAllInstruments();

    function getInstrumentBySymbol(symbol: string) {
        const instrument = instruments.find((i) => i.info.symbol === symbol);
        if (!instrument) {
            throw new Error('unknown symbol: ' + symbol);
        }
        return instrument;
    }

    const instrument = getInstrumentBySymbol('BTC-USDB-PYTH');

    const pair = instrument.pairs.get(PERP_EXPIRY)!;

    // inquire quotation and how much BTC is equivalent to 500 USDB
    const { baseAmount, quotation } = await sdk.inquireByQuote(pair, Side.LONG, ethers.utils.parseUnits('500', 18));

    // update cache for signer
    await sdk.syncVaultCacheWithAllQuotes(await signer.getAddress());

    // simulate result
    const result = sdk.simulateTrade(
        await sdk.getPairLevelAccount(await signer.getAddress(), instrument.info.addr, PERP_EXPIRY),
        quotation,
        Side.LONG,
        baseAmount,
        undefined, // we want to estimate the required margin, so pass in undefined here
        ethers.utils.parseUnits('4', 18), // leverage, precision is 18
        100, // slippage, 100 means 100 / 10000 = 1%
    );

    // trade
    await sdk.intuitiveTrade(
        signer,
        pair,
        Side.LONG,
        baseAmount,
        result.margin, // required margin
        result.tradePrice,
        100, // slippage, 100 means 100 / 10000 = 1%
        Math.floor(Date.now() / 1000) + 300, // deadline, set to 5 minutes later
    );

    console.log(
        `Open a long position of ${ethers.utils.formatEther(
            baseAmount,
        )} BTC(≈ 500 USDB) with ${ethers.utils.formatUnits(result.margin, 18)} USDB and ${ethers.utils.formatUnits(
            result.leverageWad,
        )} leverage`,
    );
}

main().catch(console.error);
```

### Adjust position, withdraw half of the available margin

```ts
import { ethers } from 'ethers';
import { SynFuturesV3, PERP_EXPIRY } from '@synfutures/oyster-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('blast');

    await sdk.init();

    // get your own signer
    const signer = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY as string, sdk.ctx.provider);

    const instruments = await sdk.getAllInstruments();

    function getInstrumentBySymbol(symbol: string) {
        const instrument = instruments.find((i) => i.info.symbol === symbol);
        if (!instrument) {
            throw new Error('unknown symbol: ' + symbol);
        }
        return instrument;
    }

    const instrument = getInstrumentBySymbol('BTC-USDB-PYTH');

    const pair = instrument.pairs.get(PERP_EXPIRY)!;

    const account = await sdk.getPairLevelAccount(await signer.getAddress(), instrument.info.addr, PERP_EXPIRY);

    // calculate the maximum amount of margin that can be withdrawn
    const available = account.position.getMaxWithdrawableMargin();

    await sdk.adjustMargin(
        signer,
        pair,
        false, // we try to withdraw the margin, so pass false here, otherwise pass true
        available.div(2), // withdraw half of the available margin
        Math.floor(Date.now() / 1000) + 300, // deadline, set to 5 minutes later
    );

    console.log(`Withdraw ${ethers.utils.formatUnits(available.div(2), 18)} USDB margin`);
}

main().catch(console.error);
```

### Place order

```ts
import { ethers } from 'ethers';
import { SynFuturesV3, PERP_EXPIRY, Side, TickMath } from '@synfutures/oyster-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('blast');

    await sdk.init();

    // get your own signer
    const signer = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY as string, sdk.ctx.provider);

    const instruments = await sdk.getAllInstruments();

    function getInstrumentBySymbol(symbol: string) {
        const instrument = instruments.find((i) => i.info.symbol === symbol);
        if (!instrument) {
            throw new Error('unknown symbol: ' + symbol);
        }
        return instrument;
    }

    const instrument = getInstrumentBySymbol('BTC-USDB-PYTH');

    const pair = instrument.pairs.get(PERP_EXPIRY)!;

    // update cache for signer
    await sdk.syncVaultCacheWithAllQuotes(await signer.getAddress());

    // we try to place a short order,
    // so the price of the order must be higher than the fair price
    const targetTick = pair.amm.tick + 100;

    // simulate result
    const result = sdk.simulateOrder(
        await sdk.getPairLevelAccount(await signer.getAddress(), instrument.info.addr, PERP_EXPIRY),
        targetTick,
        ethers.utils.parseEther('0.2'),
        Side.SHORT,
        ethers.utils.parseUnits('4', 18),
    );

    // place order
    await sdk.limitOrder(
        signer,
        pair,
        targetTick,
        ethers.utils.parseEther('0.2'),
        result.balance,
        Side.SHORT,
        Math.floor(Date.now() / 1000) + 300, // deadline, set to 5 minutes later
    );

    console.log(
        `Place a 4 leveraged limit order of 0.2 BTC at ${ethers.utils.formatUnits(
            TickMath.getWadAtTick(targetTick),
            18,
        )}`,
    );
}

main().catch(console.error);
```

### Bulk Cancel order

```ts
import { SynFuturesV3, PERP_EXPIRY } from '@synfutures/oyster-sdk';
import { ethers } from 'ethers';

async function main() {
    const sdk = SynFuturesV3.getInstance('blast');

    await sdk.init();

    // get your own signer
    const signer = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY as string, sdk.ctx.provider);

    const instruments = await sdk.getAllInstruments();

    function getInstrumentBySymbol(symbol: string) {
        const instrument = instruments.find((i) => i.info.symbol === symbol);
        if (!instrument) {
            throw new Error('unknown symbol: ' + symbol);
        }
        return instrument;
    }

    const instrument = getInstrumentBySymbol('BTC-USDB-PYTH');

    const account = await sdk.getPairLevelAccount(await signer.getAddress(), instrument.info.addr, PERP_EXPIRY);

    // cancel all orders
    await sdk.batchCancelOrder(signer, account, account.orders, Math.floor(Date.now() / 1000) + 300);

    console.log('Cancel all orders:', account.orders.map((order) => order.oid).join(','));
}

main().catch(console.error);
```

### Fill order

```ts
import { SynFuturesV3, PERP_EXPIRY } from '@synfutures/oyster-sdk';
import { ethers } from 'ethers';

async function main() {
    const sdk = SynFuturesV3.getInstance('blast');

    await sdk.init();

    // get your own signer
    const signer = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY as string, sdk.ctx.provider);

    const instruments = await sdk.getAllInstruments();

    function getInstrumentBySymbol(symbol: string) {
        const instrument = instruments.find((i) => i.info.symbol === symbol);
        if (!instrument) {
            throw new Error('unknown symbol: ' + symbol);
        }
        return instrument;
    }

    const instrument = getInstrumentBySymbol('BTC-USDB-PYTH');

    const account = await sdk.getPairLevelAccount(await signer.getAddress(), instrument.info.addr, PERP_EXPIRY);

    const targetOrder = account.orders[0];

    await sdk.fill(signer, instrument.info.addr, {
        expiry: PERP_EXPIRY,
        tick: targetOrder.tick,
        target: await signer.getAddress(),
        nonce: targetOrder.nonce,
    });

    console.log('Fill order:', targetOrder.oid);
}

main().catch(console.error);
```

### Add liquidity

```ts
import { ethers } from 'ethers';
import { SynFuturesV3, PERP_EXPIRY, TickMath } from '@synfutures/oyster-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('blast');

    await sdk.init();

    // get your own signer
    const signer = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY as string, sdk.ctx.provider);

    const instruments = await sdk.getAllInstruments();

    function getInstrumentBySymbol(symbol: string) {
        const instrument = instruments.find((i) => i.info.symbol === symbol);
        if (!instrument) {
            throw new Error('unknown symbol: ' + symbol);
        }
        return instrument;
    }

    const instrument = getInstrumentBySymbol('BTC-USDB-PYTH');

    // update cache for signer
    await sdk.syncVaultCacheWithAllQuotes(await signer.getAddress());

    // margin to add liquidity
    const margin = ethers.utils.parseUnits('1000', 18);

    const result = await sdk.simulateAddLiquidity(
        await signer.getAddress(),
        {
            marketType: instrument.marketType,
            baseSymbol: instrument.info.base.symbol,
            quoteSymbol: instrument.info.quote.symbol,
        },
        PERP_EXPIRY,
        ethers.utils.parseUnits('1.8', 18), // alpha, liquidity range factor, 1.8 means ± 80%
        margin,
        100, // // slippage, 100 means 100 / 10000 = 1%
    );

    await sdk.addLiquidity(
        signer,
        {
            marketType: instrument.marketType,
            baseSymbol: instrument.info.base.symbol,
            quoteSymbol: instrument.info.quote.symbol,
        },
        PERP_EXPIRY,
        result.tickDelta,
        margin,
        result.sqrtStrikeLowerPX96,
        result.sqrtStrikeUpperPX96,
        Math.floor(Date.now() / 1000) + 300, // deadline, set to 5 minutes later
    );

    console.log(
        `Add 1000 USDB liquidity from tick ${TickMath.getTickAtSqrtRatio(
            result.sqrtStrikeLowerPX96,
        )} to tick ${TickMath.getTickAtSqrtRatio(result.sqrtStrikeUpperPX96)}`,
    );
}

main().catch(console.error);
```

### Remove liquidity

```ts
import { ethers } from 'ethers';
import { SynFuturesV3, PERP_EXPIRY } from '@synfutures/oyster-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('blast');

    await sdk.init();

    // get your own signer
    const signer = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY as string, sdk.ctx.provider);

    const instruments = await sdk.getAllInstruments();

    function getInstrumentBySymbol(symbol: string) {
        const instrument = instruments.find((i) => i.info.symbol === symbol);
        if (!instrument) {
            throw new Error('unknown symbol: ' + symbol);
        }
        return instrument;
    }

    const instrument = getInstrumentBySymbol('BTC-USDB-PYTH');

    // update cache for signer
    await sdk.syncVaultCacheWithAllQuotes(await signer.getAddress());

    // get user account
    const account = await sdk.getPairLevelAccount(await signer.getAddress(), instrument.info.addr, PERP_EXPIRY);

    const range = account.ranges[0];

    const result = sdk.simulateRemoveLiquidity(account, range, 100);

    await sdk.removeLiquidity(
        signer,
        instrument.pairs.get(PERP_EXPIRY)!,
        await signer.getAddress(),
        range,
        result.sqrtStrikeLowerPX96,
        result.sqrtStrikeUpperPX96,
        Math.floor(Date.now() / 1000) + 300, // deadline, set to 5 minutes later
    );

    console.log(
        `Remove ${ethers.utils.formatUnits(range.balance, 18)} USDB liquidity from tick ${range.tickLower} to tick ${
            range.tickUpper
        }`,
    );
}

main().catch(console.error);
```

### Query user operation history

```ts
import { SynFuturesV3 } from '@synfutures/oyster-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('blast');

    await sdk.init();

    // get signer address
    const signer = process.argv[2];

    console.log(
        'Account history:',
        await sdk.subgraph.getVirtualTrades({
            traders: [signer],
        }),
    );
}

main().catch(console.error);
```

### Query pair kline

```ts
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { CHAIN_ID, now } from '@derivation-tech/web3-core';
import { parseEther } from 'ethers/lib/utils';
import { PERP_EXPIRY } from './constants';
import { IKlineDataProvider, KlineDataProvider, KlineInterval } from './chart/kline';
import { SynFuturesV3 } from './synfuturesV3Core';

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

demoKline().catch(console.error);
```

### Query pair depth

```ts
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { CHAIN_ID } from '@derivation-tech/web3-core';
import { parseEther } from 'ethers/lib/utils';
import { PERP_EXPIRY } from './constants';
import { SynFuturesV3 } from './synfuturesV3Core';
import { DepthChartDataProvider } from './chart/depth';

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

demoDepth().catch(console.error);
```

### Query pair funding rate

```ts
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { formatWad, fromWad } from '@derivation-tech/web3-core';
import { PERP_EXPIRY } from './constants';
import { SynFuturesV3 } from './synfuturesV3Core';
import { FundingChartDataProvider, FundingChartInterval } from './chart/funding';
import { wdiv } from './math';
import { BigNumber } from 'ethers';

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

demoFundingRate().catch(console.error);
```

### Query user single pair info

```ts
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { now } from '@derivation-tech/web3-core';
import { PERP_EXPIRY } from './constants';
import { SynFuturesV3 } from './synfuturesV3Core';

export async function demoUserPairInfo(): Promise<void> {
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

demoUserPairInfo().catch(console.error);
```

### Query market info

```ts
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { formatWad } from '@derivation-tech/web3-core';
import { SynFuturesV3 } from './synfuturesV3Core';
import { wmul } from './math';

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

demoMarketInfoPage().catch(console.error);
```

### Direct trade interface

```ts
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ethers } from 'ethers';
import { INT24_MAX, INT24_MIN, NULL_DDL, PERP_EXPIRY } from './constants';
import { SynFuturesV3 } from './synfuturesV3Core';
import { Side } from './types';
import { parseEther } from 'ethers/lib/utils';
import { ZERO } from '@derivation-tech/web3-core';

export async function demoTrade(): Promise<void> {
    const synfV3 = SynFuturesV3.getInstance('blast');
    const allInstruments = await synfV3.getAllInstruments();
    const instrument = allInstruments.find((i) => i.info.symbol.includes('BTC-USDB'))!;
    const pair = instrument.getPairModel(PERP_EXPIRY);
    // get your own signer
    const signer = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY as string, synfV3.ctx.provider);
    // want to open a long position with 1 BTC, inquire the quotation first
    const side = Side.LONG;
    const size = parseEther('0.1');
    await synfV3.syncVaultCacheWithAllQuotes(signer.address); // get signer's account
    const account = await synfV3.getPairLevelAccount(signer.address, instrument.info.addr, pair.amm.expiry);
    const { quotation } = await synfV3.inquireByBase(pair, side, size);

    // margin and leverage are optional
    // 1. undefined margin, margin will be calculated based on leverage
    // 2. undefined leverage, leverage will be calculated based on margin
    // 3. both undefined, leverage will be calculated based on new size and equity
    const { margin } = synfV3.simulateTrade(
        account,
        quotation,
        side,
        size,
        undefined,
        parseEther('4'), // leverage in WAD format
        100, // slippage in bps, 100 bps = 1%
    );

    await synfV3.trade(signer, instrument.info.addr, {
        expiry: pair.amm.expiry,
        size,
        amount: margin,
        // if the traded average price exceeds the limit price represented in tick format, trade would revert
        // say I want to long btc with 1 btc, and I don't want average trade price to exceed 60k, then set limitTick to
        // TickMath.getTickAtPWad(parseEther('60000'))
        limitTick: size.gt(ZERO) ? INT24_MAX : INT24_MIN,
        deadline: NULL_DDL, // set tx deadline, if desire 10 minutes ddl, use now() + 10 * 60
    });
}

demoTrade().catch(console.error);
```

### Direct place interface

```ts
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ethers } from 'ethers';
import { PEARL_SPACING, PERP_EXPIRY } from './constants';
import { SynFuturesV3 } from './synfuturesV3Core';
import { Side } from './types';
import { parseEther } from 'ethers/lib/utils';
import { formatWad, now } from '@derivation-tech/web3-core';
import { alignTick } from './common';
import { TickMath } from './math';

export async function demoPlace(): Promise<void> {
    const synfV3 = SynFuturesV3.getInstance('blast');
    const allInstruments = await synfV3.getAllInstruments();
    const instrument = allInstruments.find((i) => i.info.symbol.includes('BTC-USDB'))!;
    const pair = instrument.getPairModel(PERP_EXPIRY);
    // get your own signer
    const signer = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY as string, synfV3.ctx.provider);
    // say you want to place an short limit order of size 1 BTC at price 5% higher from current fair price with 10x leverage
    // order cannot be placed too far from mark price, which is 2 * imr, and order cannot be too trivial
    // to get minOrderValue
    const minOrderValue = instrument.minOrderValue;
    console.log(formatWad(minOrderValue));
    const size = parseEther('1').mul(-1);
    const leverage = parseEther('10');
    const placePrice = pair.fairPriceWad.mul(105).div(100);
    const tick = alignTick(TickMath.getTickAtPWad(placePrice), PEARL_SPACING); // tick needs to be aligned with pearl spacing
    await synfV3.syncVaultCacheWithAllQuotes(signer.address);
    const account = await synfV3.getPairLevelAccount(signer.address, instrument.info.addr, PERP_EXPIRY);
    const { balance: margin } = synfV3.simulateOrder(account, tick, size, Side.SHORT, leverage);
    await synfV3.place(signer, instrument.info.addr, {
        expiry: pair.amm.expiry,
        tick, // the price you want to place your order in tick format
        size: size,
        amount: margin,
        deadline: now() + 10 * 60,
    });
}

demoPlace().catch(console.error);
```

### Direct add liquidity interface

```ts
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ethers } from 'ethers';
import { NULL_DDL, PERP_EXPIRY, RATIO_BASE } from './constants';
import { SynFuturesV3 } from './synfuturesV3Core';
import { parseEther } from 'ethers/lib/utils';
import { formatWad, fromWad } from '@derivation-tech/web3-core';
import { tickDeltaToAlphaWad } from './common';
import { TICK_DELTA_MAX } from './math';

export async function demoAdd(): Promise<void> {
    const synfV3 = SynFuturesV3.getInstance('blast');
    const allInstruments = await synfV3.getAllInstruments();
    const instrument = allInstruments.find((i) => i.info.symbol.includes('BTC-USDB'))!;
    const pair = instrument.getPairModel(PERP_EXPIRY);
    // get your own signer
    const signer = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY as string, synfV3.ctx.provider);
    const margin = parseEther('1000'); // margin to add liquidity, has to be larger than minRangeValue
    console.log(formatWad(instrument.minRangeValue));
    // alphaWad has to be larger than (1 + imr) and less than maxAlphaWad which is round +- 500%
    const minAlphaWad = parseEther(((RATIO_BASE + instrument.setting.initialMarginRatio) / RATIO_BASE).toString());
    const maxAlphaWad = tickDeltaToAlphaWad(TICK_DELTA_MAX);
    console.log(fromWad(minAlphaWad), fromWad(maxAlphaWad));
    const alphaWad = parseEther('1.8'); // liquidity range factor, 1.8 means ± 80%
    await synfV3.syncVaultCacheWithAllQuotes(signer.address);
    const rangeSimulation = await synfV3.simulateAddLiquidity(
        signer.address,
        {
            marketType: instrument.marketType,
            baseSymbol: instrument.info.base.symbol,
            quoteSymbol: instrument.info.quote.symbol,
        },
        pair.amm.expiry,
        alphaWad,
        margin,
        100, // slippage, 100 means 100 / 10000 = 1%
    );
    // limit tick is calculated based on sqrtStrikeLowerPX96 and sqrtStrikeUpperPX96, which are calculated based on slippage
    const limitTicks = synfV3.encodeLimitTicks(
        rangeSimulation.sqrtStrikeLowerPX96,
        rangeSimulation.sqrtStrikeUpperPX96,
    );
    await synfV3.add(signer, instrument.info.addr, {
        expiry: pair.amm.expiry,
        // can use tickDelta larger than calcMinTickDelta(imr) and smaller than TICK_DELTA_MAX
        tickDelta: rangeSimulation.tickDelta,
        amount: margin,
        limitTicks,
        deadline: NULL_DDL,
    });
}

demoAdd().catch(console.error);
```

### Direct remove liquidity interface

almost the same with `removeLiquidity` interface

```ts
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ethers } from 'ethers';
import { PERP_EXPIRY } from './constants';
import { SynFuturesV3 } from './synfuturesV3Core';
import { now } from '@derivation-tech/web3-core';

export async function demoRemove(): Promise<void> {
    const synfV3 = SynFuturesV3.getInstance('blast');
    const allInstruments = await synfV3.getAllInstruments();
    const instrument = allInstruments.find((i) => i.info.symbol.includes('BTC-USDB'))!;
    const pair = instrument.getPairModel(PERP_EXPIRY);
    // get your own signer
    const signer = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY as string, synfV3.ctx.provider);
    await synfV3.syncVaultCacheWithAllQuotes(signer.address);
    const account = await synfV3.getPairLevelAccount(signer.address, instrument.info.addr, pair.amm.expiry);
    const range = account.ranges[0];

    const result = synfV3.simulateRemoveLiquidity(account, range, 100);

    await synfV3.remove(signer, instrument.info.addr, {
        expiry: pair.amm.expiry,
        target: signer.address,
        tickLower: range.tickLower,
        tickUpper: range.tickUpper,
        limitTicks: synfV3.encodeLimitTicks(result.sqrtStrikeLowerPX96, result.sqrtStrikeUpperPX96), // calculated based on slippage
        deadline: now() + 60,
    });
}

demoRemove().catch(console.error);
```

### Direct cancel order interface

```ts
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ethers } from 'ethers';
import { PERP_EXPIRY } from './constants';
import { SynFuturesV3 } from './synfuturesV3Core';
import { now } from '@derivation-tech/web3-core';

export async function demoCancel(): Promise<void> {
    const synfV3 = SynFuturesV3.getInstance('blast');
    const allInstruments = await synfV3.getAllInstruments();
    const instrument = allInstruments.find((i) => i.info.symbol.includes('BTC-USDB'))!;
    const pair = instrument.getPairModel(PERP_EXPIRY);
    // get your own signer
    const signer = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY as string, synfV3.ctx.provider);
    await synfV3.syncVaultCacheWithAllQuotes(signer.address);

    const account = await synfV3.getPairLevelAccount(signer.address, instrument.info.addr, pair.amm.expiry);

    await synfV3.cancel(signer, instrument.info.addr, {
        expiry: pair.amm.expiry,
        tick: account.orders[0].tick, // the price of the order you want to cancel in tick format
        deadline: now() + 60,
    });
}

demoCancel().catch(console.error);
```

### Update pair

```ts
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ethers } from 'ethers';
import { PERP_EXPIRY } from './constants';
import { SynFuturesV3 } from './synfuturesV3Core';

export async function demoUpdate(): Promise<void> {
    const synfV3 = SynFuturesV3.getInstance('blast');
    const allInstruments = await synfV3.getAllInstruments();
    const instrument = allInstruments.find((i) => i.info.symbol.includes('BTC-USDB'))!;
    const pair = instrument.getPairModel(PERP_EXPIRY);

    // get your own signer
    const signer = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY as string, synfV3.ctx.provider);

    await synfV3.update(signer, instrument.info.addr, pair.amm.expiry);
}

demoUpdate().catch(console.error);
```

### Settle User

```ts
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ethers } from 'ethers';
import { PERP_EXPIRY } from './constants';
import { SynFuturesV3 } from './synfuturesV3Core';

export async function demoSettle(): Promise<void> {
    const synfV3 = SynFuturesV3.getInstance('blast');
    const allInstruments = await synfV3.getAllInstruments();
    const instrument = allInstruments.find((i) => i.info.symbol.includes('BTC-USDB'))!;
    const pair = instrument.getPairModel(PERP_EXPIRY);

    // get your own signer
    const signer = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY as string, synfV3.ctx.provider);

    const trader = '';

    await synfV3.settle(
        signer,
        instrument.info.addr,
        pair.amm.expiry,
        trader, // trader to settle
    );
}

demoSettle().catch(console.error);
```
