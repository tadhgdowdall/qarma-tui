import type { CliRenderer } from "@opentui/core";
import { BoxRenderable, TextAttributes, TextRenderable } from "@opentui/core";

export function createStatusBar(renderer: CliRenderer) {
  const statusbar = new BoxRenderable(renderer, {
    flexDirection: "row",
    justifyContent: "space-between",
    border: true,
    borderColor: "#141414",
    backgroundColor: "#050505",
    paddingLeft: 1,
    paddingRight: 1,
  });

  statusbar.add(
    new TextRenderable(renderer, {
      content: "local  localhost:3000  openai",
      fg: "#a3a3a3",
      attributes: TextAttributes.DIM,
    }),
  );

  statusbar.add(
    new TextRenderable(renderer, {
      content: "tab sidebar  q quit  / command  enter run",
      fg: "#f97316",
      attributes: TextAttributes.DIM,
    }),
  );

  return statusbar;
}
