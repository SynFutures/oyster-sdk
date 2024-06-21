[@synfutures/v3-sdk](../README.md) / AccountSnapshot

# Class: AccountSnapshot

## Table of contents

### Constructors

- [constructor](AccountSnapshot.md#constructor)

### Properties

- [oids](AccountSnapshot.md#oids)
- [onumber](AccountSnapshot.md#onumber)
- [orders](AccountSnapshot.md#orders)
- [position](AccountSnapshot.md#position)
- [ranges](AccountSnapshot.md#ranges)
- [rids](AccountSnapshot.md#rids)
- [rnumber](AccountSnapshot.md#rnumber)

### Methods

- [addOrder](AccountSnapshot.md#addorder)
- [addRange](AccountSnapshot.md#addrange)
- [copy](AccountSnapshot.md#copy)
- [delOrder](AccountSnapshot.md#delorder)
- [delPosition](AccountSnapshot.md#delposition)
- [delRange](AccountSnapshot.md#delrange)
- [deserialize](AccountSnapshot.md#deserialize)
- [getIthOrderIndex](AccountSnapshot.md#getithorderindex)
- [getIthRangeIndex](AccountSnapshot.md#getithrangeindex)
- [getPosition](AccountSnapshot.md#getposition)
- [serialize](AccountSnapshot.md#serialize)
- [setPosition](AccountSnapshot.md#setposition)
- [settle](AccountSnapshot.md#settle)

## Constructors

### constructor

• **new AccountSnapshot**()

## Properties

### oids

• **oids**: `number`[]

___

### onumber

• **onumber**: `number` = `0`

___

### orders

• **orders**: `Map`<`number`, [`Order`](../interfaces/Order.md)\>

___

### position

• **position**: [`Position`](../interfaces/Position.md)

___

### ranges

• **ranges**: `Map`<`number`, [`Range`](../interfaces/Range.md)\>

___

### rids

• **rids**: `number`[]

___

### rnumber

• **rnumber**: `number` = `0`

## Methods

### addOrder

▸ **addOrder**(`tick`, `nonce`, `order`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `tick` | `number` |
| `nonce` | `number` |
| `order` | [`Order`](../interfaces/Order.md) |

#### Returns

`void`

___

### addRange

▸ **addRange**(`tickLower`, `tickUpper`, `range`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `tickLower` | `number` |
| `tickUpper` | `number` |
| `range` | [`Range`](../interfaces/Range.md) |

#### Returns

`void`

___

### copy

▸ **copy**(): [`AccountSnapshot`](AccountSnapshot.md)

#### Returns

[`AccountSnapshot`](AccountSnapshot.md)

___

### delOrder

▸ **delOrder**(`tick`, `nonce`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `tick` | `number` |
| `nonce` | `number` |

#### Returns

`void`

___

### delPosition

▸ **delPosition**(): `void`

#### Returns

`void`

___

### delRange

▸ **delRange**(`tickLower`, `tickUpper`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `tickLower` | `number` |
| `tickUpper` | `number` |

#### Returns

`void`

___

### deserialize

▸ **deserialize**(`serialized`): [`AccountSnapshot`](AccountSnapshot.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `serialized` | `any` |

#### Returns

[`AccountSnapshot`](AccountSnapshot.md)

___

### getIthOrderIndex

▸ **getIthOrderIndex**(`i`): `Object`

#### Parameters

| Name | Type |
| :------ | :------ |
| `i` | `number` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `nonce` | `number` |
| `tick` | `number` |

___

### getIthRangeIndex

▸ **getIthRangeIndex**(`i`): `Object`

#### Parameters

| Name | Type |
| :------ | :------ |
| `i` | `number` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `tickLower` | `number` |
| `tickUpper` | `number` |

___

### getPosition

▸ **getPosition**(): [`Position`](../interfaces/Position.md)

#### Returns

[`Position`](../interfaces/Position.md)

___

### serialize

▸ **serialize**(): `any`

#### Returns

`any`

___

### setPosition

▸ **setPosition**(`position`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `position` | [`Position`](../interfaces/Position.md) |

#### Returns

`void`

___

### settle

▸ **settle**(): `void`

#### Returns

`void`
