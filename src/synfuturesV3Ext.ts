import { BigNumber, Overrides, Signer, ethers } from 'ethers';
import { SynFuturesV3 } from './synfuturesV3Core';
import { ChainContext, CHAIN_ID, ERC20__factory, ADDR_BATCH_SIZE, BlockInfo } from '@derivation-tech/web3-core';
import {
    CexFeederSource,
    CexMarket,
    InstrumentIdentifier,
    MarketType,
    PriceFeeder,
    Range,
    SetChainlinkFeederParam,
} from './types';
import { batchQuery, encodeAddParam, parseTicks } from './common/util';
import { PERP_EXPIRY, NULL_DDL } from './constants';
import { ZERO, TICK_DELTA_MAX, ANY_PRICE_TICK } from './math';
import { ExtendedRange } from './subgraph';

export class SynFuturesV3Ext {
    private static instances = new Map<number, SynFuturesV3Ext>();
    core: SynFuturesV3;

    get ctx(): ChainContext {
        return this.core.ctx;
    }

    protected constructor(core: SynFuturesV3) {
        this.core = core;
    }

    public static getInstance(chanIdOrName: CHAIN_ID | string): SynFuturesV3Ext {
        const chainId = ChainContext.getChainInfo(chanIdOrName).chainId;
        let instance = SynFuturesV3Ext.instances.get(chainId);
        if (!instance) {
            const core = SynFuturesV3.getInstance(chainId);
            instance = new SynFuturesV3Ext(core);
            SynFuturesV3Ext.instances.set(chainId, instance);
        }
        return instance;
    }

    async init(): Promise<void> {
        await this.core.initInstruments();
    }

    async setCexFeeder(
        signer: Signer,
        marketType: MarketType,
        params: SetChainlinkFeederParam[],
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrumentAddress: string[] = []; // = params.map((param) => this.computeChainlinkInstrumentAddress(param.base, param.quote));
        const feeders: PriceFeeder[] = [];
        for (let i = 0; i < params.length; i++) {
            const param = params[i];
            instrumentAddress.push(await this.core.computeInstrumentAddress(marketType, param.base, param.quote));
            feeders.push({
                ftype: param.ftype,
                aggregator0: param.aggregator0,
                heartBeat0: param.heartBeat0,
                scaler0: ZERO,
                aggregator1: param.aggregator1,
                heartBeat1: param.heartBeat1,
                scaler1: ZERO,
            } as PriceFeeder);
        }
        const contract = this.core.contracts.marketContracts[marketType]?.market as CexMarket;
        const unsignedTx = await contract.populateTransaction.setFeeder(instrumentAddress, feeders, overrides ?? {});
        return this.ctx.sendTx(signer, unsignedTx);
    }
    // only admin
    async setChainlinkFeeder(
        signer: Signer,
        params: SetChainlinkFeederParam[],
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        return this.setCexFeeder(signer, MarketType.LINK, params, overrides);
    }

    // only admin
    async setEmergingFeeder(
        signer: Signer,
        params: SetChainlinkFeederParam[],
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        return this.setCexFeeder(signer, MarketType.EMG, params, overrides);
    }

    // Update Chainlink Feeder, to keep consistent with the config json.
    async syncCexFeederWithConfig(
        signer: Signer,
        marketType: MarketType,
        pairs: { baseSymbol: string; quoteSymbol: string }[],
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const feederSource = (
            marketType == MarketType.LINK
                ? this.core.config.marketConfig.LINK?.feederSource
                : this.core.config.marketConfig.EMG?.feederSource
        ) as CexFeederSource[];
        const params: SetChainlinkFeederParam[] = [];
        for (const pair of pairs) {
            const item = feederSource.find(
                (item) => item.baseSymbol === pair.baseSymbol && item.quoteSymbol === pair.quoteSymbol,
            );
            if (!item) {
                throw new Error(`no feeder source for ${pair.baseSymbol}/${pair.quoteSymbol} in config json`);
            }
            params.push({
                base: pair.baseSymbol,
                quote: pair.quoteSymbol,
                ftype: item.ftype,
                aggregator0: item.aggregator0,
                heartBeat0: item.heartBeat0,
                aggregator1: item.aggregator1,
                heartBeat1: item.heartBeat1,
            } as SetChainlinkFeederParam);
        }
        return this.setCexFeeder(signer, marketType, params, overrides ?? {});
    }

    // Update Chainlink Feeder, to keep consistent with the config json.
    async syncChainlinkFeederWithConfig(
        signer: Signer,
        pairs: { baseSymbol: string; quoteSymbol: string }[],
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        return await this.syncCexFeederWithConfig(signer, MarketType.LINK, pairs, overrides);
    }

    // Update EmergingMarket Feeder, to keep consistent with the config json.
    async syncEmergingFeederWithConfig(
        signer: Signer,
        pairs: { baseSymbol: string; quoteSymbol: string }[],
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        return await this.syncCexFeederWithConfig(signer, MarketType.EMG, pairs, overrides);
    }

    async disableLpWhitelist(
        signer: Signer,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const unsignedTx = await this.core.contracts.config.populateTransaction.disableLpWhitelist(overrides ?? {});
        return await this.ctx.sendTx(signer, unsignedTx);
    }

    async setLpWhiteList(
        signer: Signer,
        targets: string[],
        flags: boolean[],
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const unsignedTx = await this.core.contracts.config.populateTransaction.setLpWhiteList(
            targets,
            flags,
            overrides ?? {},
        );
        return await this.ctx.sendTx(signer, unsignedTx);
    }

