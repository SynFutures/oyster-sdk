/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigNumber, ethers } from 'ethers';
import { ChainContext, ContractParser } from '@derivation-tech/web3-core';
import {
    CexMarket__factory,
    Config__factory,
    DexV2Market__factory,
    FeederType,
    Gate__factory,
    Guardian__factory,
    InstrumentCondition,
    Instrument__factory,
    MarketType,
    QuoteType,
    Status,
    cexMarket,
} from '../types';
import {
    decodeAddParam,
    decodeBatchPlaceParam,
    decodeCancelParam,
    decodeFillParam,
    decodeParamForDepositAndWithdraw,
    decodePlaceParam,
    decodeRemoveParam,
    decodeTradeWithStabilityFeeParam,
    extractFeeRatioParams,
    formatCompactEmaParam,
    formatExpiry,
    formatRatio,
    formatSqrtPX96,
    formatTick,
    formatTimestamp,
} from './util';
import { ParamType } from 'ethers/lib/utils';
import { LogDescription, TransactionDescription } from '@ethersproject/abi';
import { ErrorDescription } from '@ethersproject/abi/lib/interface';
import { formatWad, formatUnits } from '@derivation-tech/web3-core';
import { NATIVE_TOKEN_ADDRESS } from '../constants';

function isTransactionDescription(
    description: TransactionDescription | LogDescription | ErrorDescription,
): description is TransactionDescription {
    return 'functionFragment' in description;
}

function isLogDescription(
    description: TransactionDescription | LogDescription | ErrorDescription,
): description is LogDescription {
    return 'eventFragment' in description;
}

function isErrorDescription(
    description: TransactionDescription | LogDescription | ErrorDescription,
): description is ErrorDescription {
    return 'errorFragment' in description;
}

export class InstrumentParser extends ContractParser {
    constructor(addressParser?: (address: string) => Promise<string>) {
        super(Instrument__factory.createInterface(), addressParser);
    }

    async formatEncodedFundctionArgs(obj: object): Promise<string> {
        let str = '{ ';
        for (const [k, v] of Object.entries(obj)) {
            if (ethers.utils.isAddress(v)) {
                str += `${k}: ${await this.parseAddress(v)}, `;
                continue;
            }
            if (k === 'limitTicks') {
                str += `minTickLower: ${formatTick(
                    Number(BigInt(v.toNumber()) >> BigInt(24)),
                )}, maxTickUpper: ${formatTick(v.toNumber() & ((1 << 24) - 1))}, `;
            } else if (k === 'ticks') {
                str += `${k}: [${v.map((tick: number) => formatTick(tick)).join(', ')}], `;
            } else {
                str += `${k}: ${this.parseDefaultBaseParam(ParamType.from({ type: 'string', name: k }), v)}, `;
            }
        }
        str = str.substring(0, str.length - 2) + ' }';
        return str;
    }

    async parseBaseArrayParam(
        description: TransactionDescription | LogDescription | ErrorDescription,
        param: ParamType,
        value: any[],
    ): Promise<string> {
        if (description.name === 'add' && param.name === 'args') {
            return this.formatEncodedFundctionArgs(decodeAddParam(value));
        } else if (description.name === 'remove' && param.name === 'args') {
            return this.formatEncodedFundctionArgs(decodeRemoveParam(value));
        } else if (description.name === 'trade' && param.name === 'args') {
            return this.formatEncodedFundctionArgs(decodeTradeWithStabilityFeeParam(value));
        } else if (description.name === 'place' && param.name === 'args') {
            return this.formatEncodedFundctionArgs(decodePlaceParam(value));
        } else if (description.name === 'batchPlace' && param.name === 'args') {
            return this.formatEncodedFundctionArgs(decodeBatchPlaceParam(value));
        }
        return await super.parseBaseArrayParam(description, param, value);
    }

    async parseBaseParam(
        description: TransactionDescription | LogDescription | ErrorDescription,
        param: ParamType,
        data: any,
    ): Promise<string> {
        if (isTransactionDescription(description)) {
            return this.parseFunctionBaseParam(description, param, data);
        } else if (isLogDescription(description)) {
            return this.parseEventBaseParam(description, param, data);
        } else if (isErrorDescription(description)) {
            return this.parseErrorBaseParam(description, param, data);
        } else {
            return this.parseDefaultBaseParam(param, data);
        }
    }

    async parseFunctionBaseParam(_description: TransactionDescription, param: ParamType, data: any): Promise<string> {
        switch (param.name) {
            // handle function fields that need special parsing
            case 'arg': {
                switch (_description.functionFragment.name) {
                    case 'cancel':
                        return this.formatEncodedFundctionArgs(decodeCancelParam(data));
                    case 'fill':
                        return this.formatEncodedFundctionArgs(decodeFillParam(data));
                    default:
                        return data.toString();
                }
            }
            default:
                return this.parseDefaultBaseParam(param, data);
        }
    }

