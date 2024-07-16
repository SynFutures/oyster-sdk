import { ChainContext, GRAPH_PAGE_SIZE, Graph, TokenInfo, ZERO, now } from '@derivation-tech/web3-core';
import { BigNumber } from 'ethers';
import { orderBy as _orderBy } from 'lodash';
import { VaultStatus } from './types';
import { Vault__factory } from '../types';

export type QueryHistoryParam = QueryEventParam;

export interface QueryEventParam extends Pagination {
    eventNames?: string[];
    accounts?: string[];
    startTs?: number;
    endTs?: number;
}

export interface Pagination {
    page?: number;
    size?: number;
}

export interface TransactionEvent {
    id: string;
    txHash: string;
    account: string;
    blockNumber: number;
    timestamp: number;
    logIndex: number;
    name: string;
    args: { [key: string]: any };
}

export interface PendingUnstakeWithTx {
    pendingIndex: number;
    txHash: string;
    amount: BigNumber;
}

export interface VaultInfo {
    vaultAddr: string;
    vaultName: string;
    managerAddr: string;
    quoteToken: TokenInfo;
    status: VaultStatus;
    totalValue: BigNumber;
    liveThreshold: BigNumber;
}

export interface DepositInfo {
    user: string;
    vault: string;
    shares: BigNumber;
    entryValue: BigNumber;
    holdingValue: BigNumber;
    allTimeEerned: BigNumber;
}

export interface DepositWithdraw {
    type: string; // DEPOSIT or WITHDRAW
    vaultAddr: string;
    userAddr: string;
    timestamp: number;
    shares: BigNumber;
    quoteAmount: BigNumber;
}

export class VaultGraph extends Graph {
    ctx: ChainContext;

    constructor(ctx: ChainContext, endpoint: string, retryOption?: any) {
        super(endpoint, retryOption);
        this.ctx = ctx;
    }

    buildQueryEventCondition(param: QueryEventParam): string {
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
                status
                liveThreshold
            }
        }`;
        const vaults = (await this.query(graphQL, 0, GRAPH_PAGE_SIZE)).vaults;
        const result: VaultInfo[] = [];
        const quoteAddrs: Set<string> = new Set(vaults.map((v: any) => v.quote.toLowerCase()));
        const tokenInfos = await Promise.all(Array.from(quoteAddrs).map((addr) => this.ctx.getTokenInfo(addr)));
        const totalValues = await Promise.all(
            vaults.map((v: any) => Vault__factory.connect(v.id, this.ctx.provider).getTotalValue()),
        );
        for (const vault of vaults) {
            result.push({
                vaultAddr: vault.id,
                vaultName: vault.name,
                managerAddr: vault.manager,
                quoteToken: tokenInfos.find((t) => t.address.toLowerCase() === vault.quote.toLowerCase())!,
                status: vault.status as VaultStatus,
                totalValue: totalValues.find((_, idx) => vaults[idx].id === vault.id)!,
                liveThreshold: vault.liveThreshold,
            });
        }
        return result;
    }

    async getUserDepositInfo(account: string): Promise<DepositInfo[]> {
        const graphQL = `query{
            users(where: {address: "${account.toLowerCase()}"}) {
                address
                vault {
                    id
                    totalShares
                }
                shares
                entryValue
            }
        }`;
        const deposits = await this.query(graphQL, 0, GRAPH_PAGE_SIZE);
        const result: DepositInfo[] = [];
        const vaultAddrs: string[] = Array.from(new Set(deposits.users.map((d: any) => d.vault.id)));
        const totalValues = await Promise.all(
            vaultAddrs.map((addr) => Vault__factory.connect(addr, this.ctx.provider).getTotalValue()),
        );
        const depositWithdraws = await this.getUserDepositWithdrawHistory(account);
        for (const deposit of deposits.users) {
            const shares = BigNumber.from(deposit.shares);
            const totalShares = BigNumber.from(deposit.vault.totalShares);
            const entryValue = BigNumber.from(deposit.entryValue);
            const holdingValue = totalShares.eq(ZERO)
                ? ZERO
                : totalValues
                      .find((_, idx) => vaultAddrs[idx] === deposit.vault.id)!
                      .mul(deposit.shares)
                      .div(totalShares);
            const allTimeEerned = depositWithdraws
                .filter((d) => d.vaultAddr === deposit.vault.id)
                .reduce((acc, d) => (d.type === 'DEPOSIT' ? acc.add(d.quoteAmount) : acc.sub(d.quoteAmount)), ZERO)
                .add(holdingValue)
                .sub(entryValue);
            result.push({
                user: deposit.address,
                vault: deposit.vault.id,
                shares,
                entryValue,
                holdingValue,
                allTimeEerned,
            });
        }
        return result;
    }

    async getUserDepositWithdrawHistory(account: string): Promise<DepositWithdraw[]> {
        const graphQL = `query($skip: Int, $first: Int, $lastID: String){
            users(skip: $skip, first: $first, where:{
                address:"${account.toLowerCase()}"
            }) {
                depositWithdraw{
                type
                vault
                user{
                    address
                }
                timestamp
                shares
                quantity
                }
            }
        }`;
        const depositWithdraws = await this.queryAll(graphQL, GRAPH_PAGE_SIZE, true);
        const result: DepositWithdraw[] = [];
        for (const depositWithdraw of depositWithdraws) {
            for (const d of depositWithdraw.depositWithdraw) {
                result.push({
                    type: d.type,
                    vaultAddr: d.vault,
                    userAddr: d.user.address,
                    timestamp: Number(d.timestamp),
                    shares: BigNumber.from(d.shares),
                    quoteAmount: BigNumber.from(d.quantity),
                });
            }
        }
        return result;
    }

    // query general-purposed transaction events
    async getHistoryEvents(param: QueryHistoryParam): Promise<TransactionEvent[]> {
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
        let result: TransactionEvent[] = [];
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
