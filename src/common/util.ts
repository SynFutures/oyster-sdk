/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigNumber, BigNumberish, ethers } from 'ethers';
import {
    INT24_MAX,
    MAX_CANCEL_ORDER_COUNT,
    MAX_STABILITY_FEE_RATIO,
    MAX_TICK,
    MIN_TICK,
    PERP_EXPIRY,
    RATIO_BASE,
    RATIO_DECIMALS,
} from '../constants';
import {
    MAX_UINT_128,
    ONE,
    ZERO,
    TickMath,
    wadToTick,
    WAD,
    MAX_INT_24,
    MAX_UINT_16,
    wdiv,
    s2w,
    EMPTY_TICK,
} from '../math';
import { sqrt, sqrtX96ToWad, wmulDown, r2w } from '../math';
import {
    ADDR_BATCH_SIZE,
    ChainContext,
    SECS_PER_DAY,
    SECS_PER_HOUR,
    chunk,
    formatWad,
    now,
} from '@derivation-tech/web3-core';
import {
    AddParam,
    FeederType,
    Leverage,
    RemoveParam,
    TradeParam,
    PlaceParam,
    FillParam,
    QuoteParam,
    QuoteType,
    InstrumentCondition,
    DexV2Feeder,
    PriceFeeder,
    BatchPlaceParam,
} from '../types';
import * as moment from 'moment';
import { Interface, Result, hexZeroPad } from 'ethers/lib/utils';
import { EmaParamStruct } from '../types/typechain/CexMarket';
import { CallOverrides } from 'ethers/lib/ethers';

const nonceLength = 24;
const tickLength = 24;
const limitTicksLength = tickLength * 2;
const expiryLength = 32;
const sizeLength = 128;
const amountLength = 128;
const quantityLength = 96;
const addressLength = 160;
const deadlineLength = 32;
const limitStabilityFeeRatioLength = 16;
const ratioLength = 16;
const leverageLength = 128;

function bytes32ToBigNumber(str: string): BigNumber {
    str = str.startsWith('0x') ? str : '0x' + str;
    if (str.length !== 66) {
        throw new Error('invalid bytes32 string');
    }
    return BigNumber.from(str);
}

function pickNumber(value: BigNumber, from: number, to: number): number {
    return pickBigNumber(value, from, to).toNumber();
}

function pickAddress(value: BigNumber, from: number, to: number): string {
    return hexZeroPad(pickBigNumber(value, from, to).toHexString(), 20);
}

function pickBigNumber(value: BigNumber, from: number, to: number): BigNumber {
    return value.shr(from).and(ONE.shl(to - from).sub(1));
}

/**
 * Returns the sqrt ratio as a Q64.96 corresponding to a given ratio of amount1 and amount0
 * @param amount1 The numerator amount i.e., the amount of token1
 * @param amount0 The denominator amount i.e., the amount of token0
 * @returns The sqrt ratio
 */
export function encodeSqrtRatioX96(amount1: BigNumberish, amount0: BigNumberish): BigNumber {
    const numerator = BigNumber.from(amount1.toString()).shl(192);
    const denominator = BigNumber.from(amount0.toString());
    const ratioX192 = numerator.div(denominator);
    return sqrt(ratioX192);
}

/// encode trade param to contract input format (bytes32)
export function encodeTradeParam(
    expiry: number,
    size: BigNumber,
    amount: BigNumber,
    limitTick: number,
    deadline: number,
): [string, string] {
    return encodeParamForTradeAndPlace(expiry, size, amount, limitTick, deadline);
}

export function encodeTradeWithRiskParam(
    expiry: number,
    size: BigNumber,
    amount: BigNumber,
    limitTick: number,
    deadline: number,
    maxStabilityFeeRatio: number,
    referral: string,
): [string, string] {
    const [page0, page1] = encodeParamForTradeAndPlaceWithReferral(expiry, size, amount, limitTick, deadline, referral);
    if (maxStabilityFeeRatio < 0 || maxStabilityFeeRatio > MAX_STABILITY_FEE_RATIO) {
        throw new Error('maxStabilityFeeRatio out of range');
    }
    const page0WithStabilityFee = hexZeroPad(
        BigNumber.from(maxStabilityFeeRatio).shl(88).add(BigNumber.from(page0)).toHexString(),
        32,
    );
    return [page0WithStabilityFee, page1];
}

export function encodeTradeWithReferralParam(
    expiry: number,
    size: BigNumber,
    amount: BigNumber,
    limitTick: number,
    deadline: number,
    referral: string,
): [string, string] {
    return encodeParamForTradeAndPlaceWithReferral(expiry, size, amount, limitTick, deadline, referral);
}

function encodeParamForTradeAndPlace(
    expiry: number,
    size: BigNumber,
    amount: BigNumber,
    tick: number,
    deadline: number,
): [string, string] {
    const usize = asUint128(size);
    const uAmount = asUint128(amount);

    const uTick = asUint24(tick);
    const combinedTick = BigNumber.from(uTick).shl(32).add(BigNumber.from(expiry));
    const combinedDeadline = BigNumber.from(deadline).shl(56).add(combinedTick);
    const combinedSize = BigNumber.from(usize).shl(128).add(uAmount);
    const page0 = hexZeroPad(combinedDeadline.toHexString(), 32);
    const page1 = hexZeroPad(combinedSize.toHexString(), 32);
    return [page0, page1];
}

