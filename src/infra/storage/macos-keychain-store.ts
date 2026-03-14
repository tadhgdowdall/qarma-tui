import { spawnSync } from "node:child_process";
import type { SecretStore } from "../../core/ports/secret-store";

const SERVICE_PREFIX = "qarma-tui";
const ACCOUNT_MAP: Record<string, string> = {
  openai_api_key: "openai_api_key",
};

function getAccountName(secretRef: string) {
  return ACCOUNT_MAP[secretRef] || null;
}

function isSupportedPlatform() {
  return process.platform === "darwin";
}

function shellEscapeSingleQuoted(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function toHexSecret(value: string) {
  return Buffer.from(value, "utf8").toString("hex");
}

function readKeychain(secretRef: string) {
  if (!isSupportedPlatform()) {
    return null;
  }

  const account = getAccountName(secretRef);
  if (!account) {
    return null;
  }

  const result = spawnSync(
    "/usr/bin/security",
    ["find-generic-password", "-s", SERVICE_PREFIX, "-a", account, "-w"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );

  if (result.status !== 0) {
    return null;
  }

  const value = result.stdout.trim();
  return value || null;
}

export const macosKeychainStore: SecretStore & {
  set(secretRef: string, value: string): void;
  clear(secretRef: string): void;
  isAvailable(): boolean;
} = {
  isAvailable() {
    return isSupportedPlatform();
  },
  async get(secretRef) {
    return readKeychain(secretRef);
  },
  set(secretRef, value) {
    if (!isSupportedPlatform()) {
      throw new Error("Secure key storage is not available on this platform.");
    }

    const account = getAccountName(secretRef);
    if (!account) {
      throw new Error(`No secure storage mapping exists for ${secretRef}.`);
    }

    const normalized = value.trim();
    if (!normalized) {
      throw new Error("Secret value cannot be empty.");
    }

    const command = [
      "add-generic-password",
      "-U",
      "-s",
      shellEscapeSingleQuoted(SERVICE_PREFIX),
      "-a",
      shellEscapeSingleQuoted(account),
      "-X",
      toHexSecret(normalized),
      "-T",
      '""',
    ].join(" ");

    const result = spawnSync(
      "/usr/bin/security",
      ["-i"],
      {
        stdio: ["pipe", "ignore", "ignore"],
        input: `${command}\n`,
        encoding: "utf8",
      },
    );

    if (result.status !== 0) {
      throw new Error("Failed to save key to macOS Keychain.");
    }
  },
  clear(secretRef) {
    if (!isSupportedPlatform()) {
      return;
    }

    const account = getAccountName(secretRef);
    if (!account) {
      return;
    }

    const result = spawnSync(
      "/usr/bin/security",
      ["delete-generic-password", "-s", SERVICE_PREFIX, "-a", account],
      { stdio: ["ignore", "ignore", "ignore"] },
    );

    if (result.status !== 0 && result.status !== 44) {
      throw new Error("Failed to remove key from macOS Keychain.");
    }
  },
};
