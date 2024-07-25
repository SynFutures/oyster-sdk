/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    ConfigManager,
    ContractAddress,
    FeederFactoryContracts,
    MarketContracts,
    SynfConfig,
    SynFuturesV3Contracts,
} from './config';
import { BigNumber, CallOverrides, Overrides, PayableOverrides, Signer, ethers } from 'ethers';
import { Provider } from '@ethersproject/providers';
import { BlockInfo, CHAIN_ID, ContractParser, ZERO_ADDRESS } from '@derivation-tech/web3-core';
import {
    Instrument__factory,
    Observer__factory,
    DexV2Market__factory,
    Instrument,
    Config__factory,
    Gate__factory,
    CexMarket__factory,
    Beacon__factory,
    CexMarket,
    Guardian__factory,
    PythFeederFactory__factory,
    EmergingFeederFactory__factory,
} from './types/typechain';
import { ChainContext } from '@derivation-tech/web3-core';
import {
    alphaWadToTickDelta,
    calcBenchmarkPrice,
    encodeRemoveParam,
    encodeFillParam,
    encodeCancelParam,
    encodeDepositParam,
    encodeWithdrawParam,
    fromWad,
    normalizeTick,
    trimObj,
    encodeTradeWithReferralParam,
    encodeAddWithReferralParam,
    encodePlaceWithReferralParam,
    encodeAdjustWithReferralParam,
    encodeTradeWithRiskParam,
    encodeBatchPlaceWithReferralParam,
} from './common/util';
import {
    AddParam,
    AdjustParam,
    Amm,
    CancelParam,
    InstrumentIdentifier,
    FillParam,
    LiquidateParam,
    PlaceParam,
    PairModel,
    RemoveParam,
    SweepParam,
    TradeParam,
    PairLevelAccountModel,
    Quotation,
    NumericConverter,
    PositionModel,
    OrderModel,
    entryDelta,
    RangeModel,
    combine,
    TokenInfo,
    EMPTY_POSITION,
    Position,
    rangeToPosition,
    cancelOrderToPosition,
    fillOrderToPosition,
    BatchPlaceParam,
} from './types';
import { calcMaxWithdrawable, TickMath, wdiv, wmul, ZERO } from './math';
import {
    BatchOrderSizeDistribution,
    cexMarket,
    FeederType,
    MarketType,
    QuoteType,
    Side,
    signOfSide,
} from './types/enum';
import {
    DEFAULT_REFERRAL_CODE,
    MAX_CANCEL_ORDER_COUNT,
    NATIVE_TOKEN_ADDRESS,
    PEARL_SPACING,
    RANGE_SPACING,
    RATIO_BASE,
} from './constants';
import {
    CexMarketParser,
    ConfigParser,
    DexV2MarketParser,
    GateParser,
    GuardianParser,
    InstrumentParser,
} from './common/parser';
import { FundFlow, Pending } from './types/gate';
import { updateFundingIndex } from './math/funding';
import { SdkError } from './errors/sdk.error';
import { CacheModule } from './modules/cache.module';
import { InstrumentModule } from './modules/instrument.module';
import { AccountModule } from './modules/account.module';
import { SimulateModule } from './modules/simulate.module';

export class SynFuturesV3 {
    private static instances = new Map<number, SynFuturesV3>();
    ctx: ChainContext;
    config!: SynfConfig;
    // this is not initialized in constructor, but in _init().
    contracts!: SynFuturesV3Contracts;
    // quote symbol => quote token info
    quoteSymbolToInfo: Map<string, TokenInfo> = new Map();

    cacheModule!: CacheModule;
    instrumentModule!: InstrumentModule;
    accountModule!: AccountModule;
    simulateModule!: SimulateModule;

    protected constructor(ctx: ChainContext) {
        this.ctx = ctx;
        this._initModules();
    }

    public static getInstance(chanIdOrName: CHAIN_ID | string): SynFuturesV3 {
        const chainId = ChainContext.getChainInfo(chanIdOrName).chainId;
        let instance = SynFuturesV3.instances.get(chainId);
        if (!instance) {
            const ctx = ChainContext.getInstance(chainId);
            instance = new SynFuturesV3(ctx);
            instance._init(ConfigManager.getSynfConfig(chainId));
        }
        return instance;
    }

    private _initModules(): void {
        this.cacheModule = new CacheModule(this);
        this.instrumentModule = new InstrumentModule(this);
        this.accountModule = new AccountModule(this);
        this.simulateModule = new SimulateModule(this);
    }

