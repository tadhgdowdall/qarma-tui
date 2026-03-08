import type { ModelProvider, ModelSource } from "./run";

export type ProviderProfile = {
  id: string;
  label: string;
  provider: ModelProvider;
  modelSource: ModelSource;
  modelId?: string;
  secretRef?: string;
  baseUrl?: string;
  defaultForLocalRuns?: boolean;
};

export type ResolvedModelAccess =
  | {
      mode: "user_api_key";
      provider: ModelProvider;
      modelId?: string;
      apiKey: string;
      baseUrl?: string;
    }
  | {
      mode: "qarma_managed";
      provider: ModelProvider;
      modelId?: string;
      accessToken: string;
      baseUrl?: string;
    }
  | {
      mode: "local_model";
      provider: ModelProvider;
      modelId?: string;
      baseUrl?: string;
    };
