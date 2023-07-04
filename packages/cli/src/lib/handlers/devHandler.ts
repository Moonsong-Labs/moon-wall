import {
  BlockCreation,
  CallType,
  DeepPartial,
  DevModeContext,
  EthersTransactionOptions,
  FoundationHandler,
  ViemTransactionOptions,
  ContractCallOptions,
} from "@moonwall/types";
import { ALITH_PRIVATE_KEY, createEthersTransaction, createViemTransaction } from "@moonwall/util";
import { ApiTypes } from "@polkadot/api/types/index.js";
import { createDevBlock } from "../../internal/foundations/devModeHelpers.js";
import { importJsonConfig } from "../configReader.js";
import { interactWithPrecompileContract } from "../contractFunctions.js";

export const devHandler: FoundationHandler<"dev"> = ({ testCases, context, testCase, logger }) => {
  const config = importJsonConfig();
  const env = config.environments.find((env) => env.name == process.env.MOON_TEST_ENV)!;
  const ethCompatible =
    env.foundation.type == "dev" && env.foundation.launchSpec[0].disableDefaultEthProviders;

  const ctx: DevModeContext = {
    ...context,
    createBlock: async <
      ApiType extends ApiTypes,
      Calls extends CallType<ApiType> | CallType<ApiType>[]
    >(
      transactions?: Calls,
      options: BlockCreation = {}
    ) => {
      const defaults: BlockCreation = {
        signer: env.defaultSigner || { type: "ethereum", privateKey: ALITH_PRIVATE_KEY },
        allowFailures: env.defaultAllowFailures === undefined ? true : env.defaultAllowFailures,
        finalize: env.defaultFinalization === undefined ? true : env.defaultFinalization,
      };
      return await createDevBlock(context, transactions, { ...defaults, ...options });
    },
  };

  testCases({
    context: {
      ...ctx,
      createTxn: ethCompatible
        ? undefined
        : <
            TOptions extends
              | (DeepPartial<ViemTransactionOptions> & {
                  libraryType?: "viem";
                })
              | (EthersTransactionOptions & {
                  libraryType: "ethers";
                })
          >(
            options: TOptions
          ) => {
            const { libraryType = "viem", ...txnOptions } = options;
            return libraryType === "viem"
              ? createViemTransaction(ctx, txnOptions as DeepPartial<ViemTransactionOptions>)
              : createEthersTransaction(ctx, txnOptions as EthersTransactionOptions);
          },
      readPrecompile: ethCompatible
        ? undefined
        : async (options: ContractCallOptions) => {
            const response = await interactWithPrecompileContract(ctx, {
              call: true,
              ...options,
            });
            return response;
          },
      writePrecompile: ethCompatible
        ? undefined
        : async (options: ContractCallOptions) => {
            const response = await interactWithPrecompileContract(ctx, { call: false, ...options });
            return response as `0x${string}`
          },
    },

    it: testCase,
    log: logger(),
  });
};