function encodeParamForTradeAndPlaceWithReferral(
    expiry: number,
    size: BigNumber,
    amount: BigNumber,
    tick: number,
    deadline: number,
    referral: string,
): [string, string] {
    const [page0Temp, page1] = encodeParamForTradeAndPlace(expiry, size, amount, tick, deadline);
    const hexReferral = getHexReferral(referral);
    const page0 = hexZeroPad(BigNumber.from(hexReferral).shl(192).add(BigNumber.from(page0Temp)).toHexString(), 32);
    return [page0, page1];
}

export function checkReferralCode(referral: string): void {
    if (referral.length !== 8) throw new Error('referral code length must be 8');
}

export function getHexReferral(referral: string): string {
    // cannot directly use toUtf8Bytes, since charcode larger than 127 would result in 2bytes unicode
    checkReferralCode(referral);
    const platform = referral.charCodeAt(0);
    const wallet = referral.charCodeAt(1);
    const channel = referral.slice(2);
    const hexReferral = ethers.utils.hexConcat([
        BigNumber.from(platform).toHexString(),
        BigNumber.from(wallet).toHexString(),
        ethers.utils.hexlify(ethers.utils.toUtf8Bytes(channel)),
    ]);
    return hexReferral;
}

/// encode deposit param to contract input format (bytes32)
export function encodeDepositParam(token: string, quantity: BigNumber): string {
    return encodeParamForDepositAndWithdraw(token, quantity);
}

/// encode withdraw param to contract input format (bytes32)
export function encodeWithdrawParam(token: string, quantity: BigNumber): string {
    return encodeParamForDepositAndWithdraw(token, quantity);
}

function encodeParamForDepositAndWithdraw(token: string, quantity: BigNumber): string {
    return hexZeroPad(BigNumber.from(quantity).shl(160).add(token).toHexString(), 32);
}

/// encode adjust param to contract input format (bytes32)
export function encodeAdjustParam(expiry: number, net: BigNumber, deadline: number): [string, string] {
    return encodeTradeParam(expiry, ZERO, net, 0, deadline);
}

export function encodeAdjustWithReferralParam(
    expiry: number,
    net: BigNumber,
    deadline: number,
    referral: string,
): [string, string] {
    return encodeTradeWithReferralParam(expiry, ZERO, net, 0, deadline, referral);
}

/// encode add param to contract input format (bytes32)
export function encodeAddParam(addParam: AddParam): [string, string] {
    const uTick = asUint48(addParam.limitTicks.toNumber());
    const combinedTick = BigNumber.from(uTick).shl(32).add(BigNumber.from(addParam.expiry));
    const combinedDeadline = BigNumber.from(addParam.deadline).shl(80).add(combinedTick);
    const combinedAmount = BigNumber.from(addParam.tickDeltaLower)
        .shl(152)
        .add(BigNumber.from(addParam.tickDeltaUpper).shl(128))
        .add(addParam.amount);

    const page0 = hexZeroPad(combinedDeadline.toHexString(), 32);
    const page1 = hexZeroPad(combinedAmount.toHexString(), 32);
    return [page0, page1];
}

export function encodeAddWithReferralParam(addParam: AddParam, referral: string): [string, string] {
    const hexReferral = getHexReferral(referral);
    const uTick = asUint48(addParam.limitTicks.toNumber());
    const combinedTick = BigNumber.from(uTick).shl(32).add(BigNumber.from(addParam.expiry));
    const combinedDeadline = BigNumber.from(addParam.deadline).shl(80).add(combinedTick);
    const combinedAmount = BigNumber.from(addParam.tickDeltaLower)
        .shl(152)
        .add(BigNumber.from(addParam.tickDeltaUpper).shl(128))
        .add(addParam.amount);

    const page0 = hexZeroPad(BigNumber.from(hexReferral).shl(192).add(combinedDeadline).toHexString(), 32);
    const page1 = hexZeroPad(combinedAmount.toHexString(), 32);
    return [page0, page1];
}

/// encode remove param to contract input format (bytes32[2])
export function encodeRemoveParam(removeParam: RemoveParam): [string, string] {
    const uTick = asUint48(removeParam.limitTicks.toNumber());
    const combinedTick = BigNumber.from(uTick).shl(32).add(BigNumber.from(removeParam.expiry));
    const combinedDeadline = BigNumber.from(removeParam.deadline).shl(80).add(combinedTick);

    const uTickLower = asUint24(removeParam.tickLower);
    const uTickUpper = asUint24(removeParam.tickUpper);
    const combinedTickLower = BigNumber.from(uTickLower).shl(160).add(removeParam.target);
    const combinedTickUpper = BigNumber.from(uTickUpper).shl(184).add(combinedTickLower);

    const page0 = hexZeroPad(combinedDeadline.toHexString(), 32);
    const page1 = hexZeroPad(combinedTickUpper.toHexString(), 32);
    return [page0, page1];
}

