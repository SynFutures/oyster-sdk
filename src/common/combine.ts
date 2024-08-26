/* eslint-disable @typescript-eslint/no-explicit-any */
export type Combine<T extends any[]> = T extends [infer First, ...infer Rest]
    ? First & Combine<Rest>
    : T extends [infer First]
    ? First
    : unknown;
