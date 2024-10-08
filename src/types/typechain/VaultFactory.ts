/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumber,
  BigNumberish,
  BytesLike,
  CallOverrides,
  ContractTransaction,
  Overrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import type {
  FunctionFragment,
  Result,
  EventFragment,
} from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type {
  TypedEventFilter,
  TypedEvent,
  TypedListener,
  OnEvent,
  PromiseOrValue,
} from "./common";

export type ConfigurationStruct = {
  stage: PromiseOrValue<BigNumberish>;
  quote: PromiseOrValue<string>;
  decimals: PromiseOrValue<BigNumberish>;
  maxPair: PromiseOrValue<BigNumberish>;
  maxRange: PromiseOrValue<BigNumberish>;
  maxOrder: PromiseOrValue<BigNumberish>;
  commissionRatio: PromiseOrValue<BigNumberish>;
  minQuoteAmount: PromiseOrValue<BigNumberish>;
  liveThreshold: PromiseOrValue<BigNumberish>;
};

export type ConfigurationStructOutput = [
  number,
  string,
  number,
  number,
  number,
  number,
  number,
  BigNumber,
  BigNumber
] & {
  stage: number;
  quote: string;
  decimals: number;
  maxPair: number;
  maxRange: number;
  maxOrder: number;
  commissionRatio: number;
  minQuoteAmount: BigNumber;
  liveThreshold: BigNumber;
};

export interface VaultFactoryInterface extends utils.Interface {
  functions: {
    "config()": FunctionFragment;
    "createVault(address,string,(uint8,address,uint8,uint8,uint8,uint8,uint16,uint128,uint128))": FunctionFragment;
    "getAllVaults()": FunctionFragment;
    "guardian()": FunctionFragment;
    "indexToVault(bytes32)": FunctionFragment;
    "initialize(address)": FunctionFragment;
    "owner()": FunctionFragment;
    "releasePendingForVault()": FunctionFragment;
    "renounceOwnership()": FunctionFragment;
    "setVaultCommissionRatio(address,uint16)": FunctionFragment;
    "setVaultLiveThreshold(address,uint128)": FunctionFragment;
    "setVaultManager(address,address)": FunctionFragment;
    "setVaultMinQuoteAmount(address,uint128)": FunctionFragment;
    "setVaultPortfolioLimit(address,uint8,uint8,uint8)": FunctionFragment;
    "setVaultStage(address,uint8)": FunctionFragment;
    "totalVaults()": FunctionFragment;
    "transferOwnership(address)": FunctionFragment;
    "vaultBeacon()": FunctionFragment;
    "vaultToIndex(address)": FunctionFragment;
    "vaults(uint256)": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | "config"
      | "createVault"
      | "getAllVaults"
      | "guardian"
      | "indexToVault"
      | "initialize"
      | "owner"
      | "releasePendingForVault"
      | "renounceOwnership"
      | "setVaultCommissionRatio"
      | "setVaultLiveThreshold"
      | "setVaultManager"
      | "setVaultMinQuoteAmount"
      | "setVaultPortfolioLimit"
      | "setVaultStage"
      | "totalVaults"
      | "transferOwnership"
      | "vaultBeacon"
      | "vaultToIndex"
      | "vaults"
  ): FunctionFragment;

