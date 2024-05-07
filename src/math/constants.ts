import { BigNumber } from 'ethers';

export const NEGATIVE_ONE = BigNumber.from(-1);
export const ZERO = BigNumber.from(0);
export const ONE = BigNumber.from(1);
export const TWO = BigNumber.from(2);

export const Q24 = TWO.pow(24);
export const Q32 = TWO.pow(32);
export const Q96 = TWO.pow(96);
export const Q192 = TWO.pow(192);
export const WAD = BigNumber.from(10).pow(18);

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

export const MAX_UINT_256 = BigNumber.from('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
export const MAX_UINT_128 = TWO.pow(128).sub(ONE);
export const MAX_UINT_64 = TWO.pow(64).sub(ONE);
export const MAX_UINT_32 = TWO.pow(32).sub(ONE);
export const MAX_UINT_24 = TWO.pow(24).sub(ONE);
export const MAX_UINT_16 = TWO.pow(16).sub(ONE);
export const MAX_UINT_8 = TWO.pow(8).sub(ONE);
export const MAX_UINT_160 = TWO.pow(160).sub(ONE);
export const MAX_INT_24 = TWO.pow(23).sub(ONE);

export const POWERS_OF_2 = [128, 64, 32, 16, 8, 4, 2, 1].map((pow: number): [number, BigNumber] => [pow, TWO.pow(pow)]);

export const MAX_SAFE_INTEGER = BigNumber.from(String(Number.MAX_SAFE_INTEGER));

export const TICK_DELTA_MAX = 16096; // 1.0001 ** 16096 = 5.0004080813

// uint48(uint24(type(int24).min)) << 24 | uint48(uint24(type(int24).max))
// which is (2 ** 24 + type(int24).min) * (2 ** 24) + type(int24).max
export const ANY_PRICE_TICK = BigNumber.from(140737496743935);
