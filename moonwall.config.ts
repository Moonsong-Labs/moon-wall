import {
  Foundation,
  MoonwallConfig,
  ProviderType,
} from "./src/cli/runner/lib/types.js";

export const globalConfig: MoonwallConfig = {
  label: "Global Test Config 🐯",
  defaultTestTimeout: 40000,
  environments: [
    {
      name: "chop_test",
      testFileDir: "tests/chopsticks/",
      foundation: {
        type: Foundation.Chopsticks,
        rtUpgradePath: "/home/timbotronic/workspace/moonbeam/moonwall/downloads/moonbeam-runtime-2100.wasm",
        launchSpec: [
          {
            name: "mb",
            type: "parachain",
            // buildBlockMode: "manual",
            configPath: "src/cli/runner/lib/chopsticksConfig.yml",
          },
          {
            name: "mb2",
            type: "parachain",
            configPath: "src/cli/runner/lib/chopsticksConfig2.yml",
          },
        ],
      },
      connections: [
        {
          name: "MB",
          type: ProviderType.PolkadotJs,
          endpoints: ["ws://localhost:21321"],
        },
        {
          name: "MB2",
          type: ProviderType.PolkadotJs,
          endpoints: ["ws://localhost:15321"],
        }
      ],
    },
    {
      name: "dev_minimal",
      testFileDir: "tests/compile_error/",
      foundation: {
        type: Foundation.Dev,
        launchSpec: [
          {
            name: "moonbeam",
            binPath: "/home/timbotronic/workspace/moonbeam/moonbeam/target/release/moonbeam",
          },
        ],
      },
    },
    {
      name: "mixed",
      testFileDir: "tests/compile_error/",
      foundation: {
        type: Foundation.ReadOnly,
      },
      connections: [
        {
          name: "w3",
          type: ProviderType.Web3,
          endpoints: ["wss://moonbeam.api.onfinality.io/public-ws"],
        },
        {
          name: "mb",
          type: ProviderType.Moonbeam,
          endpoints: ["wss://moonbeam.api.onfinality.io/public-ws"],
        },
      ],
    },
    {
      name: "pass",
      testFileDir: "tests/compile_error/",
      foundation: {
        type: Foundation.Dev,
        launchSpec: [
          {
            name: "moonbeam",
            binPath: "/home/timbotronic/workspace/moonbeam/moonbeam/target/release/moonbeam",
            ports: { p2pPort: 30333, wsPort: 9944, rpcPort: 9933 },
            alreadyRunning: false,
            options: [
              "--dev",
              "--no-hardware-benchmarks",
              "--no-telemetry",
              "--reserved-only",
              "--rpc-cors=all",
              "--no-grandpa",
              "--sealing=manual",
              "--force-authoring",
              "--no-prometheus",
            ],
          },
        ],
      },
      connections: [
        {
          name: "w3",
          type: ProviderType.Web3,
          endpoints: ["ws://localhost:9944"],
        },
        {
          name: "mb",
          type: ProviderType.Moonbeam,
          endpoints: ["ws://localhost:9944"],
        },
      ],
    },
    {
      name: "web3_test",
      testFileDir: "tests/web3_test/",
      foundation: {
        type: Foundation.ReadOnly,
      },
      connections: [
        {
          name: "w3",
          type: ProviderType.Web3,
          endpoints: ["wss://moonbeam.api.onfinality.io/public-ws"],
        },
      ],
    },
    {
      name: "new",
      testFileDir: "tests/eth_test/",
      include: ['**/{test,spec,test_,test-}*{ts,mts,cts}'],
      foundation: {
        type: Foundation.ReadOnly,
      },
      connections: [
        {
          name: "eth",
          type: ProviderType.Ethers,
          endpoints: ["wss://moonbeam.api.onfinality.io/public-ws"],
        },
      ],
    },
    {
      name: "dev_test",
      testFileDir: "tests/dev_tests",
      foundation: {
        type: Foundation.Dev,
        launchSpec: [
          {
            name: "moonbeam",
            binPath: "/home/timbotronic/workspace/moonbeam/moonbeam/target/release/moonbeam",
            ports: { p2pPort: 30333, wsPort: 9944, rpcPort: 9933 },
            alreadyRunning: false,
            options: [
              "--dev",
              "--no-hardware-benchmarks",
              "--no-telemetry",
              "--reserved-only",
              "--rpc-cors=all",
              "--no-grandpa",
              "--sealing=manual",
              "--force-authoring",
              "--no-prometheus",
            ],
          },
        ],
      },
      connections: [
        {
          name: "eth",
          type: ProviderType.Ethers,
          endpoints: ["ws://localhost:9944"],
        },
        {
          name: "w3",
          type: ProviderType.Web3,
          endpoints: ["ws://localhost:9944"],
        },
        {
          name: "pjs",
          type: ProviderType.PolkadotJs,
          endpoints: ["ws://localhost:9944"],
        },
      ],
    },
  ],
};

export default globalConfig;
