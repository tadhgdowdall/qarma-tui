import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LOCAL_ENV_FILE = join(process.cwd(), ".env.local");

function setFilePermissionsIfPossible(path: string) {
  if (process.platform === "win32") {
    return;
  }

  try {
    chmodSync(path, 0o600);
  } catch {
    // Best effort only. Failure here should not block local configuration.
  }
}

export function writeLocalEnvVar(name: string, value: string) {
  const nextLine = `${name}=${JSON.stringify(value)}`;
  const existing = existsSync(LOCAL_ENV_FILE) ? readFileSync(LOCAL_ENV_FILE, "utf8").split(/\r?\n/) : [];
  const nextLines = existing.filter((line) => line.trim() && !line.startsWith(`${name}=`));
  nextLines.push(nextLine);
  writeFileSync(LOCAL_ENV_FILE, `${nextLines.join("\n")}\n`, "utf8");
  setFilePermissionsIfPossible(LOCAL_ENV_FILE);
}

export function removeLocalEnvVar(name: string) {
  if (!existsSync(LOCAL_ENV_FILE)) {
    return;
  }

  const existing = readFileSync(LOCAL_ENV_FILE, "utf8").split(/\r?\n/);
  const nextLines = existing.filter((line) => line.trim() && !line.startsWith(`${name}=`));
  writeFileSync(LOCAL_ENV_FILE, nextLines.length ? `${nextLines.join("\n")}\n` : "", "utf8");
  setFilePermissionsIfPossible(LOCAL_ENV_FILE);
}
