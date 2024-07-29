import { BlockInfo, TokenInfo } from '@derivation-tech/web3-core';
import { SynFuturesV3 } from '../synfuturesV3Core';
import {
    Amm,
    AssembledInstrumentData,
    cexMarket,
    DexV2Feeder,
    FetchInstrumentParam,
    Instrument,
    Instrument__factory,
    InstrumentCondition,
    InstrumentInfo,
    InstrumentMarket,
    MarketConfig,
    MarketInfo,
    MarketType,
    PriceFeeder,
    Quotation,
    QuoteParam,
} from '../types';
import { InstrumentParser } from '../common';
import { getTokenSymbol, normalizeTick, trimObj } from '../common';
import { BigNumber, CallOverrides, ethers, Signer } from 'ethers';
import { InstrumentModel, InstrumentState } from '../models';
import { SdkError } from '../errors/sdk.error';
import { Provider } from '@ethersproject/providers';
import { TickMath } from '../math';
import { PEARL_SPACING } from '../constants';

export class InstrumentModule {
    synfV3: SynFuturesV3;
    // quote symbol => quote token info
    quoteSymbolToInfo: Map<string, TokenInfo> = new Map();

    constructor(synfV3: SynFuturesV3) {
        this.synfV3 = synfV3;
    }

    async initInstruments(symbolToInfo?: Map<string, TokenInfo>): Promise<InstrumentModel[]> {
        this.quoteSymbolToInfo = symbolToInfo ?? new Map();
        for (const [, info] of this.quoteSymbolToInfo) {
            this.synfV3.registerQuoteInfo(info);
        }
        const list = await this.getAllInstruments();

        for (const instrument of list) {
            this.synfV3.cacheModule.instrumentMap.set(instrument.info.addr.toLowerCase(), instrument);
            this.synfV3.ctx.registerAddress(instrument.info.addr, instrument.info.symbol);
            this.synfV3.ctx.registerContractParser(instrument.info.addr, new InstrumentParser());
        }
        return list;
    }

    // first try to find in cache, if not found, then fetch from chain
    async getInstrumentInfo(instrumentAddress: string): Promise<InstrumentInfo> {
        if (!this.synfV3.cacheModule.instrumentMap.has(instrumentAddress.toLowerCase())) {
            await this.initInstruments();
        }
        const instrument = this.synfV3.cacheModule.instrumentMap.get(instrumentAddress.toLowerCase());
        if (!instrument) {
            throw new Error(`Invalid instrument`);
        }
        return instrument.info;
    }

    async getAllInstruments(batchSize = 10, overrides?: CallOverrides): Promise<InstrumentModel[]> {
        const instrumentLists = await this.synfV3.contracts.gate.getAllInstruments(overrides ?? {});
        let instrumentModels: InstrumentModel[] = [];
        const totalPage = Math.ceil(instrumentLists.length / batchSize);

        for (let i = 0; i < totalPage; i++) {
            const queryList = instrumentLists.slice(
                i * batchSize,
                (i + 1) * batchSize >= instrumentLists.length ? instrumentLists.length : (i + 1) * batchSize,
            );
            const [rawList, rawBlockInfo] = trimObj(
                await this.synfV3.contracts.observer.getInstrumentByAddressList(queryList, overrides ?? {}),
            );
            instrumentModels = instrumentModels.concat(await this.parseInstrumentData(rawList, rawBlockInfo));
        }

        return instrumentModels;
    }

    async fetchInstrumentBatch(params: FetchInstrumentParam[], overrides?: CallOverrides): Promise<InstrumentModel[]> {
        const [rawList, rawBlockInfo] = trimObj(
            await this.synfV3.contracts.observer.getInstrumentBatch(params, overrides ?? {}),
        );
        return this.parseInstrumentData(rawList, rawBlockInfo);
    }

