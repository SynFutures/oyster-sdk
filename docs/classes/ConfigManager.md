[@synfutures/v3-sdk](../README.md) / ConfigManager

# Class: ConfigManager

## Table of contents

### Constructors

- [constructor](ConfigManager.md#constructor)

### Methods

- [getSynfConfig](ConfigManager.md#getsynfconfig)
- [mapQuotesParam](ConfigManager.md#mapquotesparam)
- [mapSynfConfig](ConfigManager.md#mapsynfconfig)

## Constructors

### constructor

• **new ConfigManager**()

## Methods

### getSynfConfig

▸ `Static` **getSynfConfig**(`chainId`): [`SynfConfig`](../interfaces/SynfConfig.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `chainId` | `CHAIN_ID` |

#### Returns

[`SynfConfig`](../interfaces/SynfConfig.md)

___

### mapQuotesParam

▸ `Static` **mapQuotesParam**(`quotesParams`): `Object`

#### Parameters

| Name | Type |
| :------ | :------ |
| `quotesParams` | `Object` |

#### Returns

`Object`

___

### mapSynfConfig

▸ `Static` `Private` **mapSynfConfig**(`json`): [`SynfConfig`](../interfaces/SynfConfig.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `json` | [`SynfConfigJson`](../interfaces/SynfConfigJson.md) |

#### Returns

[`SynfConfig`](../interfaces/SynfConfig.md)
