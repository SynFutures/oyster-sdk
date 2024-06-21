[@synfutures/v3-sdk](../README.md) / Snapshot

# Class: Snapshot

## Table of contents

### Constructors

- [constructor](Snapshot.md#constructor)

### Properties

- [config](Snapshot.md#config)
- [gate](Snapshot.md#gate)
- [instruments](Snapshot.md#instruments)
- [sdk](Snapshot.md#sdk)

### Methods

- [copy](Snapshot.md#copy)
- [deserialize](Snapshot.md#deserialize)
- [processLog](Snapshot.md#processlog)
- [processParsedLog](Snapshot.md#processparsedlog)
- [serialize](Snapshot.md#serialize)

## Constructors

### constructor

• **new Snapshot**(`sdk`)

Constructor

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `sdk` | [`SynFuturesV3`](SynFuturesV3.md) | SDK instance |

## Properties

### config

• **config**: [`ConfigSnapshot`](ConfigSnapshot.md)

___

### gate

• **gate**: [`GateSnapshot`](GateSnapshot.md)

___

### instruments

• **instruments**: `Map`<`string`, [`InstrumentSnapshot`](InstrumentSnapshot.md)\>

___

### sdk

• `Private` **sdk**: [`SynFuturesV3`](SynFuturesV3.md)

SDK instance

## Methods

### copy

▸ **copy**(): [`Snapshot`](Snapshot.md)

Copy snapshot

#### Returns

[`Snapshot`](Snapshot.md)

Copied snapshot

___

### deserialize

▸ **deserialize**(`serialized`): [`Snapshot`](Snapshot.md)

Deserialize snapshot from JSON object

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `serialized` | `any` | Serialized JSON object |

#### Returns

[`Snapshot`](Snapshot.md)

This

___

### processLog

▸ **processLog**(`log`, `blockNumber`): `Promise`<`void`\>

Process log

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `log` | `Log` | Log |
| `blockNumber` | `number` | Block number |

#### Returns

`Promise`<`void`\>

___

### processParsedLog

▸ **processParsedLog**(`address`, `log`, `blockNumber`): `Promise`<`void`\>

Process parsed log

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `address` | `string` | Contract address |
| `log` | `LogDescription` | Parsed log |
| `blockNumber` | `number` | Block number |

#### Returns

`Promise`<`void`\>

___

### serialize

▸ **serialize**(): `any`

Serialize snapshot to JSON object

#### Returns

`any`

JSON object
