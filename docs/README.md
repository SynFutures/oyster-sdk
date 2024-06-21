@synfutures/v3-sdk

# @synfutures/v3-sdk

## Table of contents

### Enumerations

- [FeederType](enums/FeederType.md)
- [InstrumentCondition](enums/InstrumentCondition.md)
- [Management](enums/Management.md)
- [MarketType](enums/MarketType.md)
- [OrderStatus](enums/OrderStatus.md)
- [QuoteType](enums/QuoteType.md)
- [Side](enums/Side.md)
- [Status](enums/Status.md)
- [VirtualTradeType](enums/VirtualTradeType.md)

### Classes

- [AccountSnapshot](classes/AccountSnapshot.md)
- [Comparator](classes/Comparator.md)
- [ConfigManager](classes/ConfigManager.md)
- [ConfigSnapshot](classes/ConfigSnapshot.md)
- [CtxSnapshot](classes/CtxSnapshot.md)
- [GateSnapshot](classes/GateSnapshot.md)
- [InstrumentLevelAccountModel](classes/InstrumentLevelAccountModel.md)
- [InstrumentModel](classes/InstrumentModel.md)
- [InstrumentSnapshot](classes/InstrumentSnapshot.md)
- [NumericConverter](classes/NumericConverter.md)
- [OrderModel](classes/OrderModel.md)
- [PairLevelAccountModel](classes/PairLevelAccountModel.md)
- [PairModel](classes/PairModel.md)
- [PositionModel](classes/PositionModel.md)
- [RangeModel](classes/RangeModel.md)
- [Snapshot](classes/Snapshot.md)
- [Subgraph](classes/Subgraph.md)
- [SynFuturesV3](classes/SynFuturesV3.md)

### Interfaces

- [AddParam](interfaces/AddParam.md)
- [AdjustParam](interfaces/AdjustParam.md)
- [Amm](interfaces/Amm.md)
- [AssembledInstrumentData](interfaces/AssembledInstrumentData.md)
- [BaseInfo](interfaces/BaseInfo.md)
- [CancelParam](interfaces/CancelParam.md)
- [PriceFeeder](interfaces/PriceFeeder.md)
- [CexFeederSource](interfaces/CexFeederSource.md)
- [ComparatorOptions](interfaces/ComparatorOptions.md)
- [ContractAddress](interfaces/ContractAddress.md)
- [ContractRecord](interfaces/ContractRecord.md)
- [DexV2Feeder](interfaces/DexV2Feeder.md)
- [DexV2FeederSource](interfaces/DexV2FeederSource.md)
- [FetchInstrumentParam](interfaces/FetchInstrumentParam.md)
- [FillParam](interfaces/FillParam.md)
- [IncompleteAmm](interfaces/IncompleteAmm.md)
- [InstrumentIdentifier](interfaces/InstrumentIdentifier.md)
- [InstrumentInfo](interfaces/InstrumentInfo.md)
- [InstrumentMarket](interfaces/InstrumentMarket.md)
- [InstrumentSetting](interfaces/InstrumentSetting.md)
- [InstrumentState](interfaces/InstrumentState.md)
- [LiquidateParam](interfaces/LiquidateParam.md)
- [Market](interfaces/Market.md)
- [MarketAddress](interfaces/MarketAddress.md)
- [MarketConfig](interfaces/MarketConfig.md)
- [MarketInfo](interfaces/MarketInfo.md)
- [Order](interfaces/Order.md)
- [Pagination](interfaces/Pagination.md)
- [PairData](interfaces/PairData.md)
- [ParsedTransactionEvent](interfaces/ParsedTransactionEvent.md)
- [Pearl](interfaces/Pearl.md)
- [PlaceParam](interfaces/PlaceParam.md)
- [Portfolio](interfaces/Portfolio.md)
- [Position](interfaces/Position.md)
- [QueryEventParam](interfaces/QueryEventParam.md)
- [QueryParam](interfaces/QueryParam.md)
- [Quotation](interfaces/Quotation.md)
- [QuoteParam](interfaces/QuoteParam.md)
- [QuoteParamJson](interfaces/QuoteParamJson.md)
- [Range](interfaces/Range.md)
- [RemoveParam](interfaces/RemoveParam.md)
- [SetChainlinkFeederParam](interfaces/SetChainlinkFeederParam.md)
- [SetFeederPriceParam](interfaces/SetFeederPriceParam.md)
- [SweepParam](interfaces/SweepParam.md)
- [SynFuturesV3Contracts](interfaces/SynFuturesV3Contracts.md)
- [SynfConfig](interfaces/SynfConfig.md)
- [SynfConfigJson](interfaces/SynfConfigJson.md)
- [TokenInfo](interfaces/TokenInfo.md)
- [TradeParam](interfaces/TradeParam.md)
- [TransactionEvent](interfaces/TransactionEvent.md)
- [UserOrder](interfaces/UserOrder.md)
- [VirtualTrade](interfaces/VirtualTrade.md)

