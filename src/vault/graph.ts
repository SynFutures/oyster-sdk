import { BlockInfo, ChainContext, GRAPH_PAGE_SIZE, Graph, TokenInfo, ZERO, now } from '@derivation-tech/web3-core';
import { BigNumber } from 'ethers';
import { orderBy as _orderBy } from 'lodash';
import { Stage } from './types';
import { Vault__factory } from '../types';
import { Pagination } from '../subgraph';

export interface QueryHistoryParam extends Pagination {
    eventNames?: string[];
    accounts?: string[];
    startTs?: number;
    endTs?: number;
}

export interface GraphTransactionEvent {
    id: string;
    txHash: string;
    account: string;
    blockNumber: number;
    timestamp: number;
    logIndex: number;
    name: string;
    args: { [key: string]: any };
}

export interface VaultInfo {
    vaultAddr: string;
    vaultName: string;
    managerAddr: string;
    quoteToken: TokenInfo;
    stage: Stage;
    portfolioValue: BigNumber;
    liveThreshold: BigNumber;
    minQuoteAmount: BigNumber;
}

export interface DepositInfo {
    user: string;
    vault: string;
    share: BigNumber;
    entryValue: BigNumber;
    holdingValue: BigNumber;
    allTimeEarned: BigNumber;
}

export interface DepositWithdraw {
    type: string; // DEPOSIT or WITHDRAW
    txHash: string;
    vaultAddr: string;
    userAddr: string;
    timestamp: number;
    isNative: boolean;
    quoteAmount: BigNumber;
}

export interface Arrear {
    userAddr: string;
    vaultAddr: string;
    createdTimestamp: number;
    releasedTimestamp: number;
    share: BigNumber;
}

export class VaultGraph extends Graph {
    ctx: ChainContext;

    constructor(ctx: ChainContext, endpoint: string, retryOption?: any) {
        super(endpoint, retryOption);
        this.ctx = ctx;
    }

    buildQueryEventCondition(param: QueryHistoryParam): string {
        const fn = (str: string): string => `"${str}"`;

        let accountCondition = '';
        let eventCondition = '';

        if (param.eventNames && param.eventNames.length > 0) {
            eventCondition = `name_in: [${param.eventNames.map((e) => fn(e)).join(',')}],`;
        }

        if (param.accounts && param.accounts.length > 0) {
            accountCondition = `account_in: [${param.accounts.map((t) => fn(t.toLowerCase())).join(',')}],`;
        }

        const startTsCondition = `timestamp_gte: ${param.startTs || 0},`;
        const endTsCondition = `timestamp_lt: ${param.endTs || now()},`;

        const condition = `${eventCondition}${accountCondition}${startTsCondition}${endTsCondition}`;
        return `where: {${condition} id_gt: $lastID}, `;
    }

    async getAllVaultInfo(): Promise<VaultInfo[]> {
        const graphQL = `query{
            vaults{
                id
                name
                manager
                quote
                stage
                liveThreshold
                minQuoteAmount
            }
        }`;
        const vaults = (await this.query(graphQL, 0, GRAPH_PAGE_SIZE)).vaults;
        const result: VaultInfo[] = [];
        const quoteAddrs: Set<string> = new Set(vaults.map((v: any) => v.quote.toLowerCase()));
        const tokenInfos = await Promise.all(Array.from(quoteAddrs).map((addr) => this.ctx.getTokenInfo(addr)));
        const portfolioValues = await Promise.all(
            vaults.map((v: any) => Vault__factory.connect(v.id, this.ctx.provider).getPortfolioValue()),
        );
        for (const vault of vaults) {
            result.push({
                vaultAddr: vault.id,
                vaultName: vault.name,
                managerAddr: vault.manager,
                quoteToken: tokenInfos.find((t) => t.address.toLowerCase() === vault.quote.toLowerCase())!,
                stage: vault.stage as Stage,
                portfolioValue: portfolioValues.find((_, idx) => vaults[idx].id === vault.id)!,
                liveThreshold: BigNumber.from(vault.liveThreshold),
                minQuoteAmount: BigNumber.from(vault.minQuoteAmount),
            });
        }
        return result;
    }

    async getUserDepositInfo(account: string): Promise<{
        depositInfos: DepositInfo[];
        blockInfo: BlockInfo; // return blockInfo for later withdraw's quantity->share calculation
    }> {
        const graphQL = `query{
            _meta{
                block{
                  number
                  timestamp
                }
            }
            users(where: {address: "${account.toLowerCase()}"}) {
                address
                vault {
                    id
                    totalShare
                }
                share
                entryValue
            }
        }`;
        const result = await this.query(graphQL, 0, GRAPH_PAGE_SIZE);
        const depositInfos: DepositInfo[] = [];
        const vaultAddrs: string[] = Array.from(new Set(result.users.map((d: any) => d.vault.id)));
        const portfolioValues = await Promise.all(
            vaultAddrs.map((addr) => Vault__factory.connect(addr, this.ctx.provider).getPortfolioValue()),
        );
        const depositWithdraws = await this.getUserDepositWithdrawHistory(account);
        for (const deposit of result.users) {
            const share = BigNumber.from(deposit.share);
            const totalShare = BigNumber.from(deposit.vault.totalShare);
            const entryValue = BigNumber.from(deposit.entryValue);
            const holdingValue = totalShare.eq(ZERO)
                ? ZERO
                : portfolioValues
                      .find((_, idx) => vaultAddrs[idx] === deposit.vault.id)!
                      .mul(deposit.share)
                      .div(totalShare);
            const allTimeEarned = depositWithdraws
                .filter((d) => d.vaultAddr === deposit.vault.id)
                .reduce((acc, d) => (d.type === 'WITHDRAW' ? acc.add(d.quoteAmount) : acc.sub(d.quoteAmount)), ZERO)
                .add(holdingValue);
            depositInfos.push({
                user: deposit.address,
                vault: deposit.vault.id,
                share,
                entryValue,
                holdingValue,
                allTimeEarned,
            });
        }
        return {
            depositInfos: depositInfos,
            blockInfo: {
                height: Number(result._meta.block.number),
                timestamp: Number(result._meta.block.timestamp),
            },
        };
    }

