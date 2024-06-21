[@synfutures/v3-sdk](../README.md) / Subgraph

# Class: Subgraph

## Hierarchy

- `Graph`

  ↳ **`Subgraph`**

## Table of contents

### Constructors

- [constructor](Subgraph.md#constructor)

### Properties

- [endpoint](Subgraph.md#endpoint)
- [retryOption](Subgraph.md#retryoption)

### Methods

- [buildQueryEventCondition](Subgraph.md#buildqueryeventcondition)
- [getMetaData](Subgraph.md#getmetadata)
- [getPairsData](Subgraph.md#getpairsdata)
- [getTransactionEvents](Subgraph.md#gettransactionevents)
- [getUserOrders](Subgraph.md#getuserorders)
- [getUsersToSettle](Subgraph.md#getuserstosettle)
- [getVirtualTrades](Subgraph.md#getvirtualtrades)
- [query](Subgraph.md#query)
- [queryAll](Subgraph.md#queryall)

## Constructors

### constructor

• **new Subgraph**(`endpoint`, `retryOption?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `endpoint` | `string` |
| `retryOption?` | `any` |

#### Inherited from

Graph.constructor

## Properties

### endpoint

• **endpoint**: `string`

#### Inherited from

Graph.endpoint

___

### retryOption

• **retryOption**: `any`

#### Inherited from

Graph.retryOption

## Methods

### buildQueryEventCondition

▸ **buildQueryEventCondition**(`param`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `param` | [`QueryEventParam`](../interfaces/QueryEventParam.md) |

#### Returns

`string`

___

### getMetaData

▸ **getMetaData**(): `Promise`<`any`\>

#### Returns

`Promise`<`any`\>

#### Inherited from

Graph.getMetaData

___

### getPairsData

▸ **getPairsData**(`status?`, `timestamp?`): `Promise`<[`PairData`](../interfaces/PairData.md)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `status` | [`Status`](../enums/Status.md)[] |
| `timestamp` | `number` |

#### Returns

`Promise`<[`PairData`](../interfaces/PairData.md)[]\>

___

### getTransactionEvents

▸ **getTransactionEvents**(`param`): `Promise`<[`TransactionEvent`](../interfaces/TransactionEvent.md)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `param` | [`QueryEventParam`](../interfaces/QueryEventParam.md) |

#### Returns

`Promise`<[`TransactionEvent`](../interfaces/TransactionEvent.md)[]\>

___

### getUserOrders

▸ **getUserOrders**(`param`): `Promise`<[`UserOrder`](../interfaces/UserOrder.md)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `param` | [`QueryParam`](../interfaces/QueryParam.md) |

#### Returns

`Promise`<[`UserOrder`](../interfaces/UserOrder.md)[]\>

___

### getUsersToSettle

▸ **getUsersToSettle**(`param`): `Promise`<`Record`<`number`, `string`[]\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `param` | [`QueryParam`](../interfaces/QueryParam.md) |

#### Returns

`Promise`<`Record`<`number`, `string`[]\>\>

___

### getVirtualTrades

▸ **getVirtualTrades**(`param`): `Promise`<[`VirtualTrade`](../interfaces/VirtualTrade.md)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `param` | [`QueryParam`](../interfaces/QueryParam.md) |

#### Returns

`Promise`<[`VirtualTrade`](../interfaces/VirtualTrade.md)[]\>

___

### query

▸ **query**(`graphQL`, `skip`, `first`, `lastId?`): `Promise`<`any`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `graphQL` | `string` |
| `skip` | `number` |
| `first` | `number` |
| `lastId?` | `string` |

#### Returns

`Promise`<`any`\>

#### Inherited from

Graph.query

___

### queryAll

▸ **queryAll**(`graphQL`, `pageSize?`, `pageByLastId?`): `Promise`<`any`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `graphQL` | `string` |
| `pageSize?` | `number` |
| `pageByLastId?` | `boolean` |

#### Returns

`Promise`<`any`[]\>

#### Inherited from

Graph.queryAll
