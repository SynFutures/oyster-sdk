/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Subgraph } from '../subgraph';
import { ethers } from 'ethers';
import moment from 'moment';
import fs from 'fs';
import path from 'path';
import { graphUrl, getPairMap, Network } from './util';
import Decimal from 'decimal.js';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type

function getAdjustTradeSide(
    tradeSide: 'Long' | 'Short',
    isInverse: boolean,
    considerSweepInTradeHistoryProps?: {
        type: string;
        fee: ethers.BigNumber;
    },
) {
    const side = isInverse ? (tradeSide === 'Long' ? 'Short' : 'Long') : tradeSide;
    if (considerSweepInTradeHistoryProps) {
        const { type, fee } = considerSweepInTradeHistoryProps;
        if (type == 'LIQUIDATION' && fee.eq(0)) {
            return side == 'Long' ? 'Short' : 'Long';
        }
    }
    return side;
}

export async function getTradeRecords(network: Network) {
    console.log(`Start to get trade records on ${network}`);

    const subgraph = new Subgraph(graphUrl[network]);

    const pairMap = await getPairMap(network);
    void pairMap;

    const trades = await subgraph.getVirtualTrades({
        instrumentAddr: '0xec6c44e704eb1932ec5fe1e4aba58db6fee71460',
        startTs: 1721433600,
        endTs: 1721606400,
    });

    const outputs = trades.map((trade) => {
        const p = trade as any;
        return {
            timestamp: moment.unix(p.timestamp).format('YYYY-MM-DD HH:mm:ss'),
            trader: p.trader,
            txHash: p.txHash,
            pair: pairMap.get(p.instrumentAddr.toLowerCase())?.symbol,
            type: p.type,
            side: getAdjustTradeSide(
                (p.size as ethers.BigNumber).gte(0) ? 'Long' : 'Short',
                pairMap.get(p.instrumentAddr.toLowerCase())!.reverse,
                { fee: p.fee, type: p.type },
            ),
            size: ethers.utils.formatEther(p.size.abs()),
            price: pairMap.get(p.instrumentAddr.toLowerCase())!.reverse
                ? new Decimal(1).div(ethers.utils.formatEther(p.price)).toFixed()
                : ethers.utils.formatEther(p.price),
            trade_values: ethers.utils.formatEther(p.tradeValue.abs()),
            fee: ethers.utils.formatEther(p.fee),
        };
    });

    const filterOutputs = outputs.filter((data) => new Decimal(data.size).gt(0.00000000000000001));

    const bad = filterOutputs.filter((data) => new Decimal(data.price).lt(60000));

    console.log(bad.length);

    console.log(bad);

    const outputFile = path.join(__dirname, `${network}_trade.csv`);
    const header = 'timestamp,trader,txHash,pair,type,side,size,price,trade_values,fee\n';
    fs.writeFileSync(outputFile, header);
    filterOutputs.forEach((data) => {
        const line = `${data.timestamp},${data.trader},${data.txHash},${data.pair},${data.type},${data.side},${data.size},${data.price},${data.trade_values},${data.fee}\n`;
        fs.appendFileSync(outputFile, line);
    });
}

getTradeRecords('base')
    .catch(console.error)
    .finally(() => process.exit(0));

