import { BigNumber, CallOverrides } from 'ethers';
import { BlockInfo, TokenInfo } from '@derivation-tech/web3-core';
import { InstrumentLevelAccountModel, InstrumentModel, PairLevelAccountModel, PairModel } from '../models';
import {
    FetchInstrumentParam,
    FundFlow,
    InstrumentIdentifier,
    Pending,
    Position,
    Quotation,
    Side,
    BaseInterface,
} from '../types';
import { InterfaceImplementationMissingError } from '../errors/interfaceImplementationMissing.error';

export interface ObserverInterface extends BaseInterface {
    /**
     *Get instrument level accounts infos
     *given single trader address, return multiple instrument level account which have been involved
     * @param target the target address
     * @param overrides overrides with ethers types
     */
    getInstrumentLevelAccounts(target: string, overrides?: CallOverrides): Promise<InstrumentLevelAccountModel[]>;

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
        useCache: boolean,
    ): Promise<PairLevelAccountModel>;

    /**
     *Get all instruments
     * @param batchSize the batch size,default value is 10
     * @param overrides overrides with ethers types
     */
    getAllInstruments(batchSize?: number, overrides?: CallOverrides): Promise<InstrumentModel[]>;

    /**
     *Fetch instrument batch by given params
     * @param params the params
     * @param overrides overrides with ethers types
     */
    fetchInstrumentBatch(params: FetchInstrumentParam[], overrides?: CallOverrides): Promise<InstrumentModel[]>;

    /**
     *Get quote token info by quote symbol and instrument
     * @param quoteSymbol the quote symbol
     * @param instrumentAddr the instrument
     */
    getQuoteTokenInfo(quoteSymbol: string, instrumentAddr: string): Promise<TokenInfo>;

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

    /**
     * Get next initialized tick outside
     * @param instrumentAddr the instrument address
     * @param expiry the expiry
     * @param tick the tick
     * @param right
     */
    getNextInitializedTickOutside(
        instrumentAddr: string,
        expiry: number,
        tick: number,
        right: boolean,
    ): Promise<number>;

    /**
     * Get trade size needed to move AMM price to target tick
     * @param instrumentAddr the instrument address
     * @param expiry the expiry
     * @param targetTick the target tick
     */
    getSizeToTargetTick(instrumentAddr: string, expiry: number, targetTick: number): Promise<BigNumber>;

    /**
     * Get fund flows
     * @param quoteAddrs the quote addresses
     * @param trader the trader address
     * @param overrides CallOverrides with ethers types
     */
    getFundFlows(
        quoteAddrs: string[],
        trader: string,
        overrides?: CallOverrides,
    ): Promise<{ fundFlows: FundFlow[]; blockInfo: BlockInfo }>;

    /**
     * Get user pendings
     * @param quotes the quote addresses
     * @param trader the trader address
     * @param overrides CallOverrides with ethers types
     */
    getUserPendings(
        quotes: string[],
        trader: string,
        overrides?: CallOverrides,
    ): Promise<{ pendings: { maxWithdrawable: BigNumber; pending: Pending }[]; blockInfo: BlockInfo }>;

    /**
     *Inquire by base
     * @param pair the pair
     * @param side the side
     * @param baseAmount the base amount
     * @param overrides CallOverrides with ethers types
     */
    inquireByBase(
        pair: PairModel,
        side: Side,
        baseAmount: BigNumber,
        overrides?: CallOverrides,
    ): Promise<{ quoteAmount: BigNumber; quotation: Quotation }>;

    /**
     *Inquire by quote
     * @param pair the pair
     * @param side the side
     * @param quoteAmount the quote amount
     * @param overrides CallOverrides with ethers types
     */
    inquireByQuote(
        pair: PairModel,
        side: Side,
        quoteAmount: BigNumber,
        overrides?: CallOverrides,
    ): Promise<{ baseAmount: BigNumber; quotation: Quotation }>;

    /**
     * Get position if settle
     * @param traderAccount the trader account
     */
    getPositionIfSettle(traderAccount: PairLevelAccountModel): Promise<Position>;

    /**
     * Estimate APY
     * @param pairModel the pair
     * @param poolFee24h the pool fee
     * @param alphaWad the alpha
     */
    estimateAPY(pairModel: PairModel, poolFee24h: BigNumber, alphaWad: BigNumber): number;
}

export function createNullObserverModule(): ObserverInterface {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const errorHandler = () => {
        throw new InterfaceImplementationMissingError('ObserverInterface', 'observer');
    };
    return {
        synfV3: null as never,
        fetchInstrumentBatch: errorHandler,
        getAllInstruments: errorHandler,
        getInstrumentLevelAccounts: errorHandler,
        getPairLevelAccount: errorHandler,
        getQuoteTokenInfo: errorHandler,
        inspectDexV2MarketBenchmarkPrice: errorHandler,
        inspectCexMarketBenchmarkPrice: errorHandler,
        getRawSpotPrice: errorHandler,
        getNextInitializedTickOutside: errorHandler,
        getSizeToTargetTick: errorHandler,
        getFundFlows: errorHandler,
        getUserPendings: errorHandler,
        inquireByBase: errorHandler,
        inquireByQuote: errorHandler,
        getPositionIfSettle: errorHandler,
        estimateAPY: errorHandler,
    };
}
