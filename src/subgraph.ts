import {
    BlockInfo,
    GRAPH_PAGE_SIZE,
    Graph,
    SECS_PER_DAY,
    SECS_PER_HOUR,
    TokenInfo,
    ZERO_ADDRESS,
    now,
} from '@derivation-tech/web3-core';
import { BigNumber } from 'ethers';
import { WAD, ZERO, r2w, sqrtX96ToWad, wadToTick, wdiv, wmul } from './math';
import {
    FeederType,
    InstrumentCondition,
    InstrumentInfo,
    InstrumentMarket,
    InstrumentModel,
    InstrumentState,
    MarketConfig,
    MarketInfo,
    MarketType,
    PairState,
    QuoteType,
    Range,
    Status,
} from './types';
import { concatId, dayIdFromTimestamp, hourIdFromTimestamp } from './common/util';
import { orderBy as _orderBy } from 'lodash';

export interface TransactionEvent {
    // txHash-logIndex
    id: string;
    txHash: string;
    logIndex: number;
    address: string;
    timestamp?: number;
    blockNumber?: number;
    name: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: { [key: string]: any };
}

export enum VirtualTradeType {
    MARKET = 'MARKET',
    LIMIT = 'LIMIT',
    RANGE = 'RANGE',
    LIQUIDATION = 'LIQUIDATION',
    TAKE_OVER = 'TAKE_OVER',
}

export enum OrderStatus {
    OPEN = 'OPEN',
    FILLED = 'FILLED',
    CANCELLED = 'CANCELLED',
}

export interface VirtualTrade {
    txHash: string;
    timestamp: number;
    blockNumber: number;
    logIndex: number;
    trader: string;
    instrumentAddr: string;
    expiry: number;
    size: BigNumber;
    price: BigNumber;
    tradeValue: BigNumber;
    fee: BigNumber;
    // stability fee = tradeValue * (feeRatio - tradingFeeRatio), this field is only available for Trade and Sweep event
    stablityFee: BigNumber;
    type: VirtualTradeType;
    // this field only apply for Remove event, true means the range is liquidated; false means the range is removed by user
    isRangeLiquidated?: boolean;
    referralCode?: string;
}

export interface UserOrder {
    trader: string;
    instrumentAddr: string;
    expiry: number;
    tick: number;
    size: BigNumber;
    filledSize: BigNumber;
    price: BigNumber;
    fee: BigNumber;
    createdTimestamp: number;
    timestamp: number; // timestamp of the last update
    status: OrderStatus;
    placeTxHash: string;
    fillTxHash?: string;
    cancelTxHash?: string;
    referralCode?: string;
}

export interface PairData {
    // ${instrumentAddr}-${expiry}
    id: string;
    instrumentAddr: string;
    expiry: number;
    // APY_houly = fee_hourly / amm_balance * 8760
    // APY_24hrs = fee_24hrs / amm_balance * 365
    // APY_7d = fee_7d / amm_balance * 52
    APY24h: BigNumber;
    poolFee24h: BigNumber;
    volume24h: BigNumber;
    volume24hUTC0: BigNumber;
    volume7d: BigNumber;
    priceChange24h: BigNumber; // change percentage in wad
    high24h: BigNumber;
    low24h: BigNumber;
}

export interface Pagination {
    page?: number;
    size?: number;
}

export interface TradeData {
    trader: string;
    amm: {
        expiry: string;
    };
}

export type QueryResponse = TradeData[];
export interface QueryParam extends Pagination {
    traders?: string[];
    instrumentAddr?: string;
    expiry?: number;
    startTs?: number;
    endTs?: number;
    referralCode?: string;
}

export interface QueryEventParam extends QueryParam {
    eventNames?: string[];
}

export interface AccessControlContractRole {
    id: string;
    admins: string[];
    operators: string[];
}

export interface QueryInstrumentParam extends Pagination {
    instrumentAddrs?: string[];
    conditions?: InstrumentCondition[];
    // market config is not availabe from graph, for the sake of compelteness, we add it here
    marketConfig: { [key in MarketType]?: MarketConfig };
}

export interface QueryRangeParam extends Pagination {
    instrumentAddr?: string;
    expiry?: number;
    traders?: string[];
}

