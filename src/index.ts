import { createCliRenderer } from "@opentui/core";
import { runDoctor } from "./cli/doctor";
import { runSetup } from "./cli/setup";
import { mountApp } from "./tui/app";
import { hasManagedRuntime } from "./infra/runtime/python-runtime";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const command = process.argv[2];

if (command === "doctor") {
  await runDoctor();
  process.exit();
}

if (command === "setup") {
  await runSetup(import.meta.url);
  process.exit();
}

async function ensureManagedRuntime() {
  if (process.env.QARMA_SKIP_SETUP_PROMPT === "1" || hasManagedRuntime()) {
    return;
  }

  output.write("Qarma TUI local runtime is not installed.\n");
  const rl = createInterface({ input, output });
  try {
    const answer = (await rl.question("Install it now? [Y/n] ")).trim().toLowerCase();
    if (answer === "n" || answer === "no") {
      output.write("Run `qarma-tui setup` and start again.\n");
      process.exit(1);
    }
  } finally {
    rl.close();
  }

  await runSetup(import.meta.url);
}

await ensureManagedRuntime();

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  useAlternateScreen: true,
  useKittyKeyboard: { events: true },
});

mountApp(renderer);
