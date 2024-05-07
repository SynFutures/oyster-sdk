[@synfutures/v3-sdk](../README.md) / InstrumentSnapshot

# Class: InstrumentSnapshot

## Table of contents

### Constructors

- [constructor](InstrumentSnapshot.md#constructor)

### Properties

- [accounts](InstrumentSnapshot.md#accounts)
- [condition](InstrumentSnapshot.md#condition)
- [ctxs](InstrumentSnapshot.md#ctxs)
- [param](InstrumentSnapshot.md#param)

### Methods

- [\_handleSwap](InstrumentSnapshot.md#_handleswap)
- [\_removeRange](InstrumentSnapshot.md#_removerange)
- [cancelOrderToPosition](InstrumentSnapshot.md#cancelordertoposition)
- [combinePositions](InstrumentSnapshot.md#combinepositions)
- [copy](InstrumentSnapshot.md#copy)
- [deserialize](InstrumentSnapshot.md#deserialize)
- [fillOrderToPosition](InstrumentSnapshot.md#fillordertoposition)
- [getAccount](InstrumentSnapshot.md#getaccount)
- [getCtx](InstrumentSnapshot.md#getctx)
- [handleAdd](InstrumentSnapshot.md#handleadd)
- [handleAdjust](InstrumentSnapshot.md#handleadjust)
- [handleCancel](InstrumentSnapshot.md#handlecancel)
- [handleClaimProtocolFee](InstrumentSnapshot.md#handleclaimprotocolfee)
- [handleDeleteContext](InstrumentSnapshot.md#handledeletecontext)
- [handleDonateInsuranceFund](InstrumentSnapshot.md#handledonateinsurancefund)
- [handleFill](InstrumentSnapshot.md#handlefill)
- [handleFundingFee](InstrumentSnapshot.md#handlefundingfee)
- [handleLiquidate](InstrumentSnapshot.md#handleliquidate)
- [handlePlace](InstrumentSnapshot.md#handleplace)
- [handleRecycleInsuranceFund](InstrumentSnapshot.md#handlerecycleinsurancefund)
- [handleRemove](InstrumentSnapshot.md#handleremove)
- [handleSettle](InstrumentSnapshot.md#handlesettle)
- [handleSweep](InstrumentSnapshot.md#handlesweep)
- [handleTrade](InstrumentSnapshot.md#handletrade)
- [handleUpdateAmmStatus](InstrumentSnapshot.md#handleupdateammstatus)
- [handleUpdateCondition](InstrumentSnapshot.md#handleupdatecondition)
- [handleUpdateFundingIndex](InstrumentSnapshot.md#handleupdatefundingindex)
- [handleUpdateParam](InstrumentSnapshot.md#handleupdateparam)
- [handleUpdateSocialLossInsuranceFund](InstrumentSnapshot.md#handleupdatesociallossinsurancefund)
- [positionEquity](InstrumentSnapshot.md#positionequity)
- [serialize](InstrumentSnapshot.md#serialize)
- [splitPosition](InstrumentSnapshot.md#splitposition)
- [updateOIByPosition](InstrumentSnapshot.md#updateoibyposition)
- [updateSocialLoss](InstrumentSnapshot.md#updatesocialloss)

## Constructors

### constructor

• **new InstrumentSnapshot**(`param?`)

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `param` | [`QuoteParam`](../interfaces/QuoteParam.md) | `EMPTY_QUOTE_PARAM` |

## Properties

### accounts

• **accounts**: `Map`<`number`, `Map`<`string`, [`AccountSnapshot`](AccountSnapshot.md)\>\>

___

### condition

• **condition**: [`InstrumentCondition`](../enums/InstrumentCondition.md) = `InstrumentCondition.NORMAL`

___

### ctxs

• **ctxs**: `Map`<`number`, [`CtxSnapshot`](CtxSnapshot.md)\>

___

### param

• **param**: [`QuoteParam`](../interfaces/QuoteParam.md) = `EMPTY_QUOTE_PARAM`

## Methods

### \_handleSwap

▸ **_handleSwap**(`expiry`, `size`, `totalTaken`, `feeRatio`, `entryNotional`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |
| `size` | `BigNumber` |
| `totalTaken` | `BigNumber` |
| `feeRatio` | `number` |
| `entryNotional` | `BigNumber` |

#### Returns

`void`

___

### \_removeRange

▸ **_removeRange**(`expiry`, `trader`, `tickLower`, `tickUpper`, `size`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |
| `trader` | `string` |
| `tickLower` | `number` |
| `tickUpper` | `number` |
| `size` | `BigNumber` |

#### Returns

`void`

___

### cancelOrderToPosition

▸ **cancelOrderToPosition**(`ctx`, `pearl`, `order`, `tick`, `nonce`): [`Position`](../interfaces/Position.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `ctx` | [`CtxSnapshot`](CtxSnapshot.md) |
| `pearl` | [`Pearl`](../interfaces/Pearl.md) |
| `order` | [`Order`](../interfaces/Order.md) |
| `tick` | `number` |
| `nonce` | `number` |

#### Returns

[`Position`](../interfaces/Position.md)

___

### combinePositions

▸ **combinePositions**(`ctx`, `position1`, `position2`, `adjustOI?`): [`Position`](../interfaces/Position.md)

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `ctx` | [`CtxSnapshot`](CtxSnapshot.md) | `undefined` |
| `position1` | [`Position`](../interfaces/Position.md) | `undefined` |
| `position2` | [`Position`](../interfaces/Position.md) | `undefined` |
| `adjustOI` | `boolean` | `false` |

#### Returns

[`Position`](../interfaces/Position.md)

___

### copy

▸ **copy**(): [`InstrumentSnapshot`](InstrumentSnapshot.md)

#### Returns

[`InstrumentSnapshot`](InstrumentSnapshot.md)

___

### deserialize

▸ **deserialize**(`serialized`): [`InstrumentSnapshot`](InstrumentSnapshot.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `serialized` | `any` |

#### Returns

[`InstrumentSnapshot`](InstrumentSnapshot.md)

___

### fillOrderToPosition

▸ **fillOrderToPosition**(`ctx`, `pearl`, `order`, `tick`, `nonce`, `fillSize`): [`Position`](../interfaces/Position.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `ctx` | [`CtxSnapshot`](CtxSnapshot.md) |
| `pearl` | [`Pearl`](../interfaces/Pearl.md) |
| `order` | [`Order`](../interfaces/Order.md) |
| `tick` | `number` |
| `nonce` | `number` |
| `fillSize` | `BigNumber` |

#### Returns

[`Position`](../interfaces/Position.md)

___

### getAccount

▸ **getAccount**(`expiry`, `trader`): [`AccountSnapshot`](AccountSnapshot.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |
| `trader` | `string` |

#### Returns

[`AccountSnapshot`](AccountSnapshot.md)

___

### getCtx

▸ **getCtx**(`expiry`): [`CtxSnapshot`](CtxSnapshot.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |

#### Returns

[`CtxSnapshot`](CtxSnapshot.md)

___

### handleAdd

▸ **handleAdd**(`expiry`, `trader`, `tickLower`, `tickUpper`, `range`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |
| `trader` | `string` |
| `tickLower` | `number` |
| `tickUpper` | `number` |
| `range` | [`Range`](../interfaces/Range.md) |

#### Returns

`void`

___

### handleAdjust

▸ **handleAdjust**(`expiry`, `trader`, `amount`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |
| `trader` | `string` |
| `amount` | `BigNumber` |

#### Returns

`void`

___

### handleCancel

▸ **handleCancel**(`expiry`, `trader`, `tick`, `nonce`, `fee`, `pic`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |
| `trader` | `string` |
| `tick` | `number` |
| `nonce` | `number` |
| `fee` | `BigNumber` |
| `pic` | [`Position`](../interfaces/Position.md) |

#### Returns

`void`

___

### handleClaimProtocolFee

▸ **handleClaimProtocolFee**(`expiry`, `amount`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |
| `amount` | `BigNumber` |

#### Returns

`void`

___

### handleDeleteContext

▸ **handleDeleteContext**(`expiry`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |

#### Returns

`void`

___

### handleDonateInsuranceFund

▸ **handleDonateInsuranceFund**(`expiry`, `donator`, `amount`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |
| `donator` | `string` |
| `amount` | `BigNumber` |

#### Returns

`void`

___

### handleFill

▸ **handleFill**(`expiry`, `trader`, `tick`, `nonce`, `fee`, `pic`, `operator`, `tip`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |
| `trader` | `string` |
| `tick` | `number` |
| `nonce` | `number` |
| `fee` | `BigNumber` |
| `pic` | [`Position`](../interfaces/Position.md) |
| `operator` | `string` |
| `tip` | `BigNumber` |

#### Returns

`void`

___

### handleFundingFee

▸ **handleFundingFee**(`trader`, `funding`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `trader` | `string` |
| `funding` | `BigNumber` |

#### Returns

`void`

___

### handleLiquidate

▸ **handleLiquidate**(`expiry`, `trader`, `amount`, `mark`, `target`, `size`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |
| `trader` | `string` |
| `amount` | `BigNumber` |
| `mark` | `BigNumber` |
| `target` | `string` |
| `size` | `BigNumber` |

#### Returns

`void`

___

### handlePlace

▸ **handlePlace**(`expiry`, `trader`, `tick`, `nonce`, `order`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |
| `trader` | `string` |
| `tick` | `number` |
| `nonce` | `number` |
| `order` | [`Order`](../interfaces/Order.md) |

#### Returns

`void`

___

### handleRecycleInsuranceFund

▸ **handleRecycleInsuranceFund**(`expiry`, `amount`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |
| `amount` | `BigNumber` |

#### Returns

`void`

___

### handleRemove

▸ **handleRemove**(`expiry`, `trader`, `tickLower`, `tickUpper`, `fee`, `pic`, `operator`, `tip`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |
| `trader` | `string` |
| `tickLower` | `number` |
| `tickUpper` | `number` |
| `fee` | `BigNumber` |
| `pic` | [`Position`](../interfaces/Position.md) |
| `operator` | `string` |
| `tip` | `BigNumber` |

#### Returns

`void`

___

### handleSettle

▸ **handleSettle**(`expiry`, `trader`, `settlement`, `balance`, `operator`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |
| `trader` | `string` |
| `settlement` | `BigNumber` |
| `balance` | `BigNumber` |
| `operator` | `string` |

#### Returns

`void`

___

### handleSweep

▸ **handleSweep**(`expiry`, `trader`, `size`, `takenSize`, `takenValue`, `entryNotional`, `feeRatio`, `sqrtPX96`, `mark`, `operator`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |
| `trader` | `string` |
| `size` | `BigNumber` |
| `takenSize` | `BigNumber` |
| `takenValue` | `BigNumber` |
| `entryNotional` | `BigNumber` |
| `feeRatio` | `number` |
| `sqrtPX96` | `BigNumber` |
| `mark` | `BigNumber` |
| `operator` | `string` |

#### Returns

`void`

___

### handleTrade

▸ **handleTrade**(`expiry`, `trader`, `size`, `amount`, `takenSize`, `takenValue`, `entryNotional`, `feeRatio`, `sqrtPX96`, `mark`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |
| `trader` | `string` |
| `size` | `BigNumber` |
| `amount` | `BigNumber` |
| `takenSize` | `BigNumber` |
| `takenValue` | `BigNumber` |
| `entryNotional` | `BigNumber` |
| `feeRatio` | `number` |
| `sqrtPX96` | `BigNumber` |
| `mark` | `BigNumber` |

#### Returns

`void`

___

### handleUpdateAmmStatus

▸ **handleUpdateAmmStatus**(`expiry`, `status`, `sqrtPX96`, `mark`, `blockNumber`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |
| `status` | [`Status`](../enums/Status.md) |
| `sqrtPX96` | `BigNumber` |
| `mark` | `BigNumber` |
| `blockNumber` | `number` |

#### Returns

`void`

___

### handleUpdateCondition

▸ **handleUpdateCondition**(`timestamp`, `condition`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `timestamp` | `number` |
| `condition` | `number` |

#### Returns

`void`

___

### handleUpdateFundingIndex

▸ **handleUpdateFundingIndex**(`fundingIndex`, `blockNumber`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `fundingIndex` | `BigNumber` |
| `blockNumber` | `number` |

#### Returns

`void`

___

### handleUpdateParam

▸ **handleUpdateParam**(`param`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `param` | [`QuoteParam`](../interfaces/QuoteParam.md) |

#### Returns

`void`

___

### handleUpdateSocialLossInsuranceFund

▸ **handleUpdateSocialLossInsuranceFund**(`expiry`, `longSocialLossIndex`, `shortSocialLossIndex`, `insuranceFund`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |
| `longSocialLossIndex` | `BigNumber` |
| `shortSocialLossIndex` | `BigNumber` |
| `insuranceFund` | `BigNumber` |

#### Returns

`void`

___

### positionEquity

▸ **positionEquity**(`expiry`, `p`, `mark`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expiry` | `number` |
| `p` | [`Position`](../interfaces/Position.md) |
| `mark` | `BigNumber` |

#### Returns

`BigNumber`

___

### serialize

▸ **serialize**(): `any`

#### Returns

`any`

___

### splitPosition

▸ **splitPosition**(`pos`, `partSize`): [`Position`](../interfaces/Position.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `pos` | [`Position`](../interfaces/Position.md) |
| `partSize` | `BigNumber` |

#### Returns

[`Position`](../interfaces/Position.md)

___

### updateOIByPosition

▸ `Private` **updateOIByPosition**(`oldPic`, `pic`, `ctx`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `oldPic` | [`Position`](../interfaces/Position.md) |
| `pic` | [`Position`](../interfaces/Position.md) |
| `ctx` | [`CtxSnapshot`](CtxSnapshot.md) |

#### Returns

`void`

___

### updateSocialLoss

▸ **updateSocialLoss**(`ctx`, `balance`, `isLongPosition`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `ctx` | [`CtxSnapshot`](CtxSnapshot.md) |
| `balance` | `BigNumber` |
| `isLongPosition` | `boolean` |

#### Returns

`void`
