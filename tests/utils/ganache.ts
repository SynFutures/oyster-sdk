import Ganache from 'ganache';
import { ethers, Wallet } from 'ethers';

const mnemonic = 'candy treat cake treat pudding treat honey rich treat crumble treat treat';

export function getWalletForIndex(index: number): Wallet {
    return Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${index}`);
}

export interface LocalGanacheOptions {
    rpc: string;
    chainId: number;
    startBlockNumber?: number;
    localPort?: number;
    mnemonic?: string;
    accountNumber?: number;
}

let server: any = null;

export async function startLocal(opts: LocalGanacheOptions): Promise<string> {
    if (!opts.startBlockNumber) {
        opts.startBlockNumber = await new ethers.providers.JsonRpcProvider(opts.rpc).getBlockNumber();
    }
    if (!opts.accountNumber) {
        opts.accountNumber = 10;
    }
    const accounts: { balance: string; secretKey: string }[] = [];
    for (let i = 0; i < opts.accountNumber; i++) {
        accounts.push({
            balance: '0x' + BigInt('100000000000000000000').toString(16),
            secretKey: getWalletForIndex(i).privateKey,
        });
    }
    const options = {
        fork: {
            url: opts.rpc,
            blockNumber: opts.startBlockNumber,
        },
        accounts: accounts,
        logging: {
            quiet: true,
        },
        chain: {
            chainId: opts.chainId,
        },
        mnemonic: opts.mnemonic || '',
    };
    if (!server) {
        server = Ganache.server(options);
        server.listen(opts.localPort || 8545, () => {
            console.log(`Ganache started at http://localhost:${opts.localPort || 8545}`);
        });
    }
    return `http://localhost:${opts.localPort || 8545}`;
}
