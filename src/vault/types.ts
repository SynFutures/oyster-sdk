export enum Stage {
    UPCOMING = 'UPCOMING',
    LIVE = 'LIVE',
    SUSPENDED = 'SUSPENDED',
    INVALID = 'INVALID',
}

export enum Phase {
    NONE = 0,
    WAIT_ADJUST = 1,
    WAIT_RELEASE = 2,
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
