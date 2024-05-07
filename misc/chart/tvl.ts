import { CHAIN_ID, now } from '@derivation-tech/web3-core';
import { TvlChartDataProvider } from '../../src/chart/tvl';
import { PERP_EXPIRY } from '../../src/constants';

export async function tvlChartDemo(): Promise<void> {
    const dataProvider = new TvlChartDataProvider(CHAIN_ID.GOERLI);
    const x = await dataProvider.getTvlData('0x02a3f65cd2332f829f4a69bcb16f3a987304b430', PERP_EXPIRY, 0, now());
    console.info(x);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
tvlChartDemo();
