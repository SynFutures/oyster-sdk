import { ChainContext, ContractParser } from '@derivation-tech/web3-core';
import { VaultFactory } from '../types/typechain/vault';
import { VAULT_FACTORY_ADDRESSES } from './constants';
import { Vault, VaultFactory__factory, Vault__factory } from '../types';
import { Signer, ethers, BigNumber } from 'ethers';

export class VaultFactoryClient {
    ctx: ChainContext;
    vaultFactory: VaultFactory;

    constructor(ctx: ChainContext) {
        this.ctx = ctx;
        const factoryAddress: string = VAULT_FACTORY_ADDRESSES[ctx.chainId];
        this.vaultFactory = VaultFactory__factory.connect(factoryAddress, ctx.provider);
        ctx.registerAddress(factoryAddress, 'VaultFactory');
        ctx.registerContractParser(factoryAddress, new ContractParser(VaultFactory__factory.createInterface()));
    }

    async getAllVaults(): Promise<string[]> {
        return await this.vaultFactory.getAllVaults();
    }

    // admin method
    async createVault(signer: Signer, quoteAddr: string, managerAddr: string, name: string): Promise<string> {
        const tx = await this.vaultFactory.populateTransaction.createVault(quoteAddr, managerAddr, name);
        await this.ctx.sendTx(signer, tx);

        const vaultAddr = await this.getVaultAddr(quoteAddr, managerAddr, name);
        if (vaultAddr === '0x') {
            throw new Error('Vault not found');
        }
        return vaultAddr;
    }

    async getVaultAddr(quoteAddr: string, managerAddr: string, name: string): Promise<string> {
        const index = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(['string', 'string', 'string'], [quoteAddr, managerAddr, name]),
        );
        return await this.vaultFactory.indexToVault(index);
    }

    async getTotalVaults(): Promise<BigNumber> {
        return await this.vaultFactory.totalVaults();
    }

    getVaultContract(vaultAddr: string): Vault {
        return Vault__factory.connect(vaultAddr, this.ctx.provider);
    }
}

export class VaultClient {
    ctx: ChainContext;
    vault: Vault;

    quoteAddr = '';
    constructor(ctx: ChainContext, vaultAddr: string) {
        this.ctx = ctx;
        this.vault = Vault__factory.connect(vaultAddr, ctx.provider);
        this.ctx.registerAddress(vaultAddr, 'Vault');
        this.ctx.registerContractParser(vaultAddr, new ContractParser(Vault__factory.createInterface()));
    }

    async _init(): Promise<void> {
        this.quoteAddr = await this.vault.quote();
    }

    async deposit(
        signer: Signer,
        vaultAddr: string,
        amount: BigNumber,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const allowance = await this.ctx.erc20.getAllowance(this.quoteAddr, await signer.getAddress(), vaultAddr);
        if (allowance.lt(amount)) {
            await this.ctx.erc20.approveIfNeeded(signer, this.quoteAddr, vaultAddr, amount);
        }
        const tx = await this.vault.populateTransaction.deposit(amount);
        return await this.ctx.sendTx(signer, tx);
    }

    async withdraw(
        signer: Signer,
        shares: BigNumber,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const tx = await this.vault.populateTransaction.withdraw(shares);
        return await this.ctx.sendTx(signer, tx);
    }

    async claimPendingWithdraw(
        signer: Signer,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const tx = await this.vault.populateTransaction.claimPendingWithdraw();
        return await this.ctx.sendTx(signer, tx);
    }

    async cancelPendingWithdraw(
        signer: Signer,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const tx = await this.vault.populateTransaction.cancelPendingWithdraw();
        return await this.ctx.sendTx(signer, tx);
    }

    // manager methods
    async markReady(
        manager: Signer,
        addrLists: string[],
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const tx = await this.vault.populateTransaction.markReady(addrLists);
        return await this.ctx.sendTx(manager, tx);
    }

    async withdrawFromGateAndRelease(
        manager: Signer,
        addrLists: string[],
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const tx = await this.vault.populateTransaction.withdrawFromGateAndRelease(addrLists);
        return await this.ctx.sendTx(manager, tx);
    }
}
