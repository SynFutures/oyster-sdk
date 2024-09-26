import { BlockInfo, ChainContext, ContractParser, formatUnits, ONE, TokenInfo, ZERO } from '@derivation-tech/web3-core';
import { Gate, Gate__factory, VaultFactory } from '../types/typechain/';
import { VAULT_FACTORY_ADDRESSES } from './constants';
import {
    AddParam,
    BatchPlaceParam,
    FillParam,
    LiquidateParam,
    NumericConverter,
    PlaceParam,
    RemoveParam,
    TradeParam,
    Vault,
    VaultFactory__factory,
    Vault__factory,
} from '../types';
import { Signer, ethers, BigNumber, CallOverrides } from 'ethers';
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
import { Stage } from './types';

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

    async getOwedQuote(user: string): Promise<{
        netValue: BigNumber;
        commissionFee: BigNumber;
    }> {
        return await this.vault.getOwedQuote(user);
    }

    async inquireWithdrawal(
        user: string,
        quoteAmount: BigNumber,
    ): Promise<{
        availableNow: boolean;
        netValue: BigNumber;
        commissionFee: BigNumber;
    }> {
        try {
            const [totalValue, totalShares] = await Promise.all([
                this.vault.getPortfolioValue(),
                this.vault.totalShare(),
            ]);
            const shares = quoteAmount.mul(totalShares).div(totalValue);
            return await this.vault.inquireWithdrawal(user, shares);
        } catch (e) {
            throw Error(JSON.stringify(e, null, 2));
        }
    }

    async getLiveThreshold(): Promise<number> {
        return Number(formatUnits((await this.vault.getConfiguration()).liveThreshold, this.quoteToken!.decimals));
    }

    async deposit(
        signer: Signer,
        isNative: boolean,
        quoteAmountWad: BigNumber,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const quoteAmount = NumericConverter.toContractQuoteAmount(quoteAmountWad, this.quoteToken!.decimals);
        if (isNative) {
            const tx = await this.vault.populateTransaction.deposit(quoteAmount, { value: quoteAmount });
            return await this.ctx.sendTx(signer, tx);
        } else {
            const allowance = await this.ctx.erc20.getAllowance(
                this.quoteAddr,
                await signer.getAddress(),
                this.vault.address,
            );
            if (allowance.lt(quoteAmount)) {
                await this.ctx.erc20.approveIfNeeded(signer, this.quoteAddr, this.vault.address, quoteAmount);
            }
            const tx = await this.vault.populateTransaction.deposit(quoteAmount);
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
        quoteAmountWad: BigNumber,
        blockInfo?: BlockInfo,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const overrides = blockInfo ? { blockTag: blockInfo.height } : {};
        const quoteAmount = NumericConverter.toContractQuoteAmount(quoteAmountWad, this.quoteToken!.decimals);
        const [totalValue, totalShare, stake] = await Promise.all([
            this.vault.getPortfolioValue(overrides),
            this.vault.totalShare(overrides),
            this.vault.getStake(await signer.getAddress(), overrides),
        ]);
        // share = quoteAmount * totalShare / totalValue, should round up to avoid dust
        const share = quoteAmount.mul(totalShare).add(totalValue.sub(ONE)).div(totalValue);
        const tx = await this.vault.populateTransaction.withdraw(isNative, share.gt(stake.share) ? stake.share : share);
        return await this.ctx.sendTx(signer, tx);
    }

    /////////////////////////////////////////////////////////////////////////////
    //  manager methods
    /////////////////////////////////////////////////////////////////////////////

    async payoff(
        manager: Signer,
        addrLists: string[],
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const tx = await this.vault.populateTransaction.payoff(addrLists);
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

    async collectCommission(
        manager: Signer,
        isNative: boolean,
        amount: BigNumber,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const ptx = await this.vault.populateTransaction.collectCommission(isNative, amount);
        return await this.ctx.sendTx(manager, ptx);
    }
}

export async function getUserDepositInfo(
    user: string,
    vaultAddrs: string[],
    ctx: ChainContext,
    overrides?: CallOverrides,
): Promise<{
    depositInfos: {
        user: string;
        vault: string;
        share: BigNumber;
        entryValue: BigNumber;
        holdingValue: BigNumber;
    }[];
    blockHeight: number; // return blockInfo for later withdraw's quantity->share calculation
}> {
    const vaultInterface = Vault__factory.createInterface();
    const calls = [];
    calls.push(
        ...vaultAddrs.map((vaultAddr) => {
            return {
                target: vaultAddr,
                callData: vaultInterface.encodeFunctionData('getPortfolioValue'),
            };
        }),
    );
    calls.push(
        ...vaultAddrs.map((vaultAddr) => {
            return {
                target: vaultAddr,
                callData: vaultInterface.encodeFunctionData('getStake', [user]),
            };
        }),
    );
    calls.push(
        ...vaultAddrs.map((vaultAddr) => {
            return {
                target: vaultAddr,
                callData: vaultInterface.encodeFunctionData('totalShare'),
            };
        }),
    );
    overrides = overrides ?? { blockTag: await ctx.provider.getBlockNumber() };
    const rawRet = (await ctx.getMulticall3().callStatic.aggregate(calls, overrides)).returnData;
    const portfolioValues = rawRet.slice(0, vaultAddrs.length).map((ret) => {
        return vaultInterface.decodeFunctionResult('getPortfolioValue', ret)[0] as BigNumber;
    });
    const stakes = rawRet.slice(vaultAddrs.length, vaultAddrs.length * 2).map((ret) => {
        return vaultInterface.decodeFunctionResult('getStake', ret)[0] as {
            share: BigNumber;
            entryValue: BigNumber;
        };
    });
    const totalShares = rawRet.slice(vaultAddrs.length * 2).map((ret) => {
        return vaultInterface.decodeFunctionResult('totalShare', ret)[0] as BigNumber;
    });
    return {
        depositInfos: stakes.map((stake, i) => {
            return {
                user,
                vault: vaultAddrs[i],
                share: stake.share,
                entryValue: stake.entryValue,
                holdingValue: totalShares[i].eq(ZERO)
                    ? ZERO
                    : portfolioValues[i].mul(stakes[i].share).div(totalShares[i]),
            };
        }),
        blockHeight: overrides.blockTag as number,
    };
}
