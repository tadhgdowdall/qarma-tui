import { createCliRenderer } from "@opentui/core";
import { mountApp } from "./tui/app";

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  useAlternateScreen: true,
});

renderer.keyInput.on("keypress", (key) => {
  if (key.name === "q" || key.name === "escape") {
    renderer.destroy();
  }
});

mountApp(renderer);
