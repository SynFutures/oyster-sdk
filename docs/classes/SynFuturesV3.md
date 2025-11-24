[@synfutures/v3-sdk](../README.md) / SynFuturesV3

# Class: SynFuturesV3

## Table of contents

### Constructors

- [constructor](SynFuturesV3.md#constructor)

### Properties

- [accountCache](SynFuturesV3.md#accountcache)
- [config](SynFuturesV3.md#config)
- [contracts](SynFuturesV3.md#contracts)
- [ctx](SynFuturesV3.md#ctx)
- [instrumentMap](SynFuturesV3.md#instrumentmap)
- [subgraph](SynFuturesV3.md#subgraph)
- [vaultCache](SynFuturesV3.md#vaultcache)
- [instances](SynFuturesV3.md#instances)

### Methods

- [\_init](SynFuturesV3.md#_init)
- [\_initContracts](SynFuturesV3.md#_initcontracts)
- [add](SynFuturesV3.md#add)
- [addLiquidity](SynFuturesV3.md#addliquidity)
- [addToWhitelistLps](SynFuturesV3.md#addtowhitelistlps)
- [adjust](SynFuturesV3.md#adjust)
- [adjustMargin](SynFuturesV3.md#adjustmargin)
- [alignPriceWadToTick](SynFuturesV3.md#alignpricewadtotick)
- [openLp](SynFuturesV3.md#allowunauthorizedlps)
- [batchCancelOrder](SynFuturesV3.md#batchcancelorder)
- [calcBoost](SynFuturesV3.md#calcboost)
- [cancel](SynFuturesV3.md#cancel)
- [claimProtocolFee](SynFuturesV3.md#claimprotocolfee)
- [computeInitData](SynFuturesV3.md#computeinitdata)
- [computeInstrumentAddress](SynFuturesV3.md#computeinstrumentaddress)
- [createChainlinkInstrument](SynFuturesV3.md#createchainlinkinstrument)
- [deposit](SynFuturesV3.md#deposit)
- [donateInsuranceFund](SynFuturesV3.md#donateinsurancefund)
- [encodeLimitTicks](SynFuturesV3.md#encodelimitticks)
- [estimateAPY](SynFuturesV3.md#estimateapy)
- [extractFeeRatioParams](SynFuturesV3.md#extractfeeratioparams)
- [fetchInstrumentBatch](SynFuturesV3.md#fetchinstrumentbatch)
- [fill](SynFuturesV3.md#fill)
- [getAllInstruments](SynFuturesV3.md#getallinstruments)
- [getCachedVaultBalance](SynFuturesV3.md#getcachedvaultbalance)
- [getChainlinkRawSpotPrice](SynFuturesV3.md#getchainlinkrawspotprice)
- [getDexV2RawSpotPrice](SynFuturesV3.md#getdexv2rawspotprice)
- [getInstrumentContract](SynFuturesV3.md#getinstrumentcontract)
- [getInstrumentInfo](SynFuturesV3.md#getinstrumentinfo)
- [getInstrumentLevelAccounts](SynFuturesV3.md#getinstrumentlevelaccounts)
- [getLimitTick](SynFuturesV3.md#getlimittick)
- [getMaxLeverage](SynFuturesV3.md#getmaxleverage)
- [getNextInitializedTickOutside](SynFuturesV3.md#getnextinitializedtickoutside)
- [getOrderLeverageByMargin](SynFuturesV3.md#getorderleveragebymargin)
- [getOrderMarginByLeverage](SynFuturesV3.md#getordermarginbyleverage)
- [getPairLevelAccount](SynFuturesV3.md#getpairlevelaccount)
- [getPositionIfSettle](SynFuturesV3.md#getpositionifsettle)
- [getSpotPrice](SynFuturesV3.md#getspotprice)
- [getSizeToTargetTick](SynFuturesV3.md#getsizetotargettick)
- [getSqrtFairPX96](SynFuturesV3.md#getsqrtfairpx96)
- [getTick](SynFuturesV3.md#gettick)
- [getTickBitMaps](SynFuturesV3.md#gettickbitmaps)
- [inWhiteListLps](SynFuturesV3.md#inwhitelistlps)
- [init](SynFuturesV3.md#init)
- [initInstruments](SynFuturesV3.md#initinstruments)
- [inquire](SynFuturesV3.md#inquire)
- [inquireByBase](SynFuturesV3.md#inquirebybase)
- [inquireByQuote](SynFuturesV3.md#inquirebyquote)
- [inquireLeverageFromTransferAmount](SynFuturesV3.md#inquireleveragefromtransferamount)
- [inquireTransferAmountFromTargetLeverage](SynFuturesV3.md#inquiretransferamountfromtargetleverage)
- [inspectDexV2MarketBenchmarkPrice](SynFuturesV3.md#inspectdexv2marketbenchmarkprice)
- [intuitiveTrade](SynFuturesV3.md#intuitivetrade)
- [leverageAtMargin](SynFuturesV3.md#leverageatmargin)
- [limitOrder](SynFuturesV3.md#limitorder)
- [liquidate](SynFuturesV3.md#liquidate)
- [marginAtLeverage](SynFuturesV3.md#marginatleverage)
- [marginToDepositWad](SynFuturesV3.md#margintodepositwad)
- [parseInstrumentData](SynFuturesV3.md#parseinstrumentdata)
- [place](SynFuturesV3.md#place)
- [remove](SynFuturesV3.md#remove)
- [removeFromWhitelistLps](SynFuturesV3.md#removefromwhitelistlps)
- [removeLiquidity](SynFuturesV3.md#removeliquidity)
- [disableLpWhitelist](SynFuturesV3.md#setallowunauthorizedlps)
- [setCachedVaultBalance](SynFuturesV3.md#setcachedvaultbalance)
- [setChainlinkFeeder](SynFuturesV3.md#setchainlinkfeeder)
- [setProvider](SynFuturesV3.md#setprovider)
- [setLpWhiteList](SynFuturesV3.md#setwhitelistlps)
- [settle](SynFuturesV3.md#settle)
- [simulateAddLiquidity](SynFuturesV3.md#simulateaddliquidity)
- [simulateAdjustMargin](SynFuturesV3.md#simulateadjustmargin)
- [simulateOrder](SynFuturesV3.md#simulateorder)
- [simulateRemoveLiquidity](SynFuturesV3.md#simulateremoveliquidity)
- [simulateTrade](SynFuturesV3.md#simulatetrade)
- [sweep](SynFuturesV3.md#sweep)
- [syncChainlinkFeederWithConfig](SynFuturesV3.md#syncchainlinkfeederwithconfig)
- [syncVaultCache](SynFuturesV3.md#syncvaultcache)
- [syncVaultCacheWithAllQuotes](SynFuturesV3.md#syncvaultcachewithallquotes)
- [trade](SynFuturesV3.md#trade)
- [update](SynFuturesV3.md#update)
- [updateInstrument](SynFuturesV3.md#updateinstrument)
- [updateInstrumentCache](SynFuturesV3.md#updateinstrumentcache)
- [updatePairLevelAccount](SynFuturesV3.md#updatepairlevelaccount)
- [vaultOperation](SynFuturesV3.md#vaultoperation)
- [getInstance](SynFuturesV3.md#getinstance)

## Constructors

### constructor

• `Protected` **new SynFuturesV3**(`ctx`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `ctx` | `ChainContext` |

## Properties

### accountCache

• **accountCache**: `Map`<`string`, `Map`<`string`, `Map`<`number`, [`PairLevelAccountModel`](PairLevelAccountModel.md)\>\>\>

___

### config

• **config**: [`SynfConfig`](../interfaces/SynfConfig.md)

___

### contracts

• **contracts**: [`SynFuturesV3Contracts`](../interfaces/SynFuturesV3Contracts.md)

___

### ctx

• **ctx**: `ChainContext`

___

### instrumentMap

• **instrumentMap**: `Map`<`string`, [`InstrumentModel`](InstrumentModel.md)\>

___

### subgraph

• **subgraph**: [`Subgraph`](Subgraph.md)

___

### vaultCache

• `Protected` **vaultCache**: `Map`<`string`, `Map`<`string`, `BigNumber`\>\>

___

### instances

▪ `Static` `Private` **instances**: `Map`<`number`, [`SynFuturesV3`](SynFuturesV3.md)\>

## Methods

### \_init

▸ `Private` **_init**(`config`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | [`SynfConfig`](../interfaces/SynfConfig.md) |

#### Returns

`void`

___

### \_initContracts

▸ `Private` **_initContracts**(`provider`, `contractAddress`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `provider` | `Provider` |
| `contractAddress` | [`ContractAddress`](../interfaces/ContractAddress.md) |

#### Returns

`void`

___

### add

▸ **add**(`signer`, `instrumentAddr`, `param`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `instrumentAddr` | `string` |
| `param` | [`AddParam`](../interfaces/AddParam.md) |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### addLiquidity

▸ **addLiquidity**(`signer`, `instrumentIdentifier`, `expiry`, `tickDelta`, `marginWad`, `sqrtStrikeLowerPX96`, `sqrtStrikeUpperPX96`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `instrumentIdentifier` | [`InstrumentIdentifier`](../interfaces/InstrumentIdentifier.md) |
| `expiry` | `number` |
| `tickDelta` | `number` |
| `marginWad` | `BigNumber` |
| `sqrtStrikeLowerPX96` | `BigNumber` |
| `sqrtStrikeUpperPX96` | `BigNumber` |
| `overrides?` | `PayableOverrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### addToWhitelistLps

▸ **addToWhitelistLps**(`signer`, `targets`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `targets` | `string`[] |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### adjust

▸ **adjust**(`signer`, `instrumentAddr`, `param`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `instrumentAddr` | `string` |
| `param` | [`AdjustParam`](../interfaces/AdjustParam.md) |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### adjustMargin

▸ **adjustMargin**(`signer`, `pair`, `transferIn`, `margin`, `deadline`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `pair` | [`PairModel`](PairModel.md) |
| `transferIn` | `boolean` |
| `margin` | `BigNumber` |
| `deadline` | `number` |
| `overrides?` | `PayableOverrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### alignPriceWadToTick

▸ **alignPriceWadToTick**(`priceWad`): `Object`

#### Parameters

| Name | Type |
| :------ | :------ |
| `priceWad` | `BigNumber` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `priceWad` | `BigNumber` |
| `tick` | `number` |

___

### openLp

▸ **openLp**(`overrides?`): `Promise`<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `overrides?` | `CallOverrides` |

#### Returns

`Promise`<`boolean`\>

___

### batchCancelOrder

▸ **batchCancelOrder**(`signer`, `account`, `ordersToCancel`, `deadline`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `account` | [`PairLevelAccountModel`](PairLevelAccountModel.md) |
| `ordersToCancel` | [`OrderModel`](OrderModel.md)[] |
| `deadline` | `number` |
| `overrides?` | `PayableOverrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### calcBoost

▸ **calcBoost**(`alpha`, `imr`): `number`

#### Parameters

| Name | Type |
| :------ | :------ |
| `alpha` | `number` |
| `imr` | `number` |

#### Returns

`number`

___

### cancel

▸ **cancel**(`signer`, `instrumentAddr`, `param`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `instrumentAddr` | `string` |
| `param` | [`CancelParam`](../interfaces/CancelParam.md) |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### claimProtocolFee

▸ **claimProtocolFee**(`signer`, `instrumentAddr`, `expiry`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `instrumentAddr` | `string` |
| `expiry` | `number` |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### computeInitData

▸ **computeInitData**(`instrumentIdentifier`): `Promise`<`string`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrumentIdentifier` | [`InstrumentIdentifier`](../interfaces/InstrumentIdentifier.md) |

#### Returns

`Promise`<`string`\>

___

### computeInstrumentAddress

▸ **computeInstrumentAddress**(`marketType`, `baseSymbol`, `quoteSymbol`): `Promise`<`string`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `marketType` | `string` |
| `baseSymbol` | `string` |
| `quoteSymbol` | `string` |

#### Returns

`Promise`<`string`\>

___

### createChainlinkInstrument

▸ **createChainlinkInstrument**(`signer`, `param`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `param` | [`InstrumentIdentifier`](../interfaces/InstrumentIdentifier.md) |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### deposit

▸ **deposit**(`signer`, `quoteAddr`, `amount`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `quoteAddr` | `string` |
| `amount` | `BigNumber` |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### donateInsuranceFund

▸ **donateInsuranceFund**(`signer`, `instrumentAddr`, `expiry`, `amount`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `instrumentAddr` | `string` |
| `expiry` | `number` |
| `amount` | `BigNumber` |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### encodeLimitTicks

▸ **encodeLimitTicks**(`sqrtStrikeLowerPX96`, `sqrtStrikeUpperPX96`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `sqrtStrikeLowerPX96` | `BigNumber` |
| `sqrtStrikeUpperPX96` | `BigNumber` |

#### Returns

`BigNumber`

___

### estimateAPY

▸ **estimateAPY**(`pairModel`, `poolFee24h`, `alphaWad`): `number`

#### Parameters

| Name | Type |
| :------ | :------ |
| `pairModel` | [`PairModel`](PairModel.md) |
| `poolFee24h` | `BigNumber` |
| `alphaWad` | `BigNumber` |

#### Returns

`number`

___

### fetchInstrumentBatch

▸ **fetchInstrumentBatch**(`params`, `overrides?`): `Promise`<[`InstrumentModel`](InstrumentModel.md)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `params` | [`FetchInstrumentParam`](../interfaces/FetchInstrumentParam.md)[] |
| `overrides?` | `CallOverrides` |

#### Returns

`Promise`<[`InstrumentModel`](InstrumentModel.md)[]\>

___

### fill

▸ **fill**(`signer`, `instrumentAddr`, `param`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `instrumentAddr` | `string` |
| `param` | [`FillParam`](../interfaces/FillParam.md) |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### getAllInstruments

▸ **getAllInstruments**(`overrides?`): `Promise`<[`InstrumentModel`](InstrumentModel.md)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `overrides?` | `CallOverrides` |

#### Returns

`Promise`<[`InstrumentModel`](InstrumentModel.md)[]\>

___

### getCachedVaultBalance

▸ **getCachedVaultBalance**(`quoteAddress`, `userAddress`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `quoteAddress` | `string` |
| `userAddress` | `string` |

#### Returns

`BigNumber`

___

### getChainlinkRawSpotPrice

▸ **getChainlinkRawSpotPrice**(`identifier`): `Promise`<`BigNumber`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `identifier` | [`InstrumentIdentifier`](../interfaces/InstrumentIdentifier.md) |

#### Returns

`Promise`<`BigNumber`\>

___

### getDexV2RawSpotPrice

▸ **getDexV2RawSpotPrice**(`identifier`): `Promise`<`BigNumber`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `identifier` | [`InstrumentIdentifier`](../interfaces/InstrumentIdentifier.md) |

#### Returns

`Promise`<`BigNumber`\>

___

### getInstrumentContract

▸ **getInstrumentContract**(`address`, `signerOrProvider?`): `Instrument`

#### Parameters

| Name | Type |
| :------ | :------ |
| `address` | `string` |
| `signerOrProvider?` | `Signer` \| `Provider` |

#### Returns

`Instrument`

___

### getInstrumentInfo

▸ **getInstrumentInfo**(`instrumentAddress`): `Promise`<[`InstrumentInfo`](../interfaces/InstrumentInfo.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrumentAddress` | `string` |

#### Returns

`Promise`<[`InstrumentInfo`](../interfaces/InstrumentInfo.md)\>

___

### getInstrumentLevelAccounts

▸ **getInstrumentLevelAccounts**(`target`, `overrides?`): `Promise`<[`InstrumentLevelAccountModel`](InstrumentLevelAccountModel.md)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `target` | `string` |
| `overrides?` | `CallOverrides` |

#### Returns

`Promise`<[`InstrumentLevelAccountModel`](InstrumentLevelAccountModel.md)[]\>

___

### getLimitTick

▸ **getLimitTick**(`tradePrice`, `slippage`, `side`): `number`

#### Parameters

| Name | Type |
| :------ | :------ |
| `tradePrice` | `BigNumber` |
| `slippage` | `number` |
| `side` | [`Side`](../enums/Side.md) |

#### Returns

`number`

___

### getMaxLeverage

▸ **getMaxLeverage**(`imr`): `number`

#### Parameters

| Name | Type |
| :------ | :------ |
| `imr` | `number` |

#### Returns

`number`

___

### getNextInitializedTickOutside

▸ **getNextInitializedTickOutside**(`instrumentAddr`, `expiry`, `tick`, `right`): `Promise`<`number`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrumentAddr` | `string` |
| `expiry` | `number` |
| `tick` | `number` |
| `right` | `boolean` |

#### Returns

`Promise`<`number`\>

___

### getOrderLeverageByMargin

▸ **getOrderLeverageByMargin**(`targetTick`, `baseSize`, `margin`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `targetTick` | `number` |
| `baseSize` | `BigNumber` |
| `margin` | `BigNumber` |

#### Returns

`BigNumber`

___

### getOrderMarginByLeverage

▸ **getOrderMarginByLeverage**(`instrumentAddr`, `expiry`, `tick`, `size`, `leverage`): `Promise`<`BigNumber`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrumentAddr` | `string` |
| `expiry` | `number` |
| `tick` | `number` |
| `size` | `BigNumber` |
| `leverage` | `number` |

#### Returns

`Promise`<`BigNumber`\>

___

### getPairLevelAccount

▸ **getPairLevelAccount**(`target`, `instrument`, `expiry`): `Promise`<[`PairLevelAccountModel`](PairLevelAccountModel.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `target` | `string` |
| `instrument` | `string` |
| `expiry` | `number` |

#### Returns

`Promise`<[`PairLevelAccountModel`](PairLevelAccountModel.md)\>

___

### getPositionIfSettle

▸ **getPositionIfSettle**(`traderAccount`): `Promise`<[`Position`](../interfaces/Position.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `traderAccount` | [`PairLevelAccountModel`](PairLevelAccountModel.md) |

#### Returns

`Promise`<[`Position`](../interfaces/Position.md)\>

___

### getSpotPrice

▸ **getSpotPrice**(`identifier`): `Promise`<`BigNumber`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `identifier` | [`InstrumentIdentifier`](../interfaces/InstrumentIdentifier.md) |

#### Returns

`Promise`<`BigNumber`\>

___

### getSizeToTargetTick

▸ **getSizeToTargetTick**(`instrumentAddr`, `expiry`, `targetTick`): `Promise`<`BigNumber`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrumentAddr` | `string` |
| `expiry` | `number` |
| `targetTick` | `number` |

#### Returns

`Promise`<`BigNumber`\>

___

### getSqrtFairPX96

▸ **getSqrtFairPX96**(`instrumentAddr`, `expiry`): `Promise`<`BigNumber`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrumentAddr` | `string` |
| `expiry` | `number` |

#### Returns

`Promise`<`BigNumber`\>

___

### getTick

▸ **getTick**(`instrumentAddr`, `expiry`): `Promise`<`number`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrumentAddr` | `string` |
| `expiry` | `number` |

#### Returns

`Promise`<`number`\>

___

### getTickBitMaps

▸ **getTickBitMaps**(`instrument`, `expiry`): `Promise`<`Map`<`number`, `BigNumber`\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrument` | `string` |
| `expiry` | `number` |

#### Returns

`Promise`<`Map`<`number`, `BigNumber`\>\>

___

### inWhiteListLps

▸ **inWhiteListLps**(`traders`, `overrides?`): `Promise`<`boolean`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `traders` | `string`[] |
| `overrides?` | `CallOverrides` |

#### Returns

`Promise`<`boolean`[]\>

___

### init

▸ **init**(): `Promise`<`void`\>

#### Returns

`Promise`<`void`\>

___

### initInstruments

▸ **initInstruments**(): `Promise`<`void`\>

#### Returns

`Promise`<`void`\>

___

### inquire

▸ **inquire**(`instrumentAddr`, `expiry`, `size`): `Promise`<[`Quotation`](../interfaces/Quotation.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrumentAddr` | `string` |
| `expiry` | `number` |
| `size` | `BigNumber` |

#### Returns

`Promise`<[`Quotation`](../interfaces/Quotation.md)\>

___

### inquireByBase

▸ **inquireByBase**(`pair`, `side`, `baseAmount`, `overrides?`): `Promise`<{ `quotation`: [`Quotation`](../interfaces/Quotation.md) ; `quoteAmount`: `BigNumber`  }\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `pair` | [`PairModel`](PairModel.md) |
| `side` | [`Side`](../enums/Side.md) |
| `baseAmount` | `BigNumber` |
| `overrides?` | `CallOverrides` |

#### Returns

`Promise`<{ `quotation`: [`Quotation`](../interfaces/Quotation.md) ; `quoteAmount`: `BigNumber`  }\>

___

### inquireByQuote

▸ **inquireByQuote**(`pair`, `side`, `quoteAmount`, `overrides?`): `Promise`<{ `baseAmount`: `BigNumber` ; `quotation`: [`Quotation`](../interfaces/Quotation.md)  }\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `pair` | [`PairModel`](PairModel.md) |
| `side` | [`Side`](../enums/Side.md) |
| `quoteAmount` | `BigNumber` |
| `overrides?` | `CallOverrides` |

#### Returns

`Promise`<{ `baseAmount`: `BigNumber` ; `quotation`: [`Quotation`](../interfaces/Quotation.md)  }\>

___

### inquireLeverageFromTransferAmount

▸ **inquireLeverageFromTransferAmount**(`position`, `transferIn`, `transferAmount`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `position` | [`PositionModel`](PositionModel.md) |
| `transferIn` | `boolean` |
| `transferAmount` | `BigNumber` |

#### Returns

`BigNumber`

___

### inquireTransferAmountFromTargetLeverage

▸ **inquireTransferAmountFromTargetLeverage**(`position`, `targetLeverage`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `position` | [`PositionModel`](PositionModel.md) |
| `targetLeverage` | `BigNumber` |

#### Returns

`BigNumber`

___

### inspectDexV2MarketBenchmarkPrice

▸ `Private` **inspectDexV2MarketBenchmarkPrice**(`instrumentIdentifier`, `expiry`): `Promise`<`BigNumber`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrumentIdentifier` | [`InstrumentIdentifier`](../interfaces/InstrumentIdentifier.md) |
| `expiry` | `number` |

#### Returns

`Promise`<`BigNumber`\>

___

### intuitiveTrade

▸ **intuitiveTrade**(`signer`, `pair`, `side`, `base`, `margin`, `tradePrice`, `slippage`, `deadline`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `pair` | [`PairModel`](PairModel.md) |
| `side` | [`Side`](../enums/Side.md) |
| `base` | `BigNumber` |
| `margin` | `BigNumber` |
| `tradePrice` | `BigNumber` |
| `slippage` | `number` |
| `deadline` | `number` |
| `overrides?` | `PayableOverrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### leverageAtMargin

▸ **leverageAtMargin**(`pair`, `side`, `baseSize`, `quoteAmount`, `marginWad`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `pair` | [`PairModel`](PairModel.md) |
| `side` | [`Side`](../enums/Side.md) |
| `baseSize` | `BigNumber` |
| `quoteAmount` | `BigNumber` |
| `marginWad` | `BigNumber` |

#### Returns

`BigNumber`

___

### limitOrder

▸ **limitOrder**(`signer`, `pair`, `tickNumber`, `baseWad`, `balanceWad`, `side`, `deadline`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `pair` | [`PairModel`](PairModel.md) |
| `tickNumber` | `number` |
| `baseWad` | `BigNumber` |
| `balanceWad` | `BigNumber` |
| `side` | [`Side`](../enums/Side.md) |
| `deadline` | `number` |
| `overrides?` | `PayableOverrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### liquidate

▸ **liquidate**(`signer`, `instrumentAddr`, `param`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `instrumentAddr` | `string` |
| `param` | [`LiquidateParam`](../interfaces/LiquidateParam.md) |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### marginAtLeverage

▸ **marginAtLeverage**(`pair`, `side`, `baseSize`, `quoteAmount`, `leverage`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `pair` | [`PairModel`](PairModel.md) |
| `side` | [`Side`](../enums/Side.md) |
| `baseSize` | `BigNumber` |
| `quoteAmount` | `BigNumber` |
| `leverage` | `BigNumber` |

#### Returns

`BigNumber`

___

### marginToDepositWad

▸ `Private` **marginToDepositWad**(`traderAddress`, `quoteInfo`, `marginNeedWad`): `BigNumber`

#### Parameters

| Name | Type |
| :------ | :------ |
| `traderAddress` | `string` |
| `quoteInfo` | [`TokenInfo`](../interfaces/TokenInfo.md) |
| `marginNeedWad` | `BigNumber` |

#### Returns

`BigNumber`

___

### parseInstrumentData

▸ **parseInstrumentData**(`rawList`, `blockInfo`): `Promise`<[`InstrumentModel`](InstrumentModel.md)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `rawList` | [`AssembledInstrumentData`](../interfaces/AssembledInstrumentData.md)[] |
| `blockInfo` | `BlockInfo` |

#### Returns

`Promise`<[`InstrumentModel`](InstrumentModel.md)[]\>

___

### place

▸ **place**(`signer`, `instrumentAddr`, `param`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `instrumentAddr` | `string` |
| `param` | [`PlaceParam`](../interfaces/PlaceParam.md) |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### remove

▸ **remove**(`signer`, `instrumentAddr`, `param`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `instrumentAddr` | `string` |
| `param` | [`RemoveParam`](../interfaces/RemoveParam.md) |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### removeFromWhitelistLps

▸ **removeFromWhitelistLps**(`signer`, `targets`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `targets` | `string`[] |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### removeLiquidity

▸ **removeLiquidity**(`signer`, `pairModel`, `targetAddress`, `rangeModel`, `sqrtStrikeLowerPX96`, `sqrtStrikeUpperPX96`, `deadline`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `pairModel` | [`PairModel`](PairModel.md) |
| `targetAddress` | `string` |
| `rangeModel` | [`RangeModel`](RangeModel.md) |
| `sqrtStrikeLowerPX96` | `BigNumber` |
| `sqrtStrikeUpperPX96` | `BigNumber` |
| `deadline` | `number` |
| `overrides?` | `PayableOverrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### disableLpWhitelist

▸ **disableLpWhitelist**(`signer`, `allow`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `allow` | `boolean` |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### setCachedVaultBalance

▸ **setCachedVaultBalance**(`quoteAddress`, `userAddress`, `balance`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `quoteAddress` | `string` |
| `userAddress` | `string` |
| `balance` | `BigNumber` |

#### Returns

`void`

___

### setChainlinkFeeder

▸ **setChainlinkFeeder**(`signer`, `params`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `params` | [`SetChainlinkFeederParam`](../interfaces/SetChainlinkFeederParam.md)[] |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### setProvider

▸ **setProvider**(`provider`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `provider` | `Provider` |

#### Returns

`void`

___

### setLpWhiteList

▸ **setLpWhiteList**(`signer`, `targets`, `flags`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `targets` | `string`[] |
| `flags` | `boolean`[] |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### settle

▸ **settle**(`signer`, `instrumentAddr`, `expiry`, `target`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `instrumentAddr` | `string` |
| `expiry` | `number` |
| `target` | `string` |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### simulateAddLiquidity

▸ **simulateAddLiquidity**(`targetAddress`, `instrumentIdentifier`, `expiry`, `alphaWad`, `margin`, `slippage`, `currentSqrtPX96?`): `Promise`<{ `liquidity`: `BigNumber` ; `lowerLeverageWad`: `BigNumber` ; `lowerPosition`: [`PositionModel`](PositionModel.md) ; `lowerPrice`: `BigNumber` ; `marginToDepositWad`: `BigNumber` ; `minEffectiveQuoteAmount`: `BigNumber` ; `minMargin`: `BigNumber` ; `sqrtStrikeLowerPX96`: `BigNumber` ; `sqrtStrikeUpperPX96`: `BigNumber` ; `tickDelta`: `number` ; `upperLeverageWad`: `BigNumber` ; `upperPosition`: [`PositionModel`](PositionModel.md) ; `upperPrice`: `BigNumber`  }\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `targetAddress` | `string` |
| `instrumentIdentifier` | [`InstrumentIdentifier`](../interfaces/InstrumentIdentifier.md) |
| `expiry` | `number` |
| `alphaWad` | `BigNumber` |
| `margin` | `BigNumber` |
| `slippage` | `number` |
| `currentSqrtPX96?` | `BigNumber` |

#### Returns

`Promise`<{ `liquidity`: `BigNumber` ; `lowerLeverageWad`: `BigNumber` ; `lowerPosition`: [`PositionModel`](PositionModel.md) ; `lowerPrice`: `BigNumber` ; `marginToDepositWad`: `BigNumber` ; `minEffectiveQuoteAmount`: `BigNumber` ; `minMargin`: `BigNumber` ; `sqrtStrikeLowerPX96`: `BigNumber` ; `sqrtStrikeUpperPX96`: `BigNumber` ; `tickDelta`: `number` ; `upperLeverageWad`: `BigNumber` ; `upperPosition`: [`PositionModel`](PositionModel.md) ; `upperPrice`: `BigNumber`  }\>

___

### simulateAdjustMargin

▸ **simulateAdjustMargin**(`pairAccountModel`, `transferAmount`, `leverageWad`): `Object`

#### Parameters

| Name | Type |
| :------ | :------ |
| `pairAccountModel` | [`PairLevelAccountModel`](PairLevelAccountModel.md) |
| `transferAmount` | `undefined` \| `BigNumber` |
| `leverageWad` | `undefined` \| `BigNumber` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `leverageWad` | `BigNumber` |
| `marginToDepositWad` | `BigNumber` |
| `simulationMainPosition` | [`PositionModel`](PositionModel.md) |
| `transferAmount` | `BigNumber` |

___

### simulateOrder

▸ **simulateOrder**(`pairAccountModel`, `targetTick`, `baseSize`, `side`, `leverageWad`): `Object`

#### Parameters

| Name | Type |
| :------ | :------ |
| `pairAccountModel` | [`PairLevelAccountModel`](PairLevelAccountModel.md) |
| `targetTick` | `number` |
| `baseSize` | `BigNumber` |
| `side` | [`Side`](../enums/Side.md) |
| `leverageWad` | `BigNumber` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `balance` | `BigNumber` |
| `baseSize` | `BigNumber` |
| `leverageWad` | `BigNumber` |
| `marginToDepositWad` | `BigNumber` |
| `minFeeRebate` | `BigNumber` |
| `minOrderValue` | `BigNumber` |

___

### simulateRemoveLiquidity

▸ **simulateRemoveLiquidity**(`pairAccountModel`, `rangeModel`, `slippage`): `Object`

#### Parameters

| Name | Type |
| :------ | :------ |
| `pairAccountModel` | [`PairLevelAccountModel`](PairLevelAccountModel.md) |
| `rangeModel` | [`RangeModel`](RangeModel.md) |
| `slippage` | `number` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `simulatePositionRemoved` | [`PositionModel`](PositionModel.md) |
| `simulationMainPosition` | [`PositionModel`](PositionModel.md) |
| `sqrtStrikeLowerPX96` | `BigNumber` |
| `sqrtStrikeUpperPX96` | `BigNumber` |

___

### simulateTrade

▸ **simulateTrade**(`pairAccountModel`, `quotation`, `side`, `baseSize`, `margin`, `leverageWad`, `slippage`): `Object`

#### Parameters

| Name | Type |
| :------ | :------ |
| `pairAccountModel` | [`PairLevelAccountModel`](PairLevelAccountModel.md) |
| `quotation` | [`Quotation`](../interfaces/Quotation.md) |
| `side` | [`Side`](../enums/Side.md) |
| `baseSize` | `BigNumber` |
| `margin` | `undefined` \| `BigNumber` |
| `leverageWad` | `undefined` \| `BigNumber` |
| `slippage` | `number` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `estimatedTradeValue` | `BigNumber` |
| `exceedMaxLeverage` | `boolean` |
| `leverageWad` | `BigNumber` |
| `limitTick` | `BigNumber` |
| `margin` | `BigNumber` |
| `marginToDepositWad` | `BigNumber` |
| `minTradeValue` | `BigNumber` |
| `priceImpactWad` | `BigNumber` |
| `simulationMainPosition` | [`PositionModel`](PositionModel.md) |
| `tradePrice` | `BigNumber` |
| `tradingFee` | `BigNumber` |

___

### sweep

▸ **sweep**(`signer`, `instrumentAddr`, `param`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `instrumentAddr` | `string` |
| `param` | [`SweepParam`](../interfaces/SweepParam.md) |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### syncChainlinkFeederWithConfig

▸ **syncChainlinkFeederWithConfig**(`signer`, `pairs`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `pairs` | { `baseSymbol`: `string` ; `quoteSymbol`: `string`  }[] |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### syncVaultCache

▸ **syncVaultCache**(`target`, `quotes`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `target` | `string` |
| `quotes` | `string`[] |

#### Returns

`Promise`<`void`\>

___

### syncVaultCacheWithAllQuotes

▸ **syncVaultCacheWithAllQuotes**(`target`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `target` | `string` |

#### Returns

`Promise`<`void`\>

___

### trade

▸ **trade**(`signer`, `instrumentAddr`, `param`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `instrumentAddr` | `string` |
| `param` | [`TradeParam`](../interfaces/TradeParam.md) |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### update

▸ **update**(`signer`, `instrumentAddr`, `expiry`, `overrides?`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `instrumentAddr` | `string` |
| `expiry` | `number` |
| `overrides?` | `Overrides` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### updateInstrument

▸ **updateInstrument**(`params`, `overrides?`): `Promise`<[`InstrumentModel`](InstrumentModel.md)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `params` | [`FetchInstrumentParam`](../interfaces/FetchInstrumentParam.md)[] |
| `overrides?` | `CallOverrides` |

#### Returns

`Promise`<[`InstrumentModel`](InstrumentModel.md)[]\>

___

### updateInstrumentCache

▸ **updateInstrumentCache**(`instrumentModels`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `instrumentModels` | [`InstrumentModel`](InstrumentModel.md)[] |

#### Returns

`void`

___

### updatePairLevelAccount

▸ **updatePairLevelAccount**(`target`, `instrument`, `expiry`, `overrides?`): `Promise`<[`PairLevelAccountModel`](PairLevelAccountModel.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `target` | `string` |
| `instrument` | `string` |
| `expiry` | `number` |
| `overrides?` | `CallOverrides` |

#### Returns

`Promise`<[`PairLevelAccountModel`](PairLevelAccountModel.md)\>

___

### vaultOperation

▸ **vaultOperation**(`signer`, `quoteAddress`, `amountWad`, `deposit`): `Promise`<`ContractTransaction` \| `TransactionReceipt`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | `Signer` |
| `quoteAddress` | `string` |
| `amountWad` | `BigNumber` |
| `deposit` | `boolean` |

#### Returns

`Promise`<`ContractTransaction` \| `TransactionReceipt`\>

___

### getInstance

▸ `Static` **getInstance**(`chanIdOrName`): [`SynFuturesV3`](SynFuturesV3.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `chanIdOrName` | `string` \| `CHAIN_ID` |

#### Returns

[`SynFuturesV3`](SynFuturesV3.md)
