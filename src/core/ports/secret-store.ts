export interface SecretStore {
  get(secretRef: string): Promise<string | null>;
}
