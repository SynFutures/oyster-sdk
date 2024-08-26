/* eslint-disable no-prototype-builtins */
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
    Object.getOwnPropertyNames(moduleConstructor.prototype).forEach((prop) => {
        if (/^constructor$/.test(prop)) {
            // ignore
            return;
        }

        let descriptor = Object.getOwnPropertyDescriptor(moduleConstructor.prototype, prop)!;

        if (typeof descriptor.value === 'function') {
            descriptor = {
                ...descriptor,
                configurable: true,
                value: descriptor.value.bind(module),
            };
        }

        if (typeof descriptor.get === 'function') {
            descriptor = {
                ...descriptor,
                configurable: true,
                get: descriptor.get.bind(module),
            };
        }

        if (typeof descriptor.set === 'function') {
            descriptor = {
                ...descriptor,
                configurable: true,
                set: descriptor.set.bind(module),
            };
        }

        // delete old property
        const old = Object.getOwnPropertyDescriptor(sdk, prop);
        if (old !== undefined) {
            delete (sdk as any)[prop];
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

        // delete old property
        const old = Object.getOwnPropertyDescriptor(sdk, prop);
        if (old !== undefined) {
            delete (sdk as any)[prop];
        }

        Object.defineProperty(sdk, prop, {
            configurable: true,
            get: function () {
                return (module as any)[prop];
            },
        });
    });
}