/// encode place param to contract input format (bytes32)
export function encodePlaceParam(
    expiry: number,
    size: BigNumber,
    amount: BigNumber,
    tick: number,
    deadline: number,
): [string, string] {
    return encodeParamForTradeAndPlace(expiry, size, amount, tick, deadline);
}

export function encodePlaceWithReferralParam(
    expiry: number,
    size: BigNumber,
    amount: BigNumber,
    tick: number,
    deadline: number,
    referral: string,
): [string, string] {
    return encodeParamForTradeAndPlaceWithReferral(expiry, size, amount, tick, deadline, referral);
}

export function encodeBatchPlaceParam(
    expiry: number,
    size: BigNumber,
    leverage: BigNumber,
    ticks: number[],
    ratios: number[],
    deadline: number,
): [string, string, string] {
    if (ticks.length > 9) throw new Error('cannot place more than 9 orders at once');
    if (ticks.length !== ratios.length) throw new Error('ticks and ratios length mismatch');

    if (ratios.reduce((a, b) => a + b, 0) !== RATIO_BASE) throw new Error('ratios sum must be 10000');

    const usize = asUint128(size);
    const uLeverage = asUint128(leverage);
    const combinedSize = BigNumber.from(usize).shl(128).add(uLeverage);
    const page2 = hexZeroPad(combinedSize.toHexString(), 32);

    let tmp0 = BigNumber.from(deadline).shl(32).add(BigNumber.from(expiry));
    for (let i = 0; i < 3; i++) {
        const uTick = i < ticks.length ? asUint24(ticks[i]) : EMPTY_TICK;
        const uRatio = i < ratios.length ? asUint16(ratios[i]) : 0;
        tmp0 = tmp0.add(BigNumber.from(uRatio).shl(64 + 40 * i)).add(BigNumber.from(uTick).shl(64 + 40 * i + 16));
    }
    const page0 = hexZeroPad(tmp0.toHexString(), 32);

    let tmp1 = ZERO;
    for (let i = 0; i < 6; i++) {
        const uTick = i + 3 < ticks.length ? asUint24(ticks[i + 3]) : EMPTY_TICK;
        const uRatio = i + 3 < ratios.length ? asUint16(ratios[i + 3]) : 0;
        tmp1 = tmp1.add(BigNumber.from(uRatio).shl(40 * i)).add(BigNumber.from(uTick).shl(40 * i + 16));
    }
    const page1 = hexZeroPad(tmp1.toHexString(), 32);

    return [page0, page1, page2];
}

export function encodeBatchPlaceWithReferralParam(
    expiry: number,
    size: BigNumber,
    leverage: BigNumber,
    ticks: number[],
    ratios: number[],
    deadline: number,
    referral: string,
): [string, string, string] {
    const [page0Temp, page1, page2] = encodeBatchPlaceParam(expiry, size, leverage, ticks, ratios, deadline);
    const hexReferral = getHexReferral(referral);
    const page0 = hexZeroPad(BigNumber.from(hexReferral).shl(192).add(BigNumber.from(page0Temp)).toHexString(), 32);
    return [page0, page1, page2];
}

/// encode fill param to contract input format (bytes32)
export function encodeFillParam(expiry: number, target: string, tick: number, nonce: number): string {
    const uTick = asUint24(tick);
    const combinedTarget = BigNumber.from(target).shl(32).add(BigNumber.from(expiry));
    const combinedTick = BigNumber.from(uTick).shl(192).add(combinedTarget);
    return hexZeroPad(BigNumber.from(nonce).shl(216).add(combinedTick).toHexString(), 32);
}

/// encode cancel param to contract input format (bytes32)
export function encodeCancelParam(expiry: number, ticks: number[], deadline: number): string {
    if (ticks.length < 1 || ticks.length > MAX_CANCEL_ORDER_COUNT)
        throw new Error(`ticks length must be between 1 and ${MAX_CANCEL_ORDER_COUNT}`);
    let encodedTicks = ZERO;
    for (let i = 0; i < MAX_CANCEL_ORDER_COUNT; i++) {
        const tick = i < ticks.length ? ticks[i] : INT24_MAX;
        encodedTicks = encodedTicks.add(BigNumber.from(asUint24(tick)).shl(24 * i));
    }

    const combinedTick = BigNumber.from(encodedTicks).shl(32).add(BigNumber.from(expiry));
    const combinedDeadline = BigNumber.from(deadline).shl(224).add(combinedTick);
    return hexZeroPad(combinedDeadline.toHexString(), 32);
}

export function encodeEmaParam(eparams: EmaParamStruct[]): BigNumber {
    let encoded = BigNumber.from(0);
    for (let i = 0; i < eparams.length; i++) {
        let temp = BigNumber.from(0);
        temp = temp.add(BigNumber.from(eparams[i].emaHalfTime).shl(48));
        temp = temp.add(BigNumber.from(eparams[i].maxTimeDelta).shl(32));
        temp = temp.add(BigNumber.from(eparams[i].maxRawTimeDelta).shl(16));
        temp = temp.add(BigNumber.from(eparams[i].maxChangeRatioPerSecond));

        encoded = encoded.add(temp.shl(64 * i));
    }
    return encoded;
}

