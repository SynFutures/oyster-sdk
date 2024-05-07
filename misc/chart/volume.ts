import { CHAIN_ID, now } from '@derivation-tech/web3-core';
import { VolumeChartDataProvider } from '../../src/chart/volume';
import { PERP_EXPIRY } from '../../src/constants';

export async function volumeChartDemo(): Promise<void> {
    const dataProvider = new VolumeChartDataProvider(CHAIN_ID.GOERLI);
    const x = await dataProvider.getVolumeData('0x32ab8e85795cde3763ade43a4141dd4ed2d33b55', PERP_EXPIRY, 0, now());
    console.info(x);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
volumeChartDemo();
