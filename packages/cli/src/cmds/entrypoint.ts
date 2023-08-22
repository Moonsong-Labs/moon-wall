import "../internal/logging";
import "@moonbeam-network/api-augment";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { testCmd } from "./runTests";
import { runNetwork } from "./runNetwork";
import { generateConfig } from "../internal/cmdFunctions/initialisation";
import { main } from "./main";
import { fetchArtifact } from "../internal/cmdFunctions/fetchArtifact";
import dotenv from "dotenv";
dotenv.config();

// Hack to expose config-path to all commands and fallback
const parsed = yargs(hideBin(process.argv))
  .options({
    configFile: {
      type: "string",
      alias: "c",
      description: "path to MoonwallConfig file",
      default: "./moonwall.config.json",
    },
  })
  .parseSync();
process.env.MOON_CONFIG_PATH = parsed.configFile;

yargs(hideBin(process.argv))
  .usage("Usage: $0")
  .version("2.0.0")
  .options({
    configFile: {
      type: "string",
      alias: "c",
      description: "path to MoonwallConfig file",
      default: "./moonwall.config.json",
    },
  })
  .middleware((argv) => {
    process.env.MOON_CONFIG_PATH = argv.configFile;
  })
  .command(`init`, "Run tests for a given Environment", async () => {
    await generateConfig();
  })
  .command(
    `download <bin> [ver] [path]`,
    "Download x86 artifact from GitHub",
    (yargs) => {
      return yargs
        .positional("bin", {
          describe: "Name of artifact to download\n[ moonbeam | polkadot | *-runtime ]",
        })
        .positional("ver", {
          describe: "Artifact version to download",
          default: "latest",
        })
        .positional("path", {
          describe: "Path where to save artifacts",
          type: "string",
          default: "./",
        })
        .option("overwrite", {
          describe: "If file exists, should it be overwritten?",
          type: "boolean",
          alias: "d",
          default: true,
        })
        .option("output-name", {
          describe: "Rename downloaded file to this name",
          alias: "o",
          type: "string",
        });
    },
    async (argv) => {
      await fetchArtifact(argv as any);
    }
  )
  .command(
    `test <envName> [GrepTest]`,
    "Run tests for a given Environment",
    (yargs) => {
      return yargs
        .positional("envName", {
          describe: "Network environment to run tests against",
          array: true,
          string: true,
        })
        .positional("GrepTest", {
          type: "string",
          description: "Pattern to grep test ID/Description to run",
        });
    },
    async (args) => {
      if (args.envName) {
        process.env.MOON_RUN_SCRIPTS = "true";
        await testCmd(args.envName.toString(), { testNamePattern: args.GrepTest });
        process.exit(0);
      } else {
        console.log("❌ No environment specified");
        console.log(`👉 Run 'pnpm moonwall --help' for more information`);
        process.exit(1);
      }
    }
  )
  .command(
    `run <envName> [GrepTest]`,
    "Start new network found in global config",
    (yargs) => {
      return yargs
        .positional("envName", {
          describe: "Network environment to start",
        })
        .positional("GrepTest", {
          type: "string",
          description: "Pattern to grep test ID/Description to run",
        });
    },
    async (argv) => {
      await runNetwork(argv as any);
      process.exit(0);
    }
  )
  .demandCommand(1)
  .fail(async (msg) => {
    console.log(msg);
    await main();
  })
  .help("h")
  .alias("h", "help")
  .parse();
