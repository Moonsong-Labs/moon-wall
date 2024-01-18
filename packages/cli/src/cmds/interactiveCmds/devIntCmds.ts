import type { ApiPromise } from "@polkadot/api";
import inquirer from "inquirer";
import { MoonwallContext } from "../../lib/globalContext";

export async function resolveDevInteractiveCmdChoice() {
  const choice = await inquirer.prompt({
    name: "cmd",
    type: "list",
    choices: [
      { name: "🆗  Create Block", value: "createblock" },
      { name: "🆕  Create Unfinalized Block", value: "createUnfinalizedBlock" },
      { name: "➡️   Create N Blocks", value: "createNBlocks" },
      new inquirer.Separator(),
      { name: "🔙  Go Back", value: "back" },
    ],
    message: `What command would you like to run? `,
    default: "createBlock",
  });

  const ctx = await (await MoonwallContext.getContext()).connectEnvironment();
  const api = ctx.providers.find((a) => a.type == "polkadotJs")!.api as ApiPromise;

  switch (choice.cmd) {
    case "createblock":
      await api.rpc.engine.createBlock(true, true);
      break;

    case "createUnfinalizedBlock":
      await api.rpc.engine.createBlock(true, false);
      break;

    case "createNBlocks": {
      const result = await new inquirer.prompt({
        name: "n",
        type: "number",
        message: `How many blocks? `,
      });

      const executeSequentially = async (remaining: number) => {
        if (remaining === 0) {
          return;
        }
        await api.rpc.engine.createBlock(true, true);
        await executeSequentially(remaining - 1);
      };
      await executeSequentially(result.n);

      break;
    }

    case "back":
      break;
  }

  return;
}
