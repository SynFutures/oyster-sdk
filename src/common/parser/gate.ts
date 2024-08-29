import { ChainContext, ContractParser, formatUnits, formatWad } from '@derivation-tech/web3-core';
import { Gate__factory, MarketType } from '../../types';
import { ethers } from 'ethers';
import {
    cexMarket,
    decodeAddParam,
    decodeParamForDepositAndWithdraw,
    formatExpiry,
    formatSqrtPX96,
    formatTick,
    formatTimestamp,
} from '../util';
import { ParamType } from 'ethers/lib/utils';
import { LogDescription, TransactionDescription } from '@ethersproject/abi';
import { ErrorDescription } from '@ethersproject/abi/lib/interface';
import { NATIVE_TOKEN_ADDRESS } from '../../constants';

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
