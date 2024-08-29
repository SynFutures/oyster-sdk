import { CallOverrides, Signer, ContractTransaction, providers, BigNumber } from 'ethers';
import { Combine } from '../../common';
import { SynFuturesV3 as SynFuturesV3Core } from '../../core';
import { alignPriceWadToTick } from '../../math';
import { WrappedPlaceOrderRequest, WrappedSimulateOrderResult } from '../../types/advanced';
import { InstrumentPlugin } from '../instrument.plugin';
import { SimulatePlugin } from '../simulate.plugin';
import { ObserverPlugin } from '../observer.plugin';
import { OrderInterface } from './order.interface';

type SynFuturesV3 = Combine<[SynFuturesV3Core, InstrumentPlugin, SimulatePlugin, ObserverPlugin]>;

export class OrderModule implements OrderInterface {
    synfV3: SynFuturesV3;

    constructor(synfV3: SynFuturesV3) {
        this.synfV3 = synfV3;
    }

    async simulatePlaceOrder(
        _params: WrappedPlaceOrderRequest,
        overrides?: CallOverrides,
    ): Promise<WrappedSimulateOrderResult> {
        const params = _params.unWrap;

        const tick =
            'tick' in params.priceInfo ? params.priceInfo.tick : alignPriceWadToTick(params.priceInfo.price).tick;

        let baseSize: BigNumber | undefined = undefined;

        if ('base' in params.amountInfo) {
            baseSize = params.amountInfo.base;
        } else {
            const { baseAmount } = await this.synfV3.observer.inquireByQuote(
                params.pair,
                params.side,
                params.amountInfo.quote,
                overrides,
            );

            baseSize = baseAmount;
        }

        const result = this.synfV3.simulate.simulateOrder2(
            params.pair,
            params.traderAddr,
            tick,
            baseSize,
            params.side,
            params.leverage,
        );

        return new WrappedSimulateOrderResult({
            baseSize: result.baseSize,
            balance: result.balance,
            leverageWad: result.leverageWad,
            marginToDepositWad: result.marginToDepositWad,
            minOrderValue: result.minOrderValue,
            minFeeRebate: result.minFeeRebate,
            tick,
            isInverse: params.isInverse,
        });
    }

    async placeOrder(
        signer: Signer,
        _params: WrappedPlaceOrderRequest,
        deadline: number,
        simulateResult?: WrappedSimulateOrderResult,
        overrides?: CallOverrides,
    ): Promise<ContractTransaction | providers.TransactionReceipt> {
        const params = _params.unWrap;

        simulateResult = simulateResult ?? (await this.simulatePlaceOrder(_params, overrides));

        return this.synfV3.instrument.limitOrder(
            signer,
            params.pair,
            simulateResult.tick,
            simulateResult.baseSize,
            simulateResult.balance,
            params.side,
            deadline,
            overrides,
            params.referralCode,
        );
    }
}
