import { BigNumber, CallOverrides, ethers, Overrides, Signer } from 'ethers';
import { BaseInterface } from '../common';

export interface GateInterface extends BaseInterface {
    /**
     *Deposit to Gate
     * @param signer custom signer
     * @param quoteAddr the quote address
     * @param amount the amount(according to the decimals of the quote address,eg: 1USDC = 1000000)
     * @param overrides overrides with ethers types
     */
    deposit(
        signer: Signer,
        quoteAddr: string,
        amount: BigNumber,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    /**
     *Withdraw from Gate
     * @param signer custom signer
     * @param quoteAddr the quote address
     * @param amount the amount(according to the decimals of the quote address,eg: 1USDC = 1000000)
     * @param overrides overrides with ethers types
     */
    withdraw(
        signer: Signer,
        quoteAddr: string,
        amount: BigNumber,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    /**
     *Gate operation,deposit or withdraw
     * @param signer custom signer
     * @param quoteAddress the quote address
     * @param amountWad the amount,decimal 18 units, always positive
     * @param deposit true:deposit false:withdraw
     */
    gateOperation(
        signer: Signer,
        quoteAddress: string,
        amountWad: BigNumber,
        deposit: boolean,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt>;

    /**
     *Get pending params
     * @param quotes the quotes address list
     * @param overrides CallOverrides with ethers
     */
    getPendingParams(
        quotes: string[],
        overrides?: CallOverrides,
    ): Promise<{ pendingDuration: BigNumber; thresholds: BigNumber[] }>;
}
