import { MoonwallContext } from "../internal/globalContext";
import { ApiPromise } from "@polkadot/api";
import { ConnectedProvider, FoundationType, ProviderType } from "../lib/types";
import { WebSocketProvider } from "ethers";

import Web3 from "web3";

export function testSuite({
  id,
  title,
  testCases,
  supportedFoundations,
}: SuiteParameters) {
  const ctx = MoonwallContext.getContext();

  describe(`🗃️  #${id} ${title}`, function () {
    let context = {
      providers: {},
      getPolkadotJs: (apiName?: string): ApiPromise => {
        if (apiName) {
          return context.providers[apiName];
        } else {
          return MoonwallContext.getContext().providers.find(
            (a) => a.type == ProviderType.PolkadotJs
          ).api as ApiPromise;
        }
      },
      getMoonbeam: (apiName?: string): ApiPromise => {
        if (apiName) {
          return context.providers[apiName];
        } else {
          return MoonwallContext.getContext().providers.find(
            (a) => a.type == ProviderType.Moonbeam
          ).api as ApiPromise;
        }
      },
      getEthers: (apiName: string): WebSocketProvider => {
        if (apiName) {
          return context.providers[apiName];
        } else {
          return MoonwallContext.getContext().providers.find(
            (a) => a.type == ProviderType.Ethers
          ).api as WebSocketProvider;
        }
      },
      getWeb3: (apiName: string): Web3 => {
        if (apiName) {
          return context.providers[apiName];
        } else {
          return MoonwallContext.getContext().providers.find(
            (a) => a.type == ProviderType.Web3
          ).api as Web3;
        }
      },
    };
    console.log("genesis is "+ ctx.genesis)

    if (
      supportedFoundations &&
      !supportedFoundations.includes(ctx.foundation)
    ) {
      throw new Error(
        `Test file does not support foundation ${ctx.foundation}`
      );
    }

    ctx.providers.forEach((a: ConnectedProvider) => {
      context.providers[a.name] = a.api;
    });

    function testCase(testcaseId: string, title: string, callback: () => void) {
      it(`📁  #${id.concat(testcaseId)} ${title}`, callback);
    }

    testCases({ context, it: testCase });
  });
}

interface CustomTest {
  (id: string, title: string, cb: () => void, only?: boolean): void;
}

interface SuiteParameters {
  id: string;
  title: string;
  environment?: string;
  testCases: (TestContext: TestContext) => void;
  options?: Object;
  supportedFoundations?: FoundationType[];
}

interface TestContext {
  context: Subcontext;
  it: CustomTest;
}

interface Subcontext {
  providers: Object;
  getPolkadotJs: ([name]?: string) => ApiPromise;
  getMoonbeam: ([name]?: string) => ApiPromise;
  getEthers: ([name]?: string) => WebSocketProvider;
  getWeb3: ([name]?: string) => Web3;
}
