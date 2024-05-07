import type { LogDescription } from '@ethersproject/abi';
export type ParsedEvent<T> = Omit<LogDescription, 'args'> & { args: T };
