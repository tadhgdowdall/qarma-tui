import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

function getOpenCommand(filePath: string) {
  if (process.platform === "darwin") {
    return { command: "open", args: [filePath] };
  }

  if (process.platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", filePath] };
  }

  return { command: "xdg-open", args: [filePath] };
}

export function openScreenshotExternally(base64Png: string) {
  const screenshotDir = join(tmpdir(), "qarma-tui-screenshots");
  mkdirSync(screenshotDir, { recursive: true });

  for (const entry of readdirSync(screenshotDir)) {
    if (!entry.endsWith(".png")) {
      continue;
    }
    rmSync(join(screenshotDir, entry), { force: true });
  }

  const filePath = join(screenshotDir, `qarma-${randomUUID()}.png`);
  writeFileSync(filePath, Buffer.from(base64Png, "base64"));

  const { command, args } = getOpenCommand(filePath);
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  return filePath;
}
