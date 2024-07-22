/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Subgraph } from '../subgraph';
import { ethers } from 'ethers';
import moment from 'moment';
import fs from 'fs';
import path from 'path';
import { graphUrl, getPairMap, Network } from './util';
import { TickMath, sqrtX96ToWad, SqrtPriceMath } from '../math';
import Decimal from 'decimal.js';

function reservePrice(price: ethers.BigNumber, reverse: boolean) {
    return reverse ? new Decimal(1).div(ethers.utils.formatEther(price)).toFixed() : ethers.utils.formatEther(price);
}

export async function getLiquidityRecords(network: Network, signer: string) {
    const subgraph = new Subgraph(graphUrl[network]);

    const pairMap = await getPairMap(network);

    console.log(`Start to get liquidity records ${signer} on ${network}`);
    const trades = await subgraph.getTransactionEvents({
        traders: [signer],
        eventNames: ['Add', 'Remove'],
    });

    const outputs = trades.map((trade) => {
        const p = trade as any;

        let upper = reservePrice(
            TickMath.getWadAtTick(Number(p.args.tickUpper)).abs(),
            pairMap.get(p.address.toLowerCase())!.reverse,
        );

        let lower = reservePrice(
            TickMath.getWadAtTick(Number(p.args.tickLower)).abs(),
            pairMap.get(p.address.toLowerCase())!.reverse,
        );

        if (pairMap.get(p.address.toLowerCase())!.reverse) {
            const temp = upper;
            upper = lower;
            lower = temp;
        }
        let xreal: string | undefined = undefined;
        if (p.name == 'Add') {
            const sqrtUpperPX96 = TickMath.getSqrtRatioAtTick(Number(p.args.tickUpper));
            const entryDeltaBase = SqrtPriceMath.getDeltaBaseAutoRoundUp(
                ethers.BigNumber.from(p.args.range[3]),
                sqrtUpperPX96,
                ethers.BigNumber.from(p.args.range[0]),
            );
            xreal = ethers.utils.formatEther(entryDeltaBase);
        }

        const fairPrice = reservePrice(
            p.name == 'Add'
                ? sqrtX96ToWad(p.args.range && p.args.range.length > 0 ? p.args.range[p.args.range.length - 1] : 0)
                : sqrtX96ToWad(p.args.sqrtPX96),
            pairMap.get(p.address.toLowerCase())!.reverse,
        );

        return {
            timestamp: moment.unix(p.timestamp).format('YYYY-MM-DD HH:mm:ss'),
            trader: p.args.trader,
            pair: pairMap.get(p.address.toLowerCase())?.symbol,
            type: p.name == 'Add' ? 'Add' : 'Remove',
            lower_price: lower,
            upper_price: upper,
            amount: ethers.utils.formatEther(
                ethers.BigNumber.from(p.name === 'Add' ? p.args.range[2] : p.args.pic[0]).abs(),
            ),
            feeEarned: ethers.utils.formatEther(
                (p.name === 'Remove' ? ethers.BigNumber.from(p.args.fee) : undefined) || ethers.BigNumber.from(0).abs(),
            ),
            fairPrice: fairPrice,
            xreal: xreal || '',
            xrealxfairPrice: xreal ? new Decimal(xreal).mul(fairPrice).toFixed() : '',
        };
    });

    //make dir data if not exist
    if (!fs.existsSync(path.join(__dirname, 'data'))) {
        fs.mkdirSync(path.join(__dirname, 'data'));
    }

    const outputFile = path.join(__dirname, 'data', `${network}_${signer}_liquidity.csv`);
    const header =
        'timestamp,trader,pair,type,lower_price,upper_price,amount,feeEarned,fairPrice,xreal,xrealxfairPrice\n';
    fs.writeFileSync(outputFile, header);
    outputs.forEach((data) => {
        const line = `${data.timestamp},${data.trader},${data.pair},${data.type},${data.lower_price},${data.upper_price},${data.amount},${data.feeEarned},${data.fairPrice},${data.xreal},${data.xrealxfairPrice}\n`;
        fs.appendFileSync(outputFile, line);
    });
}
