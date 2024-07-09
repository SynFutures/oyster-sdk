export interface PairConfig {
    maxRangeNumber: number;
    maxOrderNumber: number;
    maxPairNumber: number;
}

export enum VaultStatus {
    UPCOMING = 0,
    LIVE = 1,
    FROZEN = 2,
    INVALID = 3,
}
