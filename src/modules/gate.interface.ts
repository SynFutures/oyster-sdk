import { BigNumber, ethers, Overrides, Signer } from 'ethers';

export interface GateInterface {
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
}
