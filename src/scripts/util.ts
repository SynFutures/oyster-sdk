/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { SynFuturesV3 } from '../synfuturesV3Core';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type

export type Network = 'blast' | 'base';

export const graphUrl = {
    ['blast']: process.env.BLAST_SUBGRAPH!,
    ['base']: process.env.BASE_SUBGRAPH!,
};

const reversePiars = {
    ['blast']: [
        'WETH-PAC-EMG',
        'ETH-ezETH-PYTH',
        'ETH-fwWETH-EMG',
        'ETH-weETH-PYTH',
        'WETH-ESE-DEXV2',
        'ETH-wrsETH-EMG',
        'ETH-BLAST-PYTH',
    ],
    ['base']: [
        'ETH-CHOMP-EMG',
        'ETH-DEGEN-LINK',
        'ETH-ISK-EMG',
        'ETH-wrsETH-EMG',
        'ETH-weETH-EMG',
        'ETH-wstETH-EMG',
        'WETH-BOOMER-DEXV2',
    ],
};

export async function getPairMap(network: Network) {
    const synfV3Blast = SynFuturesV3.getInstance(network);
    const instruments = await synfV3Blast.getAllInstruments();

    const pairMap = new Map<string, { symbol: string; reverse: boolean }>();

    for (const instrument of instruments) {
        const symbol = instrument.info.symbol;
        const reverse = reversePiars[network].includes(symbol);
        const address = instrument.info.addr.toLocaleLowerCase();
        pairMap.set(address, { symbol, reverse });
    }
    return pairMap;
}

// getPairMap('base')
//     .catch(console.error)
//     .finally(() => process.exit(0));
