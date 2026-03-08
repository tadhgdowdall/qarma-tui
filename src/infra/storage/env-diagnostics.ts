type EnvDiagnostic = {
  envName: string;
  available: boolean;
};

export function getEnvDiagnostic(envName: string): EnvDiagnostic {
  const value =
    process.env[envName] ||
    (typeof Bun !== "undefined" && Bun.env ? Bun.env[envName] : undefined);

  return {
    envName,
    available: Boolean(value && value.trim()),
  };
}
