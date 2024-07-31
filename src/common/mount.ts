/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SynFuturesV3 } from '../synfuturesV3Core';

export interface Module {
    synfV3: SynFuturesV3;
}

interface ModuleConstructor<T extends Module> {
    new (sdk: SynFuturesV3): T;
}

function mixinProps(target: any, source: any, obj: any): void {
    Object.getOwnPropertyNames(source).forEach((prop) => {
        if (/^constructor$/.test(prop)) {
            // ignore
            return;
        }

        let descriptor = Object.getOwnPropertyDescriptor(source, prop)!;

        if (typeof descriptor.value === 'function') {
            descriptor = {
                ...descriptor,
                value: descriptor.value.bind(obj),
            };
        }

        Object.defineProperty(target, prop, descriptor);
    });

    Object.getOwnPropertyNames(obj).forEach((prop) => {
        if (prop === 'synfV3') {
            // ignore
            return;
        }

        const descriptor = Object.getOwnPropertyDescriptor(obj, prop)!;

        if (typeof descriptor.value === 'function') {
            // ignore
            return;
        }

        Object.defineProperty(target, prop, {
            enumerable: false,
            configurable: false,
            get: function () {
                return obj[prop];
            },
        });
    });
}

/**
 * Mount module to sdk instance
 * @param sdk SDK instance
 * @param module Module class
 * @returns Module instance
 */
export function mount<T extends Module>(sdk: SynFuturesV3, module: ModuleConstructor<T>): T {
    const _module = new module(sdk);

    mixinProps(sdk, module.prototype, _module);

    return _module;
}
