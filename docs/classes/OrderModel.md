[@synfutures/v3-sdk](../README.md) / OrderModel

# Class: OrderModel

## Implements

- [`Order`](../interfaces/Order.md)

## Table of contents

### Constructors

- [constructor](OrderModel.md#constructor)

### Properties

- [balance](OrderModel.md#balance)
- [nonce](OrderModel.md#nonce)
- [rootPair](OrderModel.md#rootpair)
- [size](OrderModel.md#size)
- [taken](OrderModel.md#taken)
- [tick](OrderModel.md#tick)

### Accessors

- [equity](OrderModel.md#equity)
- [leverageWad](OrderModel.md#leveragewad)
- [limitPrice](OrderModel.md#limitprice)
- [oid](OrderModel.md#oid)
- [side](OrderModel.md#side)

### Methods

- [toPositionModel](OrderModel.md#topositionmodel)
- [fromRawOrder](OrderModel.md#fromraworder)

## Constructors

### constructor

• **new OrderModel**(`rootPair`, `balance`, `size`, `taken`, `tick`, `nonce`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `rootPair` | [`PairModel`](PairModel.md) |
| `balance` | `BigNumber` |
| `size` | `BigNumber` |
| `taken` | `BigNumber` |
| `tick` | `number` |
| `nonce` | `number` |

## Properties

### balance

• **balance**: `BigNumber`

#### Implementation of

[Order](../interfaces/Order.md).[balance](../interfaces/Order.md#balance)

___

### nonce

• **nonce**: `number`

___

### rootPair

• `Readonly` **rootPair**: [`PairModel`](PairModel.md)

___

### size

• **size**: `BigNumber`

#### Implementation of

[Order](../interfaces/Order.md).[size](../interfaces/Order.md#size)

___

### taken

• **taken**: `BigNumber`

___

### tick

• **tick**: `number`

## Accessors

### equity

• `get` **equity**(): `BigNumber`

#### Returns

`BigNumber`

___

### leverageWad

• `get` **leverageWad**(): `BigNumber`

#### Returns

`BigNumber`

___

### limitPrice

• `get` **limitPrice**(): `BigNumber`

#### Returns

`BigNumber`

___

### oid

• `get` **oid**(): `number`

#### Returns

`number`

___

### side

• `get` **side**(): [`Side`](../enums/Side.md)

#### Returns

[`Side`](../enums/Side.md)

## Methods

### toPositionModel

▸ **toPositionModel**(): [`PositionModel`](PositionModel.md)

#### Returns

[`PositionModel`](PositionModel.md)

___

### fromRawOrder

▸ `Static` **fromRawOrder**(`rootPair`, `order`, `taken`, `oid`): [`OrderModel`](OrderModel.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `rootPair` | [`PairModel`](PairModel.md) |
| `order` | [`Order`](../interfaces/Order.md) |
| `taken` | `BigNumber` |
| `oid` | `number` |

#### Returns

[`OrderModel`](OrderModel.md)
