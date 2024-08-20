import { Subgraph } from '../subgraph';
import { graphUrl } from './util';
import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function base() {
    const subgraph = new Subgraph(graphUrl['base']);
    const trades = await subgraph.getTransactionEvents({
        eventNames: ['Trade', 'Sweep'],
        startTs: 1721347200,
    });

    const mmsOutputPath = path.join(__dirname, 'data', 'base_trades.csv');
    const file = fs.openSync(mmsOutputPath, 'a');

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const write = (...data: string[]) => {
        fs.writeSync(file, data.join(',') + '\n');
    };

    write(
        'trader',
        'txHash',
        'instrumentAddr',
        'blockNumber',
        'timestamp',
        'entryNotional',
        'tradingFeeRatio',
        'protocolFeeRatio',
    );

    for (const trade of trades) {
        const trader = trade.args.trader;
        const txHash = trade.txHash;
        const instrumentAddr = trade.address;
        const blockNumber = trade.blockNumber?.toString() ?? '0';
        const timestamp = trade.timestamp ? new Date(trade.timestamp * 1000).toISOString() : '0';
        const entryNotional = trade.args.entryNotional;
        const tradingFeeRatio = trade.args.tradingFeeRatio;
        const protocolFeeRatio = trade.args.protocolFeeRatio;
        write(trader, txHash, instrumentAddr, blockNumber, timestamp, entryNotional, tradingFeeRatio, protocolFeeRatio);
    }

    console.log(`Wrote base trades to ${mmsOutputPath}`);
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function blast() {
    const subgraph = new Subgraph(graphUrl['blast']);
    const trades = await subgraph.getTransactionEvents({
        eventNames: ['Trade', 'Sweep'],
        startTs: 1721347200,
    });

    const mmsOutputPath = path.join(__dirname, 'data', 'blast_trades.csv');
    const file = fs.openSync(mmsOutputPath, 'a');

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const write = (...data: string[]) => {
        fs.writeSync(file, data.join(',') + '\n');
    };

    write(
        'trader',
        'txHash',
        'instrumentAddr',
        'blockNumber',
        'timestamp',
        'entryNotional',
        'tradingFeeRatio',
        'protocolFeeRatio',
    );

    for (const trade of trades) {
        const trader = trade.args.trader;
        const txHash = trade.txHash;
        const instrumentAddr = trade.address;
        const blockNumber = trade.blockNumber?.toString() ?? '0';
        const timestamp = trade.timestamp ? new Date(trade.timestamp * 1000).toISOString() : '0';
        const entryNotional = trade.args.entryNotional;
        const tradingFeeRatio = trade.args.tradingFeeRatio;
        const protocolFeeRatio = trade.args.protocolFeeRatio;
        write(trader, txHash, instrumentAddr, blockNumber, timestamp, entryNotional, tradingFeeRatio, protocolFeeRatio);
    }

    console.log(`Wrote base trades to ${mmsOutputPath}`);
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function main() {
    // await base();
    await blast();
}

main()
    .catch(console.error)
    .finally(() => process.exit(0));
