export enum Stage {
    UPCOMING = 'UPCOMING',
    LIVE = 'LIVE',
    SUSPENDED = 'SUSPENDED',
    INVALID = 'INVALID',
}

export enum Phase {
    NONE = 0,
    PENDING = 1,
    WAITING = 2,
    READY = 3,
}

export enum PhaseGraph {
    NONE = 'NONE',
    PENDING = 'PENDING',
    WAITING = 'WAITING',
    READY = 'READY',
    CANCELED = 'CANCELED',
    DONE = 'DONE',
}
