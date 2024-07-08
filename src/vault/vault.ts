import { ChainContext, ContractParser } from '@derivation-tech/web3-core';
import { VaultFactory } from '../types/typechain/vault';
import { VAULT_FACTORY_ADDRESSES } from './constants';
import {
    AddParam,
    BatchPlaceParam,
    FillParam,
    InstrumentIdentifier,
    LiquidateParam,
    PlaceParam,
    RemoveParam,
    SweepParam,
    TradeParam,
    Vault,
    VaultFactory__factory,
    Vault__factory,
} from '../types';
import { Signer, ethers, BigNumber } from 'ethers';
import { AbiCoder } from 'ethers/lib/utils';
import {
    encodeAddParam,
    encodeBatchPlaceParam,
    encodeFillParam,
    encodePlaceParam,
    encodeRemoveParam,
    encodeTradeParam,
} from '../common';
import { encodeBatchCancelTicks, encodeInstrumentExpiry, encodeLiquidateParam } from './util';
import { PairConfig } from './types';

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

    async getTotalValue(): Promise<BigNumber> {
        return await this.vault.getTotalValue();
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

    async launch(
        manager: Signer,
        baseSymbol: string,
        mtype: string,
        instrument: string,
        addParam: AddParam,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const tokenInfo = await this.ctx.getTokenInfo(baseSymbol);
        const abiCoder = new AbiCoder();
        const ptx = await this.vault.populateTransaction.launch(
            this.quoteAddr,
            mtype,
            instrument,
            abiCoder.encode(
                [mtype === 'LINK' ? 'string' : 'address', 'address'],
                [mtype === 'LINK' ? baseSymbol : tokenInfo.address, this.quoteAddr],
            ),
            encodeAddParam(addParam),
        );
        return await this.ctx.sendTx(manager, ptx);
    }

    async add(
        manager: Signer,
        instrument: string,
        addParam: AddParam,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.add(instrument, encodeAddParam(addParam));
        return await this.ctx.sendTx(manager, ptx);
    }

    async remove(
        manager: Signer,
        instrument: string,
        removeParam: RemoveParam,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.remove(instrument, encodeRemoveParam(removeParam));
        return await this.ctx.sendTx(manager, ptx);
    }

    async trade(
        manager: Signer,
        instrument: string,
        tradeParam: TradeParam,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.trade(
            instrument,
            encodeTradeParam(
                tradeParam.expiry,
                tradeParam.size,
                tradeParam.amount,
                tradeParam.limitTick,
                tradeParam.deadline,
            ),
        );
        return await this.ctx.sendTx(manager, ptx);
    }

    async place(
        manager: Signer,
        instrument: string,
        placeParam: PlaceParam,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.place(
            instrument,
            encodePlaceParam(
                placeParam.expiry,
                placeParam.size,
                placeParam.amount,
                placeParam.tick,
                placeParam.deadline,
            ),
        );
        return await this.ctx.sendTx(manager, ptx);
    }

    async batchPlace(
        manager: Signer,
        instrument: string,
        batchPlaceParam: BatchPlaceParam,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.batchPlace(
            instrument,
            encodeBatchPlaceParam(
                batchPlaceParam.expiry,
                batchPlaceParam.size,
                batchPlaceParam.leverage,
                batchPlaceParam.ticks,
                batchPlaceParam.ratios,
                batchPlaceParam.deadline,
            ),
        );
        return await this.ctx.sendTx(manager, ptx);
    }

    async fill(
        manager: Signer,
        instrument: string,
        fillParam: FillParam,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.fill(
            instrument,
            encodeFillParam(fillParam.expiry, fillParam.target, fillParam.tick, fillParam.nonce),
        );
        return await this.ctx.sendTx(manager, ptx);
    }

    async batchCancel(
        manager: Signer,
        instrument: string,
        expiry: number,
        ticks: number[],
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.batchCancel(
            encodeInstrumentExpiry(instrument, expiry),
            encodeBatchCancelTicks(ticks),
        );
        return await this.ctx.sendTx(manager, ptx);
    }

    async liquidate(
        manager: Signer,
        instrument: string,
        liquidateParam: LiquidateParam,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.liquidate(
            encodeLiquidateParam(
                instrument,
                liquidateParam.expiry,
                liquidateParam.target,
                liquidateParam.size,
                liquidateParam.amount,
            ),
        );
        return await this.ctx.sendTx(manager, ptx);
    }

    async sweep(
        manager: Signer,
        instrument: string,
        sweepParam: SweepParam,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.sweep(
            encodeInstrumentExpiry(instrument, sweepParam.expiry),
            sweepParam.target,
            sweepParam.size,
        );
        return await this.ctx.sendTx(manager, ptx);
    }

    async settle(
        manager: Signer,
        instrument: string,
        expiry: number,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.settle(encodeInstrumentExpiry(instrument, expiry));
        return await this.ctx.sendTx(manager, ptx);
    }

    async switchVaultStatus(
        manager: Signer,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.switchVaultStatus();
        return await this.ctx.sendTx(manager, ptx);
    }

    async setProfitFeeRatio(
        manager: Signer,
        ratio: BigNumber,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.setProfitFeeRatio(ratio);
        return await this.ctx.sendTx(manager, ptx);
    }

    async setPairConfig(
        manager: Signer,
        pairConfig: PairConfig,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.setPairConfig(pairConfig);
        return await this.ctx.sendTx(manager, ptx);
    }

    async claimFee(
        manager: Signer,
        amount: BigNumber,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.claimFee(amount);
        return await this.ctx.sendTx(manager, ptx);
    }

    async switchOperationMode(
        manager: Signer,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.switchOperationMode();
        return await this.ctx.sendTx(manager, ptx);
    }
}