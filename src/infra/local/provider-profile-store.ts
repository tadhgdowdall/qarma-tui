import type { ProviderProfile } from "../../core/models/provider";
import type { ProviderProfileStore } from "../../core/ports/provider-profile-store";

const localProfiles: ProviderProfile[] = [
  {
    id: "openai-local",
    label: "OpenAI (local key)",
    provider: "openai",
    modelSource: "user_api_key",
    modelId: "gpt-5-nano",
    secretRef: "openai_api_key",
    defaultForLocalRuns: true,
  },
  {
    id: "qarma-managed",
    label: "Qarma managed",
    provider: "browser_use_cloud",
    modelSource: "qarma_managed",
    secretRef: "qarma_access_token",
    baseUrl: process.env.QARMA_API_URL,
  },
];

export const providerProfileStore: ProviderProfileStore = {
  async getDefaultLocalProfile() {
    return localProfiles.find((profile) => profile.defaultForLocalRuns) || null;
  },
  async getProfile(profileId) {
    return localProfiles.find((profile) => profile.id === profileId) || null;
  },
};
