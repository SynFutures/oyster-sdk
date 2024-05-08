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
8. [Cancel order](#cancel-order)
9. [Fill order](#fill-order)
10. [Add liquidity](#add-liquidity)
11. [Remove liquidity](#remove-liquidity)
12. [Query user operation history](#query-user-operation-history)

### Prerequisites
To successfully run the blew examples:

- Please put BLAST_RPC=https://rpc.ankr.com/blast into the .env file where you run your command.
- Also set your private key ALICE_PRIVATE_KEY=your_own_private_key if you want to send transactions.

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

### Cancel order

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
