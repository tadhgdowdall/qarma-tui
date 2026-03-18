import { resolvePythonRuntime, runPythonCommand, validateLocalRunnerImports } from "../infra/runtime/python-runtime";
import { fileURLToPath } from "node:url";
import { macosKeychainStore } from "../infra/storage/macos-keychain-store";

type DoctorStatus = "ok" | "warn" | "fail";

type DoctorCheck = {
  label: string;
  status: DoctorStatus;
  detail: string;
};

function statusIcon(status: DoctorStatus) {
  if (status === "ok") return "[ok]";
  if (status === "warn") return "[warn]";
  return "[fail]";
}

function checkPython(): DoctorCheck {
  const runtime = resolvePythonRuntime();
  const result = runPythonCommand(runtime.pythonBin, ["--version"]);

  if (result.error || result.status !== 0) {
    return {
      label: "Python",
      status: "fail",
      detail: `Runtime "${runtime.pythonBin}" was not found.`,
    };
  }

  const version = (result.stdout || result.stderr).trim() || "Available";
  return {
    label: "Python",
    status: "ok",
    detail: `${runtime.pythonBin} ${version} (${runtime.source})`,
  };
}

function checkLocalRunnerPath(): DoctorCheck {
  const runtime = resolvePythonRuntime();
  const pythonRoot = fileURLToPath(new URL("../infra/local/python", import.meta.url));
  const result = validateLocalRunnerImports(runtime.pythonBin, pythonRoot);

  if (!result.ok) {
    return {
      label: "Local runner path",
      status: "fail",
      detail: result.detail,
    };
  }

  return {
    label: "Local runner path",
    status: "ok",
    detail: result.detail || "agent_runner.py and llm_proxy.py import successfully.",
  };
}

async function checkOpenAiKey(): Promise<DoctorCheck> {
  const envKey = process.env.OPENAI_API_KEY || Bun.env.OPENAI_API_KEY;
  if (envKey) {
    return {
      label: "OpenAI key",
      status: "ok",
      detail: "OPENAI_API_KEY is available in the current environment.",
    };
  }

  const secureKey = macosKeychainStore.isAvailable()
    ? await macosKeychainStore.get("openai_api_key")
    : null;
  if (secureKey) {
    return {
      label: "OpenAI key",
      status: "ok",
      detail: "OpenAI key is available in secure local storage.",
    };
  }

  return {
    label: "OpenAI key",
    status: "warn",
    detail: "No OpenAI key is available in the current environment or secure local storage.",
  };
}

export async function runDoctor() {
  const checks = [
    checkPython(),
    checkLocalRunnerPath(),
    await checkOpenAiKey(),
  ];

  const hasFailure = checks.some((check) => check.status === "fail");
  const hasWarning = checks.some((check) => check.status === "warn");

  console.log("Qarma TUI Doctor\n");
  for (const check of checks) {
    console.log(`${statusIcon(check.status)} ${check.label}`);
    console.log(`       ${check.detail}`);
  }

  console.log("");
  if (hasFailure) {
    console.log("Doctor result: failures detected.");
    process.exitCode = 1;
    return;
  }

  if (hasWarning) {
    console.log("Doctor result: warnings detected.");
    process.exitCode = 0;
    return;
  }

  console.log("Doctor result: all checks passed.");
}
