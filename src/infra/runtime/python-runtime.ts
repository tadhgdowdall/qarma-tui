import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

type ManagedRuntimeMetadata = {
  version: 1;
  createdAt: string;
  updatedAt: string;
  bootstrapPython: string;
};

export type ResolvedPythonRuntime = {
  source: "managed" | "env" | "system";
  pythonBin: string;
};

const METADATA_VERSION = 1;

function safeReadJson(path: string) {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ManagedRuntimeMetadata;
  } catch {
    return null;
  }
}

export function getQarmaHome() {
  return process.env.QARMA_HOME || join(homedir(), ".qarma-tui");
}

export function getManagedRuntimePaths() {
  const homeDir = getQarmaHome();
  const runtimeDir = join(homeDir, "runtime");
  const venvDir = join(runtimeDir, "venv");
  const metadataPath = join(runtimeDir, "metadata.json");
  const configDir = join(homeDir, "config");
  const configPath = join(configDir, "config.json");

  return {
    homeDir,
    runtimeDir,
    venvDir,
    metadataPath,
    configDir,
    configPath,
  };
}

export function getManagedPythonBin(venvDir = getManagedRuntimePaths().venvDir) {
  return process.platform === "win32"
    ? join(venvDir, "Scripts", "python.exe")
    : join(venvDir, "bin", "python");
}

export function readManagedRuntimeMetadata() {
  const { metadataPath } = getManagedRuntimePaths();
  if (!existsSync(metadataPath)) {
    return null;
  }

  const metadata = safeReadJson(metadataPath);
  if (!metadata || metadata.version !== METADATA_VERSION) {
    return null;
  }

  return metadata;
}

export function hasManagedRuntime() {
  const { metadataPath, venvDir } = getManagedRuntimePaths();
  return existsSync(metadataPath) && existsSync(getManagedPythonBin(venvDir));
}

export function resolvePythonRuntime(): ResolvedPythonRuntime {
  const managedPython = getManagedPythonBin();
  if (hasManagedRuntime() && existsSync(managedPython)) {
    return {
      source: "managed",
      pythonBin: managedPython,
    };
  }

  if (process.env.QARMA_PYTHON_BIN) {
    return {
      source: "env",
      pythonBin: process.env.QARMA_PYTHON_BIN,
    };
  }

  return {
    source: "system",
    pythonBin: "python3",
  };
}

export function findBootstrapPython() {
  const candidates = process.platform === "win32"
    ? ["python", "py"]
    : ["python3", "python"];

  for (const candidate of candidates) {
    const args = candidate === "py" ? ["-3", "--version"] : ["--version"];
    const result = spawnSync(candidate, args, {
      stdio: "pipe",
      encoding: "utf8",
    });
    if (!result.error && result.status === 0) {
      return candidate;
    }
  }

  return null;
}

export function runPythonCommand(
  pythonBin: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } = {},
) {
  const commandArgs = pythonBin === "py" ? ["-3", ...args] : args;
  return spawnSync(pythonBin, commandArgs, {
    stdio: "pipe",
    encoding: "utf8",
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
    },
  });
}

export function validateLocalRunnerImports(pythonBin: string, pythonModuleDir: string) {
  const result = runPythonCommand(
    pythonBin,
    [
      "-c",
      [
        "import sys",
        `sys.path.insert(0, ${JSON.stringify(pythonModuleDir)})`,
        "import agent_runner, llm_proxy",
        'print("local runner imports successfully")',
      ].join("; "),
    ],
    {
      env: {
        PYTHONPATH: pythonModuleDir,
      },
    },
  );

  return {
    ok: result.status === 0,
    detail:
      result.stdout.trim() ||
      result.stderr.trim() ||
      "The local Python runner could not be imported.",
  };
}

export function writeManagedRuntimeMetadata(bootstrapPython: string) {
  const { runtimeDir, metadataPath, configDir, configPath } = getManagedRuntimePaths();
  mkdirSync(runtimeDir, { recursive: true });
  mkdirSync(configDir, { recursive: true });

  const now = new Date().toISOString();
  const existing = readManagedRuntimeMetadata();
  const metadata: ManagedRuntimeMetadata = {
    version: METADATA_VERSION,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    bootstrapPython,
  };

  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  writeFileSync(
    configPath,
    `${JSON.stringify(
      {
        runtime: {
          pythonBin: getManagedPythonBin(),
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

export function ensureParentDir(path: string) {
  mkdirSync(dirname(path), { recursive: true });
}
