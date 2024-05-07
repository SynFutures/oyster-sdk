[@synfutures/v3-sdk](../README.md) / CtxSnapshot

# Class: CtxSnapshot

## Table of contents

### Constructors

- [constructor](CtxSnapshot.md#constructor)

### Properties

- [amm](CtxSnapshot.md#amm)
- [pearls](CtxSnapshot.md#pearls)
- [records](CtxSnapshot.md#records)
- [tbitmap](CtxSnapshot.md#tbitmap)

### Methods

- [copy](CtxSnapshot.md#copy)
- [decreaseInvolvedFund](CtxSnapshot.md#decreaseinvolvedfund)
- [deserialize](CtxSnapshot.md#deserialize)
- [flipTick](CtxSnapshot.md#fliptick)
- [getPearl](CtxSnapshot.md#getpearl)
- [getRecord](CtxSnapshot.md#getrecord)
- [getTbitmapWord](CtxSnapshot.md#gettbitmapword)
- [increaseInvolvedFund](CtxSnapshot.md#increaseinvolvedfund)
- [nextInitializedTick](CtxSnapshot.md#nextinitializedtick)
- [serialize](CtxSnapshot.md#serialize)
- [setContextPostTakeOrder](CtxSnapshot.md#setcontextposttakeorder)
- [updateLiquidityInfo](CtxSnapshot.md#updateliquidityinfo)
- [updateOI](CtxSnapshot.md#updateoi)
- [updateRecord](CtxSnapshot.md#updaterecord)
- [updateTickOrder](CtxSnapshot.md#updatetickorder)
- [updateTicksRange](CtxSnapshot.md#updateticksrange)

## Constructors

### constructor

• **new CtxSnapshot**()

## Properties

### amm

• **amm**: [`IncompleteAmm`](../interfaces/IncompleteAmm.md)

___

### pearls

• **pearls**: `Map`<`number`, [`Pearl`](../interfaces/Pearl.md)\>

___

### records

• **records**: `Map`<`number`, `Map`<`number`, [`ContractRecord`](../interfaces/ContractRecord.md)\>\>

___

### tbitmap

• **tbitmap**: `Map`<`number`, `BigNumber`\>

## Methods

### copy

▸ **copy**(): [`CtxSnapshot`](CtxSnapshot.md)

#### Returns

[`CtxSnapshot`](CtxSnapshot.md)

___

### decreaseInvolvedFund

▸ **decreaseInvolvedFund**(`delta`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `delta` | `BigNumber` |

#### Returns

`BigNumber`

___

### deserialize

▸ **deserialize**(`serialized`): [`CtxSnapshot`](CtxSnapshot.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `serialized` | `any` |

#### Returns

[`CtxSnapshot`](CtxSnapshot.md)

___

### flipTick

▸ **flipTick**(`tick`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `tick` | `number` |

#### Returns

`void`

___

### getPearl

▸ **getPearl**(`tick`): [`Pearl`](../interfaces/Pearl.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `tick` | `number` |

#### Returns

[`Pearl`](../interfaces/Pearl.md)

___

### getRecord

▸ **getRecord**(`tick`, `nonce`): [`ContractRecord`](../interfaces/ContractRecord.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `tick` | `number` |
| `nonce` | `number` |

#### Returns

[`ContractRecord`](../interfaces/ContractRecord.md)

___

### getTbitmapWord

▸ **getTbitmapWord**(`wordPos`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `wordPos` | `number` |

#### Returns

`BigNumber`

___

### increaseInvolvedFund

▸ **increaseInvolvedFund**(`delta`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `delta` | `BigNumber` |

#### Returns

`void`

___

### nextInitializedTick

▸ **nextInitializedTick**(`tick`, `right`): `number`

#### Parameters

| Name | Type |
| :------ | :------ |
| `tick` | `number` |
| `right` | `boolean` |

#### Returns

`number`

___

### serialize

▸ **serialize**(): `any`

#### Returns

`any`

___

### setContextPostTakeOrder

▸ **setContextPostTakeOrder**(`tick`, `taken`, `feeRatio`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `tick` | `number` |
| `taken` | `BigNumber` |
| `feeRatio` | `number` |

#### Returns

`BigNumber`

___

### updateLiquidityInfo

▸ **updateLiquidityInfo**(`tick`, `liquidityDelta`, `upper`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `tick` | `number` |
| `liquidityDelta` | `BigNumber` |
| `upper` | `boolean` |

#### Returns

`boolean`

___

### updateOI

▸ **updateOI**(`delta`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `delta` | `BigNumber` |

#### Returns

`void`

___

### updateRecord

▸ **updateRecord**(`tick`, `nonce`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `tick` | `number` |
| `nonce` | `number` |

#### Returns

`void`

___

### updateTickOrder

▸ **updateTickOrder**(`tick`, `delta`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `tick` | `number` |
| `delta` | `BigNumber` |

#### Returns

`void`

___

### updateTicksRange

▸ **updateTicksRange**(`tickLower`, `tickUpper`, `delta`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `tickLower` | `number` |
| `tickUpper` | `number` |
| `delta` | `BigNumber` |

#### Returns

`void`
