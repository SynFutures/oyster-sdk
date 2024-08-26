import { BigNumber, ethers, Overrides, PayableOverrides, Signer } from 'ethers';
import {
    AddParam,
    AdjustParam,
    BatchPlaceParam,
    CancelParam,
    FillParam,
    InstrumentIdentifier,
    PlaceParam,
    Quotation,
    RemoveParam,
    Side,
    TradeParam,
} from '../types';
import { TokenInfo } from '@derivation-tech/web3-core';
import { OrderModel, PairLevelAccountModel, PairModel, RangeModel } from '../models';
import { BaseInterface } from '../common';

export interface InstrumentInterface extends BaseInterface {
    //////////////////////////////////////////////////////////
    // Low level Api
    //////////////////////////////////////////////////////////
    /**
     *Add liquidity
     * @param signer custom signer
     * @param instrumentAddr the instrument address
     * @param param the liquidity param
     * @param referralCode the referral code,default value is DEFAULT_REFERRAL_CODE(\xff\xff\x00\x00\x00\x00\x00\x00)
     * @param overrides overrides with ethers types
     */
    add(
        signer: Signer,
        instrumentAddr: string,
        param: AddParam,
        overrides?: Overrides,
        referralCode?: string,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    /**
     *Remove liquidity
     * @param signer custom signer
     * @param instrumentAddr the instrument address
     * @param param the liquidity param
     * @param overrides overrides with ethers types
     */
    remove(
        signer: Signer,
        instrumentAddr: string,
        param: RemoveParam,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    /**
     *Add a market order
     * @param signer custom signer
     * @param instrumentAddr the instrument address
     * @param param the market order param
     * @param referralCode the referral code,default value is DEFAULT_REFERRAL_CODE(\xff\xff\x00\x00\x00\x00\x00\x00)
     * @param overrides overrides with ethers types
     */
    trade(
        signer: Signer,
        instrumentAddr: string,
        param: TradeParam,
        overrides?: Overrides,
        referralCode?: string,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    /**
     * Add a market order with risk
     * WARNING: this function is not recommended to use, because it may cause penalty fee during trade
     * @param signer custom signer
     * @param instrumentAddr the instrument address
     * @param param the market order param
     * @param limitStabilityFeeRatio
     * @param referralCode the referral code,default value is DEFAULT_REFERRAL_CODE(\xff\xff\x00\x00\x00\x00\x00\x00)
     * @param overrides overrides with ethers types
     */
    tradeWithRisk(
        signer: Signer,
        instrumentAddr: string,
        param: TradeParam,
        limitStabilityFeeRatio: number,
        overrides?: Overrides,
        referralCode?: string,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    /**
     * Add a limit order
     * @param signer custom signer
     * @param instrumentAddr the instrument address
     * @param param the limit order param
     * @param referralCode the referral code,default value is DEFAULT_REFERRAL_CODE(\xff\xff\x00\x00\x00\x00\x00\x00)
     * @param overrides overrides with ethers types
     */
    place(
        signer: Signer,
        instrumentAddr: string,
        param: PlaceParam,
        overrides?: Overrides,
        referralCode?: string,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    /**
     *Add a batch limit order
     * @param signer custom signer
     * @param instrumentAddr  the instrument address
     * @param params the batch limit order param
     * @param referralCode the referral code,default value is DEFAULT_REFERRAL_CODE(\xff\xff\x00\x00\x00\x00\x00\x00)
     * @param overrides overrides with ethers types
     */
    batchPlace(
        signer: Signer,
        instrumentAddr: string,
        params: BatchPlaceParam,
        overrides?: Overrides,
        referralCode?: string,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    /**
     *Adjust a limit order
     * @param signer custom signer
     * @param instrumentAddr the instrument address
     * @param param the adjust param
     * @param referralCode the referral code,default value is DEFAULT_REFERRAL_CODE(\xff\xff\x00\x00\x00\x00\x00\x00)
     * @param overrides overrides with ethers types
     */
    adjust(
        signer: Signer,
        instrumentAddr: string,
        param: AdjustParam,
        overrides?: Overrides,
        referralCode?: string,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    /**
     * Fill order
     * @param signer custom signer
     * @param instrumentAddr the instrument address
     * @param param the fill order param
     * @param overrides overrides with ethers types
     */
    fill(
        signer: Signer,
        instrumentAddr: string,
        param: FillParam,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    /**
     * Cancel a limit order
     * @param signer custom signer
     * @param instrumentAddr the instrument address
     * @param param the cancel order param
     * @param overrides overrides with ethers types
     */
    cancel(
        signer: Signer,
        instrumentAddr: string,
        param: CancelParam,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    /**
     *Donate insurance fund
     * @param signer custom signer
     * @param instrumentAddr the instrument address
     * @param expiry the expiry
     * @param amount the insurance fund amount,all the quote should format 18 decimals, eg: 1USDC = 1000000000000000000
     * @param overrides
     */
    donateInsuranceFund(
        signer: Signer,
        instrumentAddr: string,
        expiry: number,
        amount: BigNumber,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    //////////////////////////////////////////////////////////
    // High level Api
    //////////////////////////////////////////////////////////
    /**
     * Intuitive trade
     * @param signer custom signer
     * @param pair the pair
     * @param side the side
     * @param base the base amount
     * @param margin the margin,decimal 18 units, always positive
     * @param tradePrice the trade price
     * @param slippage the slippage
     * @param deadline the deadline,seconds
     * @param overrides overrides
     * @param referralCode the referral code,default value is DEFAULT_REFERRAL_CODE(\xff\xff\x00\x00\x00\x00\x00\x00)
     */
    intuitiveTrade(
        signer: Signer,
        pair: PairModel,
        side: Side,
        base: BigNumber,
        margin: BigNumber,
        tradePrice: BigNumber,
        slippage: number,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode?: string,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    /**
     * Adjust margin
     * @param signer custom signer
     * @param pair the pair
     * @param transferIn true if transferIn, false if transferOut
     * @param margin the margin,decimal 18 units, always positive
     * @param deadline the deadline,seconds
     * @param overrides overrides
     * @param referralCode the referral code,default value is DEFAULT_REFERRAL_CODE(\xff\xff\x00\x00\x00\x00\x00\x00)
     */
    adjustMargin(
        signer: Signer,
        pair: PairModel,
        transferIn: boolean,
        margin: BigNumber,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode?: string,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    /**
     * Limit order
     * @param signer custom signer
     * @param pair the pair
     * @param tickNumber the tick
     * @param baseWad the base amount
     * @param balanceWad the balance,decimal 18 units, always positive for both long or short. e.g. 3e18 means 3 BASE
     * @param side the side
     * @param deadline the deadline,seconds
     * @param overrides overrides
     * @param referralCode the referral code,default value is DEFAULT_REFERRAL_CODE(\xff\xff\x00\x00\x00\x00\x00\x00)
     */
    limitOrder(
        signer: Signer,
        pair: PairModel,
        tickNumber: number,
        baseWad: BigNumber,
        balanceWad: BigNumber,
        side: Side,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode?: string,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    /**
     * Add liquidity with asymmetric range
     * @param signer custom signer
     * @param instrumentIdentifier the instrument
     * @param expiry the expiry
     * @param tickDeltaLower the tick lower
     * @param tickDeltaUpper the tick upper
     * @param marginWad the margin,decimal 18 units, always positive
     * @param sqrtStrikeLowerPX96  sqrtStrikeLowerPX96
     * @param sqrtStrikeUpperPX96 sqrtStrikeUpperPX96
     * @param deadline the deadline,seconds
     * @param overrides overrides
     * @param referralCode the referral code,default value is DEFAULT_REFERRAL_CODE(\xff\xff\x00\x00\x00\x00\x00\x00)
     */
    addLiquidityWithAsymmetricRange(
        signer: Signer,
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
        tickDeltaLower: number,
        tickDeltaUpper: number,
        marginWad: BigNumber,
        sqrtStrikeLowerPX96: BigNumber,
        sqrtStrikeUpperPX96: BigNumber,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode?: string,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    /**
     * Add liquidity
     * @param signer custom signer
     * @param instrumentIdentifier the instrument
     * @param expiry the expiry
     * @param tickDelta the tick delta
     * @param marginWad the margin,decimal 18 units, always positive
     * @param sqrtStrikeLowerPX96  sqrtStrikeLowerPX96
     * @param sqrtStrikeUpperPX96 sqrtStrikeUpperPX96
     * @param deadline the deadline,seconds
     * @param overrides overrides
     * @param referralCode the referral code,default value is DEFAULT_REFERRAL_CODE(\xff\xff\x00\x00\x00\x00\x00\x00)
     */
    addLiquidity(
        signer: Signer,
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
        tickDelta: number,
        marginWad: BigNumber,
        sqrtStrikeLowerPX96: BigNumber,
        sqrtStrikeUpperPX96: BigNumber,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode?: string,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    /**
     * Remove liquidity
     * @param signer custom signer
     * @param pairModel the pair
     * @param targetAddress the target address
     * @param rangeModel the range model
     * @param sqrtStrikeLowerPX96 sqrtStrikeLowerPX96
     * @param sqrtStrikeUpperPX96 sqrtStrikeUpperPX96
     * @param deadline the deadline,seconds
     * @param overrides overrides
     */
    removeLiquidity(
        signer: Signer,
        pairModel: PairModel,
        targetAddress: string,
        rangeModel: RangeModel,
        sqrtStrikeLowerPX96: BigNumber,
        sqrtStrikeUpperPX96: BigNumber,
        deadline: number,
        overrides?: PayableOverrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    /**
     * Batch cancel order
     * @param signer custom signer
     * @param account the account model
     * @param ordersToCancel the orders
     * @param deadline the deadline,seconds
     * @param overrides overrides
     */
    batchCancelOrder(
        signer: Signer,
        account: PairLevelAccountModel,
        ordersToCancel: OrderModel[],
        deadline: number,
        overrides?: PayableOverrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    //////////////////////////////////////////////////////////
    // Utility Api
    //////////////////////////////////////////////////////////
    /**
     * Compute instrument address
     * the instrument address is created by Create2
     * @param mType the market type
     * @param base the base token address or token info
     * @param quote the quote token address or token info
     */
    computeInstrumentAddress(mType: string, base: string | TokenInfo, quote: string | TokenInfo): Promise<string>;

    /**
     * Get order margin by leverage
     * @param instrumentAddr the instrument address
     * @param expiry the expiry
     * @param tick the tick
     * @param size the order size
     * @param leverage the leverage
     */
    getOrderMarginByLeverage(
        instrumentAddr: string,
        expiry: number,
        tick: number,
        size: BigNumber,
        leverage: number,
    ): Promise<BigNumber>;

    /**
     *Get current tick of instrument by expiry,todo can remove,depend on inquire
     * @param instrumentAddr the instrument address
     * @param expiry the expiry
     */
    getTick(instrumentAddr: string, expiry: number): Promise<number>;

    /**
     *Get current sqrt price of instrument by expiry format by px96,todo can remove,depend on inquire
     * @param instrumentAddr the instrument address
     * @param expiry the expiry
     */
    getSqrtFairPX96(instrumentAddr: string, expiry: number): Promise<BigNumber>;

    /**
     *Inquire instrument info by expiry and size
     * @param instrumentAddr the instrument address
     * @param expiry the expiry
     * @param size the order size
     */
    inquire(instrumentAddr: string, expiry: number, size: BigNumber): Promise<Quotation>;
}
