import type { CliRenderer, ScrollBoxRenderable } from "@opentui/core";
import type { RunFailureKind, TestRun, TestRunStep } from "../../core/models/run";
import { startRun } from "../../core/usecases/start-run";
import { services } from "../context/services";
import { addTranscriptMessage } from "../layout/transcript";
import { buildRunRequest, formatRunSettings, type RunSettings } from "../state/run-settings";
import { sampleMessages } from "../state/mock-data";
import type { Message, RecentRunSummary } from "../../shared/types";
import { copyTextToClipboard } from "../../infra/local/clipboard";

type RuntimeStatus = "idle" | "running" | "passed" | "failed" | "cancelled";

type HomeRunControllerOptions = {
  renderer: CliRenderer;
  transcript: ScrollBoxRenderable;
  runSettings: RunSettings;
  syncStatusbar: (status: RuntimeStatus, elapsedSeconds: number) => void;
  addRecentRun: (prompt: string, targetUrl: string) => RecentRunSummary;
  updateRecentRun: (
    entry: RecentRunSummary,
    status: RecentRunSummary["status"],
  ) => void;
};

export function createHomeRunController(options: HomeRunControllerOptions) {
  let transcriptSeeded = false;
  let runInFlight = false;
  let lastSubmittedPrompt = "";
  let activeRunStatus: RuntimeStatus = "idle";
  let activeRunStartedAt: number | null = null;
  let elapsedTimer: ReturnType<typeof setInterval> | null = null;
  let latestScreenshot: string | null = null;
  const transcriptMessages: Message[] = [];

  function stopElapsedTimer() {
    if (elapsedTimer) {
      clearInterval(elapsedTimer);
      elapsedTimer = null;
    }
  }

  function elapsedSeconds() {
    if (!activeRunStartedAt) {
      return 0;
    }
    return Math.max(0, Math.floor((Date.now() - activeRunStartedAt) / 1000));
  }

  function syncStatusbar() {
    options.syncStatusbar(activeRunStatus, elapsedSeconds());
    options.renderer.root.requestRender();
  }

  function normalizeRunStatus(status: TestRun["status"]) {
    return status === "queued" ? "running" : status;
  }

  function seedTranscript() {
    if (transcriptSeeded) {
      return;
    }

    for (const message of sampleMessages) {
      transcriptMessages.push(message);
      addTranscriptMessage(options.renderer, options.transcript, message);
    }

    transcriptSeeded = true;
  }

  function appendMessage(message: Message) {
    transcriptMessages.push(message);
    addTranscriptMessage(options.renderer, options.transcript, message);
  }

  function appendPromptExchange(trimmed: string) {
    appendMessage({
      speaker: "Operator",
      accent: "#f8fafc",
      content: trimmed,
      variant: "prompt",
    });
  }

  function compactStepTitle(title: string) {
    return title
      .replace(/\s+/g, " ")
      .replace(/^Verify presence of /i, "Check ")
      .replace(/^Verify that /i, "Check ")
      .replace(/^Click on /i, "Open ")
      .replace(/^No further actions required.*$/i, "Finish run")
      .replace(/^Prepare to report results.*$/i, "Finish run")
      .trim()
      .slice(0, 78);
  }

  function compactStepLine(label: string, value: string) {
    const compactValue = value
      .replace(/\s+/g, " ")
      .replace(/^Pending:\s*/i, "")
      .replace(/^Status:\s*/i, "")
      .trim()
      .slice(0, 120);

    return compactValue ? `${label}  ${compactValue}` : null;
  }

  function summarizeFailure(run: TestRun) {
    const detail = run.errorMessage || run.result || "The run did not complete.";
    const normalizedDetail = detail.replace(/\s+/g, " ").trim();

    const byKind: Record<RunFailureKind, string> = {
      assertion: `Check failed: ${normalizedDetail}`,
      timeout: normalizedDetail || "Run timed out.",
      runtime: `Runtime error: ${normalizedDetail}`,
      cancelled: "Run cancelled.",
    };

    if (run.failureKind) {
      return byKind[run.failureKind];
    }

    return `Run failed: ${normalizedDetail}`;
  }

  function getLastMeaningfulStep(run: TestRun) {
    for (let index = run.steps.length - 1; index >= 0; index -= 1) {
      const step = run.steps[index];
      if (!step) {
        continue;
      }

      const note = step.observation?.replace(/\s+/g, " ").trim();
      if (note) {
        return note;
      }

      const title = step.title?.replace(/\s+/g, " ").trim();
      if (title && title !== "Runner started" && title !== "Resolve model access") {
        return title;
      }
    }

    return "";
  }

  function buildOverallSummary(run: TestRun, summary: string) {
    const normalized = summary.replace(/\s+/g, " ").trim();
    const lastStep = getLastMeaningfulStep(run);

    if (run.status === "passed") {
      const withoutPrefix = normalized.replace(/^Verified:\s*/i, "");
      return `The requested check passed. ${withoutPrefix}`;
    }

    if (run.status === "cancelled") {
      return lastStep
        ? `The run was cancelled before completion. Last progress: ${lastStep}`
        : "The run was cancelled before the requested check completed.";
    }

    if (run.failureKind === "timeout") {
      return lastStep
        ? `The requested check timed out before completion. Last progress: ${lastStep}`
        : "The requested check did not complete before the timeout was reached.";
    }

    if (run.failureKind === "runtime") {
      return lastStep
        ? `The run failed due to a runtime issue after: ${lastStep}`
        : `The run failed due to a runtime issue. ${normalized}`;
    }

    if (run.failureKind === "assertion") {
      return lastStep
        ? `The requested check failed after: ${lastStep}`
        : `The requested check failed. ${normalized}`;
    }

    return `The requested check failed. ${normalized}`;
  }

  function appendStepMessage(step: TestRunStep) {
    if (step.title === "Runner started" || step.title === "Resolve model access") {
      return;
    }

    const noteLine = step.observation
      ? compactStepLine("note", step.observation)
      : null;

    appendMessage({
      speaker: "Qarma",
      accent: step.status === "failed" ? "#f87171" : "#f97316",
      content: compactStepTitle(step.title),
      detailLines: noteLine ? [noteLine] : [],
      stepStatus: step.status,
      variant: "step",
    });
  }

  function appendOptimisticStartupStep() {
    appendMessage({
      speaker: "Qarma",
      accent: "#f97316",
      content: "Starting local browser session",
      detailLines: [],
      stepStatus: "running",
      variant: "step",
    });
  }

  function appendRunSummary(run: TestRun) {
    const summary =
      run.status === "passed"
        ? run.result || `Run passed on ${run.targetUrl}.`
        : run.status === "cancelled"
          ? "Run cancelled."
          : summarizeFailure(run);
    const overallSummary = buildOverallSummary(run, summary);

    const durationSeconds =
      typeof run.durationMs === "number"
        ? Math.max(1, Math.round(run.durationMs / 1000))
        : null;

    appendMessage({
      speaker: "System",
      accent: run.status === "passed" ? "#4ade80" : "#f87171",
      content: summary,
      detailLines: [
        `result summary  ${overallSummary}`,
        `status  ${run.status}`,
        `target  ${run.targetUrl.replace(/^https?:\/\//, "")}`,
        durationSeconds ? `duration  ${durationSeconds}s` : null,
        run.screenshots.length > 0 ? "evidence  screenshot available (/screenshot or ctrl+o)" : null,
      ].filter((line): line is string => Boolean(line)),
      variant: "system",
    });
  }

  function appendSystemMessage(content: string, accent = "#a3a3a3") {
    appendMessage({
      speaker: "System",
      accent,
      content,
      variant: "system",
    });
  }

  async function submitRun(value: string) {
    const trimmed = value.trim();
    if (!trimmed || runInFlight) {
      return;
    }

    lastSubmittedPrompt = trimmed;
    latestScreenshot = null;
    const recentRun = options.addRecentRun(trimmed, options.runSettings.targetUrl);
    appendPromptExchange(trimmed);
    runInFlight = true;
    activeRunStatus = "running";
    activeRunStartedAt = Date.now();
    stopElapsedTimer();
    elapsedTimer = setInterval(syncStatusbar, 1000);
    syncStatusbar();
    appendOptimisticStartupStep();
    options.renderer.root.requestRender();

    await new Promise((resolve) => setTimeout(resolve, 0));

    const openAiKeySource = await services.secrets.source("openai_api_key");
    if (openAiKeySource === "missing") {
      appendSystemMessage(
        "OpenAI key is missing for the current session.",
        "#f87171",
      );
    } else {
      appendSystemMessage(
        `Local run · ${formatRunSettings(options.runSettings)}`,
        "#737373",
      );
    }

    try {
      const run = await startRun(
        buildRunRequest(trimmed, options.runSettings),
        {
          localRunner: services.localRunner,
          qarmaApi: services.qarmaApi,
        },
        {
          onStep: appendStepMessage,
        },
      );

      activeRunStatus = normalizeRunStatus(run.status);
      latestScreenshot = run.screenshots[0] || null;
      options.updateRecentRun(
        recentRun,
        run.status === "queued" ? "running" : run.status,
      );
      appendRunSummary(run);
    } catch (error) {
      activeRunStatus = "failed";
      options.updateRecentRun(recentRun, "failed");
      appendSystemMessage(
        `Run failed to start: ${error instanceof Error ? error.message : String(error)}`,
        "#f87171",
      );
    } finally {
      runInFlight = false;
      stopElapsedTimer();
      syncStatusbar();
    }
  }

  function clearTranscript() {
    stopElapsedTimer();
    activeRunStatus = "idle";
    activeRunStartedAt = null;
    transcriptMessages.length = 0;
    for (const child of options.transcript.getChildren()) {
      options.transcript.remove(child.id);
    }
    syncStatusbar();
    options.renderer.root.requestRender();
  }

  async function rerunLast() {
    if (!lastSubmittedPrompt) {
      appendSystemMessage("No previous prompt to rerun.", "#f87171");
      return;
    }

    if (runInFlight) {
      appendSystemMessage("A run is already in progress.", "#f87171");
      return;
    }

    await submitRun(lastSubmittedPrompt);
  }

  async function cancelCurrentRun() {
    if (!runInFlight) {
      appendSystemMessage("No run is currently in progress.", "#f87171");
      return;
    }

    const cancelled = await services.localRunner.cancelCurrentRun();
    if (cancelled) {
      activeRunStatus = "cancelled";
      stopElapsedTimer();
      syncStatusbar();
    }
    appendSystemMessage(
      cancelled ? "Cancelling current run..." : "No active local process to cancel.",
      cancelled ? "#f97316" : "#f87171",
    );
  }

  function copyLatestTranscriptMessage() {
    const selectedText = options.renderer.getSelection()?.getSelectedText().trim();
    if (selectedText) {
      const copied = copyTextToClipboard(options.renderer, selectedText);
      if (!copied) {
        appendSystemMessage(
          "Clipboard copy is not supported by this terminal.",
          "#f87171",
        );
      }
      return;
    }

    const lastMessage = transcriptMessages[transcriptMessages.length - 1];
    if (!lastMessage) {
      appendSystemMessage("Nothing to copy yet.", "#a3a3a3");
      return;
    }

    const copied = copyTextToClipboard(
      options.renderer,
      `${lastMessage.speaker}: ${lastMessage.content}`,
    );
    if (!copied) {
      appendSystemMessage(
        "Clipboard copy is not supported by this terminal.",
        "#f87171",
      );
    }
  }

  return {
    seedTranscript,
    submitRun,
    clearTranscript,
    rerunLast,
    cancelCurrentRun,
    copyLatestTranscriptMessage,
    appendSystemMessage,
    syncStatusbar,
    getLatestScreenshot: () => latestScreenshot,
    isRunInFlight: () => runInFlight,
  };
}
