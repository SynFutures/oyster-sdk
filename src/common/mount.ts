/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function mixinProps(target: any, source: any, obj: any): void {
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
