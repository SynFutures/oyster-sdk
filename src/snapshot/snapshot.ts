/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigNumber, ethers } from 'ethers';
import { SynFuturesV3 } from '../synfuturesV3Core';
import {
    Instrument__factory,
    Gate__factory,
    Config__factory,
    InstrumentState,
    GateState,
    ConfigState,
    ParsedEvent,
    InstrumentCondition,
    EMPTY_QUOTE_PARAM,
} from '../types';
import { GatherEventObject, NewInstrumentEventObject, ScatterEventObject } from '../types/typechain/Gate';
import {
    DEFAULT_INITIAL_MARGIN_RATIO,
    DEFAULT_MAINTENANCE_MARGIN_RATIO,
    INITIAL_MARGIN_RATIO,
    MAINTENANCE_MARGIN_RATIO,
    PERP_EXPIRY,
} from '../constants';
import { MAX_UINT_128, d2w, wmul } from '../math';
import {
    asInt128,
    deserializeCascadingMap2,
    deserializeCascadingMap3,
    serializeCascadingMap2,
    serializeCascadingMap3,
} from '../common/util';
import { FillEventObject, TradeEventObject, UpdateFundingIndexEventObject } from '../types/typechain/Instrument';
import { ZERO } from '@derivation-tech/web3-core';
import { DepositEventObject, WithdrawEventObject } from '../types/typechain/Gate';

export class Snapshot {
    instruments = new Map<string, InstrumentState>();
    gate: GateState;
    config: ConfigState;

    totalGather = new Map<string, Map<string, Map<number, BigNumber>>>(); // trader -> instrument -> expiry -> gather
    totalScatter = new Map<string, Map<string, Map<number, BigNumber>>>(); // trader -> instrument -> expiry -> scatter
    totalDeposit = new Map<string, Map<string, BigNumber>>(); // trader -> quote -> deposit
    totalWithdraw = new Map<string, Map<string, BigNumber>>(); // trader -> quote -> withdrawal
    totalTrade = new Map<string, Map<string, Map<number, BigNumber>>>(); // trader -> instrument -> expiry -> trade volume
    totalFill = new Map<string, Map<string, Map<number, BigNumber>>>(); // trader -> instrument -> expiry -> fill volume

    fundingPayInsurance = new Map<string, BigNumber>();

    constructor(private sdk: SynFuturesV3) {
        this.config = new ConfigState();

        this.gate = new GateState(this.sdk.ctx.wrappedNativeToken.address.toLowerCase());
        // register post handlers
        this.gate.registerHooks('NewInstrument', this.newInstrumentHook.bind(this), true);
        this.gate.registerHooks('Gather', this.gatherHook.bind(this), true);
        this.gate.registerHooks('Scatter', this.scatterHook.bind(this), true);
        this.gate.registerHooks('Deposit', this.depositHook.bind(this), true);
        this.gate.registerHooks('Withdraw', this.withdrawHook.bind(this), true);
    }

    serialize(): any {
        const instruments: any = {};
        for (const [k, v] of this.instruments) {
            instruments[k] = v.serialize();
        }

        const fundingPayInsurance: any = {};
        for (const [k, v] of this.fundingPayInsurance) {
            fundingPayInsurance[k] = v.toString();
        }
        return {
            instruments,
            gate: this.gate.serialize(),
            config: this.config.serialize(),
            fundingPayInsurance,
            totalGather: serializeCascadingMap3(this.totalGather),
            totalScatter: serializeCascadingMap3(this.totalScatter),
            totalDeposit: serializeCascadingMap2(this.totalDeposit),
            totalWithdraw: serializeCascadingMap2(this.totalWithdraw),
            totalTrade: serializeCascadingMap3(this.totalTrade),
            totalFill: serializeCascadingMap3(this.totalFill),
        };
    }

    deserialize(serialized: any): this {
        if (this.instruments.size > 0) {
            throw new Error('invalid deserialize');
        }

        if (
            typeof serialized !== 'object' ||
            typeof serialized.instruments !== 'object' ||
            typeof serialized.gate !== 'object' ||
            typeof serialized.config !== 'object' ||
            typeof serialized.fundingPayInsurance !== 'object' ||
            typeof serialized.totalGather !== 'object' ||
            typeof serialized.totalScatter !== 'object' ||
            typeof serialized.totalDeposit !== 'object' ||
            typeof serialized.totalWithdraw !== 'object' ||
            typeof serialized.totalTrade !== 'object' ||
            typeof serialized.totalFill !== 'object'
        ) {
            throw new Error('invalid deserialize');
        }

        for (const [k, v] of Object.entries(serialized.instruments)) {
            this.instruments.set(
                k,
                new InstrumentState(
                    InstrumentCondition.NORMAL,
                    INITIAL_MARGIN_RATIO,
                    MAINTENANCE_MARGIN_RATIO,
                    EMPTY_QUOTE_PARAM,
                ).deserialize(v),
            );
        }

        for (const [k, v] of Object.entries(serialized.fundingPayInsurance)) {
            this.fundingPayInsurance.set(k, BigNumber.from(v));
        }

        this.gate.deserialize(serialized.gate);

        this.config.deserialize(serialized.config);

        this.totalGather = deserializeCascadingMap3(serialized.totalGather);
        this.totalScatter = deserializeCascadingMap3(serialized.totalScatter);
        this.totalDeposit = deserializeCascadingMap2(serialized.totalDeposit);
        this.totalWithdraw = deserializeCascadingMap2(serialized.totalWithdraw);
        this.totalTrade = deserializeCascadingMap3(serialized.totalTrade);
        this.totalFill = deserializeCascadingMap3(serialized.totalFill);

        this.instruments.forEach((instrument) => {
            instrument.registerHooks('UpdateFundingIndex', this.updateFundingIndexHook.bind(this), false);
            instrument.registerHooks('Trade', this.tradeHook.bind(this), false);
            instrument.registerHooks('Fill', this.fillHook.bind(this), false);
        });

        return this;
    }

