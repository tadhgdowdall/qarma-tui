import { spawnSync } from "node:child_process";
import type { CliRenderer } from "@opentui/core";

function copyWithOsc52(renderer: CliRenderer, text: string) {
  return renderer.copyToClipboardOSC52(text);
}

function copyWithNativeClipboard(text: string) {
  if (process.platform === "darwin") {
    const result = spawnSync("pbcopy", {
      input: text,
      encoding: "utf8",
      stdio: ["pipe", "ignore", "ignore"],
    });
    return result.status === 0;
  }

  return false;
}

export function copyTextToClipboard(renderer: CliRenderer, text: string) {
  if (copyWithNativeClipboard(text)) {
    return true;
  }

  return copyWithOsc52(renderer, text);
}
