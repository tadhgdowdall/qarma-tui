import type { SecretStore } from "../../core/ports/secret-store";
import { SECRET_ENV_MAP } from "../../shared/constants";

export function getExpectedEnvName(secretRef: string) {
  return SECRET_ENV_MAP[secretRef] || null;
}

export const envSecretStore: SecretStore = {
  async get(secretRef) {
    const envName = getExpectedEnvName(secretRef);
    if (!envName) {
      return null;
    }

    const value =
      process.env[envName] ||
      (typeof Bun !== "undefined" && Bun.env ? Bun.env[envName] : undefined);

    return value && value.trim() ? value.trim() : null;
  },
};