export interface ExtendedRange extends Range {
    instrumentAddr: string;
    expiry: number;
    tickLower: number;
    tickUpper: number;
}

export class Subgraph extends Graph {
    // query instruments from graph, note: below fields are not available from graph thus set to zero:
    // instrument.spotPrice = ZERO
    // amm.markPrice = ZERO
    // amm.liquidity = ZERO
    // amm.totalLiquidity = ZERO
    // amm.involvedFund = ZERO
    // amm.openInterests = ZERO
    // amm.totalLong = ZERO
    // amm.totalShort = ZERO
    async getInstruments(param: QueryInstrumentParam): Promise<InstrumentModel[]> {
        const first = param.size || 1000;
        const skip = (param.page || 0) * first;

        const condition = this.buildQueryInstrumentCondition(param);

        const graphQL = `query($skip: Int, $first: Int, $lastID: String){
            _meta{
                block{
                  number
                  timestamp
                }
            }
            instruments(skip: $skip, first: $first${condition}){
                id
                symbol
                condition
                ammList {
                  expiry
                  insuranceFund
                  longFundingIndex
                  longSocialLossIndex
                  settlementPrice
                  shortFundingIndex
                  shortSocialLossIndex
                  status
                  symbol
                  timestamp
                  sqrtInitialPX96
                  sqrtPX96
                  protocolFee
                  id
                  balance
                  feeIndex
                  createdAt
                }
                base {
                  id
                  name
                  symbol
                  decimals
                }
                quote {
                  id
                  name
                  symbol
                  decimals
                }
                setting {
                  initialMarginRatio
                  maintenanceMarginRatio
                  minMarginAmount
                  protocolFeeRatio
                  qtype
                  stabilityFeeRatioParam
                  tip
                  tradingFeeRatio
                }
                dexV2Feeder {
                  feederType
                  id
                  isToken0Quote
                  pair
                  scaler0
                  scaler1
                }
                dexV2Market {
                  id
                  type
                  beacon                  
                }
                cexMarket {
                    id
                    type
                    beacon                    
                }
                cexFeeder {
                    aggregator0
                    aggregator1
                    feederType
                    heartBeat0
                    heartBeat1
                    scaler0
                    scaler1
                }    
            }
        }`;
        const resp = await this.query(graphQL, skip, first);

        const blockInfo: BlockInfo = {
            height: Number(resp._meta.block.number),
            timestamp: Number(resp._meta.block.timestamp),
        };
        const result: InstrumentModel[] = [];
        for (const inst of resp.instruments) {
            const marketType = inst.symbol.split('-')[2] as MarketType;

            const info: InstrumentInfo = {
                addr: inst.id,
                symbol: inst.symbol,
                base: {
                    address: marketType === MarketType.DEXV2 ? inst.base.id : ZERO_ADDRESS,
                    name: inst.base.name,
                    symbol: inst.base.symbol,
                    decimals: marketType === MarketType.DEXV2 ? Number(inst.base.decimals) : 0,
                },
                quote: {
                    address: inst.quote.id,
                    name: inst.quote.name,
                    symbol: inst.quote.symbol,
                    decimals: Number(inst.quote.decimals),
                },
            };
            const market = inst.cexMarket ?? inst.dexV2Market;
            const marketInfo: MarketInfo = {
                addr: market.id,
                type: market.type,
                beacon: market.beacon,
            };
            const feeder = inst.cexFeeder
                ? {
                      ftype: FeederType[inst.cexFeeder.feederType as keyof typeof FeederType],
                      scaler0: BigNumber.from(inst.cexFeeder.scaler0),
                      aggregator0: inst.cexFeeder.aggregator0,
                      heartBeat0: Number(inst.cexFeeder.heartBeat0),
                      scaler1: BigNumber.from(inst.cexFeeder.scaler1),
                      aggregator1: inst.cexFeeder.aggregator1,
                      heartBeat1: Number(inst.cexFeeder.heartBeat1),
                  }
                : {
                      ftype: FeederType[inst.dexV2Feeder.feederType as keyof typeof FeederType],
                      isToken0Quote: inst.dexV2Feeder.isToken0Quote,
                      pair: inst.dexV2Feeder.pair,
                      scaler0: BigNumber.from(inst.dexV2Feeder.scaler0),
                      scaler1: BigNumber.from(inst.dexV2Feeder.scaler1),
                  };
            const instrumentMarket: InstrumentMarket = {
                info: marketInfo,
                config: param.marketConfig[marketType as MarketType] as MarketConfig,
                feeder: feeder,
            };
            const state: InstrumentState = new InstrumentState(
                InstrumentCondition[inst.condition as keyof typeof InstrumentCondition],
                inst.setting.initialMarginRatio,
                inst.setting.maintenanceMarginRatio,
                {
                    minMarginAmount: BigNumber.from(inst.setting.minMarginAmount),
                    tradingFeeRatio: Number(inst.setting.tradingFeeRatio),
                    protocolFeeRatio: Number(inst.setting.protocolFeeRatio),
                    stabilityFeeRatioParam: BigNumber.from(inst.setting.stabilityFeeRatioParam),
                    qtype: QuoteType[inst.setting.qtype as keyof typeof QuoteType],
                    tip: BigNumber.from(inst.setting.tip),
                },
                blockInfo,
            );

            const instrument = new InstrumentModel(info, instrumentMarket, state, ZERO);
            inst.ammList.forEach((amm: any) => {
                const ammModel = {
                    expiry: Number(amm.expiry),
                    insuranceFund: BigNumber.from(amm.insuranceFund),
                    longSocialLossIndex: BigNumber.from(amm.longSocialLossIndex),
                    longFundingIndex: BigNumber.from(amm.longFundingIndex),
                    shortSocialLossIndex: BigNumber.from(amm.shortSocialLossIndex),
                    shortFundingIndex: BigNumber.from(amm.shortFundingIndex),
                    settlementPrice: BigNumber.from(amm.settlementPrice),
                    status: Status[amm.status as keyof typeof Status],
                    timestamp: Number(amm.timestamp),
                    sqrtPX96: BigNumber.from(amm.sqrtPX96),
                    protocolFee: BigNumber.from(amm.protocolFee),
                    feeIndex: BigNumber.from(amm.feeIndex),
                    tick: wadToTick(sqrtX96ToWad(BigNumber.from(amm.sqrtPX96))),
                    // note: below fields are not available from graph
                    liquidity: ZERO,
                    totalLiquidity: ZERO,
                    involvedFund: ZERO,
                    openInterests: ZERO,
                    totalLong: ZERO,
                    totalShort: ZERO,
                    blockInfo,
                };
                // note: markPrice is not available from graph
                const pair = new PairState(ammModel, blockInfo);
                instrument.state.pairStates.set(pair.amm.expiry, pair);
            });
            result.push(instrument);
        }
        return result;
    }

