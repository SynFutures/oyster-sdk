import { BigNumber } from 'ethers';
// import { getAddress, hexDataSlice, keccak256, toUtf8Bytes } from 'ethers/lib/utils';

export const WAD_DECIMALS = 18;
export const RATIO_DECIMALS = 4;

export const MAX_POSITION_NUM = 128;
export const NULL_RATIO = 0;
export const ONE_RATIO = 10000; // 100%
export const NULL_PRICE = BigNumber.from(0);

export const MAX_TICK = 443636;
export const MIN_TICK = -322517;

export const INT24_MIN = -8388608;
export const INT24_MAX = 8388607;

export const PEARL_SPACING = 1;
export const ORDER_SPACING = PEARL_SPACING * 1;
export const RANGE_SPACING = PEARL_SPACING * 10;

export const RATIO_BASE = 10000;
export const STABILITY_FEE_RATIO_BASE = 100;
export const MAX_STABILITY_FEE_RATIO = Math.pow(2, 16) - 1;

export const MIN_ORDER_MULTIPLIER = 2;
export const MIN_RANGE_MULTIPLIER = 10;

export const SETTLING_DURATION = 30 * 60; // 30 min

export const NULL_DDL = Math.pow(2, 32) - 1;
export const PERP_EXPIRY = NULL_DDL;

export const INITIAL_MARGIN_RATIO = 1000; // default initial margin ratio
export const MAINTENANCE_MARGIN_RATIO = 500; // default maintenance margin ratio

export const COMPACT_EMA_PARAM = BigNumber.from(
    '1060108913112522979002928172012890034027465765885994002407459484512227426307',
);
export const NATIVE_TOKEN_ADDRESS = '0x1d6B1d2AD091bec4aAe6A131C92008701531FdaF';

export const DEFAULT_INITIAL_MARGIN_RATIO = 1000;
export const DEFAULT_MAINTENANCE_MARGIN_RATIO = DEFAULT_INITIAL_MARGIN_RATIO / 2;

export const DEFAULT_REFERRAL_CODE = '\xff\xff\x00\x00\x00\x00\x00\x00';

export const MAX_BATCH_ORDER_COUNT = 9;
export const MIN_BATCH_ORDER_COUNT = 2;

export const MAX_CANCEL_ORDER_COUNT = 8;

// getAddress(
//     hexDataSlice(
//         BigNumber.from(keccak256(toUtf8Bytes('SYNFUTURES-NATIVE')))
//             .sub(1)
//             .toHexString(),
//         12,
//     ),
// );
