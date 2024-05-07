// import { serializeBNObject } from './utils';
// import { now, SECS_PER_MINUTE } from '@derivation-tech/web3-core';

// export async function testAllowUnauthorizedLPs(): Promise<void> {
//     const synfV3 = SynFuturesV3.getInstance('goerli');
//     const allow = await synfV3.openLp();
//     console.info(allow);

//     const inWhiteList = await synfV3.inWhiteList(['0xC7Ce13207e2570457A64167c8D78A5cCbc712349']);
//     console.info(inWhiteList);
// }

// export async function testGetAllInstruments(): Promise<void> {
//     const synfV3 = SynFuturesV3.getInstance('goerli');
//     const instruments = await synfV3.getAllInstruments();
//     console.info(instruments);
// }

// export async function test(): Promise<void> {
//     const synfV3 = SynFuturesV3.getInstance('goerli');
//     const trader = '0xC7Ce13207e2570457A64167c8D78A5cCbc712349';
//     const instrument = '0x7c7d626369177439338ce0509daf4403eed0020b';
//     const expiry = 4294967295;

//     const size = ethers.utils.parseEther('0.01');
//     const side = Side.LONG;
//     // const leverage = ethers.utils.parseEther('2');
//     const margin = ethers.utils.parseEther('200');
//     const usdc = await synfV3.ctx.getTokenInfo('USDC');
//     await synfV3.syncVaultCache(trader, [usdc.address]);

//     const account = await synfV3.getPairLevelAccount(trader, instrument, expiry);

//     const quotation = await synfV3.inquireByBase(account.rootPair, side, size);
//     const result = synfV3.simulateTrade(account, quotation.quotation, side, size, margin, undefined, 500);
//     console.info(result);
//     console.info(ethers.utils.formatEther(result.simulationMainPosition.leverageWad));
// }

// export async function testAllowUnauthorizedLPs(): Promise<void> {
//     const synfV3 = SynFuturesV3.getInstance('goerli');
//     const allow = await synfV3.openLp();
//     console.info(allow);

//     const inWhiteList = await synfV3.inWhiteList(['0xC7Ce13207e2570457A64167c8D78A5cCbc712349']);
//     console.info(inWhiteList);
// }

// export async function testGetAllInstruments(): Promise<void> {
//     const synfV3 = SynFuturesV3.getInstance('goerli');
//     const instruments = await synfV3.getAllInstruments();
//     for (const instrument of instruments) {
//         // search all pairs
//         const pairs = instrument.state.pairs;
//         // print every pair's involved fund
//         for (const pair of pairs.values()) {
//             const amm = pair.amm;
//             console.info(
//                 'pair:',
//                 pair.rootInstrument.info.symbol,
//                 'involvedFund:',
//                 ethers.utils.formatEther(amm.involvedFund),
//             );
//         }
//     }
// }

// export async function testGetDexV2RawSpotPrice(): Promise<void> {
//     const synfV3 = SynFuturesV3.getInstance('goerli');
//     const x = await synfV3.getDexV2RawSpotPrice({
//         baseSymbol: 'WETH',
//         quoteSymbol: 'USDC',
//         marketType: MarketType.DEXV2,
//     });
//     console.info(fromWad(x));
// }

// export async function testGetChainlinkRawSpotPrice(): Promise<void> {
//     const synfV3 = SynFuturesV3.getInstance('goerli');
//     const x = await synfV3.getChainlinkRawSpotPrice({
//         baseSymbol: 'BTC',
//         quoteSymbol: 'USDC',
//         marketType: MarketType.LINK,
//     });
//     console.info(fromWad(x));
// }

// import { serializeBNObject } from './utils';

// export async function test(): Promise<void> {
//     const synfV3 = SynFuturesV3.getInstance('goerli');

//     // const signer = await synfV3.ctx.getSigner('default');
//     const trader = '0x65C3B4439434bF053aA9C5aB547a6f7e742b68DF';
//     console.info(trader);
//     const instrument = '0xdc4bd200c97cb96f52140d2eedc53b52c1ef1cb1';
//     const expiry = 1695974400;

