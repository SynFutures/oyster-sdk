import { BigNumber } from 'ethers';
import _ from 'lodash';

export * from './ganache';
export function addedDeadline(deadline: number): number {
    return Math.round(
        Number(
            BigNumber.from(_.now())
                .div(1000)
                .add(deadline * 60)
                .toString(),
        ),
    );
}