export function decodeEmaParam(encoded: BigNumber): EmaParamStruct {
    return {
        emaHalfTime: encoded.shr(48).and(0xffff),
        maxTimeDelta: encoded.shr(32).and(0xffff),
        maxRawTimeDelta: encoded.shr(16).and(0xffff),
        maxChangeRatioPerSecond: encoded.and(0xffff),
    };
}

export function getLeverageFromImr(imr: number): Leverage {
    if (imr === 1000) return Leverage.LOW;
    if (imr === 500) return Leverage.MEDIUM;
    if (imr === 300) return Leverage.HIGH;
    if (imr === 100) return Leverage.RISKY;
    throw new Error('Invalid IMR value');
}

export function decodeTradeParam(args: string[]): TradeParam {
    return decodeParamForTradeAndPlace(args);
}

export function decodeTradeWithStabilityFeeParam(args: string[]): TradeParam & { limitStabilityFeeRatio: number } {
    const tradeParam = decodeTradeParam(args);
    const value1 = bytes32ToBigNumber(args[0]);
    const offset = expiryLength + tickLength + deadlineLength;
    const limitStabilityFeeRatio = pickNumber(value1, offset, offset + limitStabilityFeeRatioLength);
    return { ...tradeParam, limitStabilityFeeRatio };
}

function decodeParamForTradeAndPlace(args: string[]): TradeParam {
    if (args.length !== 2) {
        throw new Error('invalid args length');
    }

    const [arg1, arg2] = args;

    let offset = 0;
    const value1 = bytes32ToBigNumber(arg1);
    const expiry = pickNumber(value1, offset, (offset += expiryLength));
    const limitTick = asInt24(pickNumber(value1, offset, (offset += tickLength)));
    const deadline = pickNumber(value1, offset, (offset += deadlineLength));

    offset = 0;
    const value2 = bytes32ToBigNumber(arg2);
    const amount = asInt128(pickBigNumber(value2, offset, (offset += amountLength)));
    const size = asInt128(pickBigNumber(value2, offset, (offset += sizeLength)));

    return { expiry, size, amount, limitTick, deadline };
}

export function decodeDepositParam(arg: string): { token: string; quantity: BigNumber } {
    return decodeParamForDepositAndWithdraw(arg);
}

export function decodeWithdrawParam(arg: string): { token: string; quantity: BigNumber } {
    return decodeParamForDepositAndWithdraw(arg);
}

export function decodeParamForDepositAndWithdraw(arg: string): { token: string; quantity: BigNumber } {
    let offset = 0;
    const value = bytes32ToBigNumber(arg);
    const token = pickAddress(value, offset, (offset += addressLength));
    const quantity = pickBigNumber(value, offset, (offset += quantityLength));

    return { quantity, token };
}

export function decodeAddParam(args: string[]): AddParam {
    if (args.length !== 2) {
        throw new Error('invalid args length');
    }

    const [arg1, arg2] = args;

    let offset = 0;
    const value1 = bytes32ToBigNumber(arg1);
    const expiry = pickNumber(value1, offset, (offset += expiryLength));
    const limitTicks = pickBigNumber(value1, offset, (offset += limitTicksLength));
    const deadline = pickNumber(value1, offset, (offset += deadlineLength));

    offset = 0;
    const value2 = bytes32ToBigNumber(arg2);
    const amount = pickBigNumber(value2, offset, (offset += amountLength));
    const tickDeltaUpper = pickNumber(value2, offset, (offset += tickLength));
    const tickDeltaLower = pickNumber(value2, offset, (offset += tickLength));

    return { limitTicks, amount, tickDeltaLower, tickDeltaUpper, expiry, deadline };
}

export function decodeRemoveParam(args: string[]): RemoveParam {
    if (args.length !== 2) {
        throw new Error('invalid args length');
    }

    const [arg1, arg2] = args;

    let offset = 0;
    const value1 = bytes32ToBigNumber(arg1);
    const expiry = pickNumber(value1, offset, (offset += expiryLength));
    const limitTicks = pickBigNumber(value1, offset, (offset += limitTicksLength));
    const deadline = pickNumber(value1, offset, (offset += deadlineLength));

    offset = 0;
    const value2 = bytes32ToBigNumber(arg2);
    const target = pickAddress(value2, offset, (offset += addressLength));
    const tickLower = asInt24(pickNumber(value2, offset, (offset += tickLength)));
    const tickUpper = asInt24(pickNumber(value2, offset, (offset += tickLength)));

    return { tickUpper, tickLower, target, expiry, limitTicks, deadline };
}

export function decodePlaceParam(args: string[]): PlaceParam {
    const result = decodeParamForTradeAndPlace(args);
    return {
        expiry: result.expiry,
        size: result.size,
        amount: result.amount,
        tick: result.limitTick,
        deadline: result.deadline,
    };
}