    private _init(config: SynfConfig): void {
        this.config = config;

        const provider = this.ctx.provider;
        if (provider) {
            this._initContracts(provider, config.contractAddress);
        }

        const contractAddress = this.config.contractAddress;
        this.ctx.registerAddress(contractAddress.gate, 'Gate');
        this.ctx.registerAddress(contractAddress.observer, 'Observer');
        this.ctx.registerAddress(contractAddress.config, 'Config');
        this.ctx.registerContractParser(contractAddress.gate, new GateParser(this.ctx));
        this.ctx.registerContractParser(contractAddress.config, new ConfigParser());
        if (contractAddress.guardian) {
            this.ctx.registerAddress(contractAddress.guardian, 'Guardian');
            this.ctx.registerContractParser(contractAddress.guardian, new GuardianParser());
        }

        for (const marketType in contractAddress.market) {
            const marketAddress = contractAddress.market[marketType as MarketType]!;
            this.ctx.registerAddress(marketAddress.market, `${marketType}-Market`);
            this.ctx.registerAddress(marketAddress.beacon, `${marketType}-InstrumentBeacon`);
            if (cexMarket(marketType as MarketType)) {
                this.ctx.registerContractParser(marketAddress.market, new CexMarketParser());
            } else {
                this.ctx.registerContractParser(marketAddress.market, new DexV2MarketParser());
            }
        }
        for (const marketType in contractAddress.feederFactory) {
            const feederFactoryAddress = contractAddress.feederFactory[marketType as MarketType]!;
            if (feederFactoryAddress.factory !== '' && feederFactoryAddress.beacon !== '') {
                this.ctx.registerAddress(feederFactoryAddress.factory, `${marketType}-FeederFactory`);
                this.ctx.registerAddress(feederFactoryAddress.beacon, `${marketType}-FeederBeacon`);
                if (marketType === MarketType.PYTH) {
                    this.ctx.registerContractParser(
                        feederFactoryAddress.factory,
                        new ContractParser(PythFeederFactory__factory.createInterface()),
                    );
                } else if (marketType === MarketType.EMG) {
                    this.ctx.registerContractParser(
                        feederFactoryAddress.factory,
                        new ContractParser(EmergingFeederFactory__factory.createInterface()),
                    );
                }
            }
        }
        if (this.config.tokenInfo) {
            for (const token of this.config.tokenInfo) {
                this.registerQuoteInfo(token);
            }
        }
    }

    private _initContracts(provider: Provider, contractAddress: ContractAddress): void {
        // At present, beacon for chainlink instrument and dexV2 instrument are the same contract (in InstrumentBeacon.sol).
        const marketContracts: { [key in MarketType]?: MarketContracts } = {};
        for (const marketType in contractAddress.market) {
            const mType = marketType as MarketType;
            const marketAddress = contractAddress.market[mType]!;
            marketContracts[mType] = {
                market: cexMarket(mType)
                    ? CexMarket__factory.connect(marketAddress.market, provider)
                    : DexV2Market__factory.connect(marketAddress.market, provider),
                beacon: Beacon__factory.connect(marketAddress.beacon, provider),
            };
        }
        const feederFactoryContracts: { [key in MarketType]?: FeederFactoryContracts } = {};
        for (const marketType in contractAddress.feederFactory) {
            const mType = marketType as MarketType;
            const feederFactoryAddress = contractAddress.feederFactory[mType]!;
            if (feederFactoryAddress.factory !== '' && feederFactoryAddress.beacon !== '') {
                if (mType === MarketType.PYTH) {
                    feederFactoryContracts[mType] = {
                        factory: PythFeederFactory__factory.connect(feederFactoryAddress.factory, provider),
                        beacon: Beacon__factory.connect(feederFactoryAddress.beacon, provider),
                    };
                } else if (mType === MarketType.EMG) {
                    feederFactoryContracts[mType] = {
                        factory: EmergingFeederFactory__factory.connect(feederFactoryAddress.factory, provider),
                        beacon: Beacon__factory.connect(feederFactoryAddress.beacon, provider),
                    };
                } else {
                    throw new Error(`Invalid market type ${mType}`);
                }
            }
        }

        this.contracts = {
            gate: Gate__factory.connect(contractAddress.gate, provider),
            observer: Observer__factory.connect(contractAddress.observer, provider),
            config: Config__factory.connect(contractAddress.config, provider),
            guardian: contractAddress.guardian
                ? Guardian__factory.connect(contractAddress.guardian, provider)
                : undefined,
            marketContracts: marketContracts,
            feederFactoryContracts: feederFactoryContracts,
        };
    }

    public setProvider(provider: Provider, isOpSdkCompatible = false): void {
        if (!isOpSdkCompatible) this.ctx.info.isOpSdkCompatible = false;
        this.ctx.setProvider(provider);
        this._initContracts(provider, this.config.contractAddress);
    }

    async computeInitData(instrumentIdentifier: InstrumentIdentifier): Promise<string> {
        const { baseTokenInfo, quoteTokenInfo } = await this.getTokenInfo(instrumentIdentifier);

        const quoteAddress = quoteTokenInfo.address;

        let data;
        if (cexMarket(instrumentIdentifier.marketType)) {
            const baseSymbol =
                typeof instrumentIdentifier.baseSymbol === 'string'
                    ? instrumentIdentifier.baseSymbol
                    : instrumentIdentifier.baseSymbol.symbol;

            data = ethers.utils.defaultAbiCoder.encode(['string', 'address'], [baseSymbol, quoteAddress]);
        } else {
            data = ethers.utils.defaultAbiCoder.encode(['address', 'address'], [baseTokenInfo.address, quoteAddress]);
        }
        return data;
    }

