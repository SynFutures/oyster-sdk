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
import { encodeBatchCancelTicks } from './util';
import { Phase, Stage } from './types';

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
        maxRange: number,
        maxOrder: number,
        maxPair: number,
        commissionRatio: number,
        liveThreshold: number,
    ): Promise<string> {
        const tokenInfo = await this.ctx.getTokenInfo(quoteAddr);
        const tx = await this.vaultFactory.populateTransaction.createVault(managerAddr, name, {
            stage: 0,
            quote: quoteAddr,
            decimals: tokenInfo.decimals,
            maxPair,
            maxRange,
            maxOrder,
            commissionRatio,
            minQuoteAmount: 0,
            liveThreshold: parseUnits(liveThreshold.toString(), tokenInfo.decimals),
        });
        await this.ctx.sendTx(signer, tx);

        const vaultAddr = await this.getVaultAddr(quoteAddr, managerAddr, name);
        if (vaultAddr === '0x') {
            throw new Error('Vault not found');
        }
        return vaultAddr;
    }

    async setVaultManager(
        signer: Signer,
        vaultAddr: string,
        managerAddr: string,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vaultFactory.populateTransaction.setVaultManager(vaultAddr, managerAddr);
        return await this.ctx.sendTx(signer, ptx);
    }

    async setVaultStage(
        signer: Signer,
        vaultAddr: string,
        stage: Stage,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        let stageNum;
        switch (stage) {
            case Stage.UPCOMING:
                stageNum = 0;
                break;
            case Stage.LIVE:
                stageNum = 1;
                break;
            case Stage.SUSPENDED:
                stageNum = 2;
                break;
            case Stage.INVALID:
                stageNum = 3;
                break;
        }
        const ptx = await this.vaultFactory.populateTransaction.setVaultStage(vaultAddr, stageNum);
        return await this.ctx.sendTx(signer, ptx);
    }

    async setVaultPortfolioLimit(
        signer: Signer,
        vaultAddr: string,
        maxPair: number,
        maxRange: number,
        maxOrder: number,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vaultFactory.populateTransaction.setVaultPortfolioLimit(
            vaultAddr,
            maxPair,
            maxRange,
            maxOrder,
        );
        return await this.ctx.sendTx(signer, ptx);
    }

    async setVaultMinQuoteAmount(
        signer: Signer,
        vaultAddr: string,
        minQuoteAmount: number,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const configuration = await this.getVaultContract(vaultAddr).getConfiguration();
        const ptx = await this.vaultFactory.populateTransaction.setVaultMinQuoteAmount(
            vaultAddr,
            parseUnits(minQuoteAmount.toString(), configuration.decimals),
        );
        return await this.ctx.sendTx(signer, ptx);
    }

    async setVaultCommissionRatio(
        signer: Signer,
        vaultAddr: string,
        ratio: BigNumber,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vaultFactory.populateTransaction.setVaultCommissionRatio(vaultAddr, ratio);
        return await this.ctx.sendTx(signer, ptx);
    }

    async setVaultLiveThreshold(
        signer: Signer,
        vaultAddr: string,
        liveThreshold: number,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const configuration = await this.getVaultContract(vaultAddr).getConfiguration();
        const ptx = await this.vaultFactory.populateTransaction.setVaultLiveThreshold(
            vaultAddr,
            parseUnits(liveThreshold.toString(), configuration.decimals),
        );
        return await this.ctx.sendTx(signer, ptx);
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
        this.quoteAddr = (await this.vault.getConfiguration()).quote;
        this.quoteToken = await this.ctx.getTokenInfo(this.quoteAddr);
        this.gate = Gate__factory.connect(await this.vault.gate(), this.ctx.provider);
    }

    async getPortfolioValue(): Promise<BigNumber> {
        return await this.vault.getPortfolioValue();
    }

    async getUserStake(user: string): Promise<{
        share: BigNumber;
        entryValue: BigNumber;
    }> {
        return await this.vault.getStake(user);
    }

    async getUserArrear(user: string): Promise<{
        canClaim: boolean;
        status: Phase;
        quantity: BigNumber;
    }> {
        const [arrear, portfolioValue, totalShare] = await Promise.all([
            this.vault.getArrear(user),
            this.vault.getPortfolioValue(),
            this.vault.totalShare(),
        ]);
        const canClaim = arrear.phase === Phase.READY;
        return {
            canClaim,
            status: arrear.phase,
            quantity: totalShare.eq(ZERO)
                ? ZERO
                : arrear.phase === Phase.WAIT_ADJUST
                ? arrear.quantity.mul(portfolioValue).div(totalShare)
                : arrear.quantity,
        };
    }

    async inquireWithdrawal(
        user: string,
        quoteAmount: BigNumber,
    ): Promise<{
        value: BigNumber;
        phase: number;
    }> {
        try {
            const [totalValue, totalShares] = await Promise.all([
                this.vault.getPortfolioValue(),
                this.vault.totalShare(),
            ]);
            const shares = quoteAmount.mul(totalShares).div(totalValue);
            return await this.vault.inquireWithdrawal(user, shares);
        } catch (e) {
            const error = await this.ctx.normalizeError(e);
            throw Error(error.msg);
        }
    }

    async willTriggerArrear(user: string, quoteAmount: BigNumber): Promise<boolean> {
        const result = await this.inquireWithdrawal(user, quoteAmount);
        return result.phase === Phase.WAIT_ADJUST || result.phase === Phase.WAIT_RELEASE;
    }

    async getLiveThreshold(): Promise<number> {
        return Number(formatUnits((await this.vault.getConfiguration()).liveThreshold, this.quoteToken!.decimals));
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
        const tx = await this.vault.populateTransaction.withdraw(isNative, shares);
        return await this.ctx.sendTx(signer, tx);
    }

    async withdrawQuote(
        signer: Signer,
        isNative: boolean,
        quoteAmount: BigNumber,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const [totalValue, totalShares] = await Promise.all([this.vault.getPortfolioValue(), this.vault.totalShare()]);
        const shares = quoteAmount.mul(totalShares).div(totalValue);
        const tx = await this.vault.populateTransaction.withdraw(isNative, shares);
        return await this.ctx.sendTx(signer, tx);
    }

    async claimArrear(signer: Signer): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const tx = await this.vault.populateTransaction.claimArrear();
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
        const ptx = await this.vault.populateTransaction.batchCancel(instrument, expiry, encodeBatchCancelTicks(ticks));
        return await this.ctx.sendTx(manager, ptx);
    }

    async liquidate(
        manager: Signer,
        instrument: string,
        liquidateParam: LiquidateParam,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.liquidate(
            instrument,
            liquidateParam.expiry,
            liquidateParam.target,
            liquidateParam.size,
            liquidateParam.amount,
        );
        return await this.ctx.sendTx(manager, ptx);
    }

    async settle(
        manager: Signer,
        instrument: string,
        expiry: number,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.settle(instrument, expiry);
        return await this.ctx.sendTx(manager, ptx);
    }

    async claimCommission(
        manager: Signer,
        isNative: boolean,
        amount: BigNumber,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.claimCommission(isNative, amount);
        return await this.ctx.sendTx(manager, ptx);
    }
}
