export enum VaultStatus {
    UPCOMING = 'UPCOMING',
    LIVE = 'LIVE',
    SUSPENDED = 'SUSPENDED',
    INVALID = 'INVALID',
}

export enum PendingWithdrawStatus {
    NONE = 0,
    PENDING = 1,
    WAITING = 2,
    READY = 3,
}

export enum PendingWithdrawStatusGraph {
    NONE = 'NONE',
    PENDING = 'PENDING',
    WAITING = 'WAITING',
    READY = 'READY',
    CANCELED = 'CANCELED',
    DONE = 'DONE',
}