export function decodeBatchPlaceParam(args: string[]): BatchPlaceParam {
    if (args.length !== 3) {
        throw new Error('invalid args length');
    }

    const [arg1, arg2, arg3] = args;

    const ticks: number[] = [];
    const ratios: number[] = [];

    let offset = 0;
    const value1 = bytes32ToBigNumber(arg1);
    const expiry = pickNumber(value1, offset, (offset += expiryLength));
    const deadline = pickNumber(value1, offset, (offset += deadlineLength));
    for (let i = 0; i < 3; i++) {
        const ratio = pickNumber(value1, offset, (offset += ratioLength));
        const tick = asInt24(pickNumber(value1, offset, (offset += tickLength)));
        if (BigNumber.from(tick).eq(EMPTY_TICK)) continue;
        ticks.push(tick);
        ratios.push(ratio);
    }

    offset = 0;
    const value2 = bytes32ToBigNumber(arg2);
    for (let i = 0; i < 6; i++) {
        const ratio = pickNumber(value2, offset, (offset += ratioLength));
        const tick = asInt24(pickNumber(value2, offset, (offset += tickLength)));
        if (BigNumber.from(tick).eq(EMPTY_TICK)) continue;
        ticks.push(tick);
        ratios.push(ratio);
    }

    offset = 0;
    const value3 = bytes32ToBigNumber(arg3);
    const leverage = asInt128(pickBigNumber(value3, offset, (offset += leverageLength)));
    const size = asInt128(pickBigNumber(value3, offset, (offset += sizeLength)));

    return { expiry, ticks, ratios, size, leverage, deadline };
}

export function decodeFillParam(arg: string): FillParam {
    let offset = 0;
    const value = bytes32ToBigNumber(arg);
    const expiry = pickNumber(value, offset, (offset += expiryLength));
    const target = pickAddress(value, offset, (offset += addressLength));
    const tick = asInt24(pickNumber(value, offset, (offset += tickLength)));
    const nonce = pickNumber(value, offset, (offset += nonceLength));

    return { nonce, tick, target, expiry };
}

export function decodeCancelParam(arg: string): { expiry: number; ticks: number[]; deadline: number } {
    let offset = 0;
    const value = bytes32ToBigNumber(arg);
    const expiry = pickNumber(value, offset, (offset += expiryLength));
    const ticks: number[] = [];
    for (let i = 0; i < MAX_CANCEL_ORDER_COUNT; i++) {
        const tick = asInt24(pickNumber(value, offset, (offset += tickLength)));
        if (tick === MAX_INT_24.toNumber()) {
            continue;
        }
        ticks.push(tick);
    }
    const deadline = pickNumber(value, offset, (offset += deadlineLength));

    return { ticks, expiry, deadline };
}

export function alignExpiry(): number {
    const alignedExpiry = Math.floor((Date.now() / 1000 + 259200) / 604800) * 604800 + 345600 + 28800 - 259200;
    return alignedExpiry;
}

export function alignTick(tick: number, tickSpacing: number): number {
    return tick - (tick % tickSpacing);
}

export function getMinTick(tickSpacing: number): number {
    return Math.ceil(-TickMath.MAX_TICK / tickSpacing) * tickSpacing;
}

export function getMaxTick(tickSpacing: number): number {
    return Math.floor(TickMath.MAX_TICK / tickSpacing) * tickSpacing;
}

export function getMaxLiquidityPerTick(tickSpacing: number): BigNumber {
    return MAX_UINT_128.div((getMaxTick(tickSpacing) - getMinTick(tickSpacing)) / tickSpacing + 1);
}

export function asUint16(x: number): number {
    if (x < 0) {
        x += 1 << 16;
    }
    return x;
}

export function asInt24(x: number): number {
    const MAX_INT_24 = (1 << 23) - 1;
    if (x > MAX_INT_24) {
        x -= 1 << 24;
    }
    return x;
}

export function asUint24(x: number): number {
    if (x < 0) {
        x += 1 << 24;
    }
    return x;
}

export function asUint48(x: number): number {
    if (x < 0) {
        x += 1 << 48;
    }
    return x;
}

export function asUint96(x: BigNumber): BigNumber {
    if (x.isNegative()) {
        x = x.add(ONE.shl(96));
    }
    return x;
}

export function asUint128(x: BigNumber): BigNumber {
    if (x.isNegative()) {
        x = x.add(ONE.shl(128));
    }
    return x;
}

export function asUint256(x: BigNumber): BigNumber {
    if (x.isNegative()) {
        x = x.add(ONE.shl(256));
    }
    return x;
}

///@dev force x to be int24
/// x must be positive
export function forceAsInt24(x: BigNumber): BigNumber {
    x = x.and(ONE.shl(24).sub(ONE));
    if (x.gt(MAX_INT_24)) {
        x = x.sub(ONE.shl(24));
    }
    return x;
}

export function asInt256(x: BigNumber): BigNumber {
    if (x.gt(ethers.constants.MaxInt256)) {
        x = x.sub(ONE.shl(256));
    }
    return x;
}

export function asInt128(x: BigNumber): BigNumber {
    const MAX_INT_128 = ONE.shl(127).sub(ONE);
    if (x.gt(MAX_INT_128)) {
        x = x.sub(ONE.shl(128));
    }
    return x;
}

