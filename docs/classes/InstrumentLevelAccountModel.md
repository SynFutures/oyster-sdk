[@synfutures/v3-sdk](../README.md) / InstrumentLevelAccountModel

# Class: InstrumentLevelAccountModel

## Table of contents

### Constructors

- [constructor](InstrumentLevelAccountModel.md#constructor)

### Properties

- [instrumentAddr](InstrumentLevelAccountModel.md#instrumentaddr)
- [portfolios](InstrumentLevelAccountModel.md#portfolios)
- [rootInstrument](InstrumentLevelAccountModel.md#rootinstrument)
- [traderAddr](InstrumentLevelAccountModel.md#traderaddr)

### Methods

- [addPairLevelAccount](InstrumentLevelAccountModel.md#addpairlevelaccount)
- [balanceInVault](InstrumentLevelAccountModel.md#balanceinvault)

## Constructors

### constructor

• **new InstrumentLevelAccountModel**(`rootInstrument`, `instrumentAddr`, `traderAddr`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `rootInstrument` | [`InstrumentModel`](InstrumentModel.md) |
| `instrumentAddr` | `string` |
| `traderAddr` | `string` |

## Properties

### instrumentAddr

• **instrumentAddr**: `string`

___

### portfolios

• **portfolios**: `Map`<`number`, [`PairLevelAccountModel`](PairLevelAccountModel.md)\>

___

### rootInstrument

• `Readonly` **rootInstrument**: [`InstrumentModel`](InstrumentModel.md)

___

### traderAddr

• **traderAddr**: `string`

## Methods

### addPairLevelAccount

▸ **addPairLevelAccount**(`pair`, `portfolio`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `pair` | [`PairModel`](PairModel.md) |
| `portfolio` | [`Portfolio`](../interfaces/Portfolio.md) |

#### Returns

`void`

___

### balanceInVault

▸ **balanceInVault**(): `BigNumber`

#### Returns

`BigNumber`
