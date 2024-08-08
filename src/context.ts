import {
    CacheInterface,
    ConfigInterface,
    createNullCacheModule,
    createNullConfigModule,
    createNullGateModule,
    createNullInstrumentModule,
    createNullObserverModule,
    createNullSimulateModule,
    createNullTransactionModule,
    GateInterface,
    InstrumentInterface,
    ObserverInterface,
    SimulateInterface,
} from './modules';
import { TxInterface } from './modules';

export interface Context {
    cache: CacheInterface;
    gate: GateInterface;
    instrument: InstrumentInterface;
    observer: ObserverInterface;
    simulate: SimulateInterface;
    tx: TxInterface;
    config: ConfigInterface;
}

export const createNullContext = (): Context => ({
    cache: createNullCacheModule(),
    gate: createNullGateModule(),
    instrument: createNullInstrumentModule(),
    observer: createNullObserverModule(),
    simulate: createNullSimulateModule(),
    tx: createNullTransactionModule(),
    config: createNullConfigModule(),
});
