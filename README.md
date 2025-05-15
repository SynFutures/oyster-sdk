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

## ABIs

The SDK provides ABIs of several important contracts to facilitate your interaction with SynFuturesV3. You can obtain them in the following ways:

-   Extract the original JSON files directly from the SDK. The paths are as follows:

```shell
/oyster-sdk/src/abis/CexMarket.json
/oyster-sdk/src/abis/Config.json
/oyster-sdk/src/abis/DexV2Market.json
/oyster-sdk/src/abis/Gate.json
/oyster-sdk/src/abis/Instrument.json
/oyster-sdk/src/abis/Observer.json
```

-   Use them directly from the SDK

```typescript
import { INSTRUMENT_ABI } from '@synfutures/oyster-sdk';
import { Contract } from 'ethers';

// Print the ABI of the Instrument contract
console.info(JSON.stringify(INSTRUMENT_ABI, null, 2));

// Use INSTRUMENT_ABI directly from the SDK
new Contract(address, INSTRUMENT_ABI, signerOrProvider);
```

## Examples

1. [Query instruments and pairs information](#query-instruments-and-pairs-information)
2. [Query accout information](#query-accout-information)
3. [Deposit to `Gate`](#deposit-to-gate)
4. [Withdraw from `Gate`](#withdraw-from-gate)
5. [Trade](#trade)
6. [Adjust position, withdraw half of the available margin](#adjust-position-withdraw-half-of-the-available-margin)
7. [Place order](#place-order)
8. [Batch place orders](#batch-place-orders)
9. [Bulk cancel order](#bulk-cancel-order)
10. [Add liquidity](#add-liquidity)
11. [Add asymmetric liquidity](#add-asymmetric-liquidity)
12. [Remove liquidity](#remove-liquidity)
13. [Query user operation history](#query-user-operation-history)
14. [Query pair kline chart data](#query-pair-kline)
15. [Query pair depth chart data](#query-pair-depth)
16. [Query pair funding rate data](#query-pair-funding-rate)
17. [Query user single pair info](#query-user-single-pair-info)
18. [Get Volume Chart](#get-volume-chart)
19. [Query Account Portfolio Info](#query-account-portfolio-info)
20. [Query Account Range History](#query-account-range-history)
21. [Query Asset Transfer History](#query-asset-transfer-history)
22. [Query Deposit Withdraw History](#query-deposit-withdraw-history)
23. [Estimate Earning APY](#estimate-earning-apy)
24. [Query market info](#query-market-info)
25. [Direct trade interface](#direct-trade-interface)
26. [Direct place interface](#direct-place-interface)
27. [Direct add interface](#direct-add-interface)
28. [Direct remove interface](#direct-remove-interface)
29. [Direct cancel interface](#direct-cancel-interface)
30. [Update pair](#update-pair)
31. [Settle trader](#settle-trader)
32. [Parse tx](#parse-tx)
33. [Restrictions on add, trade and place](#restrictions-on-add-trade-and-place)
34. [Query subgraph using referral code as filter](#query-subgraph-using-referral-code-as-filter)

### Prerequisites

To successfully run the blew examples:

-   Please put BLAST_RPC=https://rpc.ankr.com/blast into the .env file where you run your command.
-   Also set your private key ALICE_PRIVATE_KEY=your_own_private_key if you want to send transactions.
-   Or you can set your provider and wallet directly in the code.

```ts
const sdk = SynFuturesV3.getInstance('blast');
sdk.setProvider(new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/blast'));
const keystore = readFileSync('keystore.json', 'utf-8');
const signer1 = ethers.Wallet.fromEncryptedJsonSync(keystore, 'password');
const signer2 = ethers.Wallet.fromMnemonic(
    'test test test test test test test test test test test test',
    "m/44'/60'/0'/0/1",
);
const signer3 = new ethers.Wallet('private key');
```

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

// ts-node src/demo.ts 0xYOUR_ACCOUNT_ADDRESS_HERE
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

    // 1. withdraw USDB
    // get USDB token info
    const usdb = await sdk.ctx.getTokenInfo('USDB');
    await sdk.withdraw(signer, usdb.address, ethers.utils.parseUnits('10', usdb.decimals));
    console.log('Withdraw 10 USDB from the gate');

    // 2. withdraw WETH
    await sdk.withdraw(
        signer,
        sdk.ctx.wrappedNative.address,
        ethers.utils.parseUnits('0.01', await sdk.ctx.wrappedNative.decimals()),
    );

    // 3. withdraw all WETH to ETH
    await sdk.withdraw(
        signer,
        NATIVE_TOKEN_ADDRESS,
        await sdk.contracts.gate.reserveOf(sdk.ctx.wrappedNative.address, signer.address),
    );
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
    const {
        tradePrice, // average trade price in quote token
        estimatedTradeValue, // traded value in quote token, i.e. entryNotional
        minTradeValue, // if no existing position, return a minimum trade value related to instrument imr
        tradingFee, // trading fee in quote token
        margin, // required margin in quote token
        leverageWad, // leverage in WAD format
        priceImpactWad, // price impact = (postFair - preFair) / preFair, represented in WAD format
        realized, // realized pnl, funding and social loss counted
        simulationMainPosition, // main position after trade
        marginToDepositWad, // if current margin is not enough, margin to deposit in WAD format
        limitTick, // average price limit represented in tick, if trade price is out of limit price, tx will revert
        exceedMaxLeverage, // return true if leverage exceeds max leverage
    } = sdk.simulateTrade(
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
        margin, // required margin
        tradePrice,
        100, // slippage, 100 means 100 / 10000 = 1%
        Math.floor(Date.now() / 1000) + 300, // deadline, set to 5 minutes later
    );

    // use referral code
    // NOTICE: channel code must be 6 bytes long
    const channel = '8test8';
    const getReferralCode = (channel: string): string => {
        return '\xff\xff' + channel; // 0xffff means you are sending tx using SDK and private key
    };
    await sdk.intuitiveTrade(
        signer,
        pair,
        Side.LONG,
        baseAmount,
        margin, // required margin
        tradePrice,
        100, // slippage, 100 means 100 / 10000 = 1%
        Math.floor(Date.now() / 1000) + 300, // deadline, set to 5 minutes later,
        {}, // here is overrides, you can pass in custom overrides for gas price and limit
        getReferralCode(channel),
    );

    console.log(
        `Open a long position of ${ethers.utils.formatEther(
            baseAmount,
        )} BTC(≈ 500 USDB) with ${ethers.utils.formatUnits(margin, 18)} USDB and ${ethers.utils.formatUnits(
            leverageWad,
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
    // NOTICE: tick must be aligned with PEARL_SPACING, i.e. ORDER_SPACING
    // order spacing is 5, so the tick must be divisible by 5
    const targetTick = alignTick(pair.amm.tick + 100, PEARL_SPACING);

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

    // use referral code
    // NOTICE: channel code must be 6 bytes long
    const channel = '8test8';
    const getReferralCode = (channel: string): string => {
        return '\xff\xff' + channel; // 0xffff means you are sending tx using SDK and private key
    };
    await sdk.limitOrder(
        signer,
        pair,
        targetTick,
        ethers.utils.parseEther('0.2'),
        result.balance,
        Side.SHORT,
        Math.floor(Date.now() / 1000) + 300, // deadline, set to 5 minutes later
        {}, // here is overrides, you can pass in custom overrides for gas price and limit
        getReferralCode(channel),
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

### Batch place orders

```ts
export async function demoBatchPlace(): Promise<void> {
    const sdk = SynFuturesV3.getInstance('Blast');

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
    await sdk.syncVaultCacheWithAllQuotes(account.traderAddr);
    const pair = instrument.getPairModel(PERP_EXPIRY)!;
    const ticks = Array.from({ length: 9 }, (_, i) =>
        alignTick(pair.amm.tick + PEARL_SPACING * (i + 1), PEARL_SPACING),
    );
    const ratios = [1111, 1111, 1111, 1111, 1111, 1111, 1111, 1111, 1112]; // ratios must add up to 10000
    const leverage = ethers.utils.parseEther('5');
    const size = ethers.utils.parseEther('1');
    const res = sdk.simulateBatchPlace(account, ticks, ratios, size, Side.SHORT, leverage);
    for (const order of res.orders) {
        console.log(
            formatUnits(order.baseSize, 18),
            formatUnits(wmul(order.baseSize, sqrtX96ToWad(pair.amm.sqrtPX96)), 18),
            formatUnits(wdiv(wmul(order.baseSize, sqrtX96ToWad(pair.amm.sqrtPX96)), order.balance), 18),
            formatUnits(order.balance, 18),
            formatUnits(order.minFeeRebate, 18),
        );
    }
    console.log(
        formatUnits(
            res.orders.reduce((acc, order) => acc.add(order.balance), ethers.BigNumber.from(0)),
            18,
        ),
    );
    console.log(formatUnits(res.marginToDepositWad, 18));
    console.log(formatUnits(res.minOrderValue, 18));

    // to simulate batch place with frontend input, use simulateBatchOrder interface
    const lowerTick = TickMath.getTickAtPWad(pair.fairPriceWad.mul(10050).div(10000));
    const upperTick = TickMath.getTickAtPWad(pair.fairPriceWad.mul(10150).div(10000));
    const orderCount = 9;
    const res2 = sdk.simulateBatchOrder(
        account,
        lowerTick,
        upperTick,
        orderCount,
        BatchOrderSizeDistribution.FLAT,
        size,
        Side.SHORT,
        leverage,
    );
    for (const order of res2.orders) {
        console.log(
            order.tick,
            formatUnits(TickMath.getWadAtTick(order.tick), 18),
            order.ratio,
            formatUnits(order.baseSize, 18),
            formatUnits(wmul(order.baseSize, sqrtX96ToWad(pair.amm.sqrtPX96)), 18),
            formatUnits(wdiv(wmul(order.baseSize, sqrtX96ToWad(pair.amm.sqrtPX96)), order.balance), 18),
            formatUnits(order.balance, 18),
            formatUnits(order.minFeeRebate, 18),
        );
    }
    console.log(
        formatUnits(
            res2.orders.reduce((acc, order) => acc.add(order.balance), ethers.BigNumber.from(0)),
            18,
        ),
    );
    console.log(formatUnits(res2.marginToDepositWad, 18));
    console.log(formatUnits(res2.minOrderValue, 18));

    await sdk.batchPlace(signer, instrument.info.addr, {
        expiry: PERP_EXPIRY,
        ticks,
        ratios,
        size,
        leverage,
        deadline: now() + 300, // deadline, set to 5 minutes from now
    });
}

demoBatchPlace().catch(console.error);
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
    // NOTICE: the order amount must be [1, 8], otherwise an error will be thrown
    await sdk.batchCancelOrder(signer, account, account.orders, Math.floor(Date.now() / 1000) + 300);

    console.log('Cancel all orders:', account.orders.map((order) => order.oid).join(','));
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

    const {
        tickDelta, // tick range to add, calculated based on alphaWad
        liquidity, // amount of liquidity to add
        // NOTICE: range lower tick and upper tick are aligned with RANGE_SPACING, but normally you are taken care of and don't have to deal with range spacing yourself
        upperPrice, // range upper price, alinged with RANGE_SPACING
        lowerPrice, // range lower price, aligned with RANGE_SPACING
        lowerPosition, // new net position if get removed at lower price
        lowerLeverageWad, // new leverage if get removed at lower price
        upperPosition, // new net position if get removed at upper price
        upperLeverageWad, // new leverage if get removed at upper price
        sqrtStrikeLowerPX96, // tx would revert if fair price is lower than this, calculated with slippage
        sqrtStrikeUpperPX96, // tx would revert if fair price is higher than this
        marginToDepositWad, // if gate reserve is not enough to cover the margin, you need to deposit this amount
        minMargin, // margin required
        minEffectiveQuoteAmount, // minimum quote needed to add liquidity based on instrument imr and quote token setting
        equivalentAlpha, // actual alpha, slightly different from input alpha
    } = await sdk.simulateAddLiquidity(
        await signer.getAddress(),
        {
            marketType: instrument.marketType,
            baseSymbol: instrument.info.base.symbol,
            quoteSymbol: instrument.info.quote.symbol,
        },
        PERP_EXPIRY,
        ethers.utils.parseUnits('1.8', 18), // alpha, liquidity range factor, 1.8 means [1/1.8, 1.8]x current price
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
        tickDelta,
        margin,
        sqrtStrikeLowerPX96,
        sqrtStrikeUpperPX96,
        Math.floor(Date.now() / 1000) + 300, // deadline, set to 5 minutes later
    );

    // use referral code
    // NOTICE: channel code must be 6 bytes long
    const channel = '8test8';
    const getReferralCode = (channel: string): string => {
        return '\xff\xff' + channel; // 0xffff means you are sending tx using SDK and private key
    };
    await sdk.addLiquidity(
        signer,
        {
            marketType: instrument.marketType,
            baseSymbol: instrument.info.base.symbol,
            quoteSymbol: instrument.info.quote.symbol,
        },
        PERP_EXPIRY,
        tickDelta,
        margin,
        sqrtStrikeLowerPX96,
        sqrtStrikeUpperPX96,
        Math.floor(Date.now() / 1000) + 300, // deadline, set to 5 minutes later
        {}, // here is overrides, you can pass in custom overrides for gas price and limit
        getReferralCode(channel),
    );

    console.log(
        `Add 1000 USDB liquidity from tick ${TickMath.getTickAtSqrtRatio(
            sqrtStrikeLowerPX96,
        )} to tick ${TickMath.getTickAtSqrtRatio(sqrtStrikeUpperPX96)}`,
    );
}

main().catch(console.error);
```

### Add asymmetric liquidity

```ts
export async function demoAddAsymmetricLiquidity(): Promise<void> {
    const sdk = SynFuturesV3.getInstance('Blast');

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

    // return value almost same as simulateAddLiquidity, tickDelta => tickDeltaLower and tickDeltaUpper
    const res = await sdk.simulateAddLiquidityWithAsymmetricRange(
        await signer.getAddress(),
        {
            marketType: instrument.marketType,
            baseSymbol: instrument.info.base.symbol,
            quoteSymbol: instrument.info.quote.symbol,
        },
        PERP_EXPIRY,
        ethers.utils.parseUnits('1.8', 18), // alpha lower, liquidity range factor, currPx / 1.8
        ethers.utils.parseUnits('2', 18), // alpha upper, liquidity range factor, currPx * 2
        margin,
        100, // // slippage, 100 means 100 / 10000 = 1%
    );

    await sdk.addLiquidityWithAsymmetricRange(
        signer,
        {
            marketType: instrument.marketType,
            baseSymbol: instrument.info.base.symbol,
            quoteSymbol: instrument.info.quote.symbol,
        },
        PERP_EXPIRY,
        res.tickDeltaLower,
        res.tickDeltaUpper,
        margin,
        res.sqrtStrikeLowerPX96,
        res.sqrtStrikeUpperPX96,
        now() + 300, // deadline, set to 5 minutes from now
    );

    // use referral code
    // NOTICE: channel code must be 6 bytes long
    const channel = '8test8';
    const getReferralCode = (channel: string): string => {
        return '\xff\xff' + channel; // 0xffff means you are sending tx using SDK and private key
    };

    await sdk.addLiquidityWithAsymmetricRange(
        signer,
        {
            marketType: instrument.marketType,
            baseSymbol: instrument.info.base.symbol,
            quoteSymbol: instrument.info.quote.symbol,
        },
        PERP_EXPIRY,
        res.tickDeltaLower,
        res.tickDeltaUpper,
        margin,
        res.sqrtStrikeLowerPX96,
        res.sqrtStrikeUpperPX96,
        now() + 300, // deadline, set to 5 minutes from now
        {}, // here is overrides, you can pass in custom overrides for gas price and limit
        getReferralCode(channel),
    );
}
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

### Get Volume Chart

```ts
import { PERP_EXPIRY, SynFuturesV3, VolumeChartDataProvider } from '@synfutures/oyster-sdk';
async function main() {
    function now() {
        return Math.floor(Date.now() / 1000);
    }
    function getInstrumentBySymbol(symbol: string) {
        const instrument = instruments.find((i) => i.info.symbol === symbol);
        if (!instrument) {
            throw new Error('unknown symbol: ' + symbol);
        }
        return instrument;
    }

    const sdk = SynFuturesV3.getInstance('blast');
    const instruments = await sdk.getAllInstruments();
    const instrument = getInstrumentBySymbol('BTC-USDB-PYTH');

    const dataProvider = new VolumeChartDataProvider(sdk.ctx.chainId);
    const volumeChartData = await dataProvider.getVolumeData(instrument.info.addr, PERP_EXPIRY, 0, now());
    for (const data of volumeChartData) {
        console.log('timestamp:', data.timestamp, 'baseVolume:', data.baseVolume, 'quoteVolume:', data.quoteVolume);
    }
}
main().catch(console.error);
```

### Query Account Portfolio Info

```ts
import { SynFuturesV3, PERP_EXPIRY, InstrumentLevelAccountModel, sqrtX96ToWad, TickMath, ZERO } from '@synfutures/oyster-sdk';
import { formatEther } from 'ethers/lib/utils';
import { ethers } from 'ethers';

async function main() {
    const sdk = SynFuturesV3.getInstance('blast');
    await sdk.initInstruments();
    const accAddr = '0xYOUR_ACCOUNT_ADDRESS_HERE';
    await sdk.syncVaultCacheWithAllQuotes(accAddr);

    console.log('print balance in gate contract');
    for (const symbol of Object.keys(sdk.config.quotesParam)) {
        const tokenInfo = await sdk.ctx.getTokenInfo(symbol);
        const tokenBalanceInVault = await sdk.getCachedVaultBalance(tokenInfo.address, accAddr);
        console.log(
            `Token ${symbol} balance in vault: ${ethers.utils.formatUnits(tokenBalanceInVault, tokenInfo.decimals)}`,
        );
    }

    const allInstrumentLevelAccount: InstrumentLevelAccountModel[] = await sdk.getInstrumentLevelAccounts(accAddr);
    for (const instrumentLevelAccount of allInstrumentLevelAccount) {
        for (const [, pairLevelAccountModel] of instrumentLevelAccount.portfolios) {
            if (pairLevelAccountModel.ranges.length > 0) {
                console.log('print ranges for pair:', pairLevelAccountModel.rootPair.symbol);
                for (const range of pairLevelAccountModel.ranges) {
                    console.log('range:', range.tickLower, range.tickUpper, 'enterPrice', formatEther(sqrtX96ToWad(range.sqrtEntryPX96)), 'fees Earned', formatEther(range.feeEarned), 'value locked', formatEther(range.valueLocked);
                    console.log('lowerPrice', formatEther(TickMath.getWadAtTick(range.tickLower)), 'upperPrice', formatEther(TickMath.getWadAtTick(range.tickUpper)));
                    console.log('lowerLiquidationPrice', formatEther(range.lowerPositionModelIfRemove.liquidationPrice), 'upperLiquidationPrice', formatEther(range.upperPositionModelIfRemove.liquidationPrice));
                }
            }
            if (pairLevelAccountModel.position.size !== ZERO) {
                console.log('print position for pair:', pairLevelAccountModel.rootPair.symbol);
                console.log('position size:', formatEther(pairLevelAccountModel.position.size), 'side:', pairLevelAccountModel.position.side, 'leverage:', formatEther(pairLevelAccountModel.position.leverageWad),
                    'position value', formatEther(pairLevelAccountModel.position.getEquity()), 'margin', formatEther(pairLevelAccountModel.position.balance), 'maxWithdrawableMargin', formatEther(pairLevelAccountModel.position.getMaxWithdrawableMargin()));
                console.log('unrealized Pnl', formatEther(pairLevelAccountModel.position.unrealizedPnl));
                console.log('unrealized Funding', formatEther(pairLevelAccountModel.position.unrealizedFundingFee));
                console.log('liquidate price', formatEther(pairLevelAccountModel.position.liquidationPrice));
            }

            if (pairLevelAccountModel.orders.length > 0) {
                console.log('print orders for pair:', pairLevelAccountModel.rootPair.symbol);
                for (const order of pairLevelAccountModel.orders) {
                    console.log('order price:', order.limitPrice, 'size:', formatEther(order.size), 'taken', formatEther(order.taken), 'margin:', formatEther(order.balance), 'leverage:', formatEther(order.leverageWad), 'side:', order.side);
                }
            }

        }
    }
}

main().catch(console.error);
```

### Query Account Range History

```ts
import { SynFuturesV3, TickMath, formatExpiry } from '@synfutures/oyster-sdk';
import { formatEther } from 'ethers/lib/utils';
async function main() {
    const sdk = SynFuturesV3.getInstance('blast');
    const accAddr = '0xYOUR_ACCOUNT_ADDRESS_HERE';

    function now() {
        return Math.floor(Date.now() / 1000);
    }

    // get user range history
    const userFundingHistory = await sdk.subgraph.getTransactionEvents({
        eventNames: ['Add', 'Remove'],
        traders: [accAddr],
        // instrumentAddr: instrument.info.addr, // optional
        // expiry: pair.amm.expiry, // optional
        // to get all history, just ignore startTs and endTs
        startTs: now() - 3600 * 24 * 30, // 30 days ago, get 1 month history
        endTs: now(),
    });

    // print user range history
    for (const event of userFundingHistory) {
        console.log(
            'instrumentAddress',
            event.address,
            'expiry',
            formatExpiry(parseInt(event.args.expiry)),
            'event:',
            event.name,
            'timestamp:',
            event.timestamp,
            'tickLowerPrice',
            formatEther(TickMath.getWadAtTick(parseInt(event.args.tickLower))),
            'tickUpperPrice',
            formatEther(TickMath.getWadAtTick(parseInt(event.args.tickUpper))),
        );
    }
}
main().catch(console.error);
```

### Query Asset Transfer History

```ts
import { SynFuturesV3, TickMath, formatExpiry } from '@synfutures/oyster-sdk';
import { formatUnits } from 'ethers/lib/utils';

async function main() {
    const sdk = SynFuturesV3.getInstance('blast');
    const accAddr = '0xYOUR_ACCOUNT_ADDRESS_HERE';

    function now() {
        return Math.floor(Date.now() / 1000);
    }

    // get user transfer history
    const userTransferHistory = await sdk.subgraph.getTransactionEvents({
        eventNames: ['Gather', 'Scatter'],
        traders: [accAddr],
        // instrumentAddr: instrument.info.addr, // optional
        // expiry: pair.amm.expiry, // optional
        // to get all history, just ignore startTs and endTs
        startTs: now() - 3600 * 24 * 30, // 30 days ago, get 1 month history
        endTs: now(),
    });

    // print user transfer history
    for (const event of userTransferHistory) {
        console.log(
            'instrumentAddress',
            event.address,
            'expiry',
            formatExpiry(parseInt(event.args.expiry)),
            'event:',
            event.name,
            'timestamp:',
            event.timestamp,
        );
        const quoteAddr = event.args.quote;
        const tokenInfo = await sdk.ctx.getTokenInfo(quoteAddr);
        console.log(
            'Type',
            event.name === 'Gather' ? 'Transfer In' : 'Transfer Out',
            'Token',
            tokenInfo.symbol,
            'amount',
            formatUnits(event.args.quantity, tokenInfo.decimals),
        );
    }
}

main().catch(console.error);
```

### Query Deposit Withdraw History

```ts
import { NATIVE_TOKEN_ADDRESS, SynFuturesV3, TickMath, formatExpiry } from '@synfutures/oyster-sdk';
import { formatUnits } from 'ethers/lib/utils';

async function main() {
    const sdk = SynFuturesV3.getInstance('blast');
    const accAddr = '0xYOUR_ACCOUNT_ADDRESS_HERE';

    function now() {
        return Math.floor(Date.now() / 1000);
    }

    // get user transfer history
    const userDWHistory = await sdk.subgraph.getTransactionEvents({
        eventNames: ['Deposit', 'Withdraw'],
        traders: [accAddr],
        // instrumentAddr: instrument.info.addr, // optional
        // expiry: pair.amm.expiry, // optional
        // to get all history, just ignore startTs and endTs
        startTs: now() - 3600 * 24 * 30, // 30 days ago, get 1 month history
        endTs: now(),
    });

    // print user transfer history
    for (const event of userDWHistory) {
        console.log('event:', event.name, 'timestamp:', event.timestamp);
        const quoteAddr = event.args.quote;
        const tokenInfo =
            quoteAddr.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
                ? await sdk.ctx.wrappedNativeToken
                : await sdk.ctx.getTokenInfo(quoteAddr);
        console.log('Token', tokenInfo.symbol, 'amount', formatUnits(event.args.quantity, tokenInfo.decimals));
    }
}

main().catch(console.error);
```

### Estimate Earning APY

```ts
import { SynFuturesV3, PERP_EXPIRY } from '@synfutures/oyster-sdk';
import { parseEther } from 'ethers/lib/utils';

async function main() {
    function getInstrumentBySymbol(symbol: string) {
        const instrument = instruments.find((i) => i.info.symbol === symbol);
        if (!instrument) {
            throw new Error('unknown symbol: ' + symbol);
        }
        return instrument;
    }

    const sdk = SynFuturesV3.getInstance('blast');
    const instruments = await sdk.getAllInstruments();
    const instrument = getInstrumentBySymbol('BTC-USDB-PYTH');
    const pair = instrument.pairs.get(PERP_EXPIRY)!;
    // alpha means the width of the range -> 1.5 means [1/1.5, 1.5]x current price
    const alpha = '1.5';
    // compute APY need pairs data
    const pairDatas = await sdk.subgraph.getPairsData();
    // get the pair data for the instrument
    const pairData = pairDatas.find(
        (pd) => pd.instrumentAddr.toLowerCase() === instrument.info.addr.toLowerCase() && pd.expiry === PERP_EXPIRY,
    );
    //can estimate the apy
    const fee_24hrs = pairData!.poolFee24h;
    const apy = sdk.estimateAPY(pair, fee_24hrs, parseEther(alpha));
    console.log('estimated apy:', apy);
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

    // use referral code
    // NOTICE: channel code must be 6 bytes long
    const channel = '8test8';
    const getReferralCode = (channel: string): string => {
        return '\xff\xff' + channel; // 0xffff means you are sending tx using SDK and private key
    };
    await synfV3.trade(
        signer,
        instrument.info.addr,
        {
            expiry: pair.amm.expiry,
            size,
            amount: margin,
            // if the traded average price exceeds the limit price represented in tick format, trade would revert
            // say I want to long btc with 1 btc, and I don't want average trade price to exceed 60k, then set limitTick to
            // TickMath.getTickAtPWad(parseEther('60000'))
            limitTick: size.gt(ZERO) ? INT24_MAX : INT24_MIN,
            deadline: NULL_DDL, // set tx deadline, if desire 10 minutes ddl, use now() + 10 * 60
        },
        {}, // here is overrides, you can pass in custom overrides for gas price and limit
        getReferralCode(channel),
    );
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

    // use referral code
    // NOTICE: channel code must be 6 bytes long
    const channel = '8test8';
    const getReferralCode = (channel: string): string => {
        return '\xff\xff' + channel; // 0xffff means you are sending tx using SDK and private key
    };
    await synfV3.place(
        signer,
        instrument.info.addr,
        {
            expiry: pair.amm.expiry,
            tick, // the price you want to place your order in tick format
            size: size,
            amount: margin,
            deadline: now() + 10 * 60,
        },
        {}, // here is overrides, you can pass in custom overrides for gas price and limit
        getReferralCode(channel),
    );
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
    // alphaWad has to be larger than (1 + imr) and less than maxAlphaWad which is round [1/5, 5]x
    const minAlphaWad = parseEther(((RATIO_BASE + instrument.setting.initialMarginRatio) / RATIO_BASE).toString());
    const maxAlphaWad = tickDeltaToAlphaWad(TICK_DELTA_MAX);
    console.log(fromWad(minAlphaWad), fromWad(maxAlphaWad));
    const alphaWad = parseEther('1.8'); // liquidity range factor, 1.8 means [1/1.8, 1.8]x current price
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

    // use referral code
    // NOTICE: channel code must be 6 bytes long
    const channel = '8test8';
    const getReferralCode = (channel: string): string => {
        return '\xff\xff' + channel; // 0xffff means you are sending tx using SDK and private key
    };
    await synfV3.add(
        signer,
        instrument.info.addr,
        {
            expiry: pair.amm.expiry,
            // can use tickDelta larger than calcMinTickDelta(imr) and smaller than TICK_DELTA_MAX
            tickDelta: rangeSimulation.tickDelta,
            amount: margin,
            limitTicks,
            deadline: NULL_DDL,
        },
        {}, // here is overrides, you can pass in custom overrides for gas price and limit
        getReferralCode(channel),
    );
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

### Parse tx

```ts
async function demoParseTx(): Promise<void> {
    const synfV3 = SynFuturesV3.getInstance('Blast');
    const allInstruments = await synfV3.getAllInstruments();
    const instrument = allInstruments.find((i) => i.info.symbol.includes('BTC-USDB-PYTH'))!;

    // 1. parse successful tx
    // to successfully parse instrument event in the tx, you need to register contract parser first
    synfV3.ctx.registerContractParser(instrument.info.addr, new InstrumentParser());
    // take add tx for example
    const addTx = 'add_tx_hash_here';
    const response = await synfV3.ctx.provider.getTransaction(addTx);
    // fetch contract parser for parsing tx calldata
    const contractParser = synfV3.ctx.getContractParser(instrument.info.addr)!;
    console.log(await contractParser.parseTransaction({ data: response.data, value: response.value }));
    // parse tx details
    await synfV3.ctx.handleResponse(response);
    // get tx receipt for event handling
    const receipt = await synfV3.ctx.provider.getTransactionReceipt(addTx);
    // parse events using tx receipt
    await synfV3.ctx.handleReceipt(receipt);

    // 2. parse revert tx and get revert reason
    const revertTxHash = 'revert_tx_hash_here';
    const tx = await synfV3.ctx.provider.getTransaction(revertTxHash);
    const printRawLog = (log: Log) => {
        console.log('raw event', 'data:', log.data, 'topics:', log.topics);
    };
    try {
        const receipt = await tx.wait();
        for (const log of receipt.logs) {
            const parser = synfV3.ctx.getContractParser(log.address);
            if (!parser) {
                printRawLog(log);
                continue;
            }
            let event;
            try {
                event = parser.interface.parseLog(log);
            } catch (err) {
                printRawLog(log);
                continue;
            }
            const parsedEvent = await parser.parseEvent(event);
            // add logic here to find log name 'Add' from receipt
            console.log('event ->', parsedEvent);
        }
    } catch (e) {
        console.log(await synfV3.ctx.normalizeError(e));
    }
}

demoParseTx().catch(console.error);
```

### Restrictions on add, trade and place

```ts
import { formatUnits } from '@derivation-tech/web3-core';
import { SynFuturesV3 } from './synfuturesV3Core';
import { ORDER_SPACING, PERP_EXPIRY } from './constants';
import { InstrumentCondition, Status } from './types';
import { alignTick, calcMinTickDelta } from './common/util';
import { TICK_DELTA_MAX } from './math';

export async function demoRestrictions(): Promise<void> {
    const synfV3 = SynFuturesV3.getInstance('Blast');
    const allInstruments = await synfV3.getAllInstruments();
    const instrument = allInstruments.find((i) => i.info.symbol.includes('BTC-USDB'))!;
    const pair = instrument.getPairModel(PERP_EXPIRY)!;
    // get your own signer
    const signer = await synfV3.ctx.getSigner('TEST');
    // general restrictions
    console.log(`pair has to be tradeable, i.e., instrument in NORMAL condition, pair not in SETTLING, SETTLED status`);
    console.log(
        `instrument condition: ${InstrumentCondition[instrument.state.condition]}, pair status: ${
            Status[pair.amm.status]
        }`,
    );
    // add restrictions
    console.log(`isAuthorizedLp: ${await synfV3.contracts.config.isAuthorizedLp(await signer.getAddress())}`);
    console.log(
        `tickDelta has to be within [${calcMinTickDelta(instrument.setting.initialMarginRatio)}, ${TICK_DELTA_MAX}]`,
    );
    console.log(`minRangeValue: ${formatUnits(instrument.minRangeValue, instrument.info.quote.decimals)}`); // quote
    console.log(`minLiquidity: ${formatUnits(pair.getMinLiquidity(), 18)}`);
    // place order restrictions
    console.log(`minOrderValue: ${formatUnits(instrument.minOrderValue, instrument.info.quote.decimals)}`); // quote
    console.log(`valid order tick range: [${pair.placeOrderLimit.lowerTick}, ${pair.placeOrderLimit.upperTick}]`); // can only place order within this tick range
    console.log(`order tick has to be aligned with ORDER_SPACING: ${alignTick(pair.amm.tick, ORDER_SPACING)}`);
    console.log(`can only place long order below amm current tick and short order above amm current tick`);
    // trade restrictions
    console.log(`minTradeValue: ${formatUnits(instrument.minTradeValue, instrument.info.quote.decimals)}`); // quote
}

demoRestrictions().catch(console.error);
```

### Query subgraph using referral code as filter

```ts
import { getHexReferral } from './common';
import { SynFuturesV3 } from './synfuturesV3Core';

export async function demoQueryWithReferralCode(): Promise<void> {
    const synfV3 = SynFuturesV3.getInstance('blast');

    // NOTICE: you can query AddEvent, TradeEvent, PlaceEvent, Order and VirtualTrade using referralCode as filter
    // get user trade history
    const getReferralCode = (channel: string): string => {
        return '\xff\xff' + channel; // 0xffff means you are sending tx using SDK and private key
    };
    // query using full referralCode
    const userTradeHistory1 = await synfV3.subgraph.getVirtualTrades({
        referralCode: getReferralCode('8test8'), // query all trades using '\xff\xff8test8' as referralCode
    });
    // query using partial referralCode
    await synfV3.subgraph.getVirtualTrades({
        referralCode: '8test8', // query all trades with referral code which contains '8test8'
    });
    // query add, trade, place events using referralCode
    const addEvents = await synfV3.subgraph.query(
        `query($skip: Int, $first: Int, $lastID: String){
            addEvents(
                skip: $skip, first: $first,
                where: {
                referralCode_contains: "${getReferralCode('8test8')}"
                id_gt: $lastID
                }
            ) {
                id
                logIndex
                transaction {
                id
                }
                address
                expiry
                trader
                tickLower
                tickUpper
                liquidity
                balance
                sqrtEntryPX96
                entryFeeIndex
                referralCode
            }
        }`,
        0,
        1000,
    );
    console.log(addEvents);
    const tradeEvents = await synfV3.subgraph.query(
        `query($skip: Int, $first: Int, $lastID: String){
            tradeEvents(
                skip: $skip, first: $first,
                where: {
                referralCode_contains: "${getReferralCode('8test8')}"
                id_gt: $lastID
                }
            ) {
                id
                logIndex
                transaction {
                id
                }
                address
                expiry
                trader
                size
                amount
                takenSize
                takenValue
                entryNotional
                feeRatio
                mark
                sqrtPX96
                tradingFeeRatio
                protocolFeeRatio
                referralCode
            }
        }`,
        0,
        1000,
    );
    console.log(tradeEvents);
    const placeEvents = await synfV3.subgraph.query(
        `query($skip: Int, $first: Int, $lastID: String){
            placeEvents(
                skip: $skip, first: $first,
                where: {
                referralCode_contains: "${getReferralCode('8test8')}"
                id_gt: $lastID
                }
            ) {
                id
                logIndex
                transaction {
                id
                }
                address
                expiry
                trader
                tick
                nonce
                balance
                size
                referralCode
            }
        }`,
        0,
        1000,
    );
    console.log(placeEvents);
    // query user orders
    const orders = await synfV3.subgraph.getUserOrders({
        referralCode: getReferralCode('8test8'),
    });
    console.log(orders[0]);
    // to access referralCode from userTradeHistory
    console.log(userTradeHistory1[0].referralCode!);
    // but since return value is string, while wallet and platform code could range from \x01 to \xff
    // however, code larger than \x7f is not valid in utf-8 encoding and would be treated as unicode
    // so, to get original platform and wallet code, you can use getHexReferral
    console.log(getHexReferral(userTradeHistory1[0].referralCode!));
}

demoQueryWithReferralCode().catch(console.error);
```

## 🔗 Referral Code

### Introduction

On-chain Referral Code is a referral code embedded in transactions on the SynFutures platform, used to track and record user transactions. This referral code is also known as the Channel Code.

### Features

1. Embedded in Transactions: The referral code is written into transactions such as add, trade, place.
2. Platform Access: Users can access the SynFutures platform via a link with the referral code (e.g., https://oyster.synfutures.com/#/market?channel=8test8).
3. Recording Referral Code: The referral code is recorded in transactions during user sessions.
4. Transaction Query: Use the SDK to query transaction records with the referral code.

### Usage Instructions

1. Generate Referral Link: Generate a link with the referral code (format: https://oyster.synfutures.com/#/market?channel={channelCode}) and share it with other users. For example, if the channelCode is 8test8, the link would be https://oyster.synfutures.com/#/market?channel=8test8.
2. Access Platform: Users access the SynFutures platform via the referral link.
3. Perform Transactions: Users perform add, trade, place transactions on the platform.
4. Query Transactions: Use the SDK to query transaction records with the referral code.

### Note

-   Referral Code Length: The channelCode must be 6 characters long.
-   Make sure to contact us through Discord or Telegram to ensure the uniqueness of the referral code before generating the link.

### Fill in the referral code through the SDK

When calling `adjust`/`add`/`trade`/`tradeWithRisk`/`place`/`batchPlace`/`tradeToTickAndPlaceOrder`/`intuitiveTrade`/`adjustMargin`/`limitOrder`/`addLiquidityWithAsymmetricRange`/`addLiquidity`, you can pass in the last parameter to fill in the referral code, for example:

```ts
// use referral code
// NOTICE: channel code must be 6 bytes long
const channel = '8test8';
const getReferralCode = (channel: string): string => {
    return '\xff\xff' + channel; // 0xffff means you are sending tx using SDK and private key
};
await synfV3.place(
    signer,
    instrument.info.addr,
    {
        expiry: pair.amm.expiry,
        tick, // the price you want to place your order in tick format
        size: size,
        amount: margin,
        deadline: now() + 10 * 60,
    },
    {}, // here is overrides, you can pass in custom overrides for gas price and limit
    getReferralCode(channel),
);
```
