import type { CliRenderer } from "@opentui/core";
import { BoxRenderable, TextAttributes, TextRenderable } from "@opentui/core";
import type { RunSettings } from "../state/run-settings";

export function createStatusBar(renderer: CliRenderer, settings: RunSettings) {
  const statusbar = new BoxRenderable(renderer, {
    flexDirection: "row",
    justifyContent: "space-between",
    border: true,
    borderColor: "#141414",
    backgroundColor: "#050505",
    paddingLeft: 1,
    paddingRight: 1,
  });

  const summary = new TextRenderable(renderer, {
    content: `${settings.executionMode}  ${settings.targetUrl.replace(/^https?:\/\//, "")}  ${settings.providerProfileId === "qarma-managed" ? "qarma" : "openai"}  ${settings.modelId || "provider-default"}`,
    fg: "#a3a3a3",
    attributes: TextAttributes.DIM,
  });
  statusbar.add(summary);

  statusbar.add(
    new TextRenderable(renderer, {
      content: "drag select  ctrl+y copy  /settings  tab sidebar  q quit",
      fg: "#f97316",
      attributes: TextAttributes.DIM,
    }),
  );

  return {
    statusbar,
    update(nextSettings: RunSettings) {
      summary.content = `${nextSettings.executionMode}  ${nextSettings.targetUrl.replace(/^https?:\/\//, "")}  ${nextSettings.providerProfileId === "qarma-managed" ? "qarma" : "openai"}  ${nextSettings.modelId || "provider-default"}`;
    },
  };
}
