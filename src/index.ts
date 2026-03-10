import { createCliRenderer } from "@opentui/core";
import { mountApp } from "./tui/app";

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  useAlternateScreen: true,
  useKittyKeyboard: { events: true },
});

mountApp(renderer);
