import { CallOverrides, Signer, ContractTransaction, providers, BigNumber } from 'ethers';
import { TokenInfo } from '@derivation-tech/web3-core';
import { BaseInterface } from '../common';
import { FetchInstrumentParam, InstrumentIdentifier, InstrumentInfo } from '../types';
import { WrappedPlaceOrderRequest, WrappedSimulateOrderResult } from '../types/inverse';
import { WrappedPairLevelAccountModel, WrappedInstrumentModel, WrappedInstrumentLevelAccountModel } from '../models';

export interface InverseInterface extends BaseInterface {
    get instrumentMap(): Map<string, WrappedInstrumentModel>;
    get accountCache(): Map<string, Map<string, Map<number, WrappedPairLevelAccountModel>>>;

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

    /**
     *Get instrument level accounts infos
     *given single trader address, return multiple instrument level account which have been involved
     * @param target the target address
     * @param overrides overrides with ethers types
     */
    getInstrumentLevelAccounts(
        target: string,
        overrides?: CallOverrides,
    ): Promise<WrappedInstrumentLevelAccountModel[]>;

    /**
     *Get pair level account infos
     * @param target the target address
     * @param instrument the instrument address
     * @param expiry the expiry
     * @param useCache whether use cache
     */
    getPairLevelAccount(
        target: string,
        instrument: string,
        expiry: number,
        useCache?: boolean,
    ): Promise<WrappedPairLevelAccountModel>;

    /**
     * Update pair level account infos
     * @param target the target address
     * @param instrument the instrument address
     * @param expiry the expiry
     * @param overrides ethers overrides
     */
    updatePairLevelAccount(
        target: string,
        instrument: string,
        expiry: number,
        overrides?: CallOverrides,
    ): Promise<WrappedPairLevelAccountModel>;

    /**
     *Get all instruments
     * @param batchSize the batch size,default value is 10
     * @param overrides overrides with ethers types
     */
    getAllInstruments(batchSize?: number, overrides?: CallOverrides): Promise<WrappedInstrumentModel[]>;

    /**
     *Fetch instrument batch by given params
     * @param params the params
     * @param overrides overrides with ethers types
     */
    fetchInstrumentBatch(params: FetchInstrumentParam[], overrides?: CallOverrides): Promise<WrappedInstrumentModel[]>;

    /**
     *Inspect dex v2 market benchmark price
     * @param instrumentIdentifier the instrument
     * @param expiry the expiry
     */
    inspectDexV2MarketBenchmarkPrice(instrumentIdentifier: InstrumentIdentifier, expiry: number): Promise<BigNumber>;

    /**
     * Inspect cex market benchmark price
     * @param instrumentIdentifier the instrument
     * @param expiry the expiry
     */
    inspectCexMarketBenchmarkPrice(instrumentIdentifier: InstrumentIdentifier, expiry: number): Promise<BigNumber>;

    /**
     * Get raw spot price by instrument marketType
     * @param identifier the instrument identifier
     */
    getRawSpotPrice(identifier: InstrumentIdentifier): Promise<BigNumber>;

    // simulateTrade(params: ITradeRequest): ISimulateTradeResult;
    // // if simulate before, just pass the simulateResult
    // trade(
    //     params: ITradeRequest,
    //     simulateResult?: ISimulateTradeResult, // TODO: if not pass simulateResult, will simulate check before send tx
    // ): Promise<ContractTransaction | providers.TransactionReceipt>;

    simulatePlaceOrder(
        params: WrappedPlaceOrderRequest,
        overrides?: CallOverrides,
    ): Promise<WrappedSimulateOrderResult>;

    placeOrder(
        signer: Signer,
        params: WrappedPlaceOrderRequest,
        deadline: number,
        simulateResult?: WrappedSimulateOrderResult,
        overrides?: CallOverrides,
    ): Promise<ContractTransaction | providers.TransactionReceipt>;

    // simulateAddLiquidity(params: IAddLiquidityRequest): ISimulateAddLiquidityResult;
    // addLiquidity(
    //     params: IAddLiquidityRequest,
    //     simulateResult?: ISimulateAddLiquidityResult, // TODO: if not pass simulateResult, will simulate check before send tx
    // ): Promise<ContractTransaction | providers.TransactionReceipt>;

    // simulateAdjustMargin(params: IAdjustMarginRequest): ISimulateAdjustMarginResult;
    // adjustMargin(
    //     params: IAdjustMarginRequest,
    //     simulateResult?: ISimulateAdjustMarginResult, // TODO: if not pass simulateResult, will simulate check before send tx)
    // ): Promise<ContractTransaction | providers.TransactionReceipt>;

    // simulateRemoveLiquidity(params: IRemoveLiquidityRequest): IRemoveLiquidityResult;

    // removeLiquidity(
    //     params: IRemoveLiquidityRequest,
    //     simulateResult?: IRemoveLiquidityResult, // TODO: if not pass simulateResult, will simulate check before send tx
    // ): Promise<ContractTransaction | providers.TransactionReceipt>;

    // simulateBatchPlaceScaledLimitOrder(params: IBatchPlaceScaledLimitOrderRequest): IBatchPlaceScaledLimitOrderResult;

    //  batchPlaceScaledLimitOrder(
    //     params: IBatchPlaceScaledLimitOrderRequest,
    //     simulateResult?: IBatchPlaceScaledLimitOrderResult, // TODO: if not pass simulateResult, will simulate check before send tx
    // ): Promise<ContractTransaction | providers.TransactionReceipt>;

    // batchCancelOrder(params: IBatchCancelOrderRequest): Promise<ContractTransaction | providers.TransactionReceipt>;

    // simulateCrossMarketOrder(params: ICrossMarketOrderRequest): ICrossMarketOrderResult;

    // placeCrossMarketOrder(
    //     params: ICrossMarketOrderRequest,
    //     simulateResult?: ICrossMarketOrderResult, // TODO: if not pass simulateResult, will simulate check before send tx
    // ): Promise<ContractTransaction | providers.TransactionReceipt>;
}
