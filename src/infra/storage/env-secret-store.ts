import type { SecretStore } from "../../core/ports/secret-store";

const envSecretMap: Record<string, string> = {
  openai_api_key: "OPENAI_API_KEY",
  qarma_access_token: "QARMA_ACCESS_TOKEN",
};

export const envSecretStore: SecretStore = {
  async get(secretRef) {
    const envName = envSecretMap[secretRef];
    if (!envName) {
      return null;
    }

    const value = process.env[envName];
    return value && value.trim() ? value.trim() : null;
  },
};
