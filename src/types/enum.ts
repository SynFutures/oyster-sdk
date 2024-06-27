// Trade side
export enum Side {
    FLAT,
    SHORT,
    LONG,
}

// Amm Status
export enum Status {
    DORMANT,
    TRADING,
    SETTLING,
    SETTLED,
}

// Instrument Condition, only matters should contract invariants broken
export enum InstrumentCondition {
    NORMAL,
    FROZEN,
    RESOLVED,
}

export enum Management {
    FREEZE,
    RESOLVE,
    NORMALIZE,
}

// 0 for neither base/quote are stableCoin,
// 1 for quote is stableCoin & base is not,
// 2 for base is stableCoin & quote is not,
// 3 for base/quote both stableCoin
export enum FeederType {
    NONE_STABLE,
    QUOTE_STABLE,
    BASE_STABLE,
    BOTH_STABLE,
}

export enum QuoteType {
    INVALID,
    STABLE,
    NONSTABLE,
}

// Leverage, corresponding to IMR of 10%, 5%, 3%, 1% respectively
export enum Leverage {
    LOW,
    MEDIUM,
    HIGH,
    RISKY,
}

export enum MarketType {
    LINK = 'LINK',
    DEXV2 = 'DEXV2',
    EMG = 'EMG',
    PYTH = 'PYTH',
}

export enum BatchOrderSizeDistribution {
    FLAT,
    UPPER,
    LOWER,
    RANDOM,
}

export function cexMarket(marketType: MarketType): boolean {
    return marketType === MarketType.LINK || marketType === MarketType.EMG || marketType === MarketType.PYTH;
}

export function signOfSide(side: Side): number {
    switch (side) {
        case Side.LONG:
            return 1;
        case Side.SHORT:
            return -1;
        case Side.FLAT:
            return 0;
        default:
            throw new Error(`invalid side: ${side}`);
    }
}