    copy(): Snapshot {
        return new Snapshot(this.sdk).deserialize(this.serialize());
    }

    // called after GateState.handNewInstrument()
    newInstrumentHook(event: ParsedEvent<NewInstrumentEventObject>, log: ethers.providers.Log): void {
        void log;

        this.instruments.set(
            event.args.instrument.toLowerCase(),
            new InstrumentState(
                InstrumentCondition.NORMAL,
                DEFAULT_INITIAL_MARGIN_RATIO,
                DEFAULT_MAINTENANCE_MARGIN_RATIO,
                this.config.getQuoteParam(event.args.quote),
            ),
        );

        this.instruments
            .get(event.args.instrument.toLowerCase())!
            .registerHooks('UpdateFundingIndex', this.updateFundingIndexHook.bind(this), false);
        this.instruments
            .get(event.args.instrument.toLowerCase())!
            .registerHooks('Trade', this.tradeHook.bind(this), false);
        this.instruments
            .get(event.args.instrument.toLowerCase())!
            .registerHooks('Fill', this.fillHook.bind(this), false);
    }

    // called after GateState.handleGather()
    gatherHook(event: ParsedEvent<GatherEventObject>, log: ethers.providers.Log): void {
        void log;

        const tokenInfo = this.sdk.ctx.tokenInfo.get(event.args.quote.toLowerCase());
        if (!tokenInfo) {
            throw new Error('token info not found from Ctx, quote:' + event.args.quote);
        }

        this.instruments
            .get(event.args.instrument.toLowerCase())!
            .pairStates.get(event.args.expiry)!
            .decreaseInvolvedFund(d2w(event.args.quantity, tokenInfo.decimals));
        this.accumulateGatherOrScatter(event, true);
    }

    // called after GateState.handleScatter()
    scatterHook(event: ParsedEvent<ScatterEventObject>, log: ethers.providers.Log): void {
        void log;

        const tokenInfo = this.sdk.ctx.tokenInfo.get(event.args.quote.toLowerCase());
        if (!tokenInfo) {
            throw new Error('token info not found from Ctx, quote:' + event.args.quote);
        }

        this.instruments
            .get(event.args.instrument.toLowerCase())!
            .pairStates.get(event.args.expiry)!
            .increaseInvolvedFund(d2w(event.args.quantity, tokenInfo.decimals));
        this.accumulateGatherOrScatter(event, false);
    }

    private accumulateGatherOrScatter(
        event: ParsedEvent<GatherEventObject> | ParsedEvent<ScatterEventObject>,
        isGather: boolean,
    ): void {
        const tmpMap = isGather ? this.totalGather : this.totalScatter;

        const trader = event.args.trader.toLowerCase();
        let traderMap = tmpMap.get(trader);
        if (!traderMap) {
            traderMap = new Map<string, Map<number, BigNumber>>();
            tmpMap.set(trader, traderMap);
        }
        let instrumentMap = traderMap.get(event.args.instrument.toLowerCase());
        if (!instrumentMap) {
            instrumentMap = new Map<number, BigNumber>();
            traderMap.set(event.args.instrument.toLowerCase(), instrumentMap);
        }
        const oldValue = instrumentMap.get(event.args.expiry) ?? ZERO;
        instrumentMap.set(event.args.expiry, oldValue.add(event.args.quantity));
    }

    depositHook(event: ParsedEvent<DepositEventObject>, log: ethers.providers.Log): void {
        void log;
        this.accumulateDepositOrWithdraw(event, true);
    }

    withdrawHook(event: ParsedEvent<WithdrawEventObject>, log: ethers.providers.Log): void {
        void log;
        this.accumulateDepositOrWithdraw(event, false);
    }

