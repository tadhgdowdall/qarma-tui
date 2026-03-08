import { spawnSync } from "node:child_process";

const REQUIRED_IMPORTS = ["browser_use", "httpx", "langchain_openai"];

export function validateBrowserUsePreflight() {
  const pythonBin = process.env.QARMA_PYTHON_BIN || "python3";

  const versionCheck = spawnSync(pythonBin, ["--version"], {
    stdio: "pipe",
    encoding: "utf8",
  });

  if (versionCheck.error) {
    throw new Error(`Python runtime "${pythonBin}" was not found.`);
  }

  const importCheck = spawnSync(
    pythonBin,
    ["-c", `import ${REQUIRED_IMPORTS.join(", ")}`],
    {
      stdio: "pipe",
      encoding: "utf8",
    },
  );

  if (importCheck.status !== 0) {
    const detail = importCheck.stderr.trim() || importCheck.stdout.trim();
    throw new Error(
      `Missing Python dependencies for local Browser-Use runs. Install src/infra/local/python/requirements.txt.${detail ? ` ${detail}` : ""}`,
    );
  }
}
