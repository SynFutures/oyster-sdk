[@synfutures/v3-sdk](../README.md) / RangeModel

# Class: RangeModel

## Table of contents

### Constructors

- [constructor](RangeModel.md#constructor)

### Properties

- [balance](RangeModel.md#balance)
- [entryFeeIndex](RangeModel.md#entryfeeindex)
- [liquidity](RangeModel.md#liquidity)
- [rootPair](RangeModel.md#rootpair)
- [sqrtEntryPX96](RangeModel.md#sqrtentrypx96)
- [tickLower](RangeModel.md#ticklower)
- [tickUpper](RangeModel.md#tickupper)

### Accessors

- [feeEarned](RangeModel.md#feeearned)
- [lowerPositionModelIfRemove](RangeModel.md#lowerpositionmodelifremove)
- [lowerPrice](RangeModel.md#lowerprice)
- [rid](RangeModel.md#rid)
- [upperPositionModelIfRemove](RangeModel.md#upperpositionmodelifremove)
- [upperPrice](RangeModel.md#upperprice)
- [valueLocked](RangeModel.md#valuelocked)

### Methods

- [customAmm](RangeModel.md#customamm)
- [rawPositionIfRemove](RangeModel.md#rawpositionifremove)
- [fromRawRange](RangeModel.md#fromrawrange)

## Constructors

### constructor

• **new RangeModel**(`rootPair`, `liquidity`, `balance`, `sqrtEntryPX96`, `entryFeeIndex`, `tickLower`, `tickUpper`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `rootPair` | [`PairModel`](PairModel.md) |
| `liquidity` | `BigNumber` |
| `balance` | `BigNumber` |
| `sqrtEntryPX96` | `BigNumber` |
| `entryFeeIndex` | `BigNumber` |
| `tickLower` | `number` |
| `tickUpper` | `number` |

## Properties

### balance

• **balance**: `BigNumber`

___

### entryFeeIndex

• **entryFeeIndex**: `BigNumber`

___

### liquidity

• **liquidity**: `BigNumber`

___

### rootPair

• `Readonly` **rootPair**: [`PairModel`](PairModel.md)

___

### sqrtEntryPX96

• **sqrtEntryPX96**: `BigNumber`

___

### tickLower

• **tickLower**: `number`

___

### tickUpper

• **tickUpper**: `number`

## Accessors

### feeEarned

• `get` **feeEarned**(): `BigNumber`

#### Returns

`BigNumber`

___

### lowerPositionModelIfRemove

• `get` **lowerPositionModelIfRemove**(): [`PositionModel`](PositionModel.md)

#### Returns

[`PositionModel`](PositionModel.md)

___

### lowerPrice

• `get` **lowerPrice**(): `BigNumber`

#### Returns

`BigNumber`

___

### rid

• `get` **rid**(): `number`

#### Returns

`number`

___

### upperPositionModelIfRemove

• `get` **upperPositionModelIfRemove**(): [`PositionModel`](PositionModel.md)

#### Returns

[`PositionModel`](PositionModel.md)

___

### upperPrice

• `get` **upperPrice**(): `BigNumber`

#### Returns

`BigNumber`

___

### valueLocked

• `get` **valueLocked**(): `BigNumber`

#### Returns

`BigNumber`

## Methods

### customAmm

▸ `Private` **customAmm**(`tick`, `input`): [`Amm`](../interfaces/Amm.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `tick` | `number` |
| `input` | [`Amm`](../interfaces/Amm.md) |

#### Returns

[`Amm`](../interfaces/Amm.md)

___

### rawPositionIfRemove

▸ **rawPositionIfRemove**(`amm`): [`Position`](../interfaces/Position.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `amm` | [`Amm`](../interfaces/Amm.md) |

#### Returns

[`Position`](../interfaces/Position.md)

___

### fromRawRange

▸ `Static` **fromRawRange**(`rootPair`, `range`, `rid`): [`RangeModel`](RangeModel.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `rootPair` | [`PairModel`](PairModel.md) |
| `range` | [`Range`](../interfaces/Range.md) |
| `rid` | `number` |

#### Returns

[`RangeModel`](RangeModel.md)