    // query all ranges from graph
    async getRanges(param: QueryRangeParam): Promise<Map<string, ExtendedRange[]>> {
        const condition = this.buildQueryRangeCondition(param);
        const graphQL = `
        query($skip: Int, $first: Int, $lastID: String){
            ranges(first: $first, where: { status: "OPEN", id_gt: $lastID, ${condition}}){
                id
                amm {
                id
                }
                trader
                status

                tickLower
                tickUpper

                liquidity
                balance
                sqrtEntryPX96
                entryFeeIndex
            }
        }`;
        const ranges = await this.queryAll(graphQL, GRAPH_PAGE_SIZE, true);
        const blockMeta = (await this.query(`{ _meta{ block{ number, timestamp } } }`, 0, 1))._meta.block;
        const blockInfo: BlockInfo = {
            height: blockMeta.number,
            timestamp: blockMeta.timestamp,
        };
        const result: Map<string, ExtendedRange[]> = new Map();
        for (const range of ranges) {
            const parts = range.amm.id.split('-').filter((p: string) => p !== '');
            const extendedRange = {
                instrumentAddr: parts[0],
                expiry: Number(parts[1]),
                tickLower: Number(range.tickLower),
                tickUpper: Number(range.tickUpper),
                liquidity: BigNumber.from(range.liquidity),
                entryFeeIndex: BigNumber.from(range.entryFeeIndex),
                balance: BigNumber.from(range.balance),
                sqrtEntryPX96: BigNumber.from(range.sqrtEntryPX96),
                blockInfo,
            };
            const key = range.trader;
            result.set(key, (result.get(key) || []).concat(extendedRange));
        }
        return result;
    }

