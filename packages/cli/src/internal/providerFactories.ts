import { MoonwallProvider, ProviderConfig, ProviderType, ViemClient } from "@moonwall/types";
import { ALITH_PRIVATE_KEY, deriveViemChain } from "@moonwall/util";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { ApiOptions } from "@polkadot/api/types/index.js";
import chalk from "chalk";
import Debug from "debug";
import { Signer, Wallet, ethers } from "ethers";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { Web3 } from "web3";
import { WebSocketProvider as Web3ProviderWs } from "web3-providers-ws";
const debug = Debug("global:providers");

export class ProviderFactory {
  private url: string;
  private privateKey: string;

  constructor(private providerConfig: ProviderConfig) {
    this.url = providerConfig.endpoints.includes("ENV_VAR")
      ? process.env.WSS_URL!
      : providerConfig.endpoints[0];
    this.privateKey = process.env.MOON_PRIV_KEY || ALITH_PRIVATE_KEY;
  }

  public create(): MoonwallProvider {
    switch (this.providerConfig.type) {
      case "polkadotJs":
        return this.createPolkadotJs();
      case "web3":
        return this.createWeb3();
      case "ethers":
        return this.createEthers();
      case "viem":
        return this.createViem();
      default:
        return this.createDefault();
    }
  }

  private createPolkadotJs(): MoonwallProvider {
    debug(`🟢  PolkadotJs provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: async () => {
        const options: ApiOptions = {
          provider: new WsProvider(this.url),
          initWasm: false,
          noInitWarn: true,
          isPedantic: false,
          rpc: !!this.providerConfig.rpc ? this.providerConfig.rpc : undefined,
          typesBundle: !!this.providerConfig.additionalTypes
            ? this.providerConfig.additionalTypes
            : undefined,
        };

        const api = await ApiPromise.create(options);
        await api.isReady;
        return api;
      },
      ws: () => new WsProvider(this.url),
    };
  }

  private createWeb3(): MoonwallProvider {
    debug(`🟢  Web3 provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: () => {
        const provider = new Web3ProviderWs(
          this.url,
          {},
          { delay: 50, autoReconnect: false, maxAttempts: 10 }
        );

        provider.on("error", () => {
          throw new Error(
            `Cannot connect to Web3 provider ${chalk.bgWhiteBright.blackBright(this.url)}`
          );
        });

        return new Web3(provider);
      },
    };
  }

  private createEthers(): MoonwallProvider {
    debug(`🟢  Ethers provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: () => {
        const provider = new ethers.WebSocketProvider(this.url);
        return new Wallet(this.privateKey, provider);
      },
    };
  }

  private createViem(): MoonwallProvider {
    debug(`🟢  Viem omni provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: async () =>
        createWalletClient({
          chain: await deriveViemChain(this.url),
          account: privateKeyToAccount(this.privateKey as `0x${string}`),
          transport: http(this.url.replace("ws", "http")),
        }).extend(publicActions) as ViemClient,
    };
  }

  private createDefault(): MoonwallProvider {
    debug(`🟢  Default provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: () => console.log(`🚧  provider ${this.providerConfig.name} not yet implemented`),
    };
  }

  public static prepare(providerConfigs: ProviderConfig[]): MoonwallProvider[] {
    return providerConfigs.map((providerConfig) => new ProviderFactory(providerConfig).create());
  }

  public static prepareDefaultDev(): MoonwallProvider[] {
    return this.prepare([
      {
        name: "w3",
        type: "web3",
        endpoints: [vitestAutoUrl],
      },
      {
        name: "eth",
        type: "ethers",
        endpoints: [vitestAutoUrl],
      },
      {
        name: "public",
        type: "viem",
        endpoints: [vitestAutoUrl],
      },
    ]);
  }

  public static prepareDefaultZombie(): MoonwallProvider[] {
    const MOON_PARA_WSS = process.env.MOON_PARA_WSS || "error";
    const MOON_RELAY_WSS = process.env.MOON_RELAY_WSS || "error";
    return this.prepare([
      {
        name: "w3",
        type: "web3",
        endpoints: [MOON_PARA_WSS],
      },
      {
        name: "eth",
        type: "ethers",
        endpoints: [MOON_PARA_WSS],
      },
      {
        name: "parachain",
        type: "polkadotJs",
        endpoints: [MOON_PARA_WSS],
      },
      {
        name: "relaychain",
        type: "polkadotJs",
        endpoints: [MOON_RELAY_WSS],
      },
    ]);
  }
}

export interface ProviderInterface {
  name: string;
  api: any;
  type: ProviderType;
  greet: () => void | Promise<void> | { rtVersion: number; rtName: string };
  disconnect: () => void | Promise<void> | any;
}

export class ProviderInterfaceFactory {
  constructor(private name: string, private type: ProviderType, private connect: () => any) {}

  public async create(): Promise<ProviderInterface> {
    switch (this.type) {
      case "polkadotJs":
        return this.createPolkadotJs();
      case "web3":
        return this.createWeb3();
      case "ethers":
        return this.createEthers();
      case "viem":
        return this.createViem();
      default:
        throw new Error("UNKNOWN TYPE");
    }
  }

  private async createPolkadotJs(): Promise<ProviderInterface> {
    const api = (await this.connect()) as ApiPromise;
    return {
      name: this.name,
      api,
      type: this.type,
      greet: () => {
        debug(
          `👋  Provider ${this.name} is connected to chain` +
            ` ${api.consts.system.version.specName.toString()} ` +
            `RT${api.consts.system.version.specVersion.toNumber()}`
        );
        return {
          rtVersion: api.consts.system.version.specVersion.toNumber(),
          rtName: api.consts.system.version.specName.toString(),
        };
      },
      disconnect: async () => api.disconnect(),
    };
  }

  private async createWeb3(): Promise<ProviderInterface> {
    const api = (await this.connect()) as Web3;
    return {
      name: this.name,
      api,
      type: this.type,
      greet: async () =>
        console.log(
          `👋 Provider ${this.name} is connected to chain ` + (await api.eth.getChainId())
        ),
      disconnect: async () => {
        api.currentProvider!.disconnect();
      },
    };
  }

  private async createEthers(): Promise<ProviderInterface> {
    const api = (await this.connect()) as Signer;
    return {
      name: this.name,
      api,
      type: this.type,
      greet: async () =>
        debug(
          `👋  Provider ${this.name} is connected to chain ` +
            (await api.provider!.getNetwork()).chainId
        ),
      disconnect: async () => api.provider!.destroy(),
    };
  }

  private async createViem(): Promise<ProviderInterface> {
    const api = (await this.connect()) as ViemClient;
    return {
      name: this.name,
      api,
      type: this.type,
      greet: async () =>
        console.log(`👋 Provider ${this.name} is connected to chain ` + (await api.getChainId())),
      disconnect: async () => {
        // Not needed until we switch to websockets
      },
    };
  }

  public static async populate(
    name: string,
    type: ProviderType,
    connect: () =>
      | Promise<ApiPromise>
      | Signer
      | Web3
      | Promise<ViemClient>
      | void
  ): Promise<ProviderInterface> {
    return await new ProviderInterfaceFactory(name, type, connect).create();
  }
}

export const vitestAutoUrl = `ws://127.0.0.1:${
  10000 + Number(process.env.VITEST_POOL_ID || 1) * 100
}`;