    private accumulateDepositOrWithdraw(
        event: ParsedEvent<DepositEventObject> | ParsedEvent<WithdrawEventObject>,
        isDeposit: boolean,
    ): void {
        const tmpMap = isDeposit ? this.totalDeposit : this.totalWithdraw;
        const trader = event.args.trader.toLowerCase();
        let traderMap = tmpMap.get(trader);
        if (!traderMap) {
            traderMap = new Map<string, BigNumber>();
            tmpMap.set(trader, traderMap);
        }
        const oldValue = traderMap.get(event.args.quote.toLowerCase()) ?? ZERO;
        traderMap.set(event.args.quote.toLowerCase(), oldValue.add(event.args.quantity));
    }

    tradeHook(event: ParsedEvent<TradeEventObject>, log: ethers.providers.Log): void {
        this.accumulateTradeOrFill(event, log, true);
    }

    fillHook(event: ParsedEvent<FillEventObject>, log: ethers.providers.Log): void {
        this.accumulateTradeOrFill(event, log, false);
    }

    private accumulateTradeOrFill(
        event: ParsedEvent<TradeEventObject> | ParsedEvent<FillEventObject>,
        log: ethers.providers.Log,
        isTrade: boolean,
    ): void {
        const tmpMap = isTrade ? this.totalTrade : this.totalFill;
        const trader = event.args.trader.toLowerCase();
        let traderMap = tmpMap.get(trader);
        if (!traderMap) {
            traderMap = new Map<string, Map<number, BigNumber>>();
            tmpMap.set(trader, traderMap);
        }
        let instrumentMap = traderMap.get(log.address.toLowerCase());
        if (!instrumentMap) {
            instrumentMap = new Map<number, BigNumber>();
            traderMap.set(log.address.toLowerCase(), instrumentMap);
        }
        const oldValue = instrumentMap.get(event.args.expiry) ?? ZERO;
        const added = isTrade
            ? (event as ParsedEvent<TradeEventObject>).args.entryNotional
            : (event as ParsedEvent<FillEventObject>).args.pic.entryNotional;
        instrumentMap.set(event.args.expiry, oldValue.add(added));
    }

    // called after InstrumentState.handleUpdateFundingIndex()
    updateFundingIndexHook(event: ParsedEvent<UpdateFundingIndexEventObject>, log: ethers.providers.Log): void {
        const amm = this.instruments.get(log.address.toLowerCase())!.getPairState(PERP_EXPIRY).amm;
        const [newLongFundingIndex, newShortFundingIndex] = [
            asInt128(event.args.fundingIndex.and(MAX_UINT_128)),
            asInt128(event.args.fundingIndex.shr(128)),
        ];
        const [longFundingUnchanged, shortFundingUnchanged] = [
            amm.longFundingIndex.eq(newLongFundingIndex),
            amm.shortFundingIndex.eq(newShortFundingIndex),
        ];
        if (longFundingUnchanged || shortFundingUnchanged) {
            const value = longFundingUnchanged
                ? wmul(amm.shortFundingIndex.sub(newShortFundingIndex), amm.totalShort)
                : wmul(amm.longFundingIndex.sub(newLongFundingIndex), amm.totalLong);
            if (value.lt(0)) throw new Error('handleUpdateFundingIndex: negative fund paid insurance fund');

            if (
                value.gt(0) &&
                ((longFundingUnchanged && amm.totalLong.eq(0)) || (shortFundingUnchanged && amm.totalShort.eq(0)))
            ) {
                const oldValue = this.fundingPayInsurance.get(log.address.toLowerCase()) ?? ZERO;
                this.fundingPayInsurance.set(log.address.toLowerCase(), oldValue.add(value));
            }
        }
    }

    processLog(log: ethers.providers.Log): void {
        if (log.removed) {
            return;
        }

        switch (log.address.toLowerCase()) {
            case this.sdk.contracts.gate.address.toLowerCase(): {
                const event = Gate__factory.createInterface().parseLog(log);
                this.gate.handleEvent(event, log);
                break;
            }
            case this.sdk.contracts.config.address.toLowerCase(): {
                const event = Config__factory.createInterface().parseLog(log);
                this.config.handleEvent(event, log);
                break;
            }
            default: {
                const instrument = this.instruments.get(log.address.toLowerCase());
                if (!instrument) {
                    return;
                }
                const event = Instrument__factory.createInterface().parseLog(log);
                instrument.handleEvent(event, log);
                break;
            }
        }
    }

    processParsedLog(log: ethers.providers.Log, parsedLog: ParsedEvent<any>): void {
        if (log.removed) {
            return;
        }

        switch (log.address.toLowerCase()) {
            case this.sdk.contracts.gate.address.toLowerCase(): {
                this.gate.handleEvent(parsedLog, log);
                break;
            }
            case this.sdk.contracts.config.address.toLowerCase(): {
                this.config.handleEvent(parsedLog, log);
                break;
            }
            default: {
                const instrument = this.instruments.get(log.address.toLowerCase());
                if (!instrument) {
                    return;
                }
                instrument.handleEvent(parsedLog, log);
                break;
            }
        }
    }
}
