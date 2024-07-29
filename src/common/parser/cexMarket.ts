import { ContractParser, formatWad } from '@derivation-tech/web3-core';
import { CexMarket__factory, FeederType } from '../../types';
import { LogDescription, TransactionDescription } from '@ethersproject/abi';
import { ErrorDescription } from '@ethersproject/abi/lib/interface';
import { ParamType } from 'ethers/lib/utils';
import { formatCompactEmaParam, formatExpiry, formatTimestamp } from '../util';
import { BigNumber } from 'ethers';

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
