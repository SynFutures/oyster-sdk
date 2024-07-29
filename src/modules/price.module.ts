import { cexMarket, CexMarket, FeederType, InstrumentIdentifier, MarketType, QuoteType } from '../types';
import { BigNumber } from 'ethers';
import { calcBenchmarkPrice, getTokenInfo, getTokenSymbol } from '../common';
import { wdiv, ZERO } from '../math';
import { ZERO_ADDRESS } from '@derivation-tech/web3-core';
import { SynFuturesV3 } from '../synfuturesV3Core';

export class PriceModule {
    synfV3: SynFuturesV3;

    constructor(synfV3: SynFuturesV3) {
        this.synfV3 = synfV3;
    }

    public async inspectDexV2MarketBenchmarkPrice(
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
    ): Promise<BigNumber> {
        const { baseSymbol, quoteSymbol } = getTokenSymbol(
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        const baseParam = this.synfV3.config.quotesParam[baseSymbol];
        const quoteParam = this.synfV3.config.quotesParam[quoteSymbol];

        const baseStable = baseParam && baseParam.qtype === QuoteType.STABLE;
        const quoteStable = quoteParam && quoteParam.qtype === QuoteType.STABLE;

        const feederType: FeederType = ((baseStable ? 2 : 0) + (quoteStable ? 1 : 0)) as FeederType;

        const rawSpotPrice = await this.getDexV2RawSpotPrice(instrumentIdentifier);

        return calcBenchmarkPrice(
            expiry,
            rawSpotPrice,
            feederType,
            this.synfV3.config.marketConfig.DEXV2!.dailyInterestRate,
        );
    }

    public async inspectCexMarketBenchmarkPrice(
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
    ): Promise<BigNumber> {
        const instrumentAddress = await this.synfV3.instrumentModule.computeInstrumentAddress(
            instrumentIdentifier.marketType,
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        const market = this.synfV3.contracts.marketContracts[instrumentIdentifier.marketType]?.market as CexMarket;
        let benchmarkPrice;
        try {
            benchmarkPrice = await market.getBenchmarkPrice(instrumentAddress, expiry);
        } catch (e) {
            console.error('fetch chainlink market price error', e);
            benchmarkPrice = ZERO;
        }
        return benchmarkPrice;
    }

    async getRawSpotPrice(identifier: InstrumentIdentifier): Promise<BigNumber> {
        if (identifier.marketType === MarketType.DEXV2) {
            return this.getDexV2RawSpotPrice(identifier);
        } else if (cexMarket(identifier.marketType)) {
            return this.getCexRawSpotPrice(identifier);
        } else {
            throw new Error('Unsupported market type');
        }
    }

    async getDexV2RawSpotPrice(identifier: InstrumentIdentifier): Promise<BigNumber> {
        const { baseTokenInfo, quoteTokenInfo } = await getTokenInfo(identifier, this.synfV3.ctx);

        const baseScaler = BigNumber.from(10).pow(18 - baseTokenInfo.decimals);
        const quoteScaler = BigNumber.from(10).pow(18 - quoteTokenInfo.decimals);

        const isToken0Quote = BigNumber.from(baseTokenInfo.address).gt(BigNumber.from(quoteTokenInfo.address));

        const dexV2PairInfo = await this.synfV3.contracts.observer.inspectMaxReserveDexV2Pair(
            baseTokenInfo.address,
            quoteTokenInfo.address,
        );
        if (
            dexV2PairInfo.maxReservePair === ZERO_ADDRESS ||
            dexV2PairInfo.reserve0.isZero() ||
            dexV2PairInfo.reserve1.isZero()
        ) {
            // no liquidity
            return ZERO;
        }

        return isToken0Quote
            ? wdiv(dexV2PairInfo.reserve0.mul(quoteScaler), dexV2PairInfo.reserve1.mul(baseScaler))
            : wdiv(dexV2PairInfo.reserve1.mul(quoteScaler), dexV2PairInfo.reserve0.mul(baseScaler));
    }

    async getCexRawSpotPrice(instrumentIdentifier: InstrumentIdentifier): Promise<BigNumber> {
        const instrumentAddress = await this.synfV3.instrumentModule.computeInstrumentAddress(
            instrumentIdentifier.marketType,
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        const market = this.synfV3.contracts.marketContracts[instrumentIdentifier.marketType]?.market as CexMarket;
        let rawSpotPrice;
        try {
            rawSpotPrice = await market.getRawPrice(instrumentAddress);
        } catch (e) {
            console.error('fetch chainlink spot price error', e);
            rawSpotPrice = ZERO;
        }
        return rawSpotPrice;
    }
}
