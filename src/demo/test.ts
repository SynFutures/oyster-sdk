// import { PERP_EXPIRY } from '../constants';
// import { SynFuturesV3 } from '../synfuturesV3Core';
// import { InstrumentModel, Side } from '../types';
// import { TickMath } from '../math';
// import { parseEther, formatEther } from 'ethers/lib/utils';
// // eslint-disable-next-line @typescript-eslint/no-unused-vars
// async function main(): Promise<void> {
//     const synf = SynFuturesV3.getInstance('blast');
//     const whom = '0x4ec8c2Cc818D5903122050581d6Da8bC7C459D83';
//     await synf.initInstruments();
//     await synf.syncVaultCacheWithAllQuotes(whom);
//     const signer = await synf.ctx.getSigner('alice:0');
//     const instruments = await synf.getAllInstruments();
//     const instrument = getInstrumentBySymbol('BTC-USDB-PYTH');

//     function getInstrumentBySymbol(symbol: string): InstrumentModel {
//         const instrument = instruments.find((i) => i.info.symbol === symbol);
//         if (!instrument) {
//             throw new Error('unknown symbol: ' + symbol);
//         }
//         return instrument;
//     }

//     const accountModel = await synf.getPairLevelAccount(whom, instrument.info.addr, PERP_EXPIRY);
//     const targetTick = 109710;
//     console.log('targetTick:', targetTick.toString());
//     const targetPrice = TickMath.getWadAtTick(targetTick);
//     console.log('targetPrice:', targetPrice.toString());

//     const result = await synf.simulateCrossMarketOrder(
//         accountModel,
//         targetTick,
//         Side.LONG,
//         parseEther('1.5'),
//         parseEther('20'),
//         10,
//     );
//     console.log('result:', result);

//     if (result.canPlaceOrder) {
//         await synf.placeCrossMarketOrder(
//             signer,
//             accountModel.rootPair,
//             Side.LONG,

//             result.tradeSize,
//             result.tradeSimulation.margin,
//             result.tradeSimulation.tradePrice,

//             targetTick,
//             result.orderSize,
//             result.orderSimulation.balance,

//             100,
//             Math.round(new Date().getTime() / 1000) + 60,
//         );
//     } else {
//         console.log('cannot place order, need at lease size', formatEther(result.tradeSize.add(result.orderSize)));
//     }
// }

// //main();