    async parseInstrumentData(rawList: AssembledInstrumentData[], blockInfo: BlockInfo): Promise<InstrumentModel[]> {
        const instrumentModels: InstrumentModel[] = [];
        for (const rawInstrument of rawList) {
            const [baseSymbol, quoteSymbol, marketType] = rawInstrument.symbol.split('-');
            const quoteTokenInfo = await this.getQuoteTokenInfo(quoteSymbol, rawInstrument.instrumentAddr);
            let baseInfo: TokenInfo = { symbol: baseSymbol, address: ethers.constants.AddressZero, decimals: 0 };
            if (!cexMarket(marketType as MarketType)) {
                // fetch base token info from ctx
                const onCtxBaseInfo = await this.synfV3.ctx.getTokenInfo(baseSymbol);
                if (onCtxBaseInfo) {
                    baseInfo = onCtxBaseInfo;
                }
            }
            const instrumentInfo: InstrumentInfo = {
                addr: rawInstrument.instrumentAddr,
                symbol: rawInstrument.symbol,
                base: baseInfo,
                quote: quoteTokenInfo,
            };
            const marketInfo: MarketInfo = {
                addr: rawInstrument.market,
                type: marketType,
                beacon: this.synfV3.config.contractAddress.market[marketType as MarketType]!.beacon,
            };
            const marketConfig: MarketConfig = this.synfV3.config.marketConfig[marketType as MarketType]!;
            const feeder = cexMarket(marketType as MarketType)
                ? (rawInstrument.priceFeeder as PriceFeeder)
                : (rawInstrument.dexV2Feeder as DexV2Feeder);
            // we assume that marketConfig is not null
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const market: InstrumentMarket = { info: marketInfo, config: marketConfig, feeder: feeder };
            const param: QuoteParam = rawInstrument.param;
            const instrumentState: InstrumentState = new InstrumentState(
                rawInstrument.condition as InstrumentCondition,
                rawInstrument.initialMarginRatio,
                rawInstrument.maintenanceMarginRatio,
                param,
                blockInfo,
            );

            const instrumentModel = new InstrumentModel(
                instrumentInfo,
                market,
                instrumentState,
                rawInstrument.spotPrice,
            );
            for (let i = 0; i < rawInstrument.amms.length; i++) {
                const rawAmm = rawInstrument.amms[i];
                if (rawAmm.expiry === 0) {
                    continue;
                }
                instrumentModel.updatePair(rawAmm as Amm, rawInstrument.markPrices[i], blockInfo);
            }
            this.synfV3.ctx.registerAddress(instrumentInfo.addr, instrumentInfo.symbol);
            this.synfV3.ctx.registerContractParser(instrumentInfo.addr, new InstrumentParser());
            instrumentModels.push(instrumentModel);
        }
        return instrumentModels;
    }

    /// will update all expiries when params.expiry.length is 0
    public async updateInstrument(
        params: FetchInstrumentParam[],
        overrides?: CallOverrides,
    ): Promise<InstrumentModel[]> {
        const instrumentModels = await this.fetchInstrumentBatch(params, overrides);
        this.updateInstrumentCache(instrumentModels);
        return instrumentModels;
    }

    /// @dev only for internal use, update instrumentMap with params
    public updateInstrumentCache(instrumentModels: InstrumentModel[]): void {
        for (let i = 0; i < instrumentModels.length; ++i) {
            const instrument = instrumentModels[i].info.addr.toLowerCase();
            const oldModel = this.synfV3.cacheModule.instrumentMap.get(instrument);
            if (oldModel) {
                oldModel.updateInstrumentState(instrumentModels[i].state, instrumentModels[i].spotPrice);
                for (const pair of instrumentModels[i].state.pairStates.values()) {
                    oldModel.updatePair(pair.amm, instrumentModels[i].getMarkPrice(pair.amm.expiry), pair.blockInfo);
                }
            } else {
                this.synfV3.cacheModule.instrumentMap.set(instrument, instrumentModels[i]);
            }
        }
    }