export function rangeKey(tickLower: number, tickUpper: number): number {
    return shiftLeft(asUint24(tickLower), 24) + asUint24(tickUpper);
}

export function orderKey(tick: number, nonce: number): number {
    return shiftLeft(asUint24(tick), 24) + nonce;
}

// These two functions exist because shifting integer does not work as regular in JavaScript. For example:
// 1) 1 << 48 in JavaScript results in 65536
// 2) 0x200000000 >> 1 in JavaScript results in 0
// To see more about this stupid fact, go to https://stackoverflow.com/questions/42221373/javascript-integer-shift-safety-n-1-n-2

// x << n
function shiftLeft(x: number, n: number): number {
    return x * Math.pow(2, n);
}

// x >> n
function shiftRight(x: number, n: number): number {
    return Math.floor(x / Math.pow(2, n));
}

const MAX_UINT_24 = shiftLeft(1, 24) - 1;
const MAX_UINT_48 = shiftLeft(1, 48) - 1;

// find RangeTicks depending on key
export function parseTicks(key: number): { tickLower: number; tickUpper: number } {
    if (key > MAX_UINT_48) {
        throw new Error('not 48-bit key');
    }
    const tickLower = asInt24(shiftRight(key, 24));
    const tickUpper = asInt24(key & MAX_UINT_24);
    return { tickLower, tickUpper };
}

export function calcBenchmarkPrice(
    expiry: number,
    rawSpotPrice: BigNumber,
    feederType: FeederType,
    dailyInterestRate: number,
): BigNumber {
    if (expiry == PERP_EXPIRY) {
        return rawSpotPrice;
    } else {
        const daysLeft =
            Date.now() / 1000 >= expiry ? 0 : Math.floor((expiry * 1000 - Date.now()) / (SECS_PER_DAY * 1000)) + 1;
        if (feederType === FeederType.BOTH_STABLE || feederType === FeederType.NONE_STABLE) {
            return rawSpotPrice;
        } else if (feederType === FeederType.QUOTE_STABLE) {
            return wmulDown(rawSpotPrice, r2w(dailyInterestRate)).mul(daysLeft).add(rawSpotPrice);
        } else {
            /* else if (this.rootInstrument.instrumentType === FeederType.BASE_STABLE)*/
            const priceChange = wmulDown(rawSpotPrice, r2w(dailyInterestRate)).mul(daysLeft);
            return rawSpotPrice.gt(priceChange) ? rawSpotPrice.sub(priceChange) : ZERO;
        }
    }
}
export function parseOrderTickNonce(key: number): { tick: number; nonce: number } {
    if (key > MAX_UINT_48) {
        throw new Error('not 48-bit key');
    }
    const tick = asInt24(shiftRight(key, 24));
    const nonce = key & MAX_UINT_24;
    return { tick, nonce };
}

// parse: normal -> scaled
export function parseSize(size: number | string): BigNumber {
    if (typeof size === 'number') {
        size = size.toString();
    }
    return ethers.utils.parseEther(size);
}

export function parseAmount(amount: number | string): BigNumber {
    if (typeof amount === 'number') {
        amount = amount.toString();
    }
    return ethers.utils.parseUnits(amount);
}

// e.g. 0.05 => 500 which means 5%
export function parseRatio(ratio: number): number {
    return Math.floor(ratio * Math.pow(10, RATIO_DECIMALS));
}

// format: scaled -> normal
export function formatSize(size: BigNumber): string {
    return ethers.utils.formatEther(size);
}

export function formatAmount(amount: BigNumber, decimals: number): string {
    return ethers.utils.formatUnits(amount, decimals);
}

export function decompose(tick: number): { wordPos: number; bitPos: number } {
    const wordPos = tick >> 8;
    // Note that in JavaScript, -258 % 256 is -2, while we want 254.
    let bitPos = tick % 256;
    if (bitPos < 0) bitPos += 256;
    return { wordPos, bitPos };
}

export function normalizeTick(originTick: number, tickSpacing: number): number {
    return BigNumber.from(originTick).div(tickSpacing).mul(tickSpacing).toNumber();
}

// leverage is wad, margin is wad
export function getOrderMarginByLeverage(tick: number, size: BigNumber, leverage: number): BigNumber {
    const price = TickMath.getWadAtTick(tick);
    return wmulDown(price, size.abs()).div(leverage).add(1);
}

export function solidityRequire(condition: boolean, message?: string): void {
    if (!condition) {
        throw new Error(message ?? 'solidity require failed');
    }
}

export function tickDeltaToAlphaWad(tickDelta: number): BigNumber {
    return TickMath.getWadAtTick(tickDelta);
}

export function alphaWadToTickDelta(alphaWad: BigNumber): number {
    return TickMath.getTickAtPWad(alphaWad) + 1;
}

export function trimObj<T>(obj: T & { length: number }): T {
    if (isTypeChainStruct(obj)) {
        const ret = {} as T;
        Object.keys(obj).forEach((key: string, i) => {
            if (i >= obj.length) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                ret[key] = trimObj(obj[key]);
            }
        });
        return ret;
    } else if (isArray(obj)) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return (obj as Array<any>).map((item: any) => trimObj(item));
    } else {
        return obj;
    }
}