### Type Aliases

- [PositionCache](README.md#positioncache)

### Functions

- [calcFundingFee](README.md#calcfundingfee)
- [calcLiquidationPrice](README.md#calcliquidationprice)
- [calcPnl](README.md#calcpnl)
- [calculatePriceFromPnl](README.md#calculatepricefrompnl)
- [cancelOrderToPosition](README.md#cancelordertoposition)
- [combine](README.md#combine)
- [decomposePbitmap](README.md#decomposepbitmap)
- [entryDelta](README.md#entrydelta)
- [eventTemplateParseDemo](README.md#eventtemplateparsedemo)
- [fillOrderToPosition](README.md#fillordertoposition)
- [getLiquidityFromMargin](README.md#getliquidityfrommargin)
- [getMarginFromLiquidity](README.md#getmarginfromliquidity)
- [parseTransactionEventsByTemplate](README.md#parsetransactioneventsbytemplate)
- [rangeEntryDeltaBase](README.md#rangeentrydeltabase)
- [rangeEntryDeltaQuote](README.md#rangeentrydeltaquote)
- [rangeToPosition](README.md#rangetoposition)
- [realizeFundingIncome](README.md#realizefundingincome)
- [requiredMarginForOrder](README.md#requiredmarginfororder)
- [signOfSide](README.md#signofside)
- [tally](README.md#tally)

## Type Aliases

### PositionCache

Ƭ **PositionCache**: [`Position`](interfaces/Position.md)

## Functions

### calcFundingFee

▸ **calcFundingFee**(`amm`, `position`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `amm` | [`Amm`](interfaces/Amm.md) |
| `position` | [`Position`](interfaces/Position.md) |

#### Returns

`BigNumber`

___

### calcLiquidationPrice

▸ **calcLiquidationPrice**(`amm`, `position`, `maintenanceMarginRatio?`): `BigNumber`

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `amm` | [`Amm`](interfaces/Amm.md) | `undefined` |
| `position` | [`Position`](interfaces/Position.md) | `undefined` |
| `maintenanceMarginRatio` | `number` | `500` |

#### Returns

`BigNumber`

___

### calcPnl

▸ **calcPnl**(`amm`, `position`, `mark`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `amm` | [`Amm`](interfaces/Amm.md) |
| `position` | [`Position`](interfaces/Position.md) |
| `mark` | `BigNumber` |

#### Returns

`BigNumber`

___

### calculatePriceFromPnl

▸ **calculatePriceFromPnl**(`amm`, `position`, `pnl`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `amm` | [`Amm`](interfaces/Amm.md) |
| `position` | [`Position`](interfaces/Position.md) |
| `pnl` | `BigNumber` |

#### Returns

`BigNumber`

___

### cancelOrderToPosition

▸ **cancelOrderToPosition**(`pearlLeft`, `pearlNonce`, `pearlTaken`, `pearlFee`, `pearlSocialLoss`, `pearlFundingIndex`, `order`, `tick`, `nonce`, `record`): [`Position`](interfaces/Position.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `pearlLeft` | `BigNumber` |
| `pearlNonce` | `number` |
| `pearlTaken` | `BigNumber` |
| `pearlFee` | `BigNumber` |
| `pearlSocialLoss` | `BigNumber` |
| `pearlFundingIndex` | `BigNumber` |
| `order` | [`Order`](interfaces/Order.md) |
| `tick` | `number` |
| `nonce` | `number` |
| `record` | [`ContractRecord`](interfaces/ContractRecord.md) |

#### Returns

[`Position`](interfaces/Position.md)

___

### combine

▸ **combine**(`amm`, `position_1`, `position_2`): [`Position`](interfaces/Position.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `amm` | [`Amm`](interfaces/Amm.md) |
| `position_1` | [`Position`](interfaces/Position.md) |
| `position_2` | [`Position`](interfaces/Position.md) |

#### Returns

[`Position`](interfaces/Position.md)

___

### decomposePbitmap

▸ **decomposePbitmap**(`pbitmap`): `number`[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `pbitmap` | `BigNumber` |

#### Returns

`number`[]

___

### entryDelta

▸ **entryDelta**(`sqrtEntryPX96`, `tickLower`, `tickUpper`, `entryMargin`, `initialMarginRatio`): `Object`

#### Parameters

| Name | Type |
| :------ | :------ |
| `sqrtEntryPX96` | `BigNumber` |
| `tickLower` | `number` |
| `tickUpper` | `number` |
| `entryMargin` | `BigNumber` |
| `initialMarginRatio` | `number` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `deltaBase` | `BigNumber` |
| `deltaQuote` | `BigNumber` |
| `liquidity` | `BigNumber` |

___

### eventTemplateParseDemo

▸ **eventTemplateParseDemo**(): `Promise`<`void`\>

#### Returns

`Promise`<`void`\>

___

### fillOrderToPosition

▸ **fillOrderToPosition**(`pearlNonce`, `pearlTaken`, `pearlFee`, `pearlSocialLoss`, `pearlFundingIndex`, `order`, `tick`, `nonce`, `fillSize`, `record`): [`Position`](interfaces/Position.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `pearlNonce` | `number` |
| `pearlTaken` | `BigNumber` |
| `pearlFee` | `BigNumber` |
| `pearlSocialLoss` | `BigNumber` |
| `pearlFundingIndex` | `BigNumber` |
| `order` | [`Order`](interfaces/Order.md) |
| `tick` | `number` |
| `nonce` | `number` |
| `fillSize` | `BigNumber` |
| `record` | [`ContractRecord`](interfaces/ContractRecord.md) |

#### Returns

[`Position`](interfaces/Position.md)

___

### getLiquidityFromMargin

▸ **getLiquidityFromMargin**(`sqrtEntryPX96`, `sqrtUpperPX96`, `entryMargin`, `initialMarginRatio`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `sqrtEntryPX96` | `BigNumber` |
| `sqrtUpperPX96` | `BigNumber` |
| `entryMargin` | `BigNumber` |
| `initialMarginRatio` | `number` |

#### Returns

`BigNumber`

___

### getMarginFromLiquidity

▸ **getMarginFromLiquidity**(`sqrtEntryPX96`, `tickUpper`, `liquidity`, `initialMarginRatio`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `sqrtEntryPX96` | `BigNumber` |
| `tickUpper` | `number` |
| `liquidity` | `BigNumber` |
| `initialMarginRatio` | `number` |

#### Returns

`BigNumber`

___

### parseTransactionEventsByTemplate

▸ **parseTransactionEventsByTemplate**(`synfv3`, `receiptOrTxHash`): `Promise`<[`ParsedTransactionEvent`](interfaces/ParsedTransactionEvent.md)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `synfv3` | [`SynFuturesV3`](classes/SynFuturesV3.md) |
| `receiptOrTxHash` | `string` \| `TransactionReceipt` |

#### Returns

`Promise`<[`ParsedTransactionEvent`](interfaces/ParsedTransactionEvent.md)[]\>

___

### rangeEntryDeltaBase

▸ **rangeEntryDeltaBase**(`range`, `tickUpper`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `range` | [`Range`](interfaces/Range.md) |
| `tickUpper` | `number` |

#### Returns

`BigNumber`

___

### rangeEntryDeltaQuote

▸ **rangeEntryDeltaQuote**(`range`, `tickLower`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `range` | [`Range`](interfaces/Range.md) |
| `tickLower` | `number` |

#### Returns

`BigNumber`

___

### rangeToPosition

▸ **rangeToPosition**(`currentPX96`, `currentTick`, `feeIndex`, `longSocialLossIndex`, `shortSocialLossIndex`, `longFundingIndex`, `shortFundingIndex`, `tickLower`, `tickUpper`, `range`): [`Position`](interfaces/Position.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `currentPX96` | `BigNumber` |
| `currentTick` | `number` |
| `feeIndex` | `BigNumber` |
| `longSocialLossIndex` | `BigNumber` |
| `shortSocialLossIndex` | `BigNumber` |
| `longFundingIndex` | `BigNumber` |
| `shortFundingIndex` | `BigNumber` |
| `tickLower` | `number` |
| `tickUpper` | `number` |
| `range` | [`Range`](interfaces/Range.md) |

#### Returns

[`Position`](interfaces/Position.md)

___

### realizeFundingIncome

▸ **realizeFundingIncome**(`amm`, `pos`): [`Position`](interfaces/Position.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `amm` | [`Amm`](interfaces/Amm.md) |
| `pos` | [`Position`](interfaces/Position.md) |

#### Returns

[`Position`](interfaces/Position.md)

___

### requiredMarginForOrder

▸ **requiredMarginForOrder**(`limit`, `sizeWad`, `ratio`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `limit` | `BigNumber` |
| `sizeWad` | `BigNumber` |
| `ratio` | `number` |

#### Returns

`BigNumber`

___

### signOfSide

▸ **signOfSide**(`side`): `number`

#### Parameters

| Name | Type |
| :------ | :------ |
| `side` | [`Side`](enums/Side.md) |

#### Returns

`number`

___

### tally

▸ **tally**(`amm`, `position`, `mark`): `Object`

#### Parameters

| Name | Type |
| :------ | :------ |
| `amm` | [`Amm`](interfaces/Amm.md) |
| `position` | [`Position`](interfaces/Position.md) |
| `mark` | `BigNumber` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `equity` | `BigNumber` |
| `pnl` | `BigNumber` |
| `socialLoss` | `BigNumber` |
