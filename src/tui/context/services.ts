import { qarmaApiClient } from "../../infra/api/client";
import { createBrowserUseRunner } from "../../infra/local/browseruse-runner";
import { providerProfileStore } from "../../infra/local/provider-profile-store";
import { envSecretStore } from "../../infra/storage/env-secret-store";
import { createFallbackSecretStore } from "../../infra/storage/fallback-secret-store";
import { macosKeychainStore } from "../../infra/storage/macos-keychain-store";
import { createSessionSecretStore } from "../../infra/storage/session-secret-store";

const persistedSecretStore = createFallbackSecretStore(macosKeychainStore, envSecretStore);

export const sessionSecretStore = createSessionSecretStore({
  secure: macosKeychainStore,
  env: envSecretStore,
  base: persistedSecretStore,
});

export type TuiServices = {
  qarmaApi: typeof qarmaApiClient;
  localRunner: ReturnType<typeof createBrowserUseRunner>;
  secrets: typeof sessionSecretStore;
  secureSecrets: typeof macosKeychainStore;
};

export const services: TuiServices = {
  qarmaApi: qarmaApiClient,
  secrets: sessionSecretStore,
  secureSecrets: macosKeychainStore,
  localRunner: createBrowserUseRunner({
    providerProfiles: providerProfileStore,
    secrets: sessionSecretStore,
  }),
};
