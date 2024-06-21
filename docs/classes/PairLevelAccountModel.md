[@synfutures/v3-sdk](../README.md) / PairLevelAccountModel

# Class: PairLevelAccountModel

## Table of contents

### Constructors

- [constructor](PairLevelAccountModel.md#constructor)

### Properties

- [orders](PairLevelAccountModel.md#orders)
- [position](PairLevelAccountModel.md#position)
- [ranges](PairLevelAccountModel.md#ranges)
- [rootPair](PairLevelAccountModel.md#rootpair)
- [traderAddr](PairLevelAccountModel.md#traderaddr)

### Methods

- [containsRange](PairLevelAccountModel.md#containsrange)
- [getMainPosition](PairLevelAccountModel.md#getmainposition)
- [fromEmptyPortfolio](PairLevelAccountModel.md#fromemptyportfolio)
- [fromRawPortfolio](PairLevelAccountModel.md#fromrawportfolio)

## Constructors

### constructor

• **new PairLevelAccountModel**(`rootPair`, `traderAddr`, `position`, `ranges`, `orders`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `rootPair` | [`PairModel`](PairModel.md) |
| `traderAddr` | `string` |
| `position` | [`PositionModel`](PositionModel.md) |
| `ranges` | [`RangeModel`](RangeModel.md)[] |
| `orders` | [`OrderModel`](OrderModel.md)[] |

## Properties

### orders

• **orders**: [`OrderModel`](OrderModel.md)[]

___

### position

• **position**: [`PositionModel`](PositionModel.md)

___

### ranges

• **ranges**: [`RangeModel`](RangeModel.md)[]

___

### rootPair

• `Readonly` **rootPair**: [`PairModel`](PairModel.md)

___

### traderAddr

• **traderAddr**: `string`

## Methods

### containsRange

▸ **containsRange**(`lowerTick`, `upperTick`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `lowerTick` | `number` |
| `upperTick` | `number` |

#### Returns

`boolean`

___

### getMainPosition

▸ **getMainPosition**(): [`PositionModel`](PositionModel.md)

#### Returns

[`PositionModel`](PositionModel.md)

___

### fromEmptyPortfolio

▸ `Static` **fromEmptyPortfolio**(`rootPair`, `traderAddr`): [`PairLevelAccountModel`](PairLevelAccountModel.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `rootPair` | [`PairModel`](PairModel.md) |
| `traderAddr` | `string` |

#### Returns

[`PairLevelAccountModel`](PairLevelAccountModel.md)

___

### fromRawPortfolio

▸ `Static` **fromRawPortfolio**(`rootPair`, `traderAddr`, `portfolio`): [`PairLevelAccountModel`](PairLevelAccountModel.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `rootPair` | [`PairModel`](PairModel.md) |
| `traderAddr` | `string` |
| `portfolio` | [`Portfolio`](../interfaces/Portfolio.md) |

#### Returns

[`PairLevelAccountModel`](PairLevelAccountModel.md)