    // query all pairs data, amms is required as to calculate the APY
    async getPairsData(status = [Status.TRADING, Status.SETTLING], timestamp = now()): Promise<PairData[]> {
        const statusCondition = 'status_in: [' + status.map((s) => Status[s]).join(',') + '],';

        const dayId = dayIdFromTimestamp(timestamp);
        const hourId = hourIdFromTimestamp(timestamp);

        const _7d = dayId - 7 * SECS_PER_DAY;
        const _24h = hourId - 24 * SECS_PER_HOUR;
        // Why not simply query the data for the last 24 hours?
        // This is because we need to obtain the accurate closing price from 24 hours ago.
        // If the trading activity for a particular pair is incomplete within the last 24 hours,
        // we need to backtrack until we find the earliest available closing price.
        // We set a maximum backtrack time of 3 days
        const nDaysAgoHourId = hourId - 24 * 3 * SECS_PER_HOUR;

        // console.info(timestamp, dayId, hourId, _7d, _24h);
        const graphQL = `
            query($skip: Int, $first: Int, $lastID: String){
              amms(first: $first, where: {${statusCondition} id_gt: $lastID}){
                id
                symbol
                expiry
                status
                balance
                sqrtPX96
                instrument {
                  id
                }
                data {
                  id
                  totalVolume
                }
                dailyDataList(where: {timestamp_gt: ${_7d}, timestamp_lte: ${dayId}}, orderBy: timestamp, orderDirection: desc) {
                  id
                  timestamp
                  volume
                }
                hourlyDataList(where: {timestamp_gt: ${nDaysAgoHourId}, timestamp_lte: ${hourId}}, orderBy: timestamp, orderDirection: desc) {
                  id
                  timestamp
                  poolFee
                  volume
                  open
                  close
                  high
                  low
                }
              }
            }`;
        const result: PairData[] = [];
        const resp = await this.query(graphQL, 0, GRAPH_PAGE_SIZE);

        for (const amm of resp.amms) {
            let _7dVolume = ZERO;
            let _24hVolume = ZERO;
            let _24hPoolFee = ZERO;
            let _24hHigh = ZERO;
            let _24hLow = ZERO;
            let _24hClose = ZERO;

            for (const data of amm.dailyDataList) {
                _7dVolume = _7dVolume.add(BigNumber.from(data.volume));
            }

            for (const data of amm.hourlyDataList) {
                if (data.timestamp < _24h) {
                    break;
                }
                _24hVolume = _24hVolume.add(BigNumber.from(data.volume));
                _24hPoolFee = _24hPoolFee.add(BigNumber.from(data.poolFee));
            }

            for (const data of amm.hourlyDataList) {
                if (BigNumber.from(data.close).eq(0)) {
                    continue;
                }
                _24hClose = BigNumber.from(data.close);

                if (_24hHigh.lt(BigNumber.from(data.high))) {
                    _24hHigh = BigNumber.from(data.high);
                }
                if (_24hLow.eq(ZERO) || _24hLow.gt(BigNumber.from(data.low))) {
                    _24hLow = BigNumber.from(data.low);
                }
                if (data.timestamp <= _24h) {
                    break;
                }
            }

            const balance = BigNumber.from(amm.balance);
            // console.info(amm.id, '_24hFee:', fromWad(_24hFee));
            const data: PairData = {
                id: amm.id,
                expiry: Number(amm.expiry),
                instrumentAddr: amm.instrument.id,
                // APY_24hrs: fee_24hrs / all_range_value * 365
                APY24h: balance.eq(0) ? ZERO : wdiv(_24hPoolFee.mul(365), balance),
                poolFee24h: _24hPoolFee,
                volume24h: _24hVolume,
                volume24hUTC0: amm.dailyDataList.length > 0 ? BigNumber.from(amm.dailyDataList[0].volume) : ZERO,
                volume7d: _7dVolume,
                high24h: _24hHigh,
                low24h: _24hLow,
                priceChange24h: _24hClose.eq(ZERO) ? ZERO : wdiv(sqrtX96ToWad(amm.sqrtPX96), _24hClose).sub(WAD),
            };
            result.push(data);
        }
        return result;
    }

