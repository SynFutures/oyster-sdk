import { ChainContext, ContractParser, formatUnits, TokenInfo, ZERO } from '@derivation-tech/web3-core';
import { Gate, Gate__factory, VaultFactory } from '../types/typechain/';
import { VAULT_FACTORY_ADDRESSES } from './constants';
import {
    AddParam,
    BatchPlaceParam,
    FillParam,
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
import { parseUnits } from 'ethers/lib/utils';
import { AbiCoder } from 'ethers/lib/utils';
import {
    encodeAddParam,
    encodeBatchPlaceParam,
    encodeFillParam,
    encodePlaceParam,
    encodeRemoveParam,
    encodeTradeParam,
} from '../common';
import { encodeBatchCancelTicks, encodeInstrumentExpiry, encodeLiquidateParam, encodeNativeAmount } from './util';
import { PendingWithdrawStatus, VaultStatus } from './types';

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
    async createVault(
        signer: Signer,
        quoteAddr: string,
        managerAddr: string,
        name: string,
        liveThreshold: number,
        maxRangeNumber: number,
        maxOrderNumber: number,
        maxPairNumber: number,
    ): Promise<string> {
        const tokenInfo = await this.ctx.getTokenInfo(quoteAddr);
        const tx = await this.vaultFactory.populateTransaction.createVault(
            quoteAddr,
            managerAddr,
            name,
            parseUnits(liveThreshold.toString(), tokenInfo.decimals),
            maxRangeNumber,
            maxOrderNumber,
            maxPairNumber,
        );
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
    quoteToken?: TokenInfo;
    gate?: Gate;

    constructor(ctx: ChainContext, vaultAddr: string, quoteToken?: TokenInfo) {
        this.ctx = ctx;
        this.vault = Vault__factory.connect(vaultAddr, ctx.provider);
        this.ctx.registerAddress(vaultAddr, 'Vault');
        this.ctx.registerContractParser(vaultAddr, new ContractParser(Vault__factory.createInterface()));
        if (quoteToken) {
            this.quoteAddr = quoteToken.address;
            this.quoteToken = quoteToken;
        }
    }

    async _init(): Promise<void> {
        this.quoteAddr = await this.vault.quote();
        this.quoteToken = await this.ctx.getTokenInfo(this.quoteAddr);
        this.gate = Gate__factory.connect(await this.vault.gate(), this.ctx.provider);
    }

    async getTotalValue(): Promise<BigNumber> {
        return await this.vault.getTotalValue();
    }

    async getUserDeposit(user: string): Promise<{
        shares: BigNumber;
        entryValue: BigNumber;
    }> {
        return await this.vault.sharesInfoOf(user);
    }

    async getUserPendingWithdraw(user: string): Promise<{
        canClaim: boolean;
        status: PendingWithdrawStatus;
        quantity: BigNumber;
    }> {
        const [pendingWithdraw, totalValue, totalShares] = await Promise.all([
            this.vault.pendingsOf(user),
            this.vault.getTotalValue(),
            this.vault.totalShares(),
        ]);
        const canClaim = pendingWithdraw.status === PendingWithdrawStatus.READY;
        return {
            canClaim,
            status: pendingWithdraw.status,
            quantity: totalShares.eq(ZERO)
                ? ZERO
                : pendingWithdraw.status === PendingWithdrawStatus.PENDING
                ? pendingWithdraw.quantity.mul(totalValue).div(totalShares)
                : pendingWithdraw.quantity,
        };
    }

    async shouldRequestPendingWithdraw(quoteAmount: BigNumber): Promise<boolean> {
        if (!this.gate) this.gate = Gate__factory.connect(await this.vault.gate(), this.ctx.provider);
        const [fundFlow, threshold, pending, reserve] = await Promise.all([
            this.gate.fundFlowOf(this.quoteAddr, this.vault.address),
            this.gate.thresholdOf(this.quoteAddr),
            this.gate.pendingOf(this.quoteAddr, this.vault.address),
            this.gate.reserveOf(this.quoteAddr, this.vault.address),
        ]);

        const maxWithdrawable = threshold
            .add(pending.exemption)
            .sub(fundFlow.totalOut)
            .add(fundFlow.totalIn)
            .sub(pending.amount);
        return quoteAmount.gt(maxWithdrawable) || quoteAmount.gt(reserve);
    }

    async getLiveThreshold(): Promise<number> {
        return Number(formatUnits(await this.vault.liveThreshold(), this.quoteToken!.decimals));
    }

    async deposit(
        signer: Signer,
        isNative: boolean,
        amount: BigNumber,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        if (isNative) {
            const tx = await this.vault.populateTransaction.deposit(amount, { value: amount });
            return await this.ctx.sendTx(signer, tx);
        } else {
            const allowance = await this.ctx.erc20.getAllowance(
                this.quoteAddr,
                await signer.getAddress(),
                this.vault.address,
            );
            if (allowance.lt(amount)) {
                await this.ctx.erc20.approveIfNeeded(signer, this.quoteAddr, this.vault.address, amount);
            }
            const tx = await this.vault.populateTransaction.deposit(amount);
            return await this.ctx.sendTx(signer, tx);
        }
    }

    async withdraw(
        signer: Signer,
        isNative: boolean,
        shares: BigNumber,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const tx = await this.vault.populateTransaction.withdraw(encodeNativeAmount(isNative, shares));
        return await this.ctx.sendTx(signer, tx);
    }

    async withdrawQuote(
        signer: Signer,
        isNative: boolean,
        quoteAmount: BigNumber,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const [totalValue, totalShares] = await Promise.all([this.vault.getTotalValue(), this.vault.totalShares()]);
        const shares = quoteAmount.mul(totalShares).div(totalValue);
        const tx = await this.vault.populateTransaction.withdraw(encodeNativeAmount(isNative, shares));
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

    async setVaultStatus(
        manager: Signer,
        status: VaultStatus,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        let statusNum;
        switch (status) {
            case VaultStatus.UPCOMING:
                statusNum = 0;
                break;
            case VaultStatus.LIVE:
                statusNum = 1;
                break;
            case VaultStatus.SUSPENDED:
                statusNum = 2;
                break;
            case VaultStatus.INVALID:
                statusNum = 3;
                break;
        }
        const ptx = await this.vault.populateTransaction.setVaultStatus(statusNum);
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
        maxRangeNumber: number,
        maxOrderNumber: number,
        maxPairNumber: number,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.setPairConfig(maxRangeNumber, maxOrderNumber, maxPairNumber);
        return await this.ctx.sendTx(manager, ptx);
    }

    async claimFee(
        manager: Signer,
        isNative: boolean,
        amount: BigNumber,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.claimFee(encodeNativeAmount(isNative, amount));
        return await this.ctx.sendTx(manager, ptx);
    }

    async switchOperationMode(
        manager: Signer,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.switchOperationMode();
        return await this.ctx.sendTx(manager, ptx);
    }
}
