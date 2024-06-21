[@synfutures/v3-sdk](../README.md) / Comparator

# Class: Comparator

## Table of contents

### Constructors

- [constructor](Comparator.md#constructor)

### Properties

- [getBlockTimestamp](Comparator.md#getblocktimestamp)
- [logger](Comparator.md#logger)
- [overrides](Comparator.md#overrides)
- [sdk](Comparator.md#sdk)
- [shader](Comparator.md#shader)

### Methods

- [compareAccounts](Comparator.md#compareaccounts)
- [compareAmm](Comparator.md#compareamm)
- [compareBalance](Comparator.md#comparebalance)
- [compareObj](Comparator.md#compareobj)
- [comparePearlsAndBitMap](Comparator.md#comparepearlsandbitmap)
- [compareRecords](Comparator.md#comparerecords)
- [fillZero](Comparator.md#fillzero)
- [getAccountFromObserver](Comparator.md#getaccountfromobserver)
- [getAmmFromObserver](Comparator.md#getammfromobserver)
- [getBalanceFromVault](Comparator.md#getbalancefromvault)
- [getPbits](Comparator.md#getpbits)
- [getPearlsFromObserver](Comparator.md#getpearlsfromobserver)
- [getRecordsFromObserver](Comparator.md#getrecordsfromobserver)
- [getTBitMapFromObserver](Comparator.md#gettbitmapfromobserver)
- [toMap](Comparator.md#tomap)

## Constructors

### constructor

• **new Comparator**(`sdk`, `options?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `sdk` | [`SynFuturesV3`](SynFuturesV3.md) |
| `options?` | `Partial`<[`ComparatorOptions`](../interfaces/ComparatorOptions.md)\> |

## Properties

### getBlockTimestamp

• `Private` **getBlockTimestamp**: (`blockNumber`: `number`) => `Promise`<`number`\>

#### Type declaration

▸ (`blockNumber`): `Promise`<`number`\>

##### Parameters

| Name | Type |
| :------ | :------ |
| `blockNumber` | `number` |

##### Returns

`Promise`<`number`\>

___

### logger

• `Private` **logger**: `Logger`

___

### overrides

• `Private` **overrides**: `CallOverrides`

___

### sdk

• `Private` **sdk**: [`SynFuturesV3`](SynFuturesV3.md)

___

### shader

• `Private` **shader**: `Shader`

## Methods

### compareAccounts

▸ **compareAccounts**(`instrument`, `expiry`, `accounts`, `accountsMap`): `Promise`<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrument` | `string` |
| `expiry` | `number` |
| `accounts` | `string`[] |
| `accountsMap` | `Map`<`string`, [`AccountSnapshot`](AccountSnapshot.md)\> |

#### Returns

`Promise`<`boolean`\>

___

### compareAmm

▸ **compareAmm**(`instrument`, `expiry`, `localAmm`): `Promise`<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrument` | `string` |
| `expiry` | `number` |
| `localAmm` | [`IncompleteAmm`](../interfaces/IncompleteAmm.md) |

#### Returns

`Promise`<`boolean`\>

___

### compareBalance

▸ **compareBalance**(`quote`, `accounts`, `accounts2balance`): `Promise`<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `quote` | `string` |
| `accounts` | `string`[] |
| `accounts2balance` | `Map`<`string`, `BigNumber`\> |

#### Returns

`Promise`<`boolean`\>

___

### compareObj

▸ **compareObj**(`fromContract`, `fromLocal`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `fromContract` | `any` |
| `fromLocal` | `any` |

#### Returns

`boolean`

___

### comparePearlsAndBitMap

▸ **comparePearlsAndBitMap**(`instrument`, `expiry`, `tBitMapFromLocal`, `pearlsMapFromLocal`): `Promise`<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrument` | `string` |
| `expiry` | `number` |
| `tBitMapFromLocal` | `Map`<`number`, `BigNumber`\> |
| `pearlsMapFromLocal` | `Map`<`number`, [`Pearl`](../interfaces/Pearl.md)\> |

#### Returns

`Promise`<`boolean`\>

___

### compareRecords

▸ **compareRecords**(`instrument`, `expiry`, `records`): `Promise`<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrument` | `string` |
| `expiry` | `number` |
| `records` | `Map`<`number`, `Map`<`number`, [`ContractRecord`](../interfaces/ContractRecord.md)\>\> |

#### Returns

`Promise`<`boolean`\>

___

### fillZero

▸ **fillZero**(`ori`): `any`[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `ori` | `any`[] |

#### Returns

`any`[]

___

### getAccountFromObserver

▸ **getAccountFromObserver**(`instrument`, `expiry`, `account`): `Promise`<[`AccountSnapshot`](AccountSnapshot.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrument` | `string` |
| `expiry` | `number` |
| `account` | `string` |

#### Returns

`Promise`<[`AccountSnapshot`](AccountSnapshot.md)\>

___

### getAmmFromObserver

▸ **getAmmFromObserver**(`instrument`, `expiry`): `Promise`<[`Amm`](../interfaces/Amm.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrument` | `string` |
| `expiry` | `number` |

#### Returns

`Promise`<[`Amm`](../interfaces/Amm.md)\>

___

### getBalanceFromVault

▸ **getBalanceFromVault**(`token`, `account`): `Promise`<`BigNumber`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `token` | `string` |
| `account` | `string` |

#### Returns

`Promise`<`BigNumber`\>

___

### getPbits

▸ **getPbits**(`pbitmap`): `number`[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `pbitmap` | `BigNumber` |

#### Returns

`number`[]

___

### getPearlsFromObserver

▸ **getPearlsFromObserver**(`instrument`, `expiry`, `tBitMap`, `referalKeys`): `Promise`<`Map`<`number`, [`Pearl`](../interfaces/Pearl.md)\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrument` | `string` |
| `expiry` | `number` |
| `tBitMap` | `Map`<`number`, `BigNumber`\> |
| `referalKeys` | `number`[] |

#### Returns

`Promise`<`Map`<`number`, [`Pearl`](../interfaces/Pearl.md)\>\>

___

### getRecordsFromObserver

▸ **getRecordsFromObserver**(`instrument`, `expiry`, `records`): `Promise`<`Map`<`number`, `Map`<`number`, [`ContractRecord`](../interfaces/ContractRecord.md)\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrument` | `string` |
| `expiry` | `number` |
| `records` | `Map`<`number`, `Map`<`number`, [`ContractRecord`](../interfaces/ContractRecord.md)\>\> |

#### Returns

`Promise`<`Map`<`number`, `Map`<`number`, [`ContractRecord`](../interfaces/ContractRecord.md)\>\>\>

___

### getTBitMapFromObserver

▸ **getTBitMapFromObserver**(`instrument`, `expiry`): `Promise`<`Map`<`number`, `BigNumber`\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrument` | `string` |
| `expiry` | `number` |

#### Returns

`Promise`<`Map`<`number`, `BigNumber`\>\>

___

### toMap

▸ **toMap**(`indexs`, `entities`): `Map`<`number`, `any`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `indexs` | `number`[] |
| `entities` | `any`[] |

#### Returns

`Map`<`number`, `any`\>
