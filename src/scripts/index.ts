/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { getFundingRecords } from './funding';
import { getTradeRecords } from './trade';
import { getLiquidityRecords } from './liquidity';
import { Network } from './util';

void getFundingRecords;
void getTradeRecords;
void getLiquidityRecords;

async function main() {
    console.log('Start to get  records');
    let fundingList: { network: Network; signer: string }[] = [
        { network: 'blast', signer: '0xf9839F42909FC4E90B39C40E17BA1C2513947007' },
        { network: 'blast', signer: '0x6F151666b4530430EEfbABBB01aFE157b6A7B092' },
        { network: 'blast', signer: '0xaEaB100ae57103aBC72423395d0BdbA54e395067' },
        { network: 'base', signer: '0xf9839F42909FC4E90B39C40E17BA1C2513947007' },
        { network: 'base', signer: '0x6F151666b4530430EEfbABBB01aFE157b6A7B092' },
        { network: 'base', signer: '0xaEaB100ae57103aBC72423395d0BdbA54e395067' },
    ];

    fundingList = fundingList.map((funding) => {
        funding.signer = funding.signer.toLowerCase();
        return funding;
    });

    for (const funding of fundingList) {
        await getLiquidityRecords(funding.network, funding.signer);
    }

    console.log('end to get  records');
}

main()
    .catch(console.error)
    .finally(() => process.exit(0));
