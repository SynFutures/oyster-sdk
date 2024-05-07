import { CHAIN_ID, now } from '@derivation-tech/web3-core';
import { PERP_EXPIRY } from '../../src/constants';
import { KlineDataProvider, IKlineDataProvider, KlineInterval } from '../../src/chart/kline';
import { parseEther } from 'ethers/lib/utils';

export async function klineChartDemo(): Promise<void> {
    const dataProvider: IKlineDataProvider = new KlineDataProvider(CHAIN_ID.GOERLI);
    const x = await dataProvider.getKlineData(
        '0x32ab8e85795cde3763ade43a4141dd4ed2d33b55',
        PERP_EXPIRY,
        KlineInterval.HOUR,
        0,
        now(),
        parseEther('0.1'),
    );
    console.info(x);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
klineChartDemo();
