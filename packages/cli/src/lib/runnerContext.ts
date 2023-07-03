import "@moonbeam-network/api-augment";
import type {
  FoundationHandler,
  FoundationType,
  GenericContext,
  ITestCase,
  ITestSuiteType,
  PolkadotProviders,
  ProviderMap,
  ProviderType,
  TestCasesFn,
  ViemClient,
} from "@moonwall/types";
import { ApiPromise } from "@polkadot/api";
import Debug from "debug";
import { Signer } from "ethers";
import { afterAll, beforeAll, describe, it } from "vitest";
import { Web3 } from "web3";
import { importJsonConfig } from "./configReader.js";
import { MoonwallContext, contextCreator } from "./globalContext.js";
import { chopsticksHandler } from "./handlers/chopsticksHandler.js";
import { devHandler } from "./handlers/devHandler.js";
import { readOnlyHandler } from "./handlers/readOnlyHandler.js";
import { zombieHandler } from "./handlers/zombieHandler.js";

const RT_VERSION = Number(process.env.MOON_RTVERSION);
const RT_NAME = process.env.MOON_RTNAME;
let ctx: MoonwallContext;

// About: This has been designed in the handler pattern so that eventually we can integrate it to vitest
// https://vitest.dev/advanced/runner.html

/**
 *  * Defines a suite of tests based on provided parameters.
 *
 * @param {object} params - The setup parameters for the test suite.
 * @param {string} params.id - A unique identifier for the test suite (e.g. D03).
 * @param {string} params.title - The title of the test suite (e.g. 'Fee calculation: congestion handling').
 * @param {function} params.testCases - A callback function that houses the individual test cases of this suite.
 * @param {string} params.foundationMethods - Explicitly specify which foundation these tests will run against reveal which methods to make available.
 * @param {number} [params.minRtVersion] - The minimum runtime version required for the test suite, otherwise will be skipped.
 * @param {string} [params.chainType] - The required runtime name required for the test suite, otherwise will be skipped.
 * @param {string} [params.notChainType] - The runtime name to not run against this test suite, otherwise will not be skipped.
 *
 * @returns {void} - No explicit return value, this function results is wrapped and handled by the vitest instance.
 * @example
 *      describeSuite({
 *        id: "D01",
 *        title: "Sample test suite",
 *        foundationMethods: "dev",
 *        testCases: ({ it, context, log }) => {
 *          it({
 *            id: "T01",
 *            title: "Sample test case",
 *            test: async function () {
 *              expect(true).to.be.true;
 *            },
 *          });
 *        },
 *      });
 */
export function describeSuite<T extends FoundationType>({
  id: suiteId,
  title,
  testCases,
  foundationMethods,
  minRtVersion,
  chainType,
  notChainType,
}: ITestSuiteType<T>): void {
  if (
    (minRtVersion && minRtVersion > RT_VERSION) ||
    (chainType && chainType !== RT_NAME) ||
    (notChainType && notChainType === RT_NAME)
  ) {
    describe.skip(`🗃️  #${suiteId} ${title}`);
    return;
  }

  beforeAll(async function () {
    const globalConfig = importJsonConfig();

    if (!process.env.MOON_TEST_ENV) {
      throw new Error("MOON_TEST_ENV not set");
    }

    ctx = await contextCreator(globalConfig, process.env.MOON_TEST_ENV);
  });

  afterAll(async function () {
    await MoonwallContext.destroy();
  });

  const testCase = (params: ITestCase) => {
    if (params.modifier) {
      it[params.modifier](
        `📁  #${suiteId.concat(params.id)} ${params.title}`,
        params.test,
        params.timeout
      );
      return;
    }
    if (
      (params.minRtVersion && params.minRtVersion > RT_VERSION) ||
      (params.chainType && params.chainType !== RT_NAME) ||
      (params.notChainType && params.notChainType === RT_NAME)
    ) {
      it.skip(`📁  #${suiteId.concat(params.id)} ${params.title}`, params.test, params.timeout);
      return;
    }

    it(`📁  #${suiteId.concat(params.id)} ${params.title}`, params.test, params.timeout);
  };

  describe(`🗃️  #${suiteId} ${title}`, function () {
    const getApi = <T extends ProviderType>(apiType?: T, apiName?: string) => {
      const provider = ctx.providers.find((prov) => {
        if (apiType == "polkadotJs" && apiName == "anyPolkadot") {
          return prov.type == "moon" || prov.type == "polkadotJs";
        } else if (apiType && apiName) {
          return prov.type == apiType && prov.name === apiName;
        } else if (apiType && !apiName) {
          return prov.type == apiType;
        } else if (!apiType && apiName) {
          return prov.name === apiName;
        } else {
          return false;
        }
      });

      if (!provider) {
        throw new Error(
          `API of type ${apiType} ${apiName ? "and name " + apiName : ""} could not be found`
        );
      }

      return provider.api as ProviderMap[T];
    };

    const context: GenericContext = {
      api: <T extends ProviderType>(type: T, name?: string) => getApi(type, name),
      viem: (apiName?: string): ViemClient => getApi("viem", apiName),
      polkadotJs: (options?: { apiName?: string; type?: PolkadotProviders }): ApiPromise =>
        options
          ? options.type
            ? getApi(options.type, options.apiName)
            : getApi("polkadotJs", options.apiName)
          : getApi("polkadotJs", "anyPolkadot"),
      ethers: (apiName?: string): Signer => getApi("ethers", apiName),
      web3: (apiName?: string): Web3 => getApi("web3", apiName),
    };

    const foundationHandlers: Record<FoundationType, FoundationHandler<any>> = {
      dev: devHandler,
      chopsticks: chopsticksHandler,
      zombie: zombieHandler,
      read_only: readOnlyHandler,
      fork: readOnlyHandler,
    };

    const handler = foundationHandlers[foundationMethods];
    if (!handler) {
      throw new Error(`Unsupported foundation methods: ${foundationMethods}`);
    }

    handler({
      testCases: testCases as TestCasesFn<any>,
      context,
      testCase,
      logger,
      ctx,
    });
  });
}

const logger = () => {
  process.env.DEBUG_COLORS = "1";
  const debug = Debug(`test:${process.env.MOON_TEST_ENV}`);
  debug.log = console.log.bind(process.stdout);
  Debug.enable("test:*");

  return debug;
};
