import { ApiPromise } from "@polkadot/api";
import { WebSocketProvider } from "ethers";
import Web3 from "web3";
import { Web3BaseProvider } from "web3-types";

export type MoonwallConfig = {
  label: string;
  defaultTestTimeout: number;
  environments: Environment[];
};

export type Environment = {
  name: string;
  testFileDir: string;
  foundation: Foundation;
  connections: ProviderConfig[];
};

export type Foundation = {
  type: FoundationType;
  launchSpec?: LaunchSpec;
};

export type LaunchSpec = {
  bin: {
    name: string;
    path: string;
  };
  ports: {
    p2pPort: number;
    wsPort: number;
    rpcPort: number;
  };
  alreadyRunning: boolean;
  options: string[];
};

export enum FoundationType {
  ReadOnly = "read_only",
  DevMode = "dev",
  Forked = "fork",
  ZombieNet = "zombie",
  Chopsticks = "chopsticks",
}

export interface ProviderConfig {
  name: string;
  type: ProviderType;
  endpoints: string[];
}

export type MoonwallEnvironment = {
  name: string;
  providers: MoonwallProvider[];
  nodes: Node[];
  context: any;
};

export interface MoonwallProvider {
  name: string;
  type: ProviderType;
  connect: () => Promise<ApiPromise> | Promise<WebSocketProvider> | Web3 | void;
  ws?: any;
}

export interface ConnectedProvider {
  name: string;
  api: ApiPromise | WebSocketProvider | Web3;
  disconnect: () => void;
  greet: () => Promise<void> | void;
}

export enum ProviderType {
  PolkadotJs = <any>"polkadotJs",
  Ethers = <any>"ethers",
  Web3 = <any>"web3",
  Moonbeam = <any>"moon",
  Unknown = <any>"unknown",
}

export type Node = {
  name: string;
  type: "binary" | "chopsticks" | "zombie";
  cmd: string;
  args: string[];
};

export type MoonwallTestFile = {};

export type MoonwallTestSuite = {
  tests: MoonwallTestCase[];
};

export type MoonwallTestCase = {};
