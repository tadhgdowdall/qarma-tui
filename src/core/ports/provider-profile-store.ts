import type { ProviderProfile } from "../models/provider";

export interface ProviderProfileStore {
  getDefaultLocalProfile(): Promise<ProviderProfile | null>;
  getProfile(profileId: string): Promise<ProviderProfile | null>;
}
