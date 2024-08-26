/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SynFuturesV3 } from '../core';
import type { BaseInterface } from './base';

interface ModuleConstructor<T extends SynFuturesV3, U extends BaseInterface> {
    new (sdk: T): U;
}

/**
 * Mount module to sdk instance
 * @param sdk SDK instance
 * @param moduleConstructor Module class
 * @param module Module instance
 */
export function mount<T extends SynFuturesV3, U extends BaseInterface>(
    sdk: SynFuturesV3,
    moduleConstructor: ModuleConstructor<T, U>,
    module: U,
): void {
    // mount member functions
    Object.getOwnPropertyNames(moduleConstructor).forEach((prop) => {
        if (/^constructor$/.test(prop)) {
            // ignore
            return;
        }

        let descriptor = Object.getOwnPropertyDescriptor(moduleConstructor, prop)!;

        if (typeof descriptor.value === 'function') {
            descriptor = {
                ...descriptor,
                value: descriptor.value.bind(module),
            };
        }

        Object.defineProperty(sdk, prop, descriptor);
    });

    // mount member variables
    Object.getOwnPropertyNames(module).forEach((prop) => {
        if (prop === 'synfV3') {
            // ignore
            return;
        }

        const descriptor = Object.getOwnPropertyDescriptor(module, prop)!;

        if (typeof descriptor.value === 'function') {
            // ignore
            return;
        }

        Object.defineProperty(sdk, prop, {
            enumerable: false,
            configurable: false,
            get: function () {
                return (module as any)[prop];
            },
        });
    });
}