//     const size = ethers.utils.parseEther('2');
//     const side = Side.LONG;
//     const slippage = 500;
//     // const leverage = ethers.utils.parseEther('2');
//     // const margin = ethers.utils.parseEther('200');
//     await synfV3.syncVaultCacheWithAllQuotes(trader);

//     const account = await synfV3.getPairLevelAccount(trader, instrument, expiry);

//     const quotation = await synfV3.inquireByBase(account.rootPair, side, size);

//     const leverage = ethers.utils.parseEther('7.5');
//     const result = synfV3.simulateTrade(account, quotation.quotation, side, size, undefined, leverage, slippage);
//     console.info(serializeBNObject(result, ethers.utils.formatEther));
//     // expiry: number;
//     // size: BigNumber;
//     // amount: BigNumber;
//     // limitPrice: BigNumber; // todo: what is any_price?

//     // await synfV3.intuitiveTrade(
//     //     signer,
//     //     account.rootPair,
//     //     side,
//     //     size,
//     //     result.margin,
//     //     result.tradePrice,
//     //     slippage,
//     //     now() + 5 * SECS_PER_MINUTE,
//     // );
//     // console.info(ethers.utils.formatEther(result.simulationMainPosition.leverageWad));
// }

// // eslint-disable-next-line @typescript-eslint/no-floating-promises
// test();
// export async function extractV3Events(): Promise<void> {
//     const synfV3 = SynFuturesV3.getInstance('goerli');
//     const receipt = await synfV3.ctx.provider.getTransactionReceipt(
//         '0x7148d04b8009f3604f5bb75eb46e0ddcb0620719f19342b77a04526ff68e29da',
//     );
//     const events = extractEvents(receipt, [Instrument__factory.createInterface()]);
//     for (const event of events) {
//         console.info(event.name, event.args);
//     }
// }

// export async function testUpdate(): Promise<void> {
//     const synfV3 = SynFuturesV3.getInstance('goerli');
//     const signer = await synfV3.ctx.getSigner('default');

//     const instruments = await synfV3.getAllInstruments();
//     // console.info(instruments);
//     const instrument = instruments.find((i) => i.info.symbol === 'ETH-USDC-LINK');
//     console.info(instrument?.state.pairs.get(1689926400)?.amm.status);
//     const contract = synfV3.getInstrumentContract(instrument?.info.addr as string, signer);
//     const tx = await contract.update(1689926400);
//     console.info('tx sent:', tx.hash);
//     const receipt = await tx.wait();
//     console.info(receipt);
// }

// export async function testEstimateAPY(): Promise<void> {
//     const synfV3 = SynFuturesV3.getInstance('goerli');
//     console.info(synfV3.estimateAPY(0.1, 2, 100));
// }

// export async function testGetPositionIfSettlle(): Promise<void> {
//     const synfV3 = SynFuturesV3.getInstance('goerli');

//     const trader = '0x665a89d088C0159b9a73fE8646E5f305F9E4bD5a';
//     const instrument = '0xb1d90c8af0a254c05cdb7f6ace04d189457e2486';
//     const expiry = 1691740800;

//     await synfV3.syncVaultCacheWithAllQuotes(trader);

//     const account = await synfV3.getPairLevelAccount(trader, instrument, expiry);
//     const position = await synfV3.getPositionIfSettle(account);
//     console.info(serializeBNObject(position, ethers.utils.formatEther));

//     const t = tally(account.rootPair.amm, position, account.rootPair.amm.settlementPrice);
//     console.info(serializeBNObject(t, ethers.utils.formatEther));
// }

// export async function testGetMaxLeverage(): Promise<void> {
//     const maxLeverage = SynFuturesV3.getInstance('goerli').getMaxLeverage(200);
//     console.info(maxLeverage);
// }

// eslint-disable-next-line @typescript-eslint/no-floating-promises
// testGetMaxLeverage();
// testGetPositionIfSettlle();
// testEstimateAPY();
// testGetDexV2RawSpotPrice();
// testGetChainlinkRawSpotPrice();
// testGetAllInstruments();
// testUpdate();
// extractEventsX();
// testUpdate();
// test();
// testGetAllInstruments();
// testAllowUnauthorizedLPs();
