import type { CliRenderer } from "@opentui/core";
import { BoxRenderable } from "@opentui/core";

export function createShell(renderer: CliRenderer) {
  const app = new BoxRenderable(renderer, {
    flexDirection: "row",
    flexGrow: 1,
    padding: 0,
    gap: 0,
    backgroundColor: "#0a0a0a",
  });

  const main = new BoxRenderable(renderer, {
    flexDirection: "column",
    flexGrow: 1,
    backgroundColor: "#0a0a0a",
  });

  return { app, main };
}
