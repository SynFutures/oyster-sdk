import { ChainContext, ContractParser, formatUnits } from '@derivation-tech/web3-core';
import { BigNumber } from 'ethers';
import { ParamType, formatEther } from 'ethers/lib/utils';
import { LogDescription, TransactionDescription } from '@ethersproject/abi';
import { ErrorDescription } from '@ethersproject/abi/lib/interface';
import { Vault__factory } from '../types';
import { decodeBatchCancelTicks, decodeInstrumentExpiry, decodeLiquidateParam, decodeNativeAmount } from './util';
import {
    decodeAddParam,
    decodeBatchPlaceParam,
    decodeFillParam,
    decodePlaceParam,
    decodeRemoveParam,
    decodeTradeParam,
    formatExpiry,
    formatTick,
    formatTimestamp,
} from '../common';

function formatArg(obj: object): string {
    let str = '';
    for (const [k, v] of Object.entries(obj)) {
        if (v instanceof BigNumber) {
            if (k === 'limitTicks') {
                str += `minTickLower: ${v.toNumber() >> 24}, maxTickUpper: ${v.toNumber() & ((1 << 24) - 1)}, `;
            } else {
                str += `${k}: ${formatEther(v)}, `;
            }
        } else if (typeof v === 'number') {
            if (k === 'expiry') str += `${k}: ${formatExpiry(v)}, `;
            else if (k.toLowerCase().includes('tick')) str += `${k}: ${formatTick(v)}, `;
            else if (k === 'deadline') str += `${k}: ${formatTimestamp(v)}, `;
            else str += `${k}: ${v.toString()}, `;
        } else if (typeof v === 'object') {
            str += `${k}: ${formatArg(v)}, `;
        } else {
            str += `${k}: ${v.toString()}, `;
        }
    }
    str =
        '{ ' +
        str
            .replace(/\s/g, '')
            .split(',')
            .filter((str) => str !== '')
            .join(', ') +
        ' }';
    return str;
}

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

export class VaultParser extends ContractParser {
    ctx: ChainContext;
    constructor(ctx: ChainContext, addressParser?: (address: string) => Promise<string>) {
        super(Vault__factory.createInterface(), addressParser);
        this.ctx = ctx;
    }

    async parseBaseArrayParam(
        description: TransactionDescription | LogDescription | ErrorDescription,
        param: ParamType,
        value: string[],
    ): Promise<string> {
        if (description.name === 'launch' && param.name === 'addArgs') {
            return formatArg(decodeAddParam([value[0], value[1]]));
        } else if (description.name === 'add' && param.name === 'args') {
            return formatArg(decodeAddParam([value[0], value[1]]));
        } else if (description.name === 'remove' && param.name === 'args') {
            return formatArg(decodeRemoveParam([value[0], value[1]]));
        } else if (description.name === 'trade' && param.name === 'args') {
            return formatArg(decodeTradeParam([value[0], value[1]]));
        } else if (description.name === 'place' && param.name === 'args') {
            return formatArg(decodePlaceParam([value[0], value[1]]));
        } else if (description.name === 'batchPlace' && param.name === 'args') {
            return formatArg(decodeBatchPlaceParam([value[0], value[1], value[2]]));
        } else if (description.name === 'batchPlace' && param.name === 'encodedTicks') {
            return formatArg(decodeBatchCancelTicks([value[0], value[1], value[2]]));
        } else if (description.name === 'liquidate' && param.name === 'args') {
            return formatArg(decodeLiquidateParam([value[0], value[1], value[2]]));
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
            return this.parseDefaultBaseParam(description, param, data);
        }
    }

    async parseFunctionBaseParam(description: TransactionDescription, param: ParamType, data: any): Promise<string> {
        switch (param.name) {
            // handle function fields that need special parsing
            case 'arg': {
                switch (description.functionFragment.name) {
                    case 'withdraw':
                    case 'claimFee':
                        return formatArg(decodeNativeAmount(data));
                    case 'fill':
                        return formatArg(decodeFillParam(data));
                    case 'batchCancel':
                    case 'sweep':
                    case 'settle':
                        return formatArg(decodeInstrumentExpiry(data));
                    default:
                        return data.toString();
                }
            }
            default:
                return await this.parseDefaultBaseParam(description, param, data);
        }
    }

    async parseEventBaseParam(description: LogDescription, param: ParamType, data: any): Promise<string> {
        switch (param.name) {
            // to handle event fields that need special parsing
            default:
                return await this.parseDefaultBaseParam(description, param, data);
        }
    }

    async parseErrorBaseParam(description: ErrorDescription, param: ParamType, data: any): Promise<string> {
        switch (param.name) {
            // to handle error fields that need special parsing
            default:
                return await this.parseDefaultBaseParam(description, param, data);
        }
    }

    async parseDefaultBaseParam(
        description: TransactionDescription | LogDescription | ErrorDescription,
        param: ParamType,
        data: any,
    ): Promise<string> {
        switch (param.name) {
            case 'expiry':
                return formatExpiry(data);
            case 'amount':
            case 'minAmount': {
                const quote = description.args['quote'] || description.args['token'];
                if (!quote) return formatEther(data);
                const tokenInfo = await this.ctx.getTokenInfo(quote);
                return formatUnits(data, tokenInfo.decimals);
            }
            case 'balance':
            case 'tip':
            case 'fee':
            case 'entryNotional':
            case 'deltaQuote':
            case 'protocolFee':
            case 'involvedFund':
            case 'insuranceFund':
            case 'funding':
            case 'entryFeeIndex':
            case 'size':
            case 'totalLong':
            case 'totalShort':
            case 'deltaBase':
            case 'openInterests':
            case 'totalTaken':
            case 'taken':
            case 'mark':
            case 'limitPrice':
            case 'settlement':
            case 'entrySocialLossIndex':
            case 'entryFundingIndex':
            case 'longSocialLossIndex':
            case 'shortSocialLossIndex':
            case 'longFundingIndex':
            case 'shortFundingIndex':
            case 'liquidity':
            case 'requestedSize':
            case 'totalSize':
            case 'requested':
            case 'tragetLeverage':
            case 'defaultLeverage':
            case 'leverage':
            case 'amountDelta':
                return formatEther(data);
            case 'validityRange':
            case 'adjustBand':
                return formatUnits(data, 4);
            case 'tick':
            case 'limitTick':
            case 'tickUpper':
            case 'tickLower':
            case 'lowerTick':
            case 'upperTick':
            case 'minTickLower':
            case 'maxTickUpper':
                return formatTick(Number(data));
            case 'deadline':
                return formatTimestamp(data);
            default:
                return data.toString();
        }
    }
}
