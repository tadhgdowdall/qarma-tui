import type { SecretStore } from "../../core/ports/secret-store";

export function createFallbackSecretStore(primary: SecretStore, secondary: SecretStore): SecretStore {
  return {
    async get(secretRef) {
      const primaryValue = await primary.get(secretRef);
      if (primaryValue) {
        return primaryValue;
      }

      return secondary.get(secretRef);
    },
  };
}
