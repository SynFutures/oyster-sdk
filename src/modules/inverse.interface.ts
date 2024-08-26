import { BaseInterFace } from './index';
import { InterfaceImplementationMissingError } from '../errors/interfaceImplementationMissing.error';
import { FetchInstrumentParam, InstrumentInfo } from '../types';
import { PairLevelAccountModel, WrappedInstrumentModel } from '../models';
import { TokenInfo } from '@derivation-tech/web3-core';
import { CallOverrides, ContractTransaction, providers } from 'ethers';
import { ITradeRequest, ISimulateTradeResult, ISimulatePlaceOrderResult, IPlaceOrderRequest } from '../types/inverse';

export interface InverseInterface extends BaseInterFace {
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

    simulateTrade(params: ITradeRequest): ISimulateTradeResult;
    // if simulate before, just pass the simulateResult
    trade(
        params: ITradeRequest,
        simulateResult?: ISimulateTradeResult,
    ): Promise<ContractTransaction | providers.TransactionReceipt>;

    simulatePlaceOrder(params: IPlaceOrderRequest): ISimulatePlaceOrderResult;
    // if simulate before, just pass the simulateResult
    placeOrder(
        params: IPlaceOrderRequest,
        simulateResult?: ISimulatePlaceOrderResult,
    ): Promise<ContractTransaction | providers.TransactionReceipt>;
}

export function createNullInverseModule(): InverseInterface {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const errorHandler = () => {
        throw new InterfaceImplementationMissingError('InverseInterface', 'inverse');
    };
    return {
        synfV3: null as never,
        instrumentMap: null as never,
        getInstrumentInfo: errorHandler,
        accountCache: null as never,
        initInstruments: errorHandler,
        updateInstrument: errorHandler,
    };
}
