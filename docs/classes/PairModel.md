[@synfutures/v3-sdk](../README.md) / PairModel

# Class: PairModel

## Table of contents

### Constructors

- [constructor](PairModel.md#constructor)

### Properties

- [amm](PairModel.md#amm)
- [markPrice](PairModel.md#markprice)
- [rootInstrument](PairModel.md#rootinstrument)

### Accessors

- [benchmarkPrice](PairModel.md#benchmarkprice)
- [fairPriceWad](PairModel.md#fairpricewad)
- [openInterests](PairModel.md#openinterests)
- [symbol](PairModel.md#symbol)

### Methods

- [getMinLiquidity](PairModel.md#getminliquidity)
- [minimalPairWithAmm](PairModel.md#minimalpairwithamm)

## Constructors

### constructor

• **new PairModel**(`rootInstrument`, `amm`, `markPrice`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `rootInstrument` | [`InstrumentModel`](InstrumentModel.md) |
| `amm` | [`Amm`](../interfaces/Amm.md) |
| `markPrice` | `BigNumber` |

## Properties

### amm

• **amm**: [`Amm`](../interfaces/Amm.md)

___

### markPrice

• **markPrice**: `BigNumber`

___

### rootInstrument

• `Readonly` **rootInstrument**: [`InstrumentModel`](InstrumentModel.md)

## Accessors

### benchmarkPrice

• `get` **benchmarkPrice**(): `BigNumber`

#### Returns

`BigNumber`

___

### fairPriceWad

• `get` **fairPriceWad**(): `BigNumber`

#### Returns

`BigNumber`

___

### openInterests

• `get` **openInterests**(): `BigNumber`

#### Returns

`BigNumber`

___

### symbol

• `get` **symbol**(): `string`

#### Returns

`string`

## Methods

### getMinLiquidity

▸ **getMinLiquidity**(`px96?`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `px96?` | `BigNumber` |

#### Returns

`BigNumber`

___

### minimalPairWithAmm

▸ `Static` **minimalPairWithAmm**(`instrumentModel`, `initPairPrice`): [`PairModel`](PairModel.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrumentModel` | [`InstrumentModel`](InstrumentModel.md) |
| `initPairPrice` | `BigNumber` |

#### Returns

[`PairModel`](PairModel.md)
