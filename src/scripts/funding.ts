/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Subgraph } from '../subgraph';
import { ethers } from 'ethers';
import moment from 'moment';
import fs from 'fs';
import path from 'path';
import { graphUrl, getPairMap, Network } from './util';
// import Decimal from 'decimal.js';

export async function getFundingRecords(network: Network, signer: string) {
    const subgraph = new Subgraph(graphUrl[network]);

    const pairMap = await getPairMap(network);

    console.log(`Start to get funding records ${signer} on ${network}`);
    const trades = await subgraph.getTransactionEvents({
        traders: [signer],
        eventNames: ['FundingFee'],
    });

    const outputs = trades.map((trade) => {
        const p = trade as any;
        const funding = ethers.BigNumber.from(p.args.funding);
        return {
            timestamp: moment.unix(p.timestamp).format('YYYY-MM-DD HH:mm:ss'),
            trader: p.args.trader,
            pair: pairMap.get(p.address.toLowerCase())?.symbol,
            action: funding.gt(0) ? 'Receive' : 'Pay',
            amount: ethers.utils.formatEther(funding),
        };
    });

    const outputFile = path.join(__dirname, `${network}_${signer}_funding.csv`);
    const header = 'timestamp,trader,instrumentAddr,action,amount\n';
    fs.writeFileSync(outputFile, header);
    outputs.forEach((data) => {
        const line = `${data.timestamp},${data.trader},${data.pair},${data.action},${data.amount}\n`;
        fs.appendFileSync(outputFile, line);
    });
}

