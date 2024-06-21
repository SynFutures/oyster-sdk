[@synfutures/v3-sdk](../README.md) / InstrumentModel

# Class: InstrumentModel

## Table of contents

### Constructors

- [constructor](InstrumentModel.md#constructor)

### Properties

- [info](InstrumentModel.md#info)
- [market](InstrumentModel.md#market)
- [rootSubVaultCache](InstrumentModel.md#rootsubvaultcache)
- [setting](InstrumentModel.md#setting)
- [state](InstrumentModel.md#state)

### Accessors

- [instrumentType](InstrumentModel.md#instrumenttype)
- [marketType](InstrumentModel.md#markettype)
- [minOrderValue](InstrumentModel.md#minordervalue)
- [minRangeValue](InstrumentModel.md#minrangevalue)
- [minTradeValue](InstrumentModel.md#mintradevalue)
- [spotPrice](InstrumentModel.md#spotprice)

### Methods

- [getBenchmarkPrice](InstrumentModel.md#getbenchmarkprice)
- [getFundingRate](InstrumentModel.md#getfundingrate)
- [updatePair](InstrumentModel.md#updatepair)
- [minimumInstrumentWithParam](InstrumentModel.md#minimuminstrumentwithparam)

## Constructors

### constructor

• **new InstrumentModel**(`rootSubVaultCache`, `info`, `market`, `state`, `initialMarginRatio`, `maintenanceMarginRatio`, `param`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `rootSubVaultCache` | `Map`<`string`, `BigNumber`\> |
| `info` | [`InstrumentInfo`](../interfaces/InstrumentInfo.md) |
| `market` | [`InstrumentMarket`](../interfaces/InstrumentMarket.md) |
| `state` | [`InstrumentState`](../interfaces/InstrumentState.md) |
| `initialMarginRatio` | `number` |
| `maintenanceMarginRatio` | `number` |
| `param` | [`QuoteParam`](../interfaces/QuoteParam.md) |

## Properties

### info

• **info**: [`InstrumentInfo`](../interfaces/InstrumentInfo.md)

___

### market

• **market**: [`InstrumentMarket`](../interfaces/InstrumentMarket.md)

___

### rootSubVaultCache

• `Readonly` **rootSubVaultCache**: `Map`<`string`, `BigNumber`\>

___

### setting

• **setting**: [`InstrumentSetting`](../interfaces/InstrumentSetting.md)

___

### state

• **state**: [`InstrumentState`](../interfaces/InstrumentState.md)

## Accessors

### instrumentType

• `get` **instrumentType**(): [`FeederType`](../enums/FeederType.md)

#### Returns

[`FeederType`](../enums/FeederType.md)

___

### marketType

• `get` **marketType**(): [`MarketType`](../enums/MarketType.md)

#### Returns

[`MarketType`](../enums/MarketType.md)

___

### minOrderValue

• `get` **minOrderValue**(): `BigNumber`

#### Returns

`BigNumber`

___

### minRangeValue

• `get` **minRangeValue**(): `BigNumber`

#### Returns

`BigNumber`

___

### minTradeValue

• `get` **minTradeValue**(): `BigNumber`

#### Returns

`BigNumber`

___

### spotPrice

• `get` **spotPrice**(): `BigNumber`

#### Returns

`BigNumber`

## Methods

### getBenchmarkPrice

▸ **getBenchmarkPrice**(`expiry`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |

#### Returns

`BigNumber`

___

### getFundingRate

▸ **getFundingRate**(`expiry`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |

#### Returns

`BigNumber`

___

### updatePair

▸ **updatePair**(`amm`, `markPrice`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `amm` | [`Amm`](../interfaces/Amm.md) |
| `markPrice` | `BigNumber` |

#### Returns

`void`

___

### minimumInstrumentWithParam

▸ `Static` **minimumInstrumentWithParam**(`param`): [`InstrumentModel`](InstrumentModel.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `param` | [`QuoteParam`](../interfaces/QuoteParam.md) |

#### Returns

[`InstrumentModel`](InstrumentModel.md)
