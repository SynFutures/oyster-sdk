/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Subgraph } from '../subgraph';
import { graphUrl } from './util';
import fs from 'fs';
import path from 'path';
import Decimal from 'decimal.js';
import { Instrument, DB, models } from '@synfutures/misc-db';
import { SynFuturesV3 } from '../synfuturesV3Core';
import { ethers } from 'ethers';

export function pickQuoteFromSymbol(symbol: string) {
    const from = symbol.indexOf('-');
    const to = symbol.lastIndexOf('-');
    if (from === -1 || to === -1 || from === to) {
        throw new Error('invalid symbol: ' + symbol);
    }
    return symbol.substring(from + 1, to);
}

export function pickQuoteFromFullSymbol(symbol: string) {
    const from = symbol.indexOf('-');
    const last = symbol.lastIndexOf('-');
    const to = symbol.lastIndexOf('-', last - 1);
    if (from === -1 || to === -1 || from === to) {
        throw new Error('invalid symbol: ' + symbol);
    }
    return symbol.substring(from + 1, to);
}

export function formatHexString(str: string) {
    return str.startsWith('0x') ? str.slice(2).toLowerCase() : str.toLowerCase();
}

async function main() {
    const instrumentToQuote = new Map<string, { decimals: number; name: string; symbol: string }>();

    async function getQuoteInfoByInstrument(address: string, sdk: any) {
        let info = instrumentToQuote.get(address);

        if (info === undefined) {
            const instrument = await Instrument.findOne({
                where: { chainId: sdk.ctx.chainId, address: formatHexString(address) },
            });
            if (instrument === null) {
                throw new Error('missing instrument: ' + instrument);
            }

            const tokenInfo = await sdk.ctx.getTokenInfo('0x' + instrument.quote);

            instrumentToQuote.set(
                address,
                (info = {
                    name: pickQuoteFromSymbol(instrument.symbol),
                    decimals: tokenInfo.decimals,
                    symbol: instrument.symbol,
                }),
            );
        }

        return info;
    }

    const baseSubgraph = new Subgraph(graphUrl['base']);
    const blastSubgraph = new Subgraph(graphUrl['blast']);

    const baseSdk = SynFuturesV3.getInstance('base');
    const blastSdk = SynFuturesV3.getInstance('blast');

    const referralCode = 'ÿÿvooi01';

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const db = new DB(process.env.DB_URL!);
    await db.init(models);

    const baseTrades = await baseSubgraph.getVirtualTrades({
        referralCode: referralCode,
    });

    const blastTrades = await blastSubgraph.getVirtualTrades({
        referralCode: referralCode,
    });

    const outputPath = path.join(__dirname, 'data', 'voulmeAndFees.csv');

    const file = fs.openSync(outputPath, 'a');

    const write = (...data: string[]) => {
        fs.writeSync(file, data.join(',') + '\n');
    };

    const inputPath = path.join(__dirname, 'data', 'input.csv');

    const data = fs.readFileSync(inputPath, 'utf8');
    const lines = data.split('\n').slice(1);

    const linesWithFee = lines.map((line) => {
        const [chain, address, pair, volumeInUsd] = line.split(',');
        const formatAddress = address.replace(/^"|"$/g, '');
        const quoteName = pickQuoteFromFullSymbol(pair);
        const fee = new Decimal(0);
        const symbol = pair.replace(/-PERP$/, '');
        return { chain, formatAddress, pair, volumeInUsd, symbol, quoteName, fee };
    });

    for (const trade of baseTrades) {
        const quoteInfo = await getQuoteInfoByInstrument(trade.instrumentAddr, baseSdk);
        const symbol = quoteInfo.symbol;
        console.log(symbol);
        const fee = ethers.utils.formatEther(trade.fee);
        const record = linesWithFee.find(
            (line) => line.chain == 'base' && line.formatAddress == trade.trader && line.symbol == symbol,
        );
        if (record) {
            record.fee = record.fee.add(fee);
        }
    }

    for (const trade of blastTrades) {
        const quoteInfo = await getQuoteInfoByInstrument(trade.instrumentAddr, blastSdk);
        const symbol = quoteInfo.symbol;
        const fee = ethers.utils.formatEther(trade.fee);

        const record = linesWithFee.find(
            (line) => line.chain === 'blast' && line.formatAddress === trade.trader && line.symbol === symbol,
        );
        if (record) {
            record.fee = record.fee.add(fee);
        }
    }

    write('chain', 'trader', 'pair', 'volumeInUsd', 'quoteName', 'feeInQuote');

    for (const record of linesWithFee) {
        write(
            record.chain,
            record.formatAddress,
            record.pair,
            record.volumeInUsd,
            record.quoteName,
            record.fee.toFixed(),
        );
    }
}

main()
    .catch(console.error)
    .finally(() => process.exit(0));
