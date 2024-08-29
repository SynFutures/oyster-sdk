import type { BigNumber } from 'ethers';
import type { Position } from './position';
import type { Order } from './order';
import type { Range } from './range';

export interface Portfolio {
    oids: number[];
    rids: number[];
    position: Position;
    orders: Order[];
    ranges: Range[];
    ordersTaken: BigNumber[];
}
