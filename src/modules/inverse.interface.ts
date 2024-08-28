import { CallOverrides, BigNumber, ContractTransaction, providers } from 'ethers';
import { TokenInfo } from '@derivation-tech/web3-core';
import { BaseInterface } from '../common';
import { FetchInstrumentParam, InstrumentInfo } from '../types';
import { PairLevelAccountModel, WrappedInstrumentModel, WrappedPositionModel } from '../models';
import {
    IRawSpotStateRequest,
    IRawSpotState,
    IGetOrderBookDataRequest,
    IOrderBookData,
    IDepthChartRequest,
    IDeepChartsData,
    IOdysseySimulatePortfolioPointPerDayRequest,
    IOdysseySimulateRangePointPerDayRequest,
    IOdysseySimulateOrderPointPerDayRequest,
    IPortfolioGetPendingParamsRequest,
    IPortfolioGetFundFlowsRequest,
    IPortfolioGetUserPendingsRequest,
    IPortfolioReleaseClaimRequest,
    IPortfolioDepositRequest,
    IPortfolioWithdrawRequest,
    IPortfolioGetPendingParamsResult,
    IPortfolioGetFundFlowsResult,
    IPortfolioGetUserPendingsResult,
    IAddLiquidityRequest,
    ISimulateAddLiquidityResult,
    IRemoveLiquidityRequest,
    IRemoveLiquidityResult,
    IBatchPlaceScaledLimitOrderRequest,
    IBatchPlaceScaledLimitOrderResult,
    IBatchCancelOrderRequest,
    ICrossMarketOrderRequest,
    ICrossMarketOrderResult,
    ITradeRequest,
    ISimulateTradeResult,
    IPlaceOrderRequest,
    ISimulatePlaceOrderResult,
    IAdjustMarginRequest,
    ISimulateAdjustMarginResult,
} from '../../tests/demo/params';

export interface InverseInterface extends BaseInterface {
    get instrumentMap(): Map<string, WrappedInstrumentModel>;
    get accountCache(): Map<string, Map<string, Map<number, PairLevelAccountModel>>>;

    /**
     *Get instrument info from cache and should inverse
     * @param instrumentAddress
     */
    getInstrumentInfo(instrumentAddress: string): Promise<InstrumentInfo>;

    /**
     * Init instruments
     * @param symbolToInfo the token info
     */
    initInstruments(symbolToInfo?: Map<string, TokenInfo>): Promise<WrappedInstrumentModel[]>;

    /**
     *Update instrument cache
     * will update all expiries when params.expiry.length is 0
     * @param params the params
     * @param overrides overrides with ethers types
     */
    updateInstrument(params: FetchInstrumentParam[], overrides?: CallOverrides): Promise<WrappedInstrumentModel[]>;

    // getInstrumentLevelAccounts(target: string, overrides?: CallOverrides): Promise<WrappedInstrumentLevelAccountModel[]>;

    // updatePairLevelAccount(
    //     target: string,
    //     instrument: string,
    //     expiry: number,
    //     overrides?: CallOverrides,
    // ): Promise<WrappedPairLevelAccountModel>;

    trade: {
        simulateTrade(params: ITradeRequest): ISimulateTradeResult;
        // if simulate before, just pass the simulateResult
        trade(
            params: ITradeRequest,
            simulateResult?: ISimulateTradeResult, // TODO: if not pass simulateResult, will simulate check before send tx
        ): Promise<ContractTransaction | providers.TransactionReceipt>;
        simulatePlaceOrder(params: IPlaceOrderRequest): ISimulatePlaceOrderResult;
        // if simulate before, just pass the simulateResult
        placeOrder(
            params: IPlaceOrderRequest,
            simulateResult?: ISimulatePlaceOrderResult, // TODO: if not pass simulateResult, will simulate check before send tx
        ): Promise<ContractTransaction | providers.TransactionReceipt>;
        simulateAdjustMargin(params: IAdjustMarginRequest): ISimulateAdjustMarginResult;
        adjustMargin(
            params: IAdjustMarginRequest,
            simulateResult?: ISimulateAdjustMarginResult, // TODO: if not pass simulateResult, will simulate check before send tx)
        ): Promise<ContractTransaction | providers.TransactionReceipt>;
    };

