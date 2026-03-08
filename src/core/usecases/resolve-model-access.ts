import type { ProviderProfile, ResolvedModelAccess } from "../models/provider";
import type { ProviderProfileStore } from "../ports/provider-profile-store";
import type { SecretStore } from "../ports/secret-store";
import { SECRET_ENV_MAP } from "../../shared/constants";

type ResolveModelAccessInput = {
  profileId?: string;
};

type ResolveModelAccessDependencies = {
  providerProfiles: ProviderProfileStore;
  secrets: SecretStore;
};

export async function resolveModelAccess(
  input: ResolveModelAccessInput,
  dependencies: ResolveModelAccessDependencies,
): Promise<{ profile: ProviderProfile; access: ResolvedModelAccess }> {
  const profile = input.profileId
    ? await dependencies.providerProfiles.getProfile(input.profileId)
    : await dependencies.providerProfiles.getDefaultLocalProfile();

  if (!profile) {
    throw new Error("No local provider profile is configured.");
  }

  if (profile.modelSource === "local_model") {
    throw new Error("Local model execution is not enabled.");
  }

  if (!profile.secretRef) {
    throw new Error(`Provider profile "${profile.label}" is missing a secret reference.`);
  }

  const secret = await dependencies.secrets.get(profile.secretRef);
  if (!secret) {
    const envName = SECRET_ENV_MAP[profile.secretRef];
    throw new Error(
      envName
        ? `Missing secret for provider profile "${profile.label}". Expected env var ${envName}.`
        : `Missing secret for provider profile "${profile.label}".`,
    );
  }

  if (profile.modelSource === "qarma_managed") {
    return {
      profile,
      access: {
        mode: "qarma_managed",
        provider: profile.provider,
        modelId: profile.modelId,
        accessToken: secret,
        baseUrl: profile.baseUrl,
      },
    };
  }

  return {
    profile,
    access: {
      mode: "user_api_key",
      provider: profile.provider,
      modelId: profile.modelId,
      apiKey: secret,
      baseUrl: profile.baseUrl,
    },
  };
}
