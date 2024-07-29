import { ContractParser, formatWad } from '@derivation-tech/web3-core';
import { FeederType, Guardian__factory, QuoteType } from '../../types';
import { LogDescription, TransactionDescription } from '@ethersproject/abi';
import { ErrorDescription } from '@ethersproject/abi/lib/interface';
import { ParamType } from 'ethers/lib/utils';
import { extractFeeRatioParams, formatCompactEmaParam, formatExpiry, formatRatio } from '../util';
import { BigNumber } from 'ethers';

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
