import { qarmaApiClient } from "../../infra/api/client";
import { createBrowserUseRunner } from "../../infra/local/browseruse-runner";
import { providerProfileStore } from "../../infra/local/provider-profile-store";
import { envSecretStore } from "../../infra/storage/env-secret-store";

export type TuiServices = {
  qarmaApi: typeof qarmaApiClient;
  localRunner: ReturnType<typeof createBrowserUseRunner>;
};

export const services: TuiServices = {
  qarmaApi: qarmaApiClient,
  localRunner: createBrowserUseRunner({
    providerProfiles: providerProfileStore,
    secrets: envSecretStore,
  }),
};