    async computeInstrumentAddress(
        mType: string,
        base: string | TokenInfo,
        quote: string | TokenInfo,
    ): Promise<string> {
        const gateAddress = this.config.contractAddress.gate;
        const marketType = mType as MarketType;
        const beaconAddress = this.config.contractAddress.market[marketType]!.beacon;
        const instrumentProxyByteCode = this.config.instrumentProxyByteCode;
        let salt: string;

        const { baseSymbol, quoteSymbol } = this.getTokenSymbol(base, quote);
        let quoteAddress: string;
        try {
            quoteAddress =
                typeof quote !== 'string' ? (quote as TokenInfo).address : await this.ctx.getAddress(quoteSymbol);
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
                typeof base !== 'string' ? (base as TokenInfo).address : await this.ctx.getAddress(baseSymbol);
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

    async init(): Promise<void> {
        const list = await this.instrumentModule.initInstruments();
        await this.cacheModule.initGateState(list);
        await this.cacheModule.updateConfigState();
    }

    public getLastestFundingIndex(
        amm: Amm,
        markPrice: BigNumber,
        timestamp: number,
    ): { longFundingIndex: BigNumber; shortFundingIndex: BigNumber } {
        return updateFundingIndex(amm, markPrice, timestamp);
    }

    getInstrumentContract(address: string, signerOrProvider?: Signer | Provider): Instrument {
        return Instrument__factory.connect(address, signerOrProvider ?? this.ctx.provider);
    }

    async getNextInitializedTickOutside(
        instrumentAddr: string,
        expiry: number,
        tick: number,
        right: boolean,
    ): Promise<number> {
        const observer = this.contracts.observer;
        return await TickMath.getNextInitializedTickOutside(observer, instrumentAddr, expiry, tick, right);
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

    // trade size needed to move AMM price to target tick
    async getSizeToTargetTick(instrumentAddr: string, expiry: number, targetTick: number): Promise<BigNumber> {
        const observer = this.contracts.observer;
        return await TickMath.getSizeToTargetTick(observer, instrumentAddr, expiry, targetTick);
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

    async openLp(quoteAddr?: string, overrides?: CallOverrides): Promise<boolean> {
        if ((this.ctx.chainId === CHAIN_ID.BASE || this.ctx.chainId === CHAIN_ID.LOCAL) && quoteAddr) {
            try {
                const restricted = await this.contracts.config.restrictLp(quoteAddr, overrides ?? {});
                return !restricted;
            } catch (e) {
                // ignore error since the contract on some network may not have this function
            }
        }
        return this.contracts.config.openLp(overrides ?? {});
    }

    async inWhiteListLps(quoteAddr: string, traders: string[], overrides?: CallOverrides): Promise<boolean[]> {
        let calls = [];
        let results: boolean[] = [];
        let configInterface: ethers.utils.Interface = this.contracts.config.interface;
        if ((this.ctx.chainId === CHAIN_ID.BASE || this.ctx.chainId === CHAIN_ID.LOCAL) && quoteAddr) {
            for (const trader of traders) {
                calls.push({
                    target: this.contracts.config.address,
                    callData: configInterface.encodeFunctionData('lpWhitelist', [quoteAddr, trader]),
                });
            }
            try {
                const rawData = await this.ctx.multicall3.callStatic.aggregate(calls, overrides ?? {});
                for (const data of rawData.returnData) {
                    results.push(configInterface.decodeFunctionResult('lpWhitelist', data)[0]);
                }
                return results;
            } catch (e) {
                // ignore error since the contract on some network may not have this function
            }
        }
        // legacy function for other networks
        calls = [];
        results = [];
        configInterface = new ethers.utils.Interface([
            'function lpWhitelist(address user) external view returns (bool)',
        ]);

        for (const trader of traders) {
            calls.push({
                target: this.contracts.config.address,
                callData: configInterface.encodeFunctionData('lpWhitelist', [trader]),
            });
        }
        const rawData = await this.ctx.multicall3.callStatic.aggregate(calls, overrides ?? {});
        for (const data of rawData.returnData) {
            results.push(configInterface.decodeFunctionResult('lpWhitelist', data)[0]);
        }
        return results;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////
    // interaction with contracts
    ////////////////////////////////////////////////////////////////////////////////////////////
    async deposit(
        signer: Signer,
        quoteAddr: string,
        amount: BigNumber,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const unsignedTx = await this.contracts.gate.populateTransaction.deposit(
            encodeDepositParam(quoteAddr, amount),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async withdraw(
        signer: Signer,
        quoteAddr: string,
        amount: BigNumber,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const unsignedTx = await this.contracts.gate.populateTransaction.withdraw(
            encodeWithdrawParam(quoteAddr, amount),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async adjust(
        signer: Signer,
        instrumentAddr: string,
        param: AdjustParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.trade(
            encodeAdjustWithReferralParam(param.expiry, param.net, param.deadline, referralCode),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async add(
        signer: Signer,
        instrumentAddr: string,
        param: AddParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.add(
            encodeAddWithReferralParam(param, referralCode),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async remove(
        signer: Signer,
        instrumentAddr: string,
        param: RemoveParam,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.remove(encodeRemoveParam(param), overrides ?? {});
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async trade(
        signer: Signer,
        instrumentAddr: string,
        param: TradeParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.trade(
            encodeTradeWithReferralParam(
                param.expiry,
                param.size,
                param.amount,
                param.limitTick,
                param.deadline,
                referralCode,
            ),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    // WARNING: this function is not recommended to use, because it may cause penalty fee during trade
    async tradeWithRisk(
        signer: Signer,
        instrumentAddr: string,
        param: TradeParam,
        limitStabilityFeeRatio: number,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.trade(
            encodeTradeWithRiskParam(
                param.expiry,
                param.size,
                param.amount,
                param.limitTick,
                param.deadline,
                limitStabilityFeeRatio,
                referralCode,
            ),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async place(
        signer: Signer,
        instrumentAddr: string,
        param: PlaceParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.place(
            encodePlaceWithReferralParam(
                param.expiry,
                param.size,
                param.amount,
                param.tick,
                param.deadline,
                referralCode,
            ),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async batchPlace(
        signer: Signer,
        instrumentAddr: string,
        params: BatchPlaceParam,
        overrides?: Overrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.batchPlace(
            encodeBatchPlaceWithReferralParam(
                params.expiry,
                params.size,
                params.leverage,
                params.ticks,
                params.ratios,
                params.deadline,
                referralCode,
            ),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async fill(
        signer: Signer,
        instrumentAddr: string,
        param: FillParam,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.fill(
            encodeFillParam(param.expiry, param.target, param.tick, param.nonce),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async cancel(
        signer: Signer,
        instrumentAddr: string,
        param: CancelParam,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.cancel(
            encodeCancelParam(param.expiry, [param.tick], param.deadline),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async sweep(
        signer: Signer,
        instrumentAddr: string,
        param: SweepParam,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.sweep(
            param.expiry,
            param.target,
            param.size,
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async liquidate(
        signer: Signer,
        instrumentAddr: string,
        param: LiquidateParam,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.liquidate(
            param.expiry,
            param.target,
            param.size,
            param.amount,
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async update(
        signer: Signer,
        instrumentAddr: string,
        expiry: number,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.update(expiry, overrides ?? {});
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async settle(
        signer: Signer,
        instrumentAddr: string,
        expiry: number,
        target: string,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.settle(expiry, target, overrides ?? {});
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async donateInsuranceFund(
        signer: Signer,
        instrumentAddr: string,
        expiry: number,
        amount: BigNumber,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.donateInsuranceFund(expiry, amount, overrides ?? {});
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async claimProtocolFee(
        signer: Signer,
        instrumentAddr: string,
        expiry: number,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(instrumentAddr, signer);
        const unsignedTx = await instrument.populateTransaction.claimProtocolFee(expiry, overrides ?? {});
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async release(
        signer: Signer,
        quote: string,
        trader: string,
        overrides?: Overrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const unsignedTx = await this.contracts.gate.populateTransaction.release(quote, trader, overrides ?? {});
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async getPendingParams(
        quotes: string[],
        overrides?: CallOverrides,
    ): Promise<{ pendingDuration: BigNumber; thresholds: BigNumber[] }> {
        const gateInterface = this.contracts.gate.interface;
        const calls = quotes.map((quote) => {
            return {
                target: this.contracts.gate.address,
                callData: gateInterface.encodeFunctionData('thresholdOf', [quote]),
            };
        });
        calls.push({
            target: this.contracts.gate.address,
            callData: gateInterface.encodeFunctionData('pendingDuration'),
        });
        const rawRet = (await this.ctx.getMulticall3().callStatic.aggregate(calls, overrides ?? {})).returnData;
        const thresholds = rawRet
            .slice(0, quotes.length)
            .map((ret) => gateInterface.decodeFunctionResult('thresholdOf', ret)[0] as BigNumber);
        const pendingDuration = gateInterface.decodeFunctionResult(
            'pendingDuration',
            rawRet[quotes.length],
        )[0] as BigNumber;
        return { pendingDuration, thresholds };
    }

    async getFundFlows(
        quoteAddrs: string[],
        trader: string,
        overrides?: CallOverrides,
    ): Promise<{ fundFlows: FundFlow[]; blockInfo: BlockInfo }> {
        const gateInterface = this.contracts.gate.interface;
        const observerInterface = this.contracts.observer.interface;

        const calls: { target: string; callData: string }[] = [];

        calls.push(
            ...quoteAddrs.map((quote) => {
                return {
                    target: this.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('fundFlowOf', [quote, trader]),
                };
            }),
        );
        // just to get the block info
        calls.push({
            target: this.contracts.observer.address,
            callData: observerInterface.encodeFunctionData('getVaultBalances', [trader, quoteAddrs]),
        });
        const rawRet = (await this.ctx.getMulticall3().callStatic.aggregate(calls, overrides ?? {})).returnData;
        const fundFlows = rawRet.slice(0, quoteAddrs.length).map((ret) => {
            return trimObj(gateInterface.decodeFunctionResult('fundFlowOf', ret)[0]) as FundFlow;
        });
        const blockInfo = trimObj(
            observerInterface.decodeFunctionResult('getVaultBalances', rawRet[quoteAddrs.length])[1],
        );
        return { fundFlows, blockInfo: blockInfo as BlockInfo };
    }

    async getUserPendings(
        quotes: string[],
        trader: string,
        overrides?: CallOverrides,
    ): Promise<{ pendings: { maxWithdrawable: BigNumber; pending: Pending }[]; blockInfo: BlockInfo }> {
        const gateInterface = this.contracts.gate.interface;
        const observerInterface = this.contracts.observer.interface;
        const calls: { target: string; callData: string }[] = [];
        calls.push(
            ...quotes.map((quote) => {
                return {
                    target: this.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('fundFlowOf', [quote, trader]),
                };
            }),
        );
        calls.push(
            ...quotes.map((quote) => {
                return {
                    target: this.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('thresholdOf', [quote]),
                };
            }),
        );
        calls.push(
            ...quotes.map((quote) => {
                return {
                    target: this.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('reserveOf', [quote, trader]),
                };
            }),
        );
        calls.push({
            target: this.contracts.observer.address,
            callData: observerInterface.encodeFunctionData('getPendings', [quotes, trader]),
        });
        const rawRet = (await this.ctx.getMulticall3().callStatic.aggregate(calls, overrides ?? {})).returnData;
        const fundFlows = rawRet
            .slice(0, quotes.length)
            .map((ret) => gateInterface.decodeFunctionResult('fundFlowOf', ret)[0] as FundFlow);
        const thresholds = rawRet
            .slice(quotes.length, quotes.length * 2)
            .map((ret) => gateInterface.decodeFunctionResult('thresholdOf', ret)[0] as BigNumber);
        const reserves = rawRet
            .slice(quotes.length * 2, quotes.length * 3)
            .map((ret) => gateInterface.decodeFunctionResult('reserveOf', ret)[0] as BigNumber);
        const decoded = observerInterface.decodeFunctionResult('getPendings', rawRet[quotes.length * 3]);
        const pendings = decoded[0] as Pending[];
        const blockInfo = trimObj(decoded[1]) as BlockInfo;
        return {
            pendings: pendings.map((pending, index) => {
                return {
                    maxWithdrawable: calcMaxWithdrawable(thresholds[index], pending, fundFlows[index], reserves[index]),
                    pending,
                };
            }),
            blockInfo,
        };
    }

    //////////////////////////////////////////////////////////
    // Trade inquire
    //////////////////////////////////////////////////////////
    public async inquireByBase(
        pair: PairModel,
        side: Side,
        baseAmount: BigNumber,
        overrides?: CallOverrides,
    ): Promise<{ quoteAmount: BigNumber; quotation: Quotation }> {
        const instrument = this.getInstrumentContract(pair.rootInstrument.info.addr, this.ctx.provider);
        const expiry = pair.amm.expiry;
        const sign = signOfSide(side);
        const size = baseAmount.mul(sign);
        const quotation = await instrument.inquire(expiry, size, overrides ?? {});
        const entryNotional = quotation.entryNotional;
        return {
            quoteAmount: entryNotional,
            quotation: quotation,
        };
    }

    public async inquireByQuote(
        pair: PairModel,
        side: Side,
        quoteAmount: BigNumber,
        overrides?: CallOverrides,
    ): Promise<{ baseAmount: BigNumber; quotation: Quotation }> {
        const expiry = pair.amm.expiry;
        const long = side === Side.LONG;
        const { size, quotation } = await this.contracts.observer.inquireByNotional(
            pair.rootInstrument.info.addr,
            expiry,
            quoteAmount,
            long,
            overrides ?? {},
        );
        return {
            baseAmount: size.abs(),
            quotation: quotation,
        };
    }

    // @param transferAmount: decimal 18 units, always positive
    // @param transferIn: true if in, false if out
    // @return leverageWad: decimal 18 units
    public inquireLeverageFromTransferAmount(
        position: PositionModel,
        transferIn: boolean,
        transferAmount: BigNumber,
    ): BigNumber {
        const sign: number = transferIn ? 1 : -1;
        const value = wmul(position.rootPair.markPrice, position.size.abs());
        const oldEquity = position.getEquity();
        const Amount = transferAmount.mul(sign);
        const newEquity = oldEquity.add(Amount);
        // leverage is 18 decimal
        return wdiv(value, newEquity);
    }

    // @param targetLeverage: decimal 18 units
    // @return transferAmount: decimal 18 units, positive means transferIn, negative means transferOut
    public inquireTransferAmountFromTargetLeverage(position: PositionModel, targetLeverage: BigNumber): BigNumber {
        const value = wmul(position.rootPair.markPrice, position.size.abs());
        const targetEquity = wdiv(value, targetLeverage);
        const currentEquity = position.getEquity();
        const transferAmount = targetEquity.sub(currentEquity);
        return transferAmount;
    }

    // given size distribution, return the ratios for batch orders
    getBatchOrderRatios(sizeDistribution: BatchOrderSizeDistribution, orderCount: number): number[] {
        let ratios: number[] = [];
        switch (sizeDistribution) {
            case BatchOrderSizeDistribution.FLAT: {
                ratios = Array(orderCount).fill(Math.floor(RATIO_BASE / orderCount));
                break;
            }
            case BatchOrderSizeDistribution.UPPER: {
                // first order is 1, second order is 2, ..., last order is orderCount pieces
                const sum = Array.from({ length: orderCount }, (_, i) => i + 1).reduce((acc, i) => acc + i, 0);
                ratios = Array.from({ length: orderCount }, (_, i) => Math.floor((i + 1) * (RATIO_BASE / sum)));
                break;
            }
            case BatchOrderSizeDistribution.LOWER: {
                // first order is orderCount, second order is orderCount - 1, ..., last order is 1 piece
                const sum = Array.from({ length: orderCount }, (_, i) => orderCount - i).reduce((acc, i) => acc + i, 0);
                ratios = Array.from({ length: orderCount }, (_, i) =>
                    Math.floor((orderCount - i) * (RATIO_BASE / sum)),
                );
                break;
            }
            case BatchOrderSizeDistribution.RANDOM: {
                // Generate initial ratios within a target range
                let totalRatio = 0;
                const averageRatio = RATIO_BASE / orderCount;
                const minRatio = Math.ceil(averageRatio * 0.95);
                const maxRatio = Math.floor(averageRatio * 1.05);

                // Generate initial ratios
                for (let i = 0; i < orderCount; i++) {
                    let ratio = Math.floor(averageRatio * (1 - 0.05 + Math.random() * 0.1));
                    ratio = Math.max(minRatio, Math.min(maxRatio, ratio));
                    ratios.push(ratio);
                    totalRatio += ratio;
                }

                // Adjust the ratios to ensure the sum is RATIO_BASE
                let adjustment = RATIO_BASE - totalRatio;
                const increment = adjustment > 0 ? 1 : -1;

                // Randomly adjust each ratio slightly to balance to RATIO_BASE
                while (adjustment !== 0) {
                    for (let i = 0; i < orderCount && adjustment !== 0; i++) {
                        const newRatio = ratios[i] + increment;
                        if (newRatio >= minRatio && newRatio <= maxRatio) {
                            ratios[i] = newRatio;
                            adjustment -= increment;
                        }
                    }
                }
                break;
            }
            default:
                throw new Error('Invalid size distribution');
        }
        // make sure the sum of ratios is 10000
        ratios[ratios.length - 1] =
            RATIO_BASE - ratios.slice(0, ratios.length - 1).reduce((acc, ratio) => acc + ratio, 0);
        return ratios;
    }

    //////////////////////////////////////////////////////////
    // Frontend Transaction API
    //////////////////////////////////////////////////////////

    // @param baseAmount: decimal 18 units, always positive for both long or short. e.g. 3e18 means 3 BASE
    // @param slippage: 0 ~ 10000. e.g. 500 means 5%
    public async intuitiveTrade(
        signer: Signer,
        pair: PairModel,
        side: Side,
        base: BigNumber,
        margin: BigNumber,
        tradePrice: BigNumber,
        slippage: number,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        if (side === Side.FLAT) {
            throw new Error('Invalid Price');
        }
        const sign = signOfSide(side);
        const limitTick = TickMath.getLimitTick(tradePrice, slippage, side);
        const instrument = this.getInstrumentContract(pair.rootInstrument.info.addr, signer);

        const unsignedTx = await instrument.populateTransaction.trade(
            encodeTradeWithReferralParam(pair.amm.expiry, base.mul(sign), margin, limitTick, deadline, referralCode),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    // @param margin: decimal 18 units, always positive
    // @param transferIn: true if transferIn, false if transferOut
    public async adjustMargin(
        signer: Signer,
        pair: PairModel,
        transferIn: boolean,
        margin: BigNumber,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const sign: number = transferIn ? 1 : -1;
        const instrument = this.getInstrumentContract(pair.rootInstrument.info.addr, signer);

        const unsignedTx = await instrument.populateTransaction.trade(
            encodeAdjustWithReferralParam(pair.amm.expiry, margin.mul(sign), deadline, referralCode),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    // @param baseAmount: decimal 18 units, always positive for both long or short. e.g. 3e18 means 3 BASE
    // @param takeProfitRatio: 0 ~ 10000. e.g. 500 means 5%
    // @param stopLossRatio: same as takeProfitRatio
    async limitOrder(
        signer: Signer,
        pair: PairModel,
        tickNumber: number,
        baseWad: BigNumber,
        balanceWad: BigNumber,
        side: Side,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const currentTick = pair.amm.tick;
        const isLong = tickNumber < currentTick;
        if (currentTick === tickNumber) throw new Error('Invalid price');
        if (isLong !== (side === Side.LONG)) throw new Error('Invalid price');
        const sign = isLong ? 1 : -1;
        const instrument = this.getInstrumentContract(pair.rootInstrument.info.addr, signer);

        const unsignedTx = await instrument.populateTransaction.place(
            encodePlaceWithReferralParam(
                pair.amm.expiry,
                baseWad.mul(sign),
                balanceWad,
                tickNumber,
                deadline,
                referralCode,
            ),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    async addLiquidityWithAsymmetricRange(
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
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const addParam = {
            expiry: expiry,
            tickDeltaLower: tickDeltaLower,
            tickDeltaUpper: tickDeltaUpper,
            amount: marginWad,
            limitTicks: TickMath.encodeLimitTicks(sqrtStrikeLowerPX96, sqrtStrikeUpperPX96),
            deadline: deadline,
        } as AddParam;
        return this._addLiquidity(signer, addParam, instrumentIdentifier, referralCode, overrides);
    }

    async addLiquidity(
        signer: Signer,
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
        tickDelta: number,
        marginWad: BigNumber,
        sqrtStrikeLowerPX96: BigNumber,
        sqrtStrikeUpperPX96: BigNumber,
        deadline: number,
        overrides?: PayableOverrides,
        referralCode = DEFAULT_REFERRAL_CODE,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const addParam = {
            expiry: expiry,
            tickDeltaLower: 0, // 0 means same as tickDeltaUpper
            tickDeltaUpper: tickDelta,
            amount: marginWad,
            limitTicks: TickMath.encodeLimitTicks(sqrtStrikeLowerPX96, sqrtStrikeUpperPX96),
            deadline: deadline,
        } as AddParam;
        return this._addLiquidity(signer, addParam, instrumentIdentifier, referralCode, overrides);
    }

    async _addLiquidity(
        signer: Signer,
        addParam: AddParam,
        instrumentIdentifier: InstrumentIdentifier,
        referralCode: string,
        overrides?: PayableOverrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrumentAddress = await this.computeInstrumentAddress(
            instrumentIdentifier.marketType,
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        let unsignedTx;
        const gate = this.contracts.gate.connect(signer);
        const indexOfInstrument = await gate.indexOf(instrumentAddress);
        if (BigNumber.from(indexOfInstrument).isZero()) {
            this.ctx.registerContractParser(instrumentAddress, new InstrumentParser());
            this.ctx.registerAddress(
                instrumentAddress,
                instrumentIdentifier.baseSymbol +
                    '-' +
                    instrumentIdentifier.quoteSymbol +
                    '-' +
                    instrumentIdentifier.marketType,
            );
            // need to create instrument
            unsignedTx = await gate.populateTransaction.launch(
                instrumentIdentifier.marketType,
                instrumentAddress,
                await this.computeInitData(instrumentIdentifier),
                encodeAddWithReferralParam(addParam, referralCode),
                overrides ?? {},
            );
        } else {
            const instrument = this.getInstrumentContract(instrumentAddress, signer);
            unsignedTx = await instrument.populateTransaction.add(
                encodeAddWithReferralParam(addParam, referralCode),
                overrides ?? {},
            );
        }

        return this.ctx.sendTx(signer, unsignedTx);
    }

    async removeLiquidity(
        signer: Signer,
        pairModel: PairModel,
        targetAddress: string,
        rangeModel: RangeModel,
        sqrtStrikeLowerPX96: BigNumber,
        sqrtStrikeUpperPX96: BigNumber,
        deadline: number,
        overrides?: PayableOverrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const instrument = this.getInstrumentContract(pairModel.rootInstrument.info.addr, signer);

        const calldata = [];
        calldata.push(
            instrument.interface.encodeFunctionData('remove', [
                encodeRemoveParam({
                    expiry: pairModel.amm.expiry,
                    target: targetAddress,
                    tickLower: rangeModel.tickLower,
                    tickUpper: rangeModel.tickUpper,
                    limitTicks: TickMath.encodeLimitTicks(sqrtStrikeLowerPX96, sqrtStrikeUpperPX96),
                    deadline: deadline,
                }),
            ]),
        );
        const unsignedTx = await instrument.populateTransaction.remove(
            encodeRemoveParam({
                expiry: pairModel.amm.expiry,
                target: targetAddress,
                tickLower: rangeModel.tickLower,
                tickUpper: rangeModel.tickUpper,
                limitTicks: TickMath.encodeLimitTicks(sqrtStrikeLowerPX96, sqrtStrikeUpperPX96),
                deadline: deadline,
            }),
            overrides ?? {},
        );
        return this.ctx.sendTx(signer, unsignedTx);
    }

    public async batchCancelOrder(
        signer: Signer,
        account: PairLevelAccountModel,
        ordersToCancel: OrderModel[],
        deadline: number,
        overrides?: PayableOverrides,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const expiry = account.rootPair.amm.expiry;
        const instrument = this.getInstrumentContract(account.rootPair.rootInstrument.info.addr, signer);

        const ticks = ordersToCancel.map((order) => order.tick);

        if (ticks.length <= MAX_CANCEL_ORDER_COUNT) {
            const unsignedTx = await instrument.populateTransaction.cancel(
                encodeCancelParam(expiry, ticks, deadline),
                overrides ?? {},
            );
            return this.ctx.sendTx(signer, unsignedTx);
        } else {
            // split ticks by size of MAX_CANCEL_ORDER_COUNT
            const tickGroups = [];
            for (let i = 0; i < ticks.length; i += MAX_CANCEL_ORDER_COUNT) {
                tickGroups.push(ticks.slice(i, i + MAX_CANCEL_ORDER_COUNT));
            }
            const calldatas = tickGroups.map((group) => {
                return instrument.interface.encodeFunctionData('cancel', [encodeCancelParam(expiry, group, deadline)]);
            });
            const unsignedTx = await instrument.populateTransaction.multicall(calldatas, overrides ?? {});
            return this.ctx.sendTx(signer, unsignedTx);
        }
    }

    public async vaultOperation(
        signer: Signer,
        quoteAddress: string,
        amountWad: BigNumber,
        deposit: boolean,
    ): Promise<ethers.ContractTransaction | ethers.providers.TransactionReceipt> {
        const vault = this.contracts.gate;
        const usingNative = quoteAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
        const quoteInfo = usingNative ? this.ctx.wrappedNativeToken : await this.ctx.getTokenInfo(quoteAddress);
        const decimals = quoteInfo.decimals;
        const amount = NumericConverter.toContractQuoteAmount(amountWad, decimals);
        let unsignedTx;
        if (deposit) {
            const overrides = usingNative ? { value: amount } : {};
            unsignedTx = await vault.populateTransaction.deposit(encodeDepositParam(quoteAddress, amount), overrides);
        } else {
            unsignedTx = await vault.populateTransaction.withdraw(encodeWithdrawParam(quoteAddress, amount));
        }

        return this.ctx.sendTx(signer, unsignedTx);
    }

    public marginToDepositWad(
        traderAddress: string,
        quoteInfo: TokenInfo,
        marginNeedWad: BigNumber,
        balanceInVaultWadOverride?: BigNumber,
    ): BigNumber {
        let balanceInVaultWad;
        if (balanceInVaultWadOverride) {
            balanceInVaultWad = balanceInVaultWadOverride;
        } else {
            balanceInVaultWad = NumericConverter.scaleQuoteAmount(
                this.cacheModule.getCachedVaultBalance(quoteInfo.address, traderAddress),
                quoteInfo.decimals,
            );
        }
        if (marginNeedWad.gt(balanceInVaultWad)) {
            return marginNeedWad.sub(balanceInVaultWad);
        } else {
            return ZERO;
        }
    }

    public async inspectDexV2MarketBenchmarkPrice(
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
    ): Promise<BigNumber> {
        const { baseSymbol, quoteSymbol } = this.getTokenSymbol(
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        const baseParam = this.config.quotesParam[baseSymbol];
        const quoteParam = this.config.quotesParam[quoteSymbol];

        const baseStable = baseParam && baseParam.qtype === QuoteType.STABLE;
        const quoteStable = quoteParam && quoteParam.qtype === QuoteType.STABLE;

        const feederType: FeederType = ((baseStable ? 2 : 0) + (quoteStable ? 1 : 0)) as FeederType;

        const rawSpotPrice = await this.getDexV2RawSpotPrice(instrumentIdentifier);

        return calcBenchmarkPrice(expiry, rawSpotPrice, feederType, this.config.marketConfig.DEXV2!.dailyInterestRate);
    }

    public async inspectCexMarketBenchmarkPrice(
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
    ): Promise<BigNumber> {
        const instrumentAddress = await this.computeInstrumentAddress(
            instrumentIdentifier.marketType,
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        const market = this.contracts.marketContracts[instrumentIdentifier.marketType]?.market as CexMarket;
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
        const { baseTokenInfo, quoteTokenInfo } = await this.getTokenInfo(identifier);

        const baseScaler = BigNumber.from(10).pow(18 - baseTokenInfo.decimals);
        const quoteScaler = BigNumber.from(10).pow(18 - quoteTokenInfo.decimals);

        const isToken0Quote = BigNumber.from(baseTokenInfo.address).gt(BigNumber.from(quoteTokenInfo.address));

        const dexV2PairInfo = await this.contracts.observer.inspectMaxReserveDexV2Pair(
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
        const instrumentAddress = await this.computeInstrumentAddress(
            instrumentIdentifier.marketType,
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        const market = this.contracts.marketContracts[instrumentIdentifier.marketType]?.market as CexMarket;
        let rawSpotPrice;
        try {
            rawSpotPrice = await market.getRawPrice(instrumentAddress);
        } catch (e) {
            console.error('fetch chainlink spot price error', e);
            rawSpotPrice = ZERO;
        }
        return rawSpotPrice;
    }

    async getPositionIfSettle(traderAccount: PairLevelAccountModel): Promise<Position> {
        let finalPic: Position = Object.assign({}, EMPTY_POSITION);
        const amm = traderAccount.rootPair.amm;
        const instrumentAddr = traderAccount.rootPair.rootInstrument.info.addr;
        const expiry = amm.expiry;
        // range settle part
        for (const range of traderAccount.ranges) {
            const position: Position = rangeToPosition(
                amm.sqrtPX96,
                amm.tick,
                amm.feeIndex,
                amm.longSocialLossIndex,
                amm.shortSocialLossIndex,
                amm.longFundingIndex,
                amm.shortFundingIndex,
                range.tickLower,
                range.tickUpper,
                range,
            );
            finalPic = combine(amm, finalPic, position).position;
        }
        const ticks = traderAccount.orders.map((o) => o.tick);
        const nonces = traderAccount.orders.map((o) => o.nonce);
        const pearls = await this.contracts.observer.getPearls(instrumentAddr, expiry, ticks);
        const records = await this.contracts.observer.getRecords(instrumentAddr, expiry, ticks, nonces);
        // order settle part
        for (let i = 0; i < traderAccount.orders.length; i++) {
            const order = traderAccount.orders[i];
            const pearl = pearls[i];
            const record = records[i];
            let position: Position;
            if (pearl.nonce === order.nonce) {
                position = cancelOrderToPosition(
                    pearl.left,
                    pearl.nonce,
                    pearl.taken,
                    pearl.fee,
                    pearl.entrySocialLossIndex,
                    pearl.entryFundingIndex,
                    order,
                    order.tick,
                    order.nonce,
                    record,
                );
            } else {
                position = fillOrderToPosition(
                    pearl.nonce,
                    pearl.taken,
                    pearl.fee,
                    pearl.entrySocialLossIndex,
                    pearl.entryFundingIndex,
                    order,
                    order.tick,
                    order.nonce,
                    order.size,
                    record,
                );
            }
            finalPic = combine(amm, finalPic, position).position;
        }
        // position settle part
        finalPic = combine(amm, finalPic, traderAccount.position).position;
        return finalPic;
    }

    estimateAPY(pairModel: PairModel, poolFee24h: BigNumber, alphaWad: BigNumber): number {
        if (pairModel.amm.liquidity.eq(ZERO)) return 0;
        const assumeAddMargin = pairModel.rootInstrument.minRangeValue;
        const tickDelta = alphaWadToTickDelta(alphaWad);

        const upperTick = RANGE_SPACING * ~~((pairModel.amm.tick + tickDelta) / RANGE_SPACING);
        const lowerTick = RANGE_SPACING * ~~((pairModel.amm.tick - tickDelta) / RANGE_SPACING);
        const { liquidity: assumeAddLiquidity } = entryDelta(
            pairModel.amm.sqrtPX96,
            lowerTick,
            upperTick,
            assumeAddMargin,
            pairModel.rootInstrument.setting.initialMarginRatio,
        );
        const assumed24HrFee: BigNumber = poolFee24h.mul(assumeAddLiquidity).div(pairModel.amm.liquidity);
        const apyWad: BigNumber = wdiv(assumed24HrFee.mul(365), assumeAddMargin);

        return fromWad(apyWad);
    }

    async getTokenInfo(instrumentIdentifier: InstrumentIdentifier): Promise<{
        baseTokenInfo: TokenInfo;
        quoteTokenInfo: TokenInfo;
    }> {
        const call1 =
            typeof instrumentIdentifier.baseSymbol === 'string'
                ? this.ctx.getTokenInfo(instrumentIdentifier.baseSymbol)
                : (instrumentIdentifier.baseSymbol as TokenInfo);
        const call2 =
            typeof instrumentIdentifier.quoteSymbol === 'string'
                ? this.ctx.getTokenInfo(instrumentIdentifier.quoteSymbol)
                : (instrumentIdentifier.quoteSymbol as TokenInfo);
        const [baseTokenInfo, quoteTokenInfo] = await Promise.all([call1, call2]);
        return { baseTokenInfo, quoteTokenInfo };
    }

    getTokenSymbol(
        base: string | TokenInfo,
        quote: string | TokenInfo,
    ): {
        baseSymbol: string;
        quoteSymbol: string;
    } {
        const baseSymbol = typeof base === 'string' ? base : base.symbol;
        const quoteSymbol = typeof quote === 'string' ? quote : quote.symbol;
        return { baseSymbol, quoteSymbol };
    }

    async getQuoteTokenInfo(quoteSymbol: string, instrumentAddr: string): Promise<TokenInfo> {
        return (
            this.quoteSymbolToInfo.get(quoteSymbol) ??
            (await this.ctx.getTokenInfo(quoteSymbol)) ??
            (await this.ctx.getTokenInfo((await this.contracts.observer.getSetting(instrumentAddr)).quote))
        );
    }

    registerQuoteInfo(tinfo: TokenInfo): void {
        this.ctx.tokenInfo.set(tinfo.symbol.toLowerCase(), tinfo);
        this.ctx.tokenInfo.set(tinfo.address.toLowerCase(), tinfo);
        this.ctx.registerAddress(tinfo.address, tinfo.symbol);
    }
}
