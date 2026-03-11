import { createCliRenderer } from "@opentui/core";
import { runDoctor } from "./cli/doctor";
import { mountApp } from "./tui/app";

const command = process.argv[2];

if (command === "doctor") {
  runDoctor();
  process.exit();
}

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  useAlternateScreen: true,
  useKittyKeyboard: { events: true },
});

mountApp(renderer);
