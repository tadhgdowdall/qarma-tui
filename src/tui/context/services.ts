import { qarmaApiClient } from "../../infra/api/client";
import { createBrowserUseRunner } from "../../infra/local/browseruse-runner";
import { providerProfileStore } from "../../infra/local/provider-profile-store";
import { envSecretStore } from "../../infra/storage/env-secret-store";
import { createSessionSecretStore } from "../../infra/storage/session-secret-store";

export const sessionSecretStore = createSessionSecretStore(envSecretStore);

export type TuiServices = {
  qarmaApi: typeof qarmaApiClient;
  localRunner: ReturnType<typeof createBrowserUseRunner>;
  secrets: typeof sessionSecretStore;
};

export const services: TuiServices = {
  qarmaApi: qarmaApiClient,
  secrets: sessionSecretStore,
  localRunner: createBrowserUseRunner({
    providerProfiles: providerProfileStore,
    secrets: sessionSecretStore,
  }),
};
