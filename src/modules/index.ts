import { SynFuturesV3Ctx } from '../synfuturesV3Core';

export interface BaseInterFace {
    synfV3: SynFuturesV3Ctx;
}

export * from './cache.interface';
export * from './instrument.interface';
export * from './simulate.interface';
export * from './gate.interface';
export * from './observer.interface';
export * from './tx.interface';
export * from './config.interface';
export * from './cache.module';
export * from './instrument.module';
export * from './simulate.module';
export * from './gate.module';
export * from './observer.module';
export * from './tx.module';
