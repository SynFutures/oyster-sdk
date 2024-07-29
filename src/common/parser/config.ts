import { ContractParser, formatWad } from '@derivation-tech/web3-core';
import { Config__factory, QuoteType } from '../../types';
import { LogDescription, TransactionDescription } from '@ethersproject/abi';
import { ErrorDescription } from '@ethersproject/abi/lib/interface';
import { ParamType } from 'ethers/lib/utils';
import { extractFeeRatioParams, formatExpiry, formatRatio } from '../util';
import { BigNumber } from 'ethers';

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
