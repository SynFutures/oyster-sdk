import { BigNumber } from 'ethers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeBNObject(data: any, bnFormatter?: (value: BigNumber) => string): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedData: any = {};

    for (const key in data) {
        const value = data[key];
        if (BigNumber.isBigNumber(value)) {
            transformedData[key] = bnFormatter ? bnFormatter(value) : value.toString();
        } else if (typeof value === 'object') {
            transformedData[key] = serializeBNObject(value, bnFormatter);
        } else {
            transformedData[key] = value;
        }
    }
    return transformedData;
}

// const x = {
//     a: 1,
//     b: 2,
//     c: {
//         x1: '2',
//         x2: BigNumber.from('1230000000000'),
//     },
// };
// console.info(serializeBNObject(x, ethers.utils.formatEther));
