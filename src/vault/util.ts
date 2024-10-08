import { hexZeroPad } from 'ethers/lib/utils';
import { BigNumber } from 'ethers';
import { asInt24, asUint24 } from '../common';

export function encodeBatchCancelTicks(ticks: number[]): [string, string, string] {
    const ENCODE_TICK_AMOUNT = 3;
    const MAX_TICK_IN_PAGE = 10;
    const EMPTY_TICK = BigNumber.from(1).shl(23).sub(1);

    if (ticks.length > ENCODE_TICK_AMOUNT * MAX_TICK_IN_PAGE) throw new Error('order full');

    const uTicks = ticks.map((tick) => asUint24(tick));

    const res: [string, string, string] = ['', '', ''];
    for (let i = 0; i < ENCODE_TICK_AMOUNT; i++) {
        let encoded = BigNumber.from(0);
        for (let j = 0; j < MAX_TICK_IN_PAGE; j++) {
            encoded = encoded.shl(24);
            encoded =
                i * MAX_TICK_IN_PAGE + j > uTicks.length - 1
                    ? encoded.add(EMPTY_TICK)
                    : encoded.add(uTicks[i * MAX_TICK_IN_PAGE + j]);
        }
        res[i] = hexZeroPad(encoded.toHexString(), 32);
    }
    return res;
}

export function decodeBatchCancelTicks(encodedTicks: [string, string, string]): number[] {
    const ENCODE_TICK_AMOUNT = 3;
    const MAX_TICK_IN_PAGE = 10;
    const EMPTY_TICK = BigNumber.from(1).shl(23).sub(1).toNumber();

    const ticks: number[] = new Array<number>();
    for (let i = 0; i < ENCODE_TICK_AMOUNT; i++) {
        if (encodedTicks[i] === undefined) continue;
        let encoded = encodedTicks[i].slice(6); // slice '0x0000', leaving 240 bits
        for (let j = 0; j < MAX_TICK_IN_PAGE; j++) {
            const tick = asInt24(BigNumber.from('0x' + encoded.slice(0, 6)).toNumber());
            if (tick === EMPTY_TICK) return ticks;
            ticks.push(tick);
            encoded = encoded.slice(6);
        }
    }
    return ticks;
}
