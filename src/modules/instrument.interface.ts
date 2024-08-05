import { BigNumber, ethers, Overrides, Signer } from 'ethers';
import {
    AddParam,
    AdjustParam,
    BatchPlaceParam,
    CancelParam,
    FillParam,
    PlaceParam,
    Quotation,
    RemoveParam,
    TradeParam,
} from '../types';
import { TokenInfo } from '@derivation-tech/web3-core';

export interface InstrumentInterface {
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
        referralCode: string,
        overrides?: Overrides,
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
        referralCode: string,
        overrides?: Overrides,
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
        referralCode: string,
        overrides?: Overrides,
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
        referralCode: string,
        overrides?: Overrides,
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
        referralCode: string,
        overrides?: Overrides,
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
        referralCode: string,
        overrides?: Overrides,
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
