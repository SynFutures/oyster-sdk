import { startLocal } from './utils';
import { ethers } from 'ethers';
import { SynFuturesV3 } from '../src';
jest.setTimeout(100000);
describe('Gate plugin Test', () => {
    beforeAll(async () => {
        startLocal({
            rpc: 'https://rpc.ankr.com/blast/2219ac21908239838622dff2c3c105f4a7e7c487ce2591fb5af2ac09e988ebeb',
            chainId: 81457,
            startBlockNumber: 7915870,
            localPort: 8545,
        });
    });

    it('Test get positions', async () => {
        const address = '0x5886dc296336cc01e6c7257676171170795e8cbc';
        const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
        const synf = SynFuturesV3.getInstance(81457);
        synf.setProvider(provider);
        await synf.init();
        const portfolio = await synf.getInstrumentLevelAccounts(address);
        console.log(portfolio);
    });
});
