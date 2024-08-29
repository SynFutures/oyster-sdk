import { CallOverrides, Signer, ContractTransaction, providers } from 'ethers';
import { TokenInfo } from '@derivation-tech/web3-core';
import { BaseInterface } from '../common';
import { FetchInstrumentParam, InstrumentInfo } from '../types';
import { WrappedPlaceOrderRequest, WrappedSimulateOrderResult } from '../types/inverse';
import { PairLevelAccountModel, WrappedInstrumentModel } from '../models';

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
