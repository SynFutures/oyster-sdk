import { CHAIN_ID } from '@derivation-tech/web3-core';
import { PERP_EXPIRY } from '../../src/constants';
import { LiquidityChartDataProvider } from '../../src/chart/liquidity';

export async function liquidityChartDemo(): Promise<void> {
    const dataProvider = new LiquidityChartDataProvider(CHAIN_ID.GOERLI);
    const x = await dataProvider.getLiquidityData('0x32ab8e85795cde3763ade43a4141dd4ed2d33b55', PERP_EXPIRY);
    console.info(JSON.stringify(x));
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
liquidityChartDemo();