    async getAccessControlContractRole(id: string): Promise<AccessControlContractRole> {
        const graphQL = `query($skip: Int, $first: Int, $lastID: String){
            accessControlContractRoles(where:{id: "${id.toLowerCase()}"}) {
                id
                admins
                operators
              }
        }`;

        const resp = await this.query(graphQL, 0, 1000);
        return resp.accessControlContractRoles[0];
    }

    buildQueryEventCondition(param: QueryEventParam, hasInstrumentField = true): string {
        const fn = (str: string): string => `"${str}"`;

        let instrumentCondition = '';
        let pairCondition = '';
        let traderCondition = '';
        let eventCondition = '';
        let referralCondition = '';

        if (param.eventNames && param.eventNames.length > 0) {
            eventCondition = `name_in: [${param.eventNames.map((e) => fn(e)).join(',')}],`;
        }

        if (param.traders && param.traders.length > 0) {
            traderCondition = `trader_in: [${param.traders.map((t) => fn(t.toLowerCase())).join(',')}],`;
        }

        if (param.instrumentAddr && param.expiry && param.expiry >= 0) {
            pairCondition = `amm: ${fn(concatId(param.instrumentAddr, param.expiry).toLowerCase())},`;
        } else if (param.instrumentAddr) {
            instrumentCondition = hasInstrumentField
                ? `instrument: ${fn(param.instrumentAddr.toLowerCase())},`
                : `amm_:{instrument: ${fn(param.instrumentAddr.toLowerCase())}},`;
        }

        if (param.referralCode) {
            referralCondition = `referralCode_contains: ${fn(param.referralCode)},`;
        }

        const startTsCondition = `timestamp_gte: ${param.startTs || 0},`;
        const endTsCondition = `timestamp_lt: ${param.endTs || now()},`;

        const condition = `${eventCondition}${instrumentCondition}${pairCondition}${traderCondition}${referralCondition}${startTsCondition}${endTsCondition}`;
        return `where: {${condition} id_gt: $lastID}, `;
    }

    buildQueryInstrumentCondition(param: QueryInstrumentParam): string {
        const fn = (str: string): string => `"${str.toLowerCase()}"`;

        let instrumentCondition = '';
        if (param.instrumentAddrs) {
            instrumentCondition += `id_in: [${param.instrumentAddrs.map((addr) => fn(addr)).join(',')}]`;
        }
        let statusCondition;
        if (param.conditions) {
            statusCondition = `condition_in: [${param.conditions.map((s) => InstrumentCondition[s]).join(',')}]`;
        }

        if (instrumentCondition || statusCondition) {
            return `, where: {${[instrumentCondition, statusCondition].join(',')}}`;
        } else {
            return '';
        }
    }

    buildQueryRangeCondition(param: QueryRangeParam): string {
        const fn = (str: string): string => `"${str.toLowerCase()}"`;

        let pairCondition = '';
        if (param.instrumentAddr && param.expiry) {
            pairCondition += `amm_contains: ${fn(param.instrumentAddr + '-' + param.expiry)}`;
        }
        let traderCondition = '';
        if (param.traders) {
            traderCondition = `trader_contains: [${param.traders.map((t) => fn(t.toLowerCase())).join(',')}]`;
        }

        if (pairCondition || traderCondition) {
            return `${[pairCondition, traderCondition].join(',')}`;
        } else {
            return '';
        }
    }

    // query general-purposed transaction events
    async getTransactionEvents(param: QueryEventParam): Promise<TransactionEvent[]> {
        const queryAll = param.size === undefined && param.page === undefined;
        const first = param.size || 1000;
        const skip = (param.page || 0) * first;
        let condition = this.buildQueryEventCondition(param);
        condition = queryAll ? condition : condition + 'orderBy: timestamp, orderDirection: desc';

        const graphQL = `query($skip: Int, $first: Int, $lastID: String){
            transactionEvents(skip: $skip, first: $first, ${condition}){
                id
                name
                args
                address
                logIndex
                blockNumber
                timestamp
                trader
                amm {
                    id
                    symbol
                }
                instrument {
                    id
                    symbol
                }
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
                address: txEvent.address,
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

    // get user order history
    async getUserOrders(param: QueryParam): Promise<UserOrder[]> {
        const first = param.size || 1000;
        const skip = (param.page || 0) * first;
        const condition = this.buildQueryEventCondition(param, false);

        const graphQL = `query($skip: Int, $first: Int, $lastID: String){
            orders(skip: $skip, first: $first, ${condition} orderBy: timestamp, orderDirection: desc){
                id
                amm {
                    id
                    symbol
                    instrument{
                        id
                    }
                    expiry
                }
                createdTimestamp
                balance
                fee
                filledSize
                nonce
                price
                size
                status
                tick
                tradeValue
                trader
                timestamp
                placeEvent {
                    transaction {
                        id
                    }
                }
                fillEvent {
                    transaction {
                        id
                    }
                }
                cancelEvent {
                    transaction {
                        id
                    }
                }
                referralCode
            }
        }`;
        const resp = await this.query(graphQL, skip, first);
        const result: UserOrder[] = [];
        for (const order of resp.orders) {
            result.push({
                trader: order.trader,
                instrumentAddr: order.amm.instrument.id,
                expiry: Number(order.amm.expiry),
                tick: Number(order.tick),
                size: BigNumber.from(order.size),
                filledSize: BigNumber.from(order.filledSize),
                price: BigNumber.from(order.price),
                fee: BigNumber.from(order.fee),
                createdTimestamp: Number(order.createdTimestamp),
                timestamp: Number(order.timestamp),
                status: order.status as OrderStatus,
                placeTxHash: order.placeEvent.transaction.id,
                fillTxHash: order.fillEvent?.transaction.id,
                cancelTxHash: order.cancelEvent?.transaction.id,
                referralCode: order.referralCode,
            });
        }
        return result;
    }

    // Obtain users who can be settled under one instrument
    async getUsersToSettle(param: QueryParam): Promise<Record<number, Array<string>>> {
        const ordersResp = await this.getOrdersToSettle(param);
        const positionsResp = await this.getPositionsToSettle(param);
        const rangesResp = await this.getRangesToSettle(param);

        const allUsers: Record<number, Array<string>> = {};

        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        const addTraderToExpiry = (trader: string, expiryStr: string) => {
            const expiry = parseInt(expiryStr);
            if (!allUsers[expiry]) {
                allUsers[expiry] = [];
            }
            if (!allUsers[expiry].includes(trader)) {
                allUsers[expiry].push(trader);
            }
        };

        [ordersResp, positionsResp, rangesResp].forEach((response) => {
            response.forEach((item) => {
                addTraderToExpiry(item.trader, item.amm.expiry);
            });
        });

        return allUsers;
    }

    async getOrdersToSettle(param: QueryParam): Promise<QueryResponse> {
        const graphQL = `query($skip: Int, $first: Int, $lastID: String){
            orders(first: $first, where: {id_gt: $lastID, amm_contains: "${param.instrumentAddr?.toLowerCase()}", status_not_in: [CANCELLED, FILLED]}) {
                trader
                id
                amm {
                    expiry
                }
            }
        }`;
        const resp = await this.queryAll(graphQL, GRAPH_PAGE_SIZE, true);
        return resp;
    }

    async getRangesToSettle(param: QueryParam): Promise<QueryResponse> {
        const graphQL = `query($skip: Int, $first: Int, $lastID: String){
            ranges(first: $first, where: {id_gt: $lastID, amm_contains: "${param.instrumentAddr?.toLowerCase()}", status_not_in: [REMOVED]}) {
                trader
                id
                amm {
                    expiry
                }
            }
        }`;
        const resp = await this.queryAll(graphQL, GRAPH_PAGE_SIZE, true);
        return resp;
    }

    async getPositionsToSettle(param: QueryParam): Promise<QueryResponse> {
        const graphQL = `query($skip: Int, $first: Int, $lastID: String){
            positions(first: $first, where: {id_gt: $lastID, amm_contains: "${param.instrumentAddr?.toLowerCase()}", size_not: "0"}) {
                trader
                id
                amm {
                    expiry
                }
            }
        }`;
        const resp = await this.queryAll(graphQL, GRAPH_PAGE_SIZE, true);
        return resp;
    }

    async getVirtualTrades(param: QueryParam): Promise<VirtualTrade[]> {
        const queryAll = param.size === undefined && param.page === undefined;
        const first = param.size || 1000;
        const skip = (param.page || 0) * first;
        let condition = this.buildQueryEventCondition(param, false);
        condition = queryAll ? condition : condition + 'orderBy: blockNumber, orderDirection: desc';

        const graphQL = `query($skip: Int, $first: Int, $lastID: String){
            virtualTrades(skip: $skip, first: $first, ${condition}){
                id
                amm {
                    id
                    symbol
                    instrument{
                        id
                    }
                    expiry
                }
                original {
                    transaction {
                        id
                    }
                    logIndex
                    name
                    args
                }
                fee
                price
                size
                timestamp
                blockNumber
                tradeValue
                trader
                type
                referralCode
            }
        }`;

        console.info(graphQL);

        let virtualTrades;
        if (queryAll) {
            virtualTrades = await this.queryAll(graphQL, GRAPH_PAGE_SIZE, true);
        } else {
            const resp = await this.query(graphQL, skip, first);
            virtualTrades = resp.virtualTrades;
        }

        let result: VirtualTrade[] = [];
        for (const trade of virtualTrades) {
            let isRangeLiquidated = false;
            if (trade.original.name === 'Remove') {
                const args = JSON.parse(trade.original.args);
                isRangeLiquidated = args.trader !== args.operator;
            }

            let stablityFee = BigNumber.from(0);
            if (trade.original.name === 'Trade' || trade.original.name === 'Sweep') {
                const args = JSON.parse(trade.original.args);
                stablityFee = wmul(
                    BigNumber.from(trade.tradeValue),
                    r2w(Number(args.feeRatio) - Number(args.tradingFeeRatio)),
                );
            }

            result.push({
                txHash: trade.original.transaction.id,
                logIndex: Number(trade.original.logIndex),
                blockNumber: Number(trade.blockNumber),
                timestamp: Number(trade.timestamp),
                trader: trade.trader,
                instrumentAddr: trade.amm.instrument.id,
                expiry: Number(trade.amm.expiry),
                size: BigNumber.from(trade.size),
                price: BigNumber.from(trade.price),
                fee: BigNumber.from(trade.fee),
                stablityFee,
                tradeValue: BigNumber.from(trade.tradeValue),
                type: trade.type as VirtualTradeType,
                isRangeLiquidated,
                referralCode: trade.referralCode,
            });
        }
        // newest first
        result = _orderBy(result, ['blockNumber', 'logIndex'], ['desc', 'desc']);
        return result;
    }

    async getQuotes(): Promise<TokenInfo[]> {
        const graphQL = `query($skip: Int, $first: Int, $lastID: String){
            quotes{
                id
                name
                symbol
                decimals
            }
        }`;
        const resp = await this.query(graphQL, 0, 1000);
        const result: TokenInfo[] = [];
        for (const quote of resp.quotes) {
            result.push({
                address: quote.id,
                name: quote.name,
                symbol: quote.symbol,
                decimals: Number(quote.decimals),
            });
        }
        return result;
    }
}

// async function main(): Promise<void> {
//     const subgraph = new Subgraph('https://api.synfutures.com/thegraph/v3-blast');
//     const events = await subgraph.getTransactionEvents({
//         instrumentAddr: '0xeb9e8822142Fc10C38FaAB7bB6c635D22eb20Ff8',
//         startTs: 1710028800,
//         endTs: 1710115200,
//         page: 1,
//         size: 1000,
//         eventNames: ['Trade', 'Sweep'],
//     });
//     console.log(events.length);

//     const volume = events.map((e) => e.args.entryNotional).reduce((a, b) => a.add(b), ZERO);
//     console.log(volume.toString());

//     const events2 = await subgraph.getUserOrders({
//         instrumentAddr: '0xeb9e8822142Fc10C38FaAB7bB6c635D22eb20Ff8',
//         startTs: 1710028800,
//         endTs: 1710115200,
//         page: 0,
//         size: 1000,
//     });
//     console.info(events2);
// }

// main()
//     .then()
//     .catch((e) => console.log(e));

