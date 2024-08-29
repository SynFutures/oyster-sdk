import { CallOverrides, Signer, ContractTransaction, providers } from 'ethers';
import { BaseInterface } from '../../common';
import { WrappedPlaceOrderRequest, WrappedSimulateOrderResult } from '../../types/advanced';

export interface OrderInterface extends BaseInterface {
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
}
