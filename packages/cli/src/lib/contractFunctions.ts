import {
  ContractDeploymentOptions,
  DevModeContext,
  MoonwallContract,
  ContractCallOptions,
} from "@moonwall/types";
import {
  ALITH_PRIVATE_KEY,
  createEthersTransaction,
  deployViemContract,
  sendRawTransaction,
} from "@moonwall/util";
import { PRECOMPILES } from "@moonwall/util";
import chalk from "chalk";
import fs from "fs";
import { readFileSync } from "fs";
import path from "path";
import type { Abi } from "viem";
import { Log, decodeFunctionResult, encodeFunctionData } from "viem";
import { importJsonConfig } from "./configReader.js";
import { createViemTransaction } from "@moonwall/util";
import { privateKeyToAccount } from "viem/accounts";
import { GenericContext } from "@moonwall/types";

function getCompiledPath(contractName: string) {
  const config = importJsonConfig();
  const contractsDir = config.environments.find(
    (env) => env.name === process.env.MOON_TEST_ENV
  )?.contracts;

  if (!contractsDir) {
    throw new Error(
      `Contracts directory not found for environment config ${process.env.MOON_TEST_ENV}\n` +
        `Please specify path to Foundry directory at:  ${chalk.bgWhiteBright.blackBright(
          "moonwall.config.json > environments > contracts"
        )}`
    );
  }

  const compiledJsonPath = recursiveSearch(contractsDir, `${contractName}.json`);
  const solidityFilePath = recursiveSearch(contractsDir, `${contractName}.sol`);

  if (!compiledJsonPath && !solidityFilePath) {
    throw new Error(
      `Neither solidity contract ${contractName}.sol nor its compiled json exists in ${contractsDir}`
    );
  } else if (!compiledJsonPath) {
    throw new Error(
      `Compiled contract ${contractName}.json doesn't exist\n` +
        `Please ${chalk.bgWhiteBright.blackBright("recompile contract")} ${contractName}.sol`
    );
  }
  return compiledJsonPath;
}

export function fetchCompiledContract<TAbi extends Abi>(
  contractName: string
): MoonwallContract<TAbi> {
  const compiledPath = getCompiledPath(contractName);
  const json = readFileSync(compiledPath, "utf8");
  const parsed = JSON.parse(json);
  return {
    abi: parsed.contract.abi,
    bytecode: parsed.byteCode,
    methods: parsed.contract.evm.methodIdentifiers,
    deployedBytecode: ("0x" + parsed.contract.evm.deployedBytecode.object) as `0x${string}`,
  };
}

export function recursiveSearch(dir: string, filename: string): string | null {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filepath = path.join(dir, file);
    const stats = fs.statSync(filepath);

    if (stats.isDirectory()) {
      const searchResult = recursiveSearch(filepath, filename);

      if (searchResult) {
        return searchResult;
      }
    } else if (stats.isFile() && file === filename) {
      return filepath;
    }
  }

  return null;
}

export async function interactWithPrecompileContract<T extends boolean>(
  context: GenericContext,
  callOptions: ContractCallOptions
) {
  const {
    precompileName,
    functionName,
    args = [],
    web3Library = "viem",
    gas = "estimate",
    privateKey = ALITH_PRIVATE_KEY,
    rawTxOnly = false,
    call = false,
  } = callOptions;
  const { abi } = fetchCompiledContract(precompileName);
  const data = encodeFunctionData({
    abi,
    functionName,
    args,
  });
  const precompileAddress = PRECOMPILES[precompileName];
  const account = privateKeyToAccount(privateKey);
  const gasParam =
    gas === "estimate"
      ? await context
          .viem()
          .estimateGas({ account: account.address, to: precompileAddress, value: 0n, data })
      : gas > 0n
      ? gas
      : 200_000n;

  if (!call && rawTxOnly) {
    return web3Library === "viem"
      ? createViemTransaction(context, { to: precompileAddress, data, gas: gasParam, privateKey })
      : createEthersTransaction(context, {
          to: precompileAddress,
          data,
          gas: gasParam,
          privateKey,
        });
  }

  // TODO: add switch for equivalent ethers function
  if (call) {
    const result = await context
      .viem()
      .call({ account, to: precompileAddress, value: 0n, data, gas: gasParam });
    return decodeFunctionResult({ abi, functionName, data: result.data! });
  } else if (!rawTxOnly) {
    const hash = await context
      .viem()
      .sendTransaction({ account, to: precompileAddress, value: 0n, data, gas: gasParam });
    return hash;
  } else {
    throw new Error("This should never happen, if it does there's a logic error in the code");
  }
}

export async function deployCreateCompiledContract<TOptions extends ContractDeploymentOptions>(
  context: DevModeContext,
  contractName: string,
  options?: TOptions
): Promise<{
  contractAddress: `0x${string}`;
  logs: Log<bigint, number>[];
  hash: `0x${string}`;
  status: "success" | "reverted";
  abi: Abi;
  bytecode: `0x${string}`;
  methods: any;
}> {
  const { abi, bytecode, methods } = fetchCompiledContract(contractName);

  const { privateKey = ALITH_PRIVATE_KEY, args = [], ...rest } = options || ({} as any);

  const blob: ContractDeploymentOptions = {
    ...rest,
    privateKey,
    args,
  };

  const { contractAddress, logs, status, hash } = await deployViemContract(
    context,
    abi,
    bytecode,
    blob
  );

  return {
    contractAddress: contractAddress as `0x${string}`,
    logs,
    hash,
    status,
    abi,
    bytecode,
    methods,
  };
}
