import type { SecretStore } from "../../core/ports/secret-store";

export type SecretSource = "session" | "secure" | "env" | "missing";

export type MutableSecretStore = SecretStore & {
  set(secretRef: string, value: string): void;
  clear(secretRef: string): void;
  source(secretRef: string): Promise<SecretSource>;
};

type SessionSecretStoreDependencies = {
  secure?: SecretStore;
  env: SecretStore;
  base: SecretStore;
};

export function createSessionSecretStore(
  dependencies: SessionSecretStoreDependencies,
): MutableSecretStore {
  const overrides = new Map<string, string>();

  return {
    set(secretRef, value) {
      const trimmed = value.trim();
      if (!trimmed) {
        overrides.delete(secretRef);
        return;
      }

      overrides.set(secretRef, trimmed);
    },
    clear(secretRef) {
      overrides.delete(secretRef);
    },
    async get(secretRef) {
      const override = overrides.get(secretRef);
      if (override) {
        return override;
      }

      return dependencies.base.get(secretRef);
    },
    async source(secretRef) {
      if (overrides.has(secretRef)) {
        return "session";
      }

      const secureValue = dependencies.secure ? await dependencies.secure.get(secretRef) : null;
      if (secureValue) {
        return "secure";
      }

      const envValue = await dependencies.env.get(secretRef);
      return envValue ? "env" : "missing";
    },
  };
}
