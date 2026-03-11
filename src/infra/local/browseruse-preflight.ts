import { resolvePythonRuntime, runPythonCommand, validateLocalRunnerImports } from "../runtime/python-runtime";
import { fileURLToPath } from "node:url";

export function validateBrowserUsePreflight() {
  const runtime = resolvePythonRuntime();
  const versionCheck = runPythonCommand(runtime.pythonBin, ["--version"]);

  if (versionCheck.error || versionCheck.status !== 0) {
    throw new Error(`Python runtime "${runtime.pythonBin}" was not found.`);
  }

  const pythonModuleDir = fileURLToPath(new URL("./python", import.meta.url));
  const validation = validateLocalRunnerImports(runtime.pythonBin, pythonModuleDir);
  if (!validation.ok) {
    throw new Error(`Local Browser-Use runtime is not ready. Run \`qarma-tui setup\`. ${validation.detail}`);
  }
}
