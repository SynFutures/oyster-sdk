/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumber,
  BigNumberish,
  BytesLike,
  CallOverrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import type { FunctionFragment, Result } from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type {
  TypedEventFilter,
  TypedEvent,
  TypedListener,
  OnEvent,
  PromiseOrValue,
} from "../../../common";

export interface LibVaultInterface extends utils.Interface {
  functions: {
    "getTotalValue(bytes32[],address,address,address,uint8)": FunctionFragment;
  };

  getFunction(nameOrSignatureOrTopic: "getTotalValue"): FunctionFragment;

  encodeFunctionData(
    functionFragment: "getTotalValue",
    values: [
      PromiseOrValue<BytesLike>[],
      PromiseOrValue<string>,
      PromiseOrValue<string>,
      PromiseOrValue<string>,
      PromiseOrValue<BigNumberish>
    ]
  ): string;

  decodeFunctionResult(
    functionFragment: "getTotalValue",
    data: BytesLike
  ): Result;

  events: {};
}

export interface LibVault extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: LibVaultInterface;

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
    getTotalValue(
      pairs: PromiseOrValue<BytesLike>[],
      target: PromiseOrValue<string>,
      gate: PromiseOrValue<string>,
      quote: PromiseOrValue<string>,
      quoteDecimals: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<[BigNumber] & { totalValue: BigNumber }>;
  };

  getTotalValue(
    pairs: PromiseOrValue<BytesLike>[],
    target: PromiseOrValue<string>,
    gate: PromiseOrValue<string>,
    quote: PromiseOrValue<string>,
    quoteDecimals: PromiseOrValue<BigNumberish>,
    overrides?: CallOverrides
  ): Promise<BigNumber>;

  callStatic: {
    getTotalValue(
      pairs: PromiseOrValue<BytesLike>[],
      target: PromiseOrValue<string>,
      gate: PromiseOrValue<string>,
      quote: PromiseOrValue<string>,
      quoteDecimals: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  filters: {};

  estimateGas: {
    getTotalValue(
      pairs: PromiseOrValue<BytesLike>[],
      target: PromiseOrValue<string>,
      gate: PromiseOrValue<string>,
      quote: PromiseOrValue<string>,
      quoteDecimals: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    getTotalValue(
      pairs: PromiseOrValue<BytesLike>[],
      target: PromiseOrValue<string>,
      gate: PromiseOrValue<string>,
      quote: PromiseOrValue<string>,
      quoteDecimals: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;
  };
}