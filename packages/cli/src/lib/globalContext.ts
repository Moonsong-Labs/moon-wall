import "@moonbeam-network/api-augment";
import {
  ConnectedProvider,
  Environment,
  FoundationType,
  MoonwallConfig,
  MoonwallEnvironment,
  MoonwallProvider,
  Node,
} from "@moonwall/types";
import { ApiPromise } from "@polkadot/api";
import zombie, { Network } from "@zombienet/orchestrator";
import Debug from "debug";
import { ChildProcess, exec } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { parseChopsticksRunCmd, parseRunCmd, parseZombieCmd } from "../internal/commandParsers.js";
import { checkZombieBins, getZombieConfig } from "../internal/foundations/zombieHelpers.js";
import { launchNode } from "../internal/localNode.js";
import {
  ProviderFactory,
  ProviderInterfaceFactory,
  vitestAutoUrl,
} from "../internal/providerFactories.js";
import { importJsonConfig } from "./configReader.js";
const debugSetup = Debug("global:context");

export class MoonwallContext {
  private static instance: MoonwallContext | undefined;
  environment!: MoonwallEnvironment;
  providers: ConnectedProvider[];
  nodes: ChildProcess[];
  foundation: FoundationType;
  zombieNetwork?: Network;
  rtUpgradePath?: string;

  constructor(config: MoonwallConfig) {
    const env = config.environments.find(({ name }) => name == process.env.MOON_TEST_ENV)!;
    this.providers = [];
    this.nodes = [];
    this.foundation = env.foundation.type;

    const foundationHandlers: Record<
      FoundationType,
      (env: Environment) => IGlobalContextFoundation
    > = {
      read_only: this.handleReadOnly,
      chopsticks: this.handleChopsticks,
      dev: this.handleDev,
      zombie: this.handleZombie,
      fork: this.handleReadOnly, // TODO: Implement fork
    };

    const foundationHandler = foundationHandlers[env.foundation.type];
    this.environment = { providers: [], nodes: [], ...foundationHandler.call(this, env) };
  }

  private handleZombie(env: Environment): IGlobalContextFoundation {
    if (env.foundation.type !== "zombie") {
      throw new Error(`Foundation type must be 'zombie'`);
    }

    const { cmd: zombieConfig } = parseZombieCmd(env.foundation.zombieSpec);
    this.rtUpgradePath = env.foundation.rtUpgradePath;
    return {
      name: env.name,
      foundationType: "zombie",
      nodes: [
        {
          name: env.foundation.zombieSpec.name,
          cmd: zombieConfig,
          args: [],
          launch: true,
        },
      ],
    };
  }

  private handleDev(env: Environment): IGlobalContextFoundation {
    if (env.foundation.type !== "dev") {
      throw new Error(`Foundation type must be 'dev'`);
    }

    const { cmd, args, launch } = parseRunCmd(env.foundation.launchSpec![0]);
    return {
      name: env.name,
      foundationType: "dev",
      nodes: [
        {
          name: env.foundation.launchSpec![0].name,
          cmd,
          args,
          launch,
        },
      ],
      providers: env.connections
        ? ProviderFactory.prepare(env.connections)
        : !!!env.foundation.launchSpec![0].disableDefaultEthProviders
        ? ProviderFactory.prepareDefaultDev()
        : ProviderFactory.prepare([
            {
              name: "node",
              type: "polkadotJs",
              endpoints: [vitestAutoUrl],
            },
          ]),
    };
  }

  private handleReadOnly(env: Environment): IGlobalContextFoundation {
    if (env.foundation.type !== "read_only") {
      throw new Error(`Foundation type must be 'dev'`);
    }

    if (!env.connections) {
      throw new Error(
        `${env.name} env config is missing connections specification, required by foundation READ_ONLY`
      );
    }
    return {
      name: env.name,
      foundationType: "read_only",
      providers: ProviderFactory.prepare(env.connections),
    };
  }

  private handleChopsticks(env: Environment): IGlobalContextFoundation {
    if (env.foundation.type !== "chopsticks") {
      throw new Error(`Foundation type must be 'dev'`);
    }

    this.rtUpgradePath = env.foundation.rtUpgradePath;
    return {
      name: env.name,
      foundationType: "chopsticks",
      nodes: [parseChopsticksRunCmd(env.foundation.launchSpec!)],
      providers: [...ProviderFactory.prepare(env.connections!)],
    };
  }

  private async startZombieNetwork(nodes: Node[]) {
    console.log("🧟 Spawning zombie nodes ...");
    const config = await importJsonConfig();
    const env = config.environments.find(({ name }) => name == process.env.MOON_TEST_ENV)!;
    const zombieConfig = getZombieConfig(nodes[0].cmd);

    await checkZombieBins(zombieConfig);

    const network = await zombie.start("", zombieConfig, { silent: true });

    process.env.MOON_RELAY_WSS = network.relay[0].wsUri;
    process.env.MOON_PARA_WSS = Object.values(network.paras)[0].nodes[0].wsUri;

    if (
      env.foundation.type == "zombie" &&
      env.foundation.zombieSpec.monitoredNode &&
      env.foundation.zombieSpec.monitoredNode in network.nodesByName
    ) {
      process.env.MOON_MONITORED_NODE = `${network.tmpDir}/${env.foundation.zombieSpec.monitoredNode}.log`;
    }

    const processIds = Object.values((network.client as any).processMap)
      .filter((item) => item!["pid"])
      .map((process) => process!["pid"]);

    const onProcessExit = () => {
      exec(`kill -9 ${processIds.join(" ")}`, (error) => {
        if (error) {
          console.error(`Error killing process: ${error.message}`);
        }
      });
    };

    process.once("exit", onProcessExit);
    process.once("SIGINT", onProcessExit);

    process.env.MOON_MONITORED_NODE = zombieConfig.parachains[0].collator
      ? `${network.tmpDir}/${zombieConfig.parachains[0].collator.name}.log`
      : `${network.tmpDir}/${zombieConfig.parachains[0].collators![0].name}.log`;
    this.zombieNetwork = network;
    return;
  }

  public async startNetwork() {
    if (process.env.MOON_RECYCLE == "true") {
      debugSetup("Network has already been started, skipping command");
      return MoonwallContext.getContext();
    }

    const activeNodes = this.nodes.filter((node) => !node.killed);
    if (activeNodes.length > 0) {
      console.log("Nodes already started! Skipping command");
      return MoonwallContext.getContext();
    }
    const nodes = MoonwallContext.getContext().environment.nodes;

    if (this.environment.foundationType === "zombie") {
      return await this.startZombieNetwork(nodes);
    }

    const promises = nodes.map(async ({ cmd, args, name, launch }) => {
      return launch && this.nodes.push(await launchNode(cmd, args, name!));
    });
    await Promise.all(promises);
    return MoonwallContext.getContext();
  }

  public async connectEnvironment(): Promise<MoonwallContext> {
    const config = await importJsonConfig();
    const env = config.environments.find(({ name }) => name == process.env.MOON_TEST_ENV)!;

    if (this.environment.foundationType == "zombie") {
      this.environment.providers = env.connections
        ? ProviderFactory.prepare(env.connections)
        : ProviderFactory.prepareDefaultZombie();
    }

    if (this.providers.length > 0) {
      return MoonwallContext.getContext();
    }

    const promises = this.environment.providers.map(
      async ({ name, type, connect }) =>
        new Promise(async (resolve) => {
          this.providers.push(await ProviderInterfaceFactory.populate(name, type, connect));
          resolve("");
        })
    );
    await Promise.all(promises);

    if (this.foundation == "zombie") {
      const promises = this.providers
        .filter(({ type }) => type == "polkadotJs" || type == "moon")
        .filter(
          ({ name }) =>
            env.foundation.type == "zombie" &&
            (!env.foundation.zombieSpec.skipBlockCheck ||
              !env.foundation.zombieSpec.skipBlockCheck.includes(name))
        )
        .map(async (provider) => {
          return await new Promise(async (resolve) => {
            console.log(`⏲️  Waiting for chain ${provider.name} to produce blocks...`);
            while (
              (
                await (provider.api as ApiPromise).rpc.chain.getBlock()
              ).block.header.number.toNumber() == 0
            ) {
              await setTimeout(500);
            }
            console.log(`✅ Chain ${provider.name} producing blocks, continuing`);
            resolve("");
          });
        });

      await Promise.all(promises);
    }

    return MoonwallContext.getContext();
  }

  public async disconnect(providerName?: string) {
    if (providerName) {
      this.providers.find(({ name }) => name === providerName)!.disconnect();
      this.providers.filter(({ name }) => name !== providerName);
    } else {
      await Promise.all(this.providers.map((prov) => prov.disconnect()));
      this.providers = [];
    }
  }

  public static printStats() {
    if (MoonwallContext) {
      console.dir(MoonwallContext.getContext(), { depth: 1 });
    } else {
      console.log("Global context not created!");
    }
  }

  public static getContext(config?: MoonwallConfig, force: boolean = false): MoonwallContext {
    if (!MoonwallContext.instance || force) {
      if (!config) {
        console.error("❌ Config must be provided on Global Context instantiation");
        process.exit(2);
      }
      MoonwallContext.instance = new MoonwallContext(config);

      debugSetup(`🟢  Moonwall context "${config.label}" created`);
    }
    return MoonwallContext.instance;
  }

  public static async destroy() {
    const ctx = MoonwallContext.getContext();
    try {
      ctx.disconnect();
    } catch {
      console.log("🛑  All connections disconnected");
    }
    const promises = ctx.nodes.map((process) => {
      return new Promise((resolve) => {
        process.kill();
        if (process.killed) {
          resolve(`process ${process.pid} killed`);
        }
      });
    });

    await Promise.all(promises);

    if (!!ctx.zombieNetwork) {
      console.log("🪓  Killing zombie nodes");
      await ctx.zombieNetwork.stop();
    }
  }
}

export const contextCreator = async (config: MoonwallConfig, env: string) => {
  const ctx = MoonwallContext.getContext(config);
  await runNetworkOnly(config);
  await ctx.connectEnvironment();
  return ctx;
};

export const runNetworkOnly = async (config: MoonwallConfig) => {
  const ctx = MoonwallContext.getContext(config);
  await ctx.startNetwork();
};

export interface IGlobalContextFoundation {
  name: string;
  context?: {};
  providers?: MoonwallProvider[];
  nodes?: {
    name?: string;
    cmd: string;
    args: string[];
    launch: boolean;
  }[];
  foundationType: FoundationType;
}
