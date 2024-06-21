[@synfutures/v3-sdk](../README.md) / ConfigSnapshot

# Class: ConfigSnapshot

## Table of contents

### Constructors

- [constructor](ConfigSnapshot.md#constructor)

### Properties

- [qparams](ConfigSnapshot.md#qparams)

### Methods

- [copy](ConfigSnapshot.md#copy)
- [deserialize](ConfigSnapshot.md#deserialize)
- [getQuoteParam](ConfigSnapshot.md#getquoteparam)
- [handleSetQuoteParam](ConfigSnapshot.md#handlesetquoteparam)
- [serialize](ConfigSnapshot.md#serialize)

## Constructors

### constructor

• **new ConfigSnapshot**()

## Properties

### qparams

• **qparams**: `Map`<`string`, [`QuoteParam`](../interfaces/QuoteParam.md)\>

## Methods

### copy

▸ **copy**(): [`ConfigSnapshot`](ConfigSnapshot.md)

#### Returns

[`ConfigSnapshot`](ConfigSnapshot.md)

___

### deserialize

▸ **deserialize**(`serialized`): [`ConfigSnapshot`](ConfigSnapshot.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `serialized` | `any` |

#### Returns

[`ConfigSnapshot`](ConfigSnapshot.md)

___

### getQuoteParam

▸ **getQuoteParam**(`quote`): [`QuoteParam`](../interfaces/QuoteParam.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `quote` | `string` |

#### Returns

[`QuoteParam`](../interfaces/QuoteParam.md)

___

### handleSetQuoteParam

▸ **handleSetQuoteParam**(`quote`, `qparam`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `quote` | `string` |
| `qparam` | [`QuoteParam`](../interfaces/QuoteParam.md) |

#### Returns

`void`

___

### serialize

▸ **serialize**(): `any`

#### Returns

`any`
