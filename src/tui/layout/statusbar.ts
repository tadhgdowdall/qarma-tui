import type { CliRenderer } from "@opentui/core";
import { BoxRenderable, TextAttributes, TextRenderable } from "@opentui/core";
import type { RunSettings } from "../state/run-settings";

type RunStatusState = {
  status: "idle" | "running" | "passed" | "failed" | "cancelled";
  elapsedSeconds: number;
};

function formatElapsed(elapsedSeconds: number) {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function statusColor(status: RunStatusState["status"]) {
  if (status === "running") return "#f97316";
  if (status === "passed") return "#4ade80";
  if (status === "failed") return "#f87171";
  if (status === "cancelled") return "#f59e0b";
  return "#a3a3a3";
}

function summaryContent(settings: RunSettings, runtime: RunStatusState) {
  const provider = settings.providerProfileId === "qarma-managed" ? "qarma" : "openai";
  const target = settings.targetUrl.replace(/^https?:\/\//, "");
  const preset = settings.targetPreset ? ` [${settings.targetPreset}]` : "";
  const elapsed = runtime.status === "running" ? `  ${formatElapsed(runtime.elapsedSeconds)}` : "";
  return `${runtime.status}${elapsed}  ${target}${preset}  ${provider}  ${settings.modelId || "provider-default"}`;
}

export function createStatusBar(renderer: CliRenderer, settings: RunSettings) {
  const statusbar = new BoxRenderable(renderer, {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#0a0a0a",
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 1,
    paddingRight: 1,
  });

  const runtime: RunStatusState = {
    status: "idle",
    elapsedSeconds: 0,
  };

  const summary = new TextRenderable(renderer, {
    content: summaryContent(settings, runtime),
    fg: statusColor(runtime.status),
    attributes: TextAttributes.DIM,
  });
  statusbar.add(summary);

  statusbar.add(
    new TextRenderable(renderer, {
      content: "/help",
      fg: "#737373",
      attributes: TextAttributes.DIM,
    }),
  );

  return {
    statusbar,
    update(nextSettings: RunSettings, nextRuntime: Partial<RunStatusState> = {}) {
      if (nextRuntime.status) {
        runtime.status = nextRuntime.status;
      }
      if (typeof nextRuntime.elapsedSeconds === "number") {
        runtime.elapsedSeconds = nextRuntime.elapsedSeconds;
      }
      summary.content = summaryContent(nextSettings, runtime);
      summary.fg = statusColor(runtime.status);
    },
  };
}
