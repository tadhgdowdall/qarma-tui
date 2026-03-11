import { spawnSync } from "node:child_process";

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

function runCommand(
  command: string,
  args: string[],
  extraEnv: NodeJS.ProcessEnv = {},
) {
  return spawnSync(command, args, {
    stdio: "pipe",
    encoding: "utf8",
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
}

function checkPython(): DoctorCheck {
  const pythonBin = process.env.QARMA_PYTHON_BIN || "python3";
  const result = runCommand(pythonBin, ["--version"]);

  if (result.error) {
    return {
      label: "Python",
      status: "fail",
      detail: `Runtime "${pythonBin}" was not found.`,
    };
  }

  const version = (result.stdout || result.stderr).trim() || "Available";
  return {
    label: "Python",
    status: "ok",
    detail: `${pythonBin} ${version}`,
  };
}

function checkLocalRunnerPath(): DoctorCheck {
  const pythonBin = process.env.QARMA_PYTHON_BIN || "python3";
  const result = runCommand(pythonBin, [
    "-c",
    [
      "import sys",
      "from pathlib import Path",
      "root = Path.cwd() / 'src' / 'infra' / 'local' / 'python'",
      "sys.path.insert(0, str(root))",
      "import agent_runner, llm_proxy",
      'print(\"local runner imports successfully\")',
    ].join("; "),
  ]);

  if (result.status !== 0) {
    const detail =
      result.stderr.trim() ||
      result.stdout.trim() ||
      "The local Python runner could not be imported.";
    return {
      label: "Local runner path",
      status: "fail",
      detail,
    };
  }

  return {
    label: "Local runner path",
    status: "ok",
    detail: result.stdout.trim() || "agent_runner.py and llm_proxy.py import successfully.",
  };
}

function checkOpenAiKey(): DoctorCheck {
  const hasKey = Boolean(process.env.OPENAI_API_KEY || Bun.env.OPENAI_API_KEY);
  if (!hasKey) {
    return {
      label: "OpenAI key",
      status: "warn",
      detail: "OPENAI_API_KEY is not set in this shell. Session or secure-store keys are not checked here.",
    };
  }

  return {
    label: "OpenAI key",
    status: "ok",
    detail: "OPENAI_API_KEY is available in the current environment.",
  };
}

export function runDoctor() {
  const checks = [
    checkPython(),
    checkLocalRunnerPath(),
    checkOpenAiKey(),
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