  encodeFunctionData(functionFragment: "config", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "createVault",
    values: [
      PromiseOrValue<string>,
      PromiseOrValue<string>,
      ConfigurationStruct
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "getAllVaults",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "guardian", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "indexToVault",
    values: [PromiseOrValue<BytesLike>]
  ): string;
  encodeFunctionData(
    functionFragment: "initialize",
    values: [PromiseOrValue<string>]
  ): string;
  encodeFunctionData(functionFragment: "owner", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "releasePendingForVault",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "renounceOwnership",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "setVaultCommissionRatio",
    values: [PromiseOrValue<string>, PromiseOrValue<BigNumberish>]
  ): string;
  encodeFunctionData(
    functionFragment: "setVaultLiveThreshold",
    values: [PromiseOrValue<string>, PromiseOrValue<BigNumberish>]
  ): string;
  encodeFunctionData(
    functionFragment: "setVaultManager",
    values: [PromiseOrValue<string>, PromiseOrValue<string>]
  ): string;
  encodeFunctionData(
    functionFragment: "setVaultMinQuoteAmount",
    values: [PromiseOrValue<string>, PromiseOrValue<BigNumberish>]
  ): string;
  encodeFunctionData(
    functionFragment: "setVaultPortfolioLimit",
    values: [
      PromiseOrValue<string>,
      PromiseOrValue<BigNumberish>,
      PromiseOrValue<BigNumberish>,
      PromiseOrValue<BigNumberish>
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "setVaultStage",
    values: [PromiseOrValue<string>, PromiseOrValue<BigNumberish>]
  ): string;
  encodeFunctionData(
    functionFragment: "totalVaults",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "transferOwnership",
    values: [PromiseOrValue<string>]
  ): string;
  encodeFunctionData(
    functionFragment: "vaultBeacon",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "vaultToIndex",
    values: [PromiseOrValue<string>]
  ): string;
  encodeFunctionData(
    functionFragment: "vaults",
    values: [PromiseOrValue<BigNumberish>]
  ): string;

  decodeFunctionResult(functionFragment: "config", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "createVault",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getAllVaults",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "guardian", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "indexToVault",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "initialize", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "owner", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "releasePendingForVault",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "renounceOwnership",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setVaultCommissionRatio",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setVaultLiveThreshold",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setVaultManager",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setVaultMinQuoteAmount",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setVaultPortfolioLimit",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setVaultStage",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "totalVaults",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "transferOwnership",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "vaultBeacon",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "vaultToIndex",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "vaults", data: BytesLike): Result;

  events: {
    "CreateVault(address,address,string,tuple,uint256)": EventFragment;
    "Initialized(uint8)": EventFragment;
    "OwnershipTransferred(address,address)": EventFragment;
  };

  getEvent(nameOrSignatureOrTopic: "CreateVault"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "Initialized"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "OwnershipTransferred"): EventFragment;
}

export interface CreateVaultEventObject {
  vault: string;
  manager: string;
  name: string;
  configuration: ConfigurationStructOutput;
  index: BigNumber;
}
export type CreateVaultEvent = TypedEvent<
  [string, string, string, ConfigurationStructOutput, BigNumber],
  CreateVaultEventObject
>;

export type CreateVaultEventFilter = TypedEventFilter<CreateVaultEvent>;

export interface InitializedEventObject {
  version: number;
}
export type InitializedEvent = TypedEvent<[number], InitializedEventObject>;

export type InitializedEventFilter = TypedEventFilter<InitializedEvent>;

export interface OwnershipTransferredEventObject {
  previousOwner: string;
  newOwner: string;
}
export type OwnershipTransferredEvent = TypedEvent<
  [string, string],
  OwnershipTransferredEventObject
>;

export type OwnershipTransferredEventFilter =
  TypedEventFilter<OwnershipTransferredEvent>;

export interface VaultFactory extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: VaultFactoryInterface;

  queryFilter<TEvent extends TypedEvent>(
    event: TypedEventFilter<TEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TEvent>>;

  listeners<TEvent extends TypedEvent>(
    eventFilter?: TypedEventFilter<TEvent>
  ): Array<TypedListener<TEvent>>;
  listeners(eventName?: string): Array<Listener>;
  removeAllListeners<TEvent extends TypedEvent>(
    eventFilter: TypedEventFilter<TEvent>
  ): this;
  removeAllListeners(eventName?: string): this;
  off: OnEvent<this>;
  on: OnEvent<this>;
  once: OnEvent<this>;
  removeListener: OnEvent<this>;

  functions: {
    config(overrides?: CallOverrides): Promise<[string]>;

    createVault(
      manager: PromiseOrValue<string>,
      name: PromiseOrValue<string>,
      configuration: ConfigurationStruct,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    getAllVaults(overrides?: CallOverrides): Promise<[string[]]>;

    guardian(overrides?: CallOverrides): Promise<[string]>;

    indexToVault(
      index: PromiseOrValue<BytesLike>,
      overrides?: CallOverrides
    ): Promise<[string] & { vault: string }>;

    initialize(
      _admin: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    owner(overrides?: CallOverrides): Promise<[string]>;

    releasePendingForVault(
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    renounceOwnership(
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    setVaultCommissionRatio(
      vault: PromiseOrValue<string>,
      commissionRatio: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    setVaultLiveThreshold(
      vault: PromiseOrValue<string>,
      liveThreshold: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    setVaultManager(
      vault: PromiseOrValue<string>,
      newManager: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    setVaultMinQuoteAmount(
      vault: PromiseOrValue<string>,
      minQuoteAmount: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    setVaultPortfolioLimit(
      vault: PromiseOrValue<string>,
      newMaxPair: PromiseOrValue<BigNumberish>,
      newMaxRange: PromiseOrValue<BigNumberish>,
      newMaxOrder: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    setVaultStage(
      vault: PromiseOrValue<string>,
      newStage: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    totalVaults(overrides?: CallOverrides): Promise<[BigNumber]>;

    transferOwnership(
      newOwner: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    vaultBeacon(overrides?: CallOverrides): Promise<[string]>;

    vaultToIndex(
      vault: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<[string] & { index: string }>;

    vaults(
      arg0: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<[string]>;
  };

  config(overrides?: CallOverrides): Promise<string>;

  createVault(
    manager: PromiseOrValue<string>,
    name: PromiseOrValue<string>,
    configuration: ConfigurationStruct,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  getAllVaults(overrides?: CallOverrides): Promise<string[]>;

  guardian(overrides?: CallOverrides): Promise<string>;

  indexToVault(
    index: PromiseOrValue<BytesLike>,
    overrides?: CallOverrides
  ): Promise<string>;

  initialize(
    _admin: PromiseOrValue<string>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  owner(overrides?: CallOverrides): Promise<string>;

  releasePendingForVault(
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  renounceOwnership(
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  setVaultCommissionRatio(
    vault: PromiseOrValue<string>,
    commissionRatio: PromiseOrValue<BigNumberish>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  setVaultLiveThreshold(
    vault: PromiseOrValue<string>,
    liveThreshold: PromiseOrValue<BigNumberish>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  setVaultManager(
    vault: PromiseOrValue<string>,
    newManager: PromiseOrValue<string>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  setVaultMinQuoteAmount(
    vault: PromiseOrValue<string>,
    minQuoteAmount: PromiseOrValue<BigNumberish>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  setVaultPortfolioLimit(
    vault: PromiseOrValue<string>,
    newMaxPair: PromiseOrValue<BigNumberish>,
    newMaxRange: PromiseOrValue<BigNumberish>,
    newMaxOrder: PromiseOrValue<BigNumberish>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  setVaultStage(
    vault: PromiseOrValue<string>,
    newStage: PromiseOrValue<BigNumberish>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  totalVaults(overrides?: CallOverrides): Promise<BigNumber>;

  transferOwnership(
    newOwner: PromiseOrValue<string>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  vaultBeacon(overrides?: CallOverrides): Promise<string>;

  vaultToIndex(
    vault: PromiseOrValue<string>,
    overrides?: CallOverrides
  ): Promise<string>;

  vaults(
    arg0: PromiseOrValue<BigNumberish>,
    overrides?: CallOverrides
  ): Promise<string>;

  callStatic: {
    config(overrides?: CallOverrides): Promise<string>;

    createVault(
      manager: PromiseOrValue<string>,
      name: PromiseOrValue<string>,
      configuration: ConfigurationStruct,
      overrides?: CallOverrides
    ): Promise<string>;

    getAllVaults(overrides?: CallOverrides): Promise<string[]>;

    guardian(overrides?: CallOverrides): Promise<string>;

    indexToVault(
      index: PromiseOrValue<BytesLike>,
      overrides?: CallOverrides
    ): Promise<string>;

    initialize(
      _admin: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<void>;

    owner(overrides?: CallOverrides): Promise<string>;

    releasePendingForVault(overrides?: CallOverrides): Promise<void>;

    renounceOwnership(overrides?: CallOverrides): Promise<void>;

    setVaultCommissionRatio(
      vault: PromiseOrValue<string>,
      commissionRatio: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<void>;

    setVaultLiveThreshold(
      vault: PromiseOrValue<string>,
      liveThreshold: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<void>;

    setVaultManager(
      vault: PromiseOrValue<string>,
      newManager: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<void>;

    setVaultMinQuoteAmount(
      vault: PromiseOrValue<string>,
      minQuoteAmount: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<void>;

    setVaultPortfolioLimit(
      vault: PromiseOrValue<string>,
      newMaxPair: PromiseOrValue<BigNumberish>,
      newMaxRange: PromiseOrValue<BigNumberish>,
      newMaxOrder: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<void>;

    setVaultStage(
      vault: PromiseOrValue<string>,
      newStage: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<void>;

    totalVaults(overrides?: CallOverrides): Promise<BigNumber>;

    transferOwnership(
      newOwner: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<void>;

    vaultBeacon(overrides?: CallOverrides): Promise<string>;

    vaultToIndex(
      vault: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<string>;

    vaults(
      arg0: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<string>;
  };

  filters: {
    "CreateVault(address,address,string,tuple,uint256)"(
      vault?: null,
      manager?: null,
      name?: null,
      configuration?: null,
      index?: null
    ): CreateVaultEventFilter;
    CreateVault(
      vault?: null,
      manager?: null,
      name?: null,
      configuration?: null,
      index?: null
    ): CreateVaultEventFilter;

    "Initialized(uint8)"(version?: null): InitializedEventFilter;
    Initialized(version?: null): InitializedEventFilter;

    "OwnershipTransferred(address,address)"(
      previousOwner?: PromiseOrValue<string> | null,
      newOwner?: PromiseOrValue<string> | null
    ): OwnershipTransferredEventFilter;
    OwnershipTransferred(
      previousOwner?: PromiseOrValue<string> | null,
      newOwner?: PromiseOrValue<string> | null
    ): OwnershipTransferredEventFilter;
  };

  estimateGas: {
    config(overrides?: CallOverrides): Promise<BigNumber>;

    createVault(
      manager: PromiseOrValue<string>,
      name: PromiseOrValue<string>,
      configuration: ConfigurationStruct,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    getAllVaults(overrides?: CallOverrides): Promise<BigNumber>;

    guardian(overrides?: CallOverrides): Promise<BigNumber>;

    indexToVault(
      index: PromiseOrValue<BytesLike>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    initialize(
      _admin: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    owner(overrides?: CallOverrides): Promise<BigNumber>;

    releasePendingForVault(
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    renounceOwnership(
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    setVaultCommissionRatio(
      vault: PromiseOrValue<string>,
      commissionRatio: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    setVaultLiveThreshold(
      vault: PromiseOrValue<string>,
      liveThreshold: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    setVaultManager(
      vault: PromiseOrValue<string>,
      newManager: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    setVaultMinQuoteAmount(
      vault: PromiseOrValue<string>,
      minQuoteAmount: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    setVaultPortfolioLimit(
      vault: PromiseOrValue<string>,
      newMaxPair: PromiseOrValue<BigNumberish>,
      newMaxRange: PromiseOrValue<BigNumberish>,
      newMaxOrder: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    setVaultStage(
      vault: PromiseOrValue<string>,
      newStage: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    totalVaults(overrides?: CallOverrides): Promise<BigNumber>;

    transferOwnership(
      newOwner: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    vaultBeacon(overrides?: CallOverrides): Promise<BigNumber>;

    vaultToIndex(
      vault: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    vaults(
      arg0: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    config(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    createVault(
      manager: PromiseOrValue<string>,
      name: PromiseOrValue<string>,
      configuration: ConfigurationStruct,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    getAllVaults(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    guardian(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    indexToVault(
      index: PromiseOrValue<BytesLike>,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    initialize(
      _admin: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    owner(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    releasePendingForVault(
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    renounceOwnership(
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    setVaultCommissionRatio(
      vault: PromiseOrValue<string>,
      commissionRatio: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    setVaultLiveThreshold(
      vault: PromiseOrValue<string>,
      liveThreshold: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    setVaultManager(
      vault: PromiseOrValue<string>,
      newManager: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    setVaultMinQuoteAmount(
      vault: PromiseOrValue<string>,
      minQuoteAmount: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    setVaultPortfolioLimit(
      vault: PromiseOrValue<string>,
      newMaxPair: PromiseOrValue<BigNumberish>,
      newMaxRange: PromiseOrValue<BigNumberish>,
      newMaxOrder: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    setVaultStage(
      vault: PromiseOrValue<string>,
      newStage: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    totalVaults(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    transferOwnership(
      newOwner: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    vaultBeacon(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    vaultToIndex(
      vault: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    vaults(
      arg0: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;
  };
}
