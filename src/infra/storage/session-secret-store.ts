import type { SecretStore } from "../../core/ports/secret-store";

export type SecretSource = "session" | "env" | "missing";

export type MutableSecretStore = SecretStore & {
  set(secretRef: string, value: string): void;
  clear(secretRef: string): void;
  source(secretRef: string): Promise<SecretSource>;
};

export function createSessionSecretStore(base: SecretStore): MutableSecretStore {
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

      return base.get(secretRef);
    },
    async source(secretRef) {
      if (overrides.has(secretRef)) {
        return "session";
      }

      const value = await base.get(secretRef);
      return value ? "env" : "missing";
    },
  };
}
