[@synfutures/v3-sdk](../README.md) / GateSnapshot

# Class: GateSnapshot

## Table of contents

### Constructors

- [constructor](GateSnapshot.md#constructor)

### Properties

- [balances](GateSnapshot.md#balances)
- [onNewInstrument](GateSnapshot.md#onnewinstrument)
- [wrappedNativeToken](GateSnapshot.md#wrappednativetoken)

### Methods

- [adjustBalance](GateSnapshot.md#adjustbalance)
- [copy](GateSnapshot.md#copy)
- [deserialize](GateSnapshot.md#deserialize)
- [getBalance](GateSnapshot.md#getbalance)
- [getEventTokenAddr](GateSnapshot.md#geteventtokenaddr)
- [handleDeposit](GateSnapshot.md#handledeposit)
- [handleGather](GateSnapshot.md#handlegather)
- [handleNewInstrument](GateSnapshot.md#handlenewinstrument)
- [handleScatter](GateSnapshot.md#handlescatter)
- [handleWithdraw](GateSnapshot.md#handlewithdraw)
- [serialize](GateSnapshot.md#serialize)

## Constructors

### constructor

• **new GateSnapshot**(`wrappedNativeToken`, `onNewInstrument`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `wrappedNativeToken` | `string` |
| `onNewInstrument` | (`instrument`: `string`, `quote`: `string`) => `void` |

## Properties

### balances

• **balances**: `Map`<`string`, `Map`<`string`, `BigNumber`\>\>

___

### onNewInstrument

• `Private` **onNewInstrument**: (`instrument`: `string`, `quote`: `string`) => `void`

#### Type declaration

▸ (`instrument`, `quote`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `instrument` | `string` |
| `quote` | `string` |

##### Returns

`void`

___

### wrappedNativeToken

• `Private` **wrappedNativeToken**: `string`

## Methods

### adjustBalance

▸ **adjustBalance**(`quote`, `trader`, `instrument`, `delta`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `quote` | `string` |
| `trader` | `string` |
| `instrument` | `string` |
| `delta` | `BigNumber` |

#### Returns

`void`

___

### copy

▸ **copy**(): [`GateSnapshot`](GateSnapshot.md)

#### Returns

[`GateSnapshot`](GateSnapshot.md)

___

### deserialize

▸ **deserialize**(`serialized`): [`GateSnapshot`](GateSnapshot.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `serialized` | `any` |

#### Returns

[`GateSnapshot`](GateSnapshot.md)

___

### getBalance

▸ **getBalance**(`quote`, `trader`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `quote` | `string` |
| `trader` | `string` |

#### Returns

`BigNumber`

___

### getEventTokenAddr

▸ **getEventTokenAddr**(`tokenAddr`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `tokenAddr` | `string` |

#### Returns

`string`

___

### handleDeposit

▸ **handleDeposit**(`quote`, `trader`, `amount`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `quote` | `string` |
| `trader` | `string` |
| `amount` | `BigNumber` |

#### Returns

`void`

___

### handleGather

▸ **handleGather**(`quote`, `trader`, `instrument`, `expiry`, `quantity`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `quote` | `string` |
| `trader` | `string` |
| `instrument` | `string` |
| `expiry` | `number` |
| `quantity` | `BigNumber` |

#### Returns

`void`

___

### handleNewInstrument

▸ **handleNewInstrument**(`index`, `instrument`, `base`, `quote`, `symbol`, `total`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `index` | `string` |
| `instrument` | `string` |
| `base` | `string` |
| `quote` | `string` |
| `symbol` | `string` |
| `total` | `BigNumber` |

#### Returns

`void`

___

### handleScatter

▸ **handleScatter**(`quote`, `trader`, `instrument`, `expiry`, `quantity`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `quote` | `string` |
| `trader` | `string` |
| `instrument` | `string` |
| `expiry` | `number` |
| `quantity` | `BigNumber` |

#### Returns

`void`

___

### handleWithdraw

▸ **handleWithdraw**(`quote`, `trader`, `amount`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `quote` | `string` |
| `trader` | `string` |
| `amount` | `BigNumber` |

#### Returns

`void`

___

### serialize

▸ **serialize**(): `any`

#### Returns

`any`