    async getUserDepositWithdrawHistory(account: string): Promise<DepositWithdraw[]> {
        const graphQL = `query($skip: Int, $first: Int, $lastID: String){
            depositWithdraws(first: $first, where:{
                user_: {address: "${account.toLowerCase()}"}
                id_gt: $lastID,
            }) {
                type
                txHash
                vault
                user{
                    address
                }
                timestamp
                isNative
                quantity
            }
        }`;
        const depositWithdraws = await this.queryAll(graphQL, GRAPH_PAGE_SIZE, true);
        const result: DepositWithdraw[] = [];
        for (const depositWithdraw of depositWithdraws) {
            result.push({
                type: depositWithdraw.type,
                txHash: depositWithdraw.txHash,
                vaultAddr: depositWithdraw.vault,
                userAddr: depositWithdraw.user.address,
                timestamp: Number(depositWithdraw.timestamp),
                isNative: depositWithdraw.isNative,
                quoteAmount: BigNumber.from(depositWithdraw.quantity),
            });
        }
        return result;
    }

    async getArrears(account: string): Promise<Arrear[]> {
        const graphQL = `query($skip: Int, $first: Int, $lastID: String){
            arrears(skip: $skip, first: $first, where:{
                user_: {
                    address: "${account.toLowerCase()}"
                }
                id_gt: $lastID,
            }){
                user {
                    id
                }
                vault
                createdTimestamp
                releasedTimestamp
                phase
                share
            }
        }`;
        const arrears = await this.queryAll(graphQL, GRAPH_PAGE_SIZE, true);
        const result: Arrear[] = [];
        for (const arrear of arrears) {
            result.push({
                userAddr: arrear.user,
                vaultAddr: arrear.vault,
                createdTimestamp: Number(arrear.createdTimestamp),
                releasedTimestamp: Number(arrear.releasedTimestamp),
                share: BigNumber.from(arrear.share),
            });
        }
        return result;
    }

    async getArrear(account: string, vault: string): Promise<Arrear> {
        const arrears = await this.getArrears(account);
        // filter by vault address and find out the latest one with newest createdTimestamp
        return arrears
            .filter((p) => p.vaultAddr === vault)
            .reduce((prev, curr) => (prev.createdTimestamp > curr.createdTimestamp ? prev : curr), {
                userAddr: account,
                vaultAddr: vault,
                createdTimestamp: 0,
                releasedTimestamp: 0,
                share: ZERO,
            });
    }

    // query general-purposed transaction events
    async getHistoryEvents(param: QueryHistoryParam): Promise<GraphTransactionEvent[]> {
        const queryAll = param.size === undefined && param.page === undefined;
        const first = param.size || 1000;
        const skip = (param.page || 0) * first;
        if (param.eventNames === undefined || param.eventNames.length === 0) {
            param.eventNames = ['Stake', 'Unstake', 'Release'];
        }
        let condition = this.buildQueryEventCondition(param);
        condition = queryAll ? condition : condition + 'orderBy: timestamp, orderDirection: desc';

        const graphQL = `query($skip: Int, $first: Int, $lastID: String){
            transactionEvents(skip: $skip, first: $first, ${condition}){
                id
                name
                args
                account
                logIndex
                blockNumber
                timestamp
                transaction {
                    id
                }
            }
        }`;
        let transactionEvents;
        if (queryAll) {
            transactionEvents = await this.queryAll(graphQL, GRAPH_PAGE_SIZE, true);
        } else {
            const resp = await this.query(graphQL, skip, first);
            transactionEvents = resp.transactionEvents;
        }
        let result: GraphTransactionEvent[] = [];
        for (const txEvent of transactionEvents) {
            result.push({
                id: txEvent.id,
                txHash: txEvent.transaction.id,
                account: txEvent.account,
                blockNumber: Number(txEvent.blockNumber),
                timestamp: Number(txEvent.timestamp),
                logIndex: Number(txEvent.logIndex),
                name: txEvent.name,
                args: JSON.parse(txEvent.args),
            });
        }
        // newest first
        result = _orderBy(result, ['blockNumber', 'logIndex'], ['desc', 'desc']);
        return result;
    }
}