    async addToWhitelistLps(
        signer: Signer,
        targets: string[],
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const flags = new Array<boolean>(targets.length).fill(true);
        return await this.setLpWhiteList(signer, targets, flags, overrides ?? {});
    }

    async removeFromWhitelistLps(
        signer: Signer,
        targets: string[],
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const flags = new Array<boolean>(targets.length).fill(false);
        return await this.setLpWhiteList(signer, targets, flags, overrides ?? {});
    }

    async setPendingDuration(
        signer: Signer,
        duration: BigNumber,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const tx = await this.core.contracts.gate.populateTransaction.setPendingDuration(duration, overrides ?? {});
        return await this.ctx.sendTx(signer, tx);
    }

    async setThreshold(
        signer: Signer,
        quote: string,
        threshold: BigNumber,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const tx = await this.core.contracts.gate.populateTransaction.setThreshold(quote, threshold, overrides ?? {});
        return await this.ctx.sendTx(signer, tx);
    }

    async createChainlinkInstrument(
        signer: Signer,
        param: InstrumentIdentifier,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const { quoteTokenInfo } = await this.core.getTokenInfo(param);
        const quoteAddress = quoteTokenInfo.address;
        await this.core.contracts.config.connect(signer).setLpWhiteList([await signer.getAddress()], [true]);
        const quote = ERC20__factory.connect(quoteAddress, signer);
        // should prepare enough quote token outside sdk
        // await quote.mint(await signer.getAddress(), ethers.utils.parseEther('10000000'));
        await quote.connect(signer).approve(this.core.contracts.gate.address, ethers.constants.MaxUint256);
        const instrumentAddress = await this.core.computeInstrumentAddress(
            MarketType.LINK,
            param.baseSymbol,
            param.quoteSymbol,
        );

        const data = ethers.utils.defaultAbiCoder.encode(['string', 'address'], [param.baseSymbol, quoteAddress]);
        const addParam = {
            expiry: PERP_EXPIRY,
            tickDeltaLower: 0,
            tickDeltaUpper: TICK_DELTA_MAX,
            amount: ethers.utils.parseEther('10000'),
            limitTicks: ANY_PRICE_TICK,
            deadline: NULL_DDL,
        };
        const unsignedTx = await this.core.contracts.gate
            .connect(signer)
            .populateTransaction.launch('LINK', instrumentAddress, data, encodeAddParam(addParam), overrides ?? {});
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async getRanges(
        instrumentAddr: string,
        expiry: number,
        lpAddrs?: string[],
        batchSize = ADDR_BATCH_SIZE,
    ): Promise<(ExtendedRange & { lpAddr: string })[]> {
        // get from observer
        if (lpAddrs !== undefined && lpAddrs.length > 0) {
            const instrument = this.core.instrumentMap.get(instrumentAddr.toLowerCase());
            if (!instrument) {
                throw new Error(`instrument ${instrumentAddr} not found`);
            }
            const latestBlock = await this.ctx.provider.getBlock('latest');
            const blockInfo: BlockInfo = {
                height: latestBlock.number,
                timestamp: latestBlock.timestamp,
            };
            const overrides = {
                blockTag: blockInfo.height,
            };
            // chunks lpAddrs into smaller batches according to the number of pairs
            const rangeIndexes = (
                await batchQuery(
                    this.ctx,
                    this.core.contracts.observer.interface,
                    lpAddrs.map((addr) => {
                        return {
                            target: this.core.contracts.observer.address,
                            method: 'getRangeIndexes',
                            params: [instrument.info.addr, expiry, addr],
                        };
                    }),
                    batchSize,
                    overrides,
                )
            ).map((ret) => ret[0] as BigNumber[]);
            // flat rangeIndexes from 2D to 1D while preserving lp info
            const lpRangeIndex: { lpAddr: string; rangeIndex: BigNumber }[] = [];
            rangeIndexes.forEach((group, index) => {
                group.forEach((value) => {
                    lpRangeIndex.push({
                        lpAddr: lpAddrs[index],
                        rangeIndex: value,
                    });
                });
            });
            const ranges = (
                await batchQuery(
                    this.ctx,
                    this.core.contracts.observer.interface,
                    lpRangeIndex.map((item) => {
                        return {
                            target: this.core.contracts.observer.address,
                            method: 'getRanges',
                            params: [instrument.info.addr, expiry, item.lpAddr, [item.rangeIndex]],
                        };
                    }),
                    batchSize,
                    overrides,
                )
            ).map((ret) => ret[0][0] as Range); // first return argument is Range[]

            return ranges.map((range, index) => {
                return {
                    lpAddr: lpRangeIndex[index].lpAddr,
                    liquidity: range.liquidity,
                    entryFeeIndex: range.entryFeeIndex,
                    balance: range.balance,
                    sqrtEntryPX96: range.sqrtEntryPX96,
                    instrumentAddr,
                    expiry,
                    ...parseTicks(Number(lpRangeIndex[index].rangeIndex)),
                    blockInfo,
                };
            });
        } else {
            // get from subgraph
            const rangesMap = await this.core.subgraph.getRanges({ instrumentAddr, expiry });
            const ranges = [];
            for (const [k, v] of rangesMap) {
                for (const range of v) {
                    ranges.push({
                        ...range,
                        lpAddr: k,
                    });
                }
            }
            return ranges;
        }
    }
}
