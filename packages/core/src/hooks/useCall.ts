import { Chain } from "@starknet-react/chains";
import { useMemo } from "react";
import {
  Abi,
  ArgsOrCalldata,
  BlockNumber,
  BlockTag,
  Contract,
  Result,
} from "starknet";

import { UseQueryProps, UseQueryResult, useQuery } from "~/query";
import { useInvalidateOnBlock } from "./useInvalidateOnBlock";
import { useNetwork } from "./useNetwork";

const DEFAULT_FETCH_INTERVAL = 5_000;

type ReadContractArgs = {
  /** The contract's function name. */
  functionName: string;
  /** Read arguments. */
  args?: ArgsOrCalldata;
  /** Block identifier used when performing call. */
  blockIdentifier?: BlockNumber;
};

export type ContractReadQueryKey = typeof queryKey;

/** Options for `useCall`. */
export type UseCallProps = ReadContractArgs &
  UseQueryProps<Result, Error, Result, ReturnType<ContractReadQueryKey>> & {
    /** The target contract's ABI. */
    abi?: Abi;
    /** The target contract's address. */
    address?: string;
    /** Refresh data at every block. */
    watch?: boolean;
  };

/** Value returned from `useCall`. */
export type UseCallResult = UseQueryResult<Result, Error>;

/**
 * Hook to perform a read-only contract call.
 *
 * @remarks
 *
 * The hook only performs a call if the target `abi`, `address`,
 * `functionName`, and `args` are not undefined.
 *
 */
export function useCall({
  abi,
  address,
  functionName,
  args,
  blockIdentifier = BlockTag.latest,
  refetchInterval: refetchInterval_,
  watch = false,
  enabled: enabled_ = true,
  ...props
}: UseCallProps): UseCallResult {
  const { chain } = useNetwork();
  const contract = abi && address ? new Contract(abi, address) : undefined;

  const queryKey_ = useMemo(
    () => queryKey({ chain, contract, functionName, args, blockIdentifier }),
    [chain, contract, functionName, args, blockIdentifier]
  );

  const enabled = useMemo(
    () => Boolean(enabled_ && contract && functionName && args),
    [enabled_, contract, functionName, args]
  );

  const refetchInterval =
    refetchInterval_ ??
    (blockIdentifier === BlockTag.pending && watch
      ? DEFAULT_FETCH_INTERVAL
      : undefined);

  useInvalidateOnBlock({
    enabled: Boolean(enabled && watch),
    queryKey: queryKey_,
  });

  return useQuery({
    queryKey: queryKey_,
    queryFn: queryFn({
      contract,
      functionName,
      args,
      blockIdentifier,
    }),
    refetchInterval,
    ...props,
  });
}

function queryKey({
  chain,
  contract,
  functionName,
  args,
  blockIdentifier,
}: { chain?: Chain; contract?: Contract } & ReadContractArgs) {
  return [
    {
      entity: "readContract",
      chainId: chain?.name,
      contract: contract?.address,
      functionName,
      args,
      blockIdentifier,
    },
  ] as const;
}

function queryFn({
  contract,
  functionName,
  args,
  blockIdentifier,
}: { contract?: Contract } & ReadContractArgs) {
  return async () => {
    if (!contract) throw new Error("contract is required");
    if (contract.functions[functionName] === undefined) {
      throw new Error(`function ${functionName} not found in contract`);
    }

    return contract.call(functionName, args, {
      parseRequest: true,
      parseResponse: true,
      blockIdentifier,
    });
  };
}