    order: {
        simulateBatchPlaceScaledLimitOrder(
            params: IBatchPlaceScaledLimitOrderRequest,
        ): IBatchPlaceScaledLimitOrderResult;
        batchPlaceScaledLimitOrder(
            params: IBatchPlaceScaledLimitOrderRequest,
            simulateResult?: IBatchPlaceScaledLimitOrderResult, // TODO: if not pass simulateResult, will simulate check before send tx
        ): Promise<ContractTransaction | providers.TransactionReceipt>;
        batchCancelOrder(params: IBatchCancelOrderRequest): Promise<ContractTransaction | providers.TransactionReceipt>;
        simulateCrossMarketOrder(params: ICrossMarketOrderRequest): ICrossMarketOrderResult;
        placeCrossMarketOrder(
            params: ICrossMarketOrderRequest,
            simulateResult?: ICrossMarketOrderResult, // TODO: if not pass simulateResult, will simulate check before send tx
        ): Promise<ContractTransaction | providers.TransactionReceipt>;
    };

    earn: {
        isOpenLP(traderAddr: string): Promise<boolean>;
        inWhiteListLps(quoteAddr: string, traderAddrs: string[]): Promise<boolean[]>;
        calcBoost(alpha: number, imr: number): number;
        simulateAddLiquidity(params: IAddLiquidityRequest): ISimulateAddLiquidityResult;
        addLiquidity(
            params: IAddLiquidityRequest,
            simulateResult?: ISimulateAddLiquidityResult, // TODO: if not pass simulateResult, will simulate check before send tx
        ): Promise<ContractTransaction | providers.TransactionReceipt>;
        simulateRemoveLiquidity(params: IRemoveLiquidityRequest): IRemoveLiquidityResult;
        removeLiquidity(
            params: IRemoveLiquidityRequest,
            simulateResult?: IRemoveLiquidityResult, // TODO: if not pass simulateResult, will simulate check before send tx
        ): Promise<ContractTransaction | providers.TransactionReceipt>;
    };

    portfolio: {
        getPendingParams(params: IPortfolioGetPendingParamsRequest): Promise<IPortfolioGetPendingParamsResult>;
        getFundFlows(params: IPortfolioGetFundFlowsRequest): Promise<IPortfolioGetFundFlowsResult>;
        getUserPendings(params: IPortfolioGetUserPendingsRequest): Promise<IPortfolioGetUserPendingsResult>;
        releaseClaim(
            params: IPortfolioReleaseClaimRequest,
        ): Promise<ContractTransaction | providers.TransactionReceipt>;
        deposit(params: IPortfolioDepositRequest): Promise<ContractTransaction | providers.TransactionReceipt>;
        withdraw(params: IPortfolioWithdrawRequest): Promise<ContractTransaction | providers.TransactionReceipt>;
    };

    graph: {
        // getVirtualTrades(param: QueryParam): Promise<IVirtualTrade[]>;
    };

    odyssey: {
        simulatePortfolioPointPerDay(params: IOdysseySimulatePortfolioPointPerDayRequest): Promise<BigNumber>;
        simulateRangePointPerDay(params: IOdysseySimulateRangePointPerDayRequest): Promise<BigNumber>;
        simulateOrderPointPerDay(params: IOdysseySimulateOrderPointPerDayRequest): Promise<BigNumber>;
    };

    charts: {
        getOrderBookData(params: IGetOrderBookDataRequest): Promise<IOrderBookData>;
        getDepthChartsData(params: IDepthChartRequest): Promise<IDeepChartsData>;
    };

    utils: {
        getRawSpotState(params: IRawSpotStateRequest): Promise<IRawSpotState>;
        isUserInBlacklisted(traderAddr: string): Promise<boolean>;
        getPositionIfSettle(traderAccount: PairLevelAccountModel): Promise<WrappedPositionModel>;
        alignPriceWadToTick(price: BigNumber): {
            tick: number;
            price: BigNumber;
        };
        getPriceAtTick(tick: number): BigNumber;
        getTickAtPrice(price: BigNumber): number;
    };
}