    parseEventBaseParam(_description: LogDescription, param: ParamType, data: any): string {
        switch (param.name) {
            // to handle event fields that need special parsing
            default:
                return this.parseDefaultBaseParam(param, data);
        }
    }

    parseErrorBaseParam(_description: ErrorDescription, param: ParamType, data: any): string {
        switch (param.name) {
            // to handle error fields that need special parsing
            default:
                return this.parseDefaultBaseParam(param, data);
        }
    }

    parseDefaultBaseParam(param: ParamType, data: any): string {
        switch (param.name) {
            case 'status':
                return Status[Number(data)];
            case 'condition':
                return InstrumentCondition[Number(data)];
            case 'expiry':
                return formatExpiry(data);
            case 'timestamp':
            case 'deadline':
                return formatTimestamp(data);
            case 'feeRatio':
                return formatRatio(data);
            case 'net':
            case 'amount':
            case 'minAmount':
            case 'balance':
            case 'tip':
            case 'fee':
            case 'entryNotional':
            case 'deltaQuote':
            case 'protocolFee':
            case 'involvedFund':
            case 'insuranceFund':
            case 'funding':
            case 'totalLong':
            case 'totalShort':
            case 'deltaBase':
            case 'openInterests':
            case 'totalTaken':
            case 'taken':
            case 'mark':
            case 'limitPrice':
            case 'settlement':
            case 'requested':
                return formatWad(data);
            case 'size':
            case 'requestedSize':
            case 'totalSize':
                return formatWad(data, 18);
            case 'sqrtPX96':
            case 'sqrtStrikeLowerPX96':
            case 'sqrtStrikeUpperPX96':
            case 'sqrtEntryPX96':
                return formatSqrtPX96(data, 18);
            case 'tick':
            case 'limitTick':
            case 'tickUpper':
            case 'tickLower':
            case 'minTickLower':
            case 'maxTickUpper':
                return formatTick(Number(data));
            default:
                return data.toString();
        }
    }
}

export class DexV2MarketParser extends ContractParser {
    constructor() {
        super(DexV2Market__factory.createInterface());
    }

    async parseBaseParam(
        _description: TransactionDescription | LogDescription | ErrorDescription,
        param: ParamType,
        data: any,
    ): Promise<string> {
        switch (param.name) {
            case 'initTime':
            case 'time':
                return formatTimestamp(data);
            case 'raw':
            case 'spot':
            case 'initMark':
            case 'initAccumulation':
                return formatWad(data);
            case 'expiry':
                return formatExpiry(data);
            case 'ftype':
                return FeederType[Number(data)];
            case 'compactEmaParam': {
                return formatCompactEmaParam(BigNumber.from(data));
            }
            default:
                return data.toString();
        }
    }
}

export class CexMarketParser extends ContractParser {
    constructor() {
        super(CexMarket__factory.createInterface());
    }

    async parseBaseParam(
        _description: TransactionDescription | LogDescription | ErrorDescription,
        param: ParamType,
        data: any,
    ): Promise<string> {
        switch (param.name) {
            case 'time':
            case 'initTime':
                return formatTimestamp(data);
            case 'spot':
            case 'raw':
            case 'initMark':
            case 'accumulation':
                return formatWad(data);
            case 'expiry':
                return formatExpiry(data);
            case 'ftype':
                return FeederType[Number(data)];
            case 'compactEmaParam': {
                return formatCompactEmaParam(BigNumber.from(data));
            }
            default:
                return data.toString();
        }
    }
}

export class GateParser extends ContractParser {
    ctx: ChainContext;
    constructor(ctx: ChainContext) {
        super(Gate__factory.createInterface());
        this.ctx = ctx;
    }

    async formatEncodedFundctionArgs(obj: object): Promise<string> {
        let str = '{ ';
        for (const [k, v] of Object.entries(obj)) {
            if (ethers.utils.isAddress(v)) {
                str += `${k}: ${await this.parseAddress(v)}, `;
                continue;
            }
            if (k === 'limitTicks') {
                str += `minTickLower: ${formatTick(v.toNumber() >> 24)}, maxTickUpper: ${formatTick(
                    v.toNumber() & ((1 << 24) - 1),
                )}, `;
            } else {
                str += `${k}: ${this.parseDefaultBaseParam(ParamType.from({ type: 'string', name: k }), v)}, `;
            }
        }
        str = str.substring(0, str.length - 2) + ' }';
        return str;
    }

    async parseBaseArrayParam(
        description: TransactionDescription | LogDescription | ErrorDescription,
        param: ParamType,
        value: any[],
    ): Promise<string> {
        if (description.name === 'launch' && param.name === 'addArgs') {
            return this.formatEncodedFundctionArgs(decodeAddParam(value));
        }
        return await super.parseBaseArrayParam(description, param, value);
    }

