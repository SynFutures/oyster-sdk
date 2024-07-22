import { ChainContext, GRAPH_PAGE_SIZE, Graph, TokenInfo, ZERO, now } from '@derivation-tech/web3-core';
import { BigNumber } from 'ethers';
import { orderBy as _orderBy } from 'lodash';
import { PhaseGraph, Stage } from './types';
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
    txHash: string;
    vaultAddr: string;
    userAddr: string;
    timestamp: number;
    shares: BigNumber;
    quoteAmount: BigNumber;
}

export interface Arrear {
    userAddr: string;
    vaultAddr: string;
    createdTimestamp: number;
    releasedTimestamp: number;
    phase: PhaseGraph;
    isNative: boolean;
    quantity: BigNumber;
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
        const portfolioValues = await Promise.all(
            vaultAddrs.map((addr) => Vault__factory.connect(addr, this.ctx.provider).getPortfolioValue()),
        );
        const depositWithdraws = await this.getUserDepositWithdrawHistory(account);
        for (const deposit of deposits.users) {
            const shares = BigNumber.from(deposit.shares);
            const totalShares = BigNumber.from(deposit.vault.totalShares);
            const entryValue = BigNumber.from(deposit.entryValue);
            const holdingValue = totalShares.eq(ZERO)
                ? ZERO
                : portfolioValues
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
                txHash
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
                    txHash: d.txHash,
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

    async getArrears(account: string): Promise<Arrear[]> {
        const graphQL = `query($skip: Int, $first: Int, $lastID: String){
            arrears(skip: $skip, first: $first, where:{
                user:"${account.toLowerCase()}"
            }){
                user {
                    id
                }
                vault
                createdTimestamp
                releasedTimestamp
                phase
                isNative
                quantity
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
                phase: arrear.phase as PhaseGraph,
                isNative: arrear.isNative,
                quantity: BigNumber.from(arrear.quantity),
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
                phase: PhaseGraph.NONE,
                isNative: false,
                quantity: ZERO,
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
