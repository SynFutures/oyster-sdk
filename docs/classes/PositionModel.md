[@synfutures/v3-sdk](../README.md) / PositionModel

# Class: PositionModel

## Implements

- [`Position`](../interfaces/Position.md)

## Table of contents

### Constructors

- [constructor](PositionModel.md#constructor)

### Properties

- [balance](PositionModel.md#balance)
- [entryFundingIndex](PositionModel.md#entryfundingindex)
- [entryNotional](PositionModel.md#entrynotional)
- [entrySocialLossIndex](PositionModel.md#entrysociallossindex)
- [rootPair](PositionModel.md#rootpair)
- [size](PositionModel.md#size)

### Accessors

- [entryPrice](PositionModel.md#entryprice)
- [leverageWad](PositionModel.md#leveragewad)
- [liquidationPrice](PositionModel.md#liquidationprice)
- [side](PositionModel.md#side)
- [unrealizedPnl](PositionModel.md#unrealizedpnl)

### Methods

- [getAdditionMarginToIMRSafe](PositionModel.md#getadditionmargintoimrsafe)
- [getEquity](PositionModel.md#getequity)
- [getMaxWithdrawableMargin](PositionModel.md#getmaxwithdrawablemargin)
- [isPositionIMSafe](PositionModel.md#ispositionimsafe)
- [isPositionMMSafe](PositionModel.md#ispositionmmsafe)
- [fromEmptyPosition](PositionModel.md#fromemptyposition)
- [fromRawPosition](PositionModel.md#fromrawposition)

## Constructors

### constructor

• **new PositionModel**(`rootPair`, `balance`, `size`, `entryNotional`, `entrySocialLossIndex`, `entryFundingIndex`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `rootPair` | [`PairModel`](PairModel.md) |
| `balance` | `BigNumber` |
| `size` | `BigNumber` |
| `entryNotional` | `BigNumber` |
| `entrySocialLossIndex` | `BigNumber` |
| `entryFundingIndex` | `BigNumber` |

## Properties

### balance

• **balance**: `BigNumber`

#### Implementation of

[Position](../interfaces/Position.md).[balance](../interfaces/Position.md#balance)

___

### entryFundingIndex

• **entryFundingIndex**: `BigNumber`

#### Implementation of

[Position](../interfaces/Position.md).[entryFundingIndex](../interfaces/Position.md#entryfundingindex)

___

### entryNotional

• **entryNotional**: `BigNumber`

#### Implementation of

[Position](../interfaces/Position.md).[entryNotional](../interfaces/Position.md#entrynotional)

___

### entrySocialLossIndex

• **entrySocialLossIndex**: `BigNumber`

#### Implementation of

[Position](../interfaces/Position.md).[entrySocialLossIndex](../interfaces/Position.md#entrysociallossindex)

___

### rootPair

• `Readonly` **rootPair**: [`PairModel`](PairModel.md)

___

### size

• **size**: `BigNumber`

#### Implementation of

[Position](../interfaces/Position.md).[size](../interfaces/Position.md#size)

## Accessors

### entryPrice

• `get` **entryPrice**(): `BigNumber`

#### Returns

`BigNumber`

___

### leverageWad

• `get` **leverageWad**(): `BigNumber`

#### Returns

`BigNumber`

___

### liquidationPrice

• `get` **liquidationPrice**(): `BigNumber`

#### Returns

`BigNumber`

___

### side

• `get` **side**(): [`Side`](../enums/Side.md)

#### Returns

[`Side`](../enums/Side.md)

___

### unrealizedPnl

• `get` **unrealizedPnl**(): `BigNumber`

#### Returns

`BigNumber`

## Methods

### getAdditionMarginToIMRSafe

▸ **getAdditionMarginToIMRSafe**(`increase`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `increase` | `boolean` |

#### Returns

`BigNumber`

___

### getEquity

▸ **getEquity**(): `BigNumber`

#### Returns

`BigNumber`

___

### getMaxWithdrawableMargin

▸ **getMaxWithdrawableMargin**(): `BigNumber`

#### Returns

`BigNumber`

___

### isPositionIMSafe

▸ **isPositionIMSafe**(`increase`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `increase` | `boolean` |

#### Returns

`boolean`

___

### isPositionMMSafe

▸ **isPositionMMSafe**(): `boolean`

#### Returns

`boolean`

___

### fromEmptyPosition

▸ `Static` **fromEmptyPosition**(`rootPair`): [`PositionModel`](PositionModel.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `rootPair` | [`PairModel`](PairModel.md) |

#### Returns

[`PositionModel`](PositionModel.md)

___

### fromRawPosition

▸ `Static` **fromRawPosition**(`rootPair`, `pos`): [`PositionModel`](PositionModel.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `rootPair` | [`PairModel`](PairModel.md) |
| `pos` | [`Position`](../interfaces/Position.md) |

#### Returns

[`PositionModel`](PositionModel.md)
