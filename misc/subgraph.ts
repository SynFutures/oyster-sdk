import { Subgraph, QueryParam } from '../src/subgraph';
import { fromWad } from '../src/common/util';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unused-vars
export async function testPairsData() {
    const subgraph = new Subgraph('https://api.thegraph.com/subgraphs/name/synfutures/synfuturesv3-goerli');
    // console.info(amms);
    const pairsData = await subgraph.getPairsData();
    for (const pairData of pairsData) {
        // print every field of pair data
        console.info(
            pairData.id,
            'APY24h:',
            fromWad(pairData.APY24h),
            'volume24h:',
            fromWad(pairData.volume24h),
            'volume7d:',
            fromWad(pairData.volume7d),
            'priceChange24h:',
            fromWad(pairData.priceChange24h),
            'high24h:',
            fromWad(pairData.high24h),
            'low24h:',
            fromWad(pairData.low24h),
        );
    }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unused-vars
export async function testTransactionEvents() {
    const subgraph = new Subgraph('https://api.thegraph.com/subgraphs/name/synfutures/synfuturesv3-goerli');
    const txEvents = await subgraph.getTransactionEvents({
        eventNames: ['Add'],
    });
    console.info(txEvents[0].args.range);
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unused-vars
export async function testOrders() {
    const subgraph = new Subgraph('https://api.thegraph.com/subgraphs/name/synfutures/synfuturesv3-goerli');
    const orders = await subgraph.getUserOrders({});
    console.info(orders);
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unused-vars
export async function testUsersToSettle(param: QueryParam) {
    const subgraph = new Subgraph('https://api.thegraph.com/subgraphs/name/fan3cn/synfuturesv3-goerli-dev');
    const distinctUsers = await subgraph.getUsersToSettle(param);
    console.log(JSON.stringify(distinctUsers[4294967295]));
    console.log(distinctUsers[4294967295].length);
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unused-vars
export async function testVitrualTrades() {
    const subgraph = new Subgraph('https://api.thegraph.com/subgraphs/name/synfutures/synfuturesv3-goerli');
    const orders = await subgraph.getVirtualTrades({
        page: 0,
        size: 2,
        traders: ['0x665a89d088C0159b9a73fE8646E5f305F9E4bD5a'],
        instrumentAddr: '0x0352273092054391968bdfdcd0ea57bda096f898',
        expiry: 1695974400,
    });
    console.info(orders);
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unused-vars
// export async function analyzeFee() {
//     const subgraph = new Subgraph('https://api.thegraph.com/subgraphs/name/synfutures/synfuturesv3-goerli');
//     // console.info(amms);
//     const txEvents = await subgraph.getTransactionEvents({
//         eventNames: ['Trade', 'Sweep'],
//         instrumentAddr: '0x32ab8e85795cde3763ade43a4141dd4ed2d33b55',
//         expiry: 1689926400,
//         endTs: now(),
//         startTs: now() - SECS_PER_DAY,
//     });
//     let total = 0;
//     for (const txEvent of txEvents) {
//         const entryNotional = fromWad(txEvent.args.pic[2]);
//         const feeRatioWad = fromWad(txEvent.args.feeRatioWad);
//         const fee = entryNotional * feeRatioWad;

//         console.info(
//             txEvent.txHash,
//             formatTs(txEvent.timestamp),
//             txEvent.name,
//             'entryNotional:',
//             entryNotional,
//             'feeRatioWad:',
//             feeRatioWad,
//             'fee:',
//             fee,
//         );
//         total += fee;
//     }
//     console.info('total:', total);
// }

// eslint-disable-next-line @typescript-eslint/no-floating-promises
// testVitrualTrades();
// testVitrualTrades();
// testTransactionEvents();
// analyzeFee();
// testPairsData();
// testTransactionEvents();
// testPairsData();
// testPairsData();
// testTransactionEvents();
// testTransactionEvents();
// testVitrualTrades();
// testOrders();
// testVitrualTrades();

async function main(): Promise<void> {
    await testUsersToSettle({ instrumentAddr: '0x668e016f521026a3d66cae79c665c7f77017420e' });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