export function isArray(obj: unknown): boolean {
    if (obj instanceof Array) {
        return obj.length === Object.keys(obj).length;
    }
    return false;
}

export function isTypeChainStruct(obj: unknown): boolean {
    if (obj instanceof Array) {
        return obj.length !== Object.keys(obj).length;
    }
    return false;
}

// For perpetual expiry, return 'PERP'
// For futures expiry, return yyyymmdd format. e.g. 20230207
export function formatExpiry(expiry: number): string {
    return expiry === PERP_EXPIRY ? 'PERP' : moment.utc(expiry * 1000).format('yyyyMMDD');
}

export function dateExpiry2Ts(expiry: string): number {
    if (expiry === '0' || expiry.toUpperCase() === 'PERPETUAL' || expiry.toUpperCase() === 'PERP') {
        return PERP_EXPIRY;
    }
    return moment.utc(expiry, 'YYYYMMDD').unix() + 8 * SECS_PER_HOUR;
}

export function formatRatio(value: BigNumberish): string {
    return ethers.utils.formatUnits(BigNumber.from(value), 2) + '%';
}

export function formatSqrtPX96(sqrtPX96: BigNumberish, fixedDecimals = 6): string {
    return formatWad(sqrtX96ToWad(sqrtPX96), fixedDecimals);
}

export function formatTick(tick: number): string {
    if (tick < MIN_TICK) {
        return 'MIN_TICK';
    } else if (tick > MAX_TICK) {
        return 'MAX_TICK';
    } else {
        return `${tick}(${formatSqrtPX96(TickMath.getSqrtRatioAtTick(tick))})`;
    }
}

export function formatTimestamp(value: BigNumberish): string {
    return new Date(BigNumber.from(value).mul(1000).toNumber()).toISOString();
}

export function dayIdFromTimestamp(timestamp = now()): number {
    return Math.floor(timestamp / SECS_PER_DAY) * SECS_PER_DAY;
}

export function hourIdFromTimestamp(timestamp = now()): number {
    return Math.floor(timestamp / SECS_PER_HOUR) * SECS_PER_HOUR;
}

export function weekIdFromTimestamp(timestamp = now()): number {
    const daysOfWeek = 7;
    const dayOfWeek = (((Math.floor(timestamp / SECS_PER_DAY) + 4) % daysOfWeek) + daysOfWeek) % daysOfWeek;
    // day diff to Monday
    const diff = Math.floor(timestamp / SECS_PER_DAY) - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    // aligned to seconds
    return diff * SECS_PER_DAY;
}

export function concatId(id1: string | number, id2: string | number): string {
    return String(id1).concat('-').concat(String(id2));
}

export function fromWad(value: BigNumberish): number {
    return Number(ethers.utils.formatEther(value));
}

export function calcMinTickDelta(initialMarginRatio: number): number {
    return wadToTick(r2w(initialMarginRatio).add(WAD));
}

export function extractFeeRatioParams(stabilityFeeRatioParam: BigNumber): BigNumber[] {
    const ret: BigNumber[] = [];
    ret.push(s2w(stabilityFeeRatioParam.and(MAX_UINT_24)));
    ret.push(s2w(stabilityFeeRatioParam.shr(24).and(MAX_UINT_16)));
    ret.push(s2w(stabilityFeeRatioParam.shr(40).and(MAX_UINT_16)));
    ret.push(s2w(stabilityFeeRatioParam.shr(56)));
    return ret;
}

export function formatQuoteParam(param: QuoteParam): string {
    return Object.entries(param)
        .map(([k, v]) => {
            if (k === 'minMarginAmount' || k === 'tip') {
                return ` ${k}: ${formatWad(BigNumber.from(v))}`;
            } else if (k === 'stabilityFeeRatioParam') {
                const feeRatioParams = extractFeeRatioParams(v);
                return ` ${k}: (${Array.from(feeRatioParams.values()).map(
                    (v, i) => String.fromCharCode(97 + i) + `: ${formatWad(v)}`,
                )})`;
            } else if (k === 'tradingFeeRatio' || k === 'protocolFeeRatio') {
                return ` ${k}: ${formatRatio(BigNumber.from(v))}`;
            } else {
                return ` ${k}: ${formatQuoteType(v)}`;
            }
        })
        .toString();
}

export function formatFeederType(ftype: FeederType): string {
    return ftype == FeederType.BASE_STABLE
        ? 'BASE_STABLE'
        : ftype == FeederType.BOTH_STABLE
        ? 'BOTH_STABLE'
        : ftype == FeederType.NONE_STABLE
        ? 'NONE_STABLE'
        : 'QUOTE_STABLE';
}

export function formatFeeder(feeder: PriceFeeder | DexV2Feeder): string {
    return Object.entries(feeder)
        .map(([k, v]) => {
            if (k === 'ftype') {
                return ` ${k}: ${formatFeederType(v)}`;
            } else {
                return ` ${k}: ${v}`;
            }
        })
        .toString();
}

export function formatQuoteType(qtype: QuoteType): string {
    return qtype == QuoteType.INVALID ? 'Invalid' : qtype == QuoteType.NONSTABLE ? 'NonStable' : 'Stable';
}

