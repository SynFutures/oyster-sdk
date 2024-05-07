# SynFutures V3 SDK

SDK for SynFutures V3

## 💻 Getting Started

npm:

```
npm install @synfutures/v3-sdk
```

yarn:

```
yarn add @synfutures/v3-sdk
```

## 📝 Environment Variables Requirement

This package depends on the more fundamental package `@derivation-tech/web3-core`. Therefore, some environment variables need to be provided as required during runtime. Please refer to [here](https://www.npmjs.com/package/@derivation-tech/web3-core).

## 📖 Resources

-   [API Reference](./docs/README.md)

## 👀 Note

1. Before carrying out operations like trade, place, etc., please check the user's allowance for `Gate`.
2. When interacting with `Gate` (such as deposit, withdraw), the precision of the token is its own precision. However, when interacting with `Instrument`, the precision of the token is fixed at 18.

## Examples

1. [Query accout onchain information](#query-accout-onchain-information)
2. [Deposit to `Gate`](#deposit-to-gate)
3. [Withdraw from `Gate`](#withdraw-from-gate)
4. [Query the price of `ETH-USDC-LINK` trading pair](#query-the-price-of-eth-usdc-link-trading-pair)
5. [Trade](#trade)
6. [Adjust position, withdraw half of the available margin](#adjust-position-withdraw-half-of-the-available-margin)
7. [Place order](#place-order)
8. [Cancel order](#cancel-order)
9. [Fill order](#fill-order)
10. [Add liquidity](#add-liquidity)
11. [Remove liquidity](#remove-liquidity)
12. [Query user operation history](#query-user-operation-history)

### Query accout onchain information

```ts
import { ethers } from 'ethers';
import { SynFuturesV3, PERP_EXPIRY } from '@synfutures/v3-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('goerli');

    await sdk.init();

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

    const instrument = getInstrumentBySymbol('ETH-USDC-LINK');

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

    // output example:
    // Position balance: 199.960140545507496997, size: 0.003549563116507925, entryNotional: 5.854431236643761468, entrySocialLossIndex: 0.0, entryFundingIndex: -2.553961029268679555
    // Order id: 1242101186560, size: 1.0, balance: 328.222567343894200353, tick: 74035, nonce: 0
    // Range id: 1054448110750, size: 1000.0, from: 62850, to: 62850
}

main().catch(console.error);
```

### Deposit to `Gate`

```ts
import { ethers } from 'ethers';
import { SynFuturesV3 } from '@synfutures/v3-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('goerli');

    await sdk.init();

    // get signer
    const signer = await sdk.ctx.getSigner(process.argv[2]);

    // approve
    await sdk.ctx.erc20.approveIfNeeded(
        signer,
        await sdk.ctx.getAddress('USDC'),
        sdk.config.contractAddress.gate,
        ethers.constants.MaxUint256,
    );

    await sdk.deposit(signer, await sdk.ctx.getAddress('USDC'), ethers.utils.parseUnits('100', 6));

    console.log('Deposit 100 USDC to gate');
}

main().catch(console.error);
```

### Withdraw from `Gate`

```ts
import { SynFuturesV3 } from '@synfutures/v3-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('goerli');

    await sdk.init();

    // get signer
    const signer = await sdk.ctx.getSigner(process.argv[2]);

    await sdk.contracts.gate.withdraw(
        await sdk.ctx.getAddress('USDC'),
        await sdk.contracts.gate.reserveOf(await sdk.ctx.getAddress('USDC'), await signer.getAddress()),
    );

    console.log('Withdraw all balances from the gate');
}

main().catch(console.error);
```

### Query the price of `ETH-USDC-LINK` trading pair

```ts
import { ethers } from 'ethers';
import { SynFuturesV3, PERP_EXPIRY, TickMath } from '@synfutures/v3-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('goerli');

    await sdk.init();

    const instruments = await sdk.getAllInstruments();

    function getInstrumentBySymbol(symbol: string) {
        const instrument = instruments.find((i) => i.info.symbol === symbol);
        if (!instrument) {
            throw new Error('unknown symbol: ' + symbol);
        }
        return instrument;
    }

    const instrument = getInstrumentBySymbol('ETH-USDC-LINK');

    const pair = instrument.state.pairs.get(PERP_EXPIRY)!;

    console.log(
        'ETH-USDC-LINK-PERP fair price:',
        ethers.utils.formatUnits(TickMath.getWadAtTick(pair.amm.tick)),
        'mark price:',
        ethers.utils.formatUnits(pair.markPrice),
    );

    // output example: ETH-USDC-LINK-PERP fair price: 1648.019659473575245172 mark price: 1640.335551941453399394
}

main().catch(console.error);
```

### Trade

```ts
import { ethers } from 'ethers';
import { SynFuturesV3, PERP_EXPIRY, Side } from '@synfutures/v3-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('goerli');

    await sdk.init();

    // get signer
    const signer = await sdk.ctx.getSigner(process.argv[2]);

    const instruments = await sdk.getAllInstruments();

    function getInstrumentBySymbol(symbol: string) {
        const instrument = instruments.find((i) => i.info.symbol === symbol);
        if (!instrument) {
            throw new Error('unknown symbol: ' + symbol);
        }
        return instrument;
    }

    const instrument = getInstrumentBySymbol('ETH-USDC-LINK');

    const pair = instrument.state.pairs.get(PERP_EXPIRY)!;

    // inquire quotation and how much ETH is equivalent to 100 USDC
    const { baseAmount, quotation } = await sdk.inquireByQuote(pair, Side.LONG, ethers.utils.parseUnits('100', 18));

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
        )} ETH(≈ 100 USDC) with ${ethers.utils.formatUnits(result.margin, 18)} USDC and ${ethers.utils.formatUnits(
            result.leverageWad,
        )} leverage`,
    );

    // output example: Open a long position of 0.059073156132254917 ETH(≈100 USDC) with 25.963689100629764104 USDC and 4.0 leverage
}

main().catch(console.error);
```

### Adjust position, withdraw half of the available margin

```ts
import { ethers } from 'ethers';
import { SynFuturesV3, PERP_EXPIRY } from '@synfutures/v3-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('goerli');

    await sdk.init();

    // get signer
    const signer = await sdk.ctx.getSigner(process.argv[2]);

    const instruments = await sdk.getAllInstruments();

    function getInstrumentBySymbol(symbol: string) {
        const instrument = instruments.find((i) => i.info.symbol === symbol);
        if (!instrument) {
            throw new Error('unknown symbol: ' + symbol);
        }
        return instrument;
    }

    const instrument = getInstrumentBySymbol('ETH-USDC-LINK');

    const pair = instrument.state.pairs.get(PERP_EXPIRY)!;

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

    console.log(`Withdraw ${ethers.utils.formatUnits(available.div(2), 18)} USDC margin`);

    // output example: Withdraw 19.991426485430327823 USDC margin
}

main().catch(console.error);
```

### Place order

```ts
import { ethers } from 'ethers';
import { SynFuturesV3, PERP_EXPIRY, Side, TickMath } from '@synfutures/v3-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('goerli');

    await sdk.init();

    // get signer
    const signer = await sdk.ctx.getSigner(process.argv[2]);

    const instruments = await sdk.getAllInstruments();

    function getInstrumentBySymbol(symbol: string) {
        const instrument = instruments.find((i) => i.info.symbol === symbol);
        if (!instrument) {
            throw new Error('unknown symbol: ' + symbol);
        }
        return instrument;
    }

    const instrument = getInstrumentBySymbol('ETH-USDC-LINK');

    const pair = instrument.state.pairs.get(PERP_EXPIRY)!;

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
        `Place a 4 leveraged limit order of 0.2 ETH at ${ethers.utils.formatUnits(
            TickMath.getWadAtTick(targetTick),
            18,
        )}`,
    );

    // output example: Placed a 4 leveraged limit order of 0.2 ETH at 1742.588359609033834188
}

main().catch(console.error);
```

### Cancel order

```ts
import { SynFuturesV3, PERP_EXPIRY } from '@synfutures/v3-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('goerli');

    await sdk.init();

    // get signer
    const signer = await sdk.ctx.getSigner(process.argv[2]);

    const instruments = await sdk.getAllInstruments();

    function getInstrumentBySymbol(symbol: string) {
        const instrument = instruments.find((i) => i.info.symbol === symbol);
        if (!instrument) {
            throw new Error('unknown symbol: ' + symbol);
        }
        return instrument;
    }

    const instrument = getInstrumentBySymbol('ETH-USDC-LINK');

    const account = await sdk.getPairLevelAccount(await signer.getAddress(), instrument.info.addr, PERP_EXPIRY);

    // cancel all orders
    await sdk.batchCancelOrder(signer, account, account.orders, Math.floor(Date.now() / 1000) + 300);

    console.log('Cancel all orders:', account.orders.map((order) => order.oid).join(','));

    // output: Cancel all orders: 1252167516160
}

main().catch(console.error);
```

### Fill order

```ts
import { SynFuturesV3, PERP_EXPIRY } from '@synfutures/v3-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('goerli');

    await sdk.init();

    // get signer
    const signer = await sdk.ctx.getSigner(process.argv[2]);

    const instruments = await sdk.getAllInstruments();

    function getInstrumentBySymbol(symbol: string) {
        const instrument = instruments.find((i) => i.info.symbol === symbol);
        if (!instrument) {
            throw new Error('unknown symbol: ' + symbol);
        }
        return instrument;
    }

    const instrument = getInstrumentBySymbol('ETH-USDC-LINK');

    const account = await sdk.getPairLevelAccount(await signer.getAddress(), instrument.info.addr, PERP_EXPIRY);

    const targetOrder = account.orders[0];

    await sdk.fill(signer, instrument.info.addr, {
        expiry: PERP_EXPIRY,
        tick: targetOrder.tick,
        target: await signer.getAddress(),
        nonce: targetOrder.nonce,
    });

    console.log('Fill order:', targetOrder.oid);

    // output: Fill order: 1252167516160
}

main().catch(console.error);
```

### Add liquidity

```ts
import { ethers } from 'ethers';
import { SynFuturesV3, PERP_EXPIRY, TickMath } from '@synfutures/v3-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('goerli');

    await sdk.init();

    // get signer
    const signer = await sdk.ctx.getSigner(process.argv[2]);

    const instruments = await sdk.getAllInstruments();

    function getInstrumentBySymbol(symbol: string) {
        const instrument = instruments.find((i) => i.info.symbol === symbol);
        if (!instrument) {
            throw new Error('unknown symbol: ' + symbol);
        }
        return instrument;
    }

    const instrument = getInstrumentBySymbol('ETH-USDC-LINK');

    // update cache for signer
    await sdk.syncVaultCacheWithAllQuotes(await signer.getAddress());

    const result = await sdk.simulateAddLiquidity(
        await signer.getAddress(),
        {
            marketType: instrument.marketType,
            baseSymbol: instrument.info.base.symbol,
            quoteSymbol: instrument.info.quote.symbol,
        },
        PERP_EXPIRY,
        ethers.utils.parseUnits('1.8', 18), // alpha, liquidity range factor, 1.8 means ± 80%
        ethers.utils.parseUnits('100', 18), // margin
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
        ethers.utils.parseUnits('100', 18),
        result.sqrtStrikeLowerPX96,
        result.sqrtStrikeUpperPX96,
    );

    console.log(
        `Add 100 USDC liquidity from tick ${TickMath.getTickAtSqrtRatio(
            result.sqrtStrikeLowerPX96,
        )} to tick ${TickMath.getTickAtSqrtRatio(result.sqrtStrikeUpperPX96)}`,
    );

    // output example: Add 100 USDC liquidity from tick 73782 to tick 74183
}

main().catch(console.error);
```

### Remove liquidity

```ts
import { ethers } from 'ethers';
import { SynFuturesV3, PERP_EXPIRY } from '@synfutures/v3-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('goerli');

    await sdk.init();

    // get signer
    const signer = await sdk.ctx.getSigner(process.argv[2]);

    const instruments = await sdk.getAllInstruments();

    function getInstrumentBySymbol(symbol: string) {
        const instrument = instruments.find((i) => i.info.symbol === symbol);
        if (!instrument) {
            throw new Error('unknown symbol: ' + symbol);
        }
        return instrument;
    }

    const instrument = getInstrumentBySymbol('ETH-USDC-LINK');

    // update cache for signer
    await sdk.syncVaultCacheWithAllQuotes(await signer.getAddress());

    // get user account
    const account = await sdk.getPairLevelAccount(await signer.getAddress(), instrument.info.addr, PERP_EXPIRY);

    const range = account.ranges[0];

    const result = sdk.simulateRemoveLiquidity(account, range, 100);

    await sdk.removeLiquidity(
        signer,
        instrument.state.pairs.get(PERP_EXPIRY)!,
        await signer.getAddress(),
        range,
        result.sqrtStrikeLowerPX96,
        result.sqrtStrikeUpperPX96,
        Math.floor(Date.now() / 1000) + 300, // deadline, set to 5 minutes later
    );

    console.log(
        `Remove ${ethers.utils.formatUnits(range.balance, 18)} USDC liquidity from tick ${range.tickLower} to tick ${
            range.tickUpper
        }`,
    );

    // output example: Remove 100.0 USDC liquidity from tick 68100 to tick 79850
}

main().catch(console.error);
```

### Query user operation history

```ts
import { SynFuturesV3 } from '@synfutures/v3-sdk';

async function main() {
    const sdk = SynFuturesV3.getInstance('goerli');

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
