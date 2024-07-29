import { ContractParser, formatWad } from '@derivation-tech/web3-core';
import { DexV2Market__factory, FeederType } from '../../types';
import { LogDescription, TransactionDescription } from '@ethersproject/abi';
import { ErrorDescription } from '@ethersproject/abi/lib/interface';
import { ParamType } from 'ethers/lib/utils';
import { formatCompactEmaParam, formatExpiry, formatTimestamp } from '../util';
import { BigNumber } from 'ethers';

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