export function formatLeverage(leverage: Leverage): string {
    return leverage == Leverage.LOW
        ? 'Low'
        : leverage == Leverage.MEDIUM
        ? 'Medium'
        : leverage == Leverage.HIGH
        ? 'High'
        : 'Risky';
}

export function formatCompactEmaParam(data: BigNumberish): string {
    return formatEmaParam(decodeEmaParam(BigNumber.from(data)));
}

export function formatEmaParam(ema: EmaParamStruct): string {
    return Object.entries(ema)
        .map(([k, v]) => {
            if (k === 'maxChangeRatioPerSecond') {
                return ` ${k}: ${formatRatio(BigNumber.from(v))}`;
            } else {
                return ` ${k}: ${v.toString()}`;
            }
        })
        .toString();
}

export function formatCondition(condition: InstrumentCondition): string {
    return condition == InstrumentCondition.FROZEN
        ? 'FROZEN'
        : condition == InstrumentCondition.NORMAL
        ? 'NORMAL'
        : 'RESOLVED';
}

export function mustParseNumber(value: string): number {
    const num = Number(value);
    if (Number.isNaN(num)) {
        throw new Error('invalid number: ' + value);
    }
    return num;
}

export function serializeSimpleObject(obj: any): any {
    const result: any = {};

    for (const [k, v] of Object.entries(obj)) {
        if (v instanceof ethers.BigNumber) {
            result[k] = {
                bn: true,
                value: v.toString(),
            };
        } else if (typeof v === 'object') {
            result[k] = serializeSimpleObject(v);
        } else {
            result[k] = v;
        }
    }

    return result;
}

export function serializeCascadingMap2(map2: Map<string, Map<string, BigNumber>>): any {
    const result: any = {};

    for (const [k, v] of map2) {
        const _v: any = {};
        for (const [k1, v1] of v) {
            _v[k1] = v1.toString();
        }
        result[k] = _v;
    }

    return result;
}

export function deserializeCascadingMap2(serialized: any): Map<string, Map<string, BigNumber>> {
    const result: any = new Map<string, Map<string, BigNumber>>();
    for (const [k, v] of Object.entries(serialized)) {
        const _v: Map<string, BigNumber> = new Map<string, BigNumber>();
        for (const [k1, v1] of Object.entries(v as object)) {
            _v.set(k1, BigNumber.from(v1));
        }
        result.set(k, _v);
    }

    return result;
}

export function serializeCascadingMap3(map2: Map<string, Map<string, Map<number, BigNumber>>>): any {
    const result: any = {};

    for (const [k, v] of map2) {
        const _v: any = {};
        for (const [k1, v1] of v) {
            const _v1: any = {};
            for (const [k2, v2] of v1) {
                _v1[k2] = v2.toString();
            }
            _v[k1] = _v1;
        }
        result[k] = _v;
    }

    return result;
}

export function deserializeCascadingMap3(serialized: any): Map<string, Map<string, Map<number, BigNumber>>> {
    const result: any = new Map<string, Map<string, Map<number, BigNumber>>>();
    for (const [k, v] of Object.entries(serialized)) {
        const _v: Map<string, Map<number, BigNumber>> = new Map<string, Map<number, BigNumber>>();
        for (const [k1, v1] of Object.entries(v as object)) {
            const _v1 = new Map<number, BigNumber>();
            for (const [k2, v2] of Object.entries(v1 as object)) {
                _v1.set(Number(k2), BigNumber.from(v2));
            }
            _v.set(k1, _v1);
        }
        result.set(k, _v);
    }

    return result;
}

export function deserializeSimpleObject(serialized: any): any {
    const result: any = {};

    for (const [k, v] of Object.entries(serialized)) {
        if (typeof v === 'object' && v !== null) {
            const _v: any = v;
            if (_v.bn && _v.value) {
                result[k] = BigNumber.from(_v.value);
            } else {
                result[k] = deserializeSimpleObject(v);
            }
        } else {
            result[k] = v;
        }
    }

    return result;
}

export function withinOrderLimit(limitPrice: BigNumber, markPrice: BigNumber, imr: number): boolean {
    return wdiv(limitPrice.sub(markPrice).abs(), markPrice).lte(r2w(imr).mul(2));
}

export async function batchQuery(
    ctx: ChainContext,
    iface: Interface,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sigs: { target: string; method: string; params?: ReadonlyArray<any> }[],
    batchSize = ADDR_BATCH_SIZE,
    overrides?: CallOverrides,
): Promise<Result[]> {
    const calls = sigs.map((sig) => {
        return {
            target: sig.target,
            callData: iface.encodeFunctionData(sig.method, sig.params),
        };
    });
    const chunks = chunk(calls, batchSize);
    const rets = await Promise.all(
        chunks.map((chunk) => {
            return ctx.multicall3.callStatic.aggregate(chunk, overrides);
        }),
    );
    return rets
        .map((rawRet, i) => {
            return rawRet.returnData.map((ret, j) => {
                return iface.decodeFunctionResult(sigs[i * batchSize + j].method, ret);
            });
        })
        .flat(1);
}
