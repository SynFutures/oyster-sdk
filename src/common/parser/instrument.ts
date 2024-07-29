import { ContractParser, formatWad } from '@derivation-tech/web3-core';
import { Instrument__factory, InstrumentCondition, Status } from '../../types';
import { ethers } from 'ethers';
import {
    decodeAddParam,
    decodeBatchPlaceParam,
    decodeCancelParam,
    decodeFillParam,
    decodePlaceParam,
    decodeRemoveParam,
    decodeTradeWithStabilityFeeParam,
    formatExpiry,
    formatRatio,
    formatSqrtPX96,
    formatTick,
    formatTimestamp,
} from '../util';
import { ParamType } from 'ethers/lib/utils';
import { LogDescription, TransactionDescription } from '@ethersproject/abi';
import { ErrorDescription } from '@ethersproject/abi/lib/interface';

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
