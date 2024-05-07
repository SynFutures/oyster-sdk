import { CHAIN_ID } from '@derivation-tech/web3-core';
import { SynFuturesV3 } from '../../src/synfutures';
import { DepthChartDataProvider } from '../../src/chart/depth';
import { PERP_EXPIRY } from '../../src/constants';
import { fromWad } from '../../src/common/util';
import { TickMath, sqrtX96ToWad } from '../../src/math';

export async function depthChartDemo(): Promise<void> {
    const dataProvider = new DepthChartDataProvider(CHAIN_ID.GOERLI);
    const synfV3 = SynFuturesV3.getInstance('goerli');
    const instruments = await synfV3.getAllInstruments();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const instrument = instruments.find((i) => i.info.symbol === 'ETH-USDC-LINK')!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-non-null-asserted-optional-chain
    const pair = instrument?.state.pairs.get(PERP_EXPIRY)!;

    console.info(
        pair.amm.tick,
        fromWad(sqrtX96ToWad(TickMath.getSqrtRatioAtTick(pair.amm.tick))),
        fromWad(sqrtX96ToWad(pair.amm.sqrtPX96)),
    );
    const liquidity = pair.amm.liquidity;

    const result = await dataProvider.getDepthData(
        instrument.info.addr,
        PERP_EXPIRY,
        liquidity,
        pair.amm.sqrtPX96,
        instrument.setting.initialMarginRatio,
    );
    console.info(result);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
depthChartDemo();