    async parseBaseParam(
        description: TransactionDescription | LogDescription | ErrorDescription,
        param: ParamType,
        data: any,
    ): Promise<string> {
        switch (param.name) {
            case 'arg':
                if (description.name === 'deposit' || description.name === 'withdraw') {
                    const args = decodeParamForDepositAndWithdraw(data);
                    const usingNative = args.token.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
                    const quoteInfo = usingNative
                        ? this.ctx.wrappedNativeToken
                        : await this.ctx.getTokenInfo(args.token);
                    return `{quantity:${formatUnits(
                        args.quantity,
                        quoteInfo.decimals,
                    )}, token:${await this.parseAddress(args.token)}}`;
                }
                return this.parseDefaultBaseParam(param, data);
            case 'threshold':
            case 'exemption':
            case 'amount':
            case 'quantity': {
                // find quote paramter to get decimals
                const quote = description.args['quote'];
                if (quote) {
                    const usingNative = quote.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
                    const quoteInfo = usingNative ? this.ctx.wrappedNativeToken : await this.ctx.getTokenInfo(quote);

                    return formatUnits(data, quoteInfo.decimals) + ' ' + quoteInfo.symbol;
                } else {
                    return data.toString();
                }
            }
            case 'data': {
                // decode launch data
                if (cexMarket(description.args['mtype'])) {
                    const [base, quote] = ethers.utils.defaultAbiCoder.decode(['string', 'address'], data);
                    return `{base: ${base}, quote: ${await this.parseAddress(quote)}}`;
                } else if (description.args['mtype'] === MarketType.DEXV2) {
                    const [base, quote] = ethers.utils.defaultAbiCoder.decode(['address', 'address'], data);
                    return `{base: ${await this.parseAddress(base)}, quote: ${await this.parseAddress(quote)}}`;
                } else {
                    return data.toString();
                }
            }
            default:
                return this.parseDefaultBaseParam(param, data);
        }
    }

    parseDefaultBaseParam(param: ParamType, data: any): string {
        switch (param.name) {
            case 'duration':
                return (Number(data) / 3600).toFixed(2) + ' hours';
            case 'amount':
                return formatWad(data);
            case 'timestamp':
                return formatTimestamp(data);
            case 'expiry':
                return formatExpiry(data);
            case 'sqrtStrikeLowerPX96':
            case 'sqrtStrikeUpperPX96':
                return formatSqrtPX96(data);
            case 'deadline':
                return formatTimestamp(data);
            default:
                return data.toString();
        }
    }
}

export class ConfigParser extends ContractParser {
    constructor() {
        super(Config__factory.createInterface());
    }

    async parseBaseParam(
        _description: TransactionDescription | LogDescription | ErrorDescription,
        param: ParamType,
        data: any,
    ): Promise<string> {
        switch (param.name) {
            case 'tradingFeeRatio':
            case 'protocolFeeRatio':
                return formatRatio(data);
            case 'stabilityFeeRatioParam':
                return extractFeeRatioParams(BigNumber.from(data))
                    .map((p) => formatWad(p))
                    .toString();
            case 'tip':
            case 'minMarginAmount':
                return formatWad(data);
            case 'expiry':
                return formatExpiry(data);
            case 'qtype':
                return QuoteType[Number(data)];
            default:
                return data.toString();
        }
    }
}

export class GuardianParser extends ContractParser {
    constructor() {
        super(Guardian__factory.createInterface());
    }

    async parseBaseParam(
        _description: TransactionDescription | LogDescription | ErrorDescription,
        param: ParamType,
        data: any,
    ): Promise<string> {
        switch (param.name) {
            case 'tradingFeeRatio':
            case 'protocolFeeRatio':
                return formatRatio(data);
            case 'stabilityFeeRatioParam':
                return extractFeeRatioParams(BigNumber.from(data))
                    .map((p) => formatWad(p))
                    .toString();
            case 'tip':
            case 'minMarginAmount':
                return formatWad(data);
            case 'expiry':
                return formatExpiry(data);
            case 'qtype':
                return QuoteType[Number(data)];
            case 'ftype':
                return FeederType[Number(data)];
            case 'compactEmaParam':
                return formatCompactEmaParam(BigNumber.from(data));
            default:
                return data.toString();
        }
    }

    async parseBaseArrayParam(
        description: TransactionDescription | LogDescription | ErrorDescription,
        param: ParamType,
        value: any[],
    ): Promise<string> {
        if (description.name === 'recycleInsuranceFund' && param.name === 'expiries') {
            return value.map((expiry) => formatExpiry(expiry)).toString();
        } else if (description.name === 'claimProtocolFee' && param.name === 'expiries') {
            return value.map((expiry) => formatExpiry(expiry)).toString();
        }
        return await super.parseBaseArrayParam(description, param, value);
    }
}

// console.info(parseTicks(85390));
