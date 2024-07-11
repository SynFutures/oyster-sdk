/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { getFundingRecords } from './funding';
import { getTradeRecords } from './trade';
import { getLiquidityRecords } from './liquidity';
import { Network } from './util';

void getFundingRecords;
void getTradeRecords;

async function main() {
    console.log('Start to get  records');
    let fundingList: { network: Network; signer: string }[] = [{ network: 'blast', signer: '0x00000000000000007' }];

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