    async computeInstrumentAddress(
        mType: string,
        base: string | TokenInfo,
        quote: string | TokenInfo,
    ): Promise<string> {
        const gateAddress = this.synfV3.config.contractAddress.gate;
        const marketType = mType as MarketType;
        const beaconAddress = this.synfV3.config.contractAddress.market[marketType]!.beacon;
        const instrumentProxyByteCode = this.synfV3.config.instrumentProxyByteCode;
        let salt: string;

        const { baseSymbol, quoteSymbol } = getTokenSymbol(base, quote);
        let quoteAddress: string;
        try {
            quoteAddress =
                typeof quote !== 'string'
                    ? (quote as TokenInfo).address
                    : await this.synfV3.ctx.getAddress(quoteSymbol);
        } catch {
            //todo beore fetch from graph
            throw new SdkError('Get quote address failed');
        }
        if (cexMarket(marketType)) {
            salt = ethers.utils.defaultAbiCoder.encode(
                ['string', 'string', 'address'],
                [marketType, baseSymbol, quoteAddress],
            );
        } else {
            //DEXV2
            const baseAddress =
                typeof base !== 'string' ? (base as TokenInfo).address : await this.synfV3.ctx.getAddress(baseSymbol);
            salt = ethers.utils.defaultAbiCoder.encode(
                ['string', 'address', 'address'],
                [marketType, baseAddress, quoteAddress],
            );
        }

        return ethers.utils.getCreate2Address(
            gateAddress,
            ethers.utils.keccak256(salt),
            ethers.utils.keccak256(
                ethers.utils.solidityPack(
                    ['bytes', 'bytes32'],
                    [instrumentProxyByteCode, ethers.utils.hexZeroPad(beaconAddress, 32)],
                ),
            ),
        );
    }

    getInstrumentContract(address: string, signerOrProvider?: Signer | Provider): Instrument {
        return Instrument__factory.connect(address, signerOrProvider ?? this.synfV3.ctx.provider);
    }

    // leverage is wad, margin is wad
    async getOrderMarginByLeverage(
        instrumentAddr: string,
        expiry: number,
        tick: number,
        size: BigNumber,
        leverage: number,
    ): Promise<BigNumber> {
        const limit = TickMath.getWadAtTick(tick);
        const instrument = this.getInstrumentContract(instrumentAddr);
        const swapInfo = await instrument.callStatic.inquire(expiry, 0);
        const mark = swapInfo.mark;
        const anchor = mark.gt(limit) ? mark : limit;
        return anchor.mul(size.abs()).div(ethers.utils.parseEther(leverage.toString())).add(1);
    }

    async getTick(instrumentAddr: string, expiry: number): Promise<number> {
        const swapInfo = await this.getInstrumentContract(instrumentAddr).callStatic.inquire(expiry, 0);
        return normalizeTick(swapInfo.tick, PEARL_SPACING);
    }

    async getSqrtFairPX96(instrumentAddr: string, expiry: number): Promise<BigNumber> {
        const swapInfo = await this.getInstrumentContract(instrumentAddr).callStatic.inquire(expiry, 0);
        return swapInfo.sqrtFairPX96;
    }

    async inquire(instrumentAddr: string, expiry: number, size: BigNumber): Promise<Quotation> {
        const instrument = this.getInstrumentContract(instrumentAddr);
        return trimObj(await instrument.callStatic.inquire(expiry, size));
    }

    async getQuoteTokenInfo(quoteSymbol: string, instrumentAddr: string): Promise<TokenInfo> {
        return (
            this.quoteSymbolToInfo.get(quoteSymbol) ??
            (await this.synfV3.ctx.getTokenInfo(quoteSymbol)) ??
            (await this.synfV3.ctx.getTokenInfo(
                (
                    await this.synfV3.contracts.observer.getSetting(instrumentAddr)
                ).quote,
            ))
        );
    }
}
