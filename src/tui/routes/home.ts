import type { CliRenderer } from "@opentui/core";
import type { RunRequest, TestRun, TestRunStep } from "../../core/models/run";
import { startRun } from "../../core/usecases/start-run";
import { createLandingView } from "../layout/landing";
import { services } from "../context/services";
import { createShell } from "../layout/shell";
import { createSidebar } from "../layout/sidebar";
import { createTranscriptPanel, addTranscriptMessage } from "../layout/transcript";
import { createComposer } from "../layout/composer";
import { createStatusBar } from "../layout/statusbar";
import { applySettingsCommand } from "../commands/settings";
import { sampleMessages, sampleSessions } from "../state/mock-data";
import { buildRunRequest, defaultRunSettings, formatRunSettings } from "../state/run-settings";
import type { Message } from "../../shared/types";
import { copyTextToClipboard } from "../../infra/local/clipboard";

export function mountHomeRoute(renderer: CliRenderer) {
  const runSettings = { ...defaultRunSettings };
  const { view: landingView, input: landingInput } = createLandingView(
    renderer,
    handleInitialSubmit,
  );
  const shell = createShell(renderer);
  const sidebar = createSidebar(renderer, sampleSessions);
  const { panel: transcriptPanel, transcript } = createTranscriptPanel(renderer);
  const { composer, input } = createComposer(renderer, handleWorkspaceSubmit);
  const statusbar = createStatusBar(renderer, runSettings);

  let sidebarOpen = false;
  let sidebarWidth = 0;
  let sidebarAnimation: ReturnType<typeof setInterval> | null = null;
  let workspaceActive = false;
  let transcriptSeeded = false;
  let runInFlight = false;
  let lastSubmittedPrompt = "";
  let activeRunStatus: "idle" | "running" | "passed" | "failed" | "cancelled" = "idle";
  let activeRunStartedAt: number | null = null;
  let elapsedTimer: ReturnType<typeof setInterval> | null = null;
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

  function normalizeRunStatus(status: TestRun["status"]) {
    return status === "queued" ? "running" : status;
  }

  function seedTranscript() {
    if (transcriptSeeded) {
      return;
    }

    for (const message of sampleMessages) {
      transcriptMessages.push(message);
      addTranscriptMessage(renderer, transcript, message);
    }

    transcriptSeeded = true;
  }

  function activateWorkspace() {
    if (workspaceActive) {
      return;
    }

    workspaceActive = true;
    landingView.visible = false;
    shell.app.visible = true;
    seedTranscript();
    syncSidebar();
    input.focus();
    renderer.root.requestRender();
  }

  function appendPromptExchange(trimmed: string) {
    const message = {
      speaker: "Operator",
      accent: "#f8fafc",
      content: trimmed,
      variant: "prompt",
    } as const;
    transcriptMessages.push(message);
    addTranscriptMessage(renderer, transcript, message);
  }

  function appendStepMessage(step: TestRunStep) {
    const message = {
      speaker: "Qarma",
      accent: step.status === "failed" ? "#f87171" : "#f97316",
      content: step.title,
      detailLines: [
        step.action ? `action  ${step.action}` : null,
        step.observation ? `note    ${step.observation}` : null,
        step.url ? `url     ${step.url}` : null,
      ].filter((line): line is string => Boolean(line)),
      stepStatus: step.status,
      variant: "step",
    } as const;
    transcriptMessages.push(message);
    addTranscriptMessage(renderer, transcript, message);
  }

  function appendRunSummary(run: TestRun) {
    const summary =
      run.status === "passed"
        ? `Run passed on ${run.targetUrl} using ${run.executionMode} execution.`
        : `Run ${run.status} on ${run.targetUrl}${run.errorMessage ? `: ${run.errorMessage}` : "."}`;

    const message = {
      speaker: "System",
      accent: run.status === "passed" ? "#4ade80" : "#f87171",
      content: summary,
      variant: "system",
    } as const;
    transcriptMessages.push(message);
    addTranscriptMessage(renderer, transcript, message);
  }

  function appendSystemMessage(content: string, accent = "#a3a3a3") {
    const message = {
      speaker: "System",
      accent,
      content,
      variant: "system",
    } as const;
    transcriptMessages.push(message);
    addTranscriptMessage(renderer, transcript, message);
  }

  function syncStatusbar() {
    statusbar.update(runSettings, {
      status: activeRunStatus,
      elapsedSeconds: elapsedSeconds(),
    });
    renderer.root.requestRender();
  }

  function copyLatestTranscriptMessage() {
    const selectedText = renderer.getSelection()?.getSelectedText().trim();
    if (selectedText) {
      const copied = copyTextToClipboard(renderer, selectedText);

      appendSystemMessage(
        copied
          ? "Copied selected transcript text to clipboard."
          : "Clipboard copy is not supported by this terminal.",
        copied ? "#4ade80" : "#f87171",
      );
      return;
    }

    const lastMessage = transcriptMessages[transcriptMessages.length - 1];
    if (!lastMessage) {
      appendSystemMessage("Nothing to copy yet.", "#a3a3a3");
      return;
    }

    const copied = copyTextToClipboard(
      renderer,
      `${lastMessage.speaker}: ${lastMessage.content}`,
    );

    appendSystemMessage(
      copied
        ? "Copied latest transcript message to clipboard."
        : "Clipboard copy is not supported by this terminal.",
      copied ? "#4ade80" : "#f87171",
    );
  }

  async function submitRun(value: string) {
    const trimmed = value.trim();
    if (!trimmed || runInFlight) {
      return;
    }

    lastSubmittedPrompt = trimmed;
    appendPromptExchange(trimmed);
    runInFlight = true;
    activeRunStatus = "running";
    activeRunStartedAt = Date.now();
    stopElapsedTimer();
    elapsedTimer = setInterval(syncStatusbar, 1000);
    syncStatusbar();

    appendSystemMessage(`Starting ${formatRunSettings(runSettings)} run.`);
    const openAiKeySource = await services.secrets.source("openai_api_key");
    appendSystemMessage(
      `Preflight OpenAI key source: ${openAiKeySource}.`,
      openAiKeySource === "missing" ? "#f87171" : "#4ade80",
    );

    try {
      const run = await startRun(
        buildRunRequest(trimmed, runSettings),
        {
          localRunner: services.localRunner,
          qarmaApi: services.qarmaApi,
        },
        {
          onStep: appendStepMessage,
        },
      );

      activeRunStatus = normalizeRunStatus(run.status);
      appendRunSummary(run);
    } catch (error) {
      activeRunStatus = "failed";
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

  function handleInitialSubmit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    activateWorkspace();
    void submitRun(trimmed);
    landingInput.value = "";
  }

  async function handleWorkspaceSubmit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    if (trimmed === "/clear") {
      stopElapsedTimer();
      activeRunStatus = "idle";
      activeRunStartedAt = null;
      transcriptMessages.length = 0;
      for (const child of transcript.getChildren()) {
        transcript.remove(child.id);
      }
      input.value = "";
      input.focus();
      syncStatusbar();
      renderer.root.requestRender();
      return;
    }

    if (trimmed === "/rerun") {
      if (!lastSubmittedPrompt) {
        appendSystemMessage("No previous prompt to rerun.", "#f87171");
      } else if (runInFlight) {
        appendSystemMessage("A run is already in progress.", "#f87171");
      } else {
        void submitRun(lastSubmittedPrompt);
      }
      input.value = "";
      input.focus();
      return;
    }

    if (trimmed === "/cancel") {
      if (!runInFlight) {
        appendSystemMessage("No run is currently in progress.", "#f87171");
      } else {
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
      input.value = "";
      input.focus();
      return;
    }

    const commandResult = await applySettingsCommand(trimmed, runSettings, services.secrets);
    if (commandResult.kind === "message") {
      appendSystemMessage(commandResult.content, commandResult.accent);
      syncStatusbar();
      input.value = "";
      input.focus();
      return;
    }

    void submitRun(trimmed);
    input.value = "";
    input.focus();
  }

  const stopSidebarAnimation = () => {
    if (sidebarAnimation) {
      clearInterval(sidebarAnimation);
      sidebarAnimation = null;
    }
  };

  const animateSidebar = (targetWidth: number) => {
    stopSidebarAnimation();

    if (sidebarWidth === targetWidth) {
      sidebar.width = sidebarWidth;
      sidebar.visible = targetWidth > 0;
      shell.app.requestRender();
      return;
    }

    sidebar.visible = true;

    sidebarAnimation = setInterval(() => {
      if (sidebarWidth === targetWidth) {
        stopSidebarAnimation();
        if (targetWidth === 0) {
          sidebar.visible = false;
        }
        return;
      }

      const direction = sidebarWidth < targetWidth ? 1 : -1;
      sidebarWidth += direction * 4;

      if ((direction > 0 && sidebarWidth > targetWidth) || (direction < 0 && sidebarWidth < targetWidth)) {
        sidebarWidth = targetWidth;
      }

      sidebar.width = sidebarWidth;
      shell.app.requestRender();
    }, 16);
  };

  const syncSidebar = () => {
    animateSidebar(sidebarOpen ? 24 : 0);
  };

  renderer.keyInput.on("keypress", (key) => {
    if (!workspaceActive && key.ctrl && key.name === "g") {
      activateWorkspace();
      return;
    }

    if (!workspaceActive) {
      return;
    }

    if (key.name === "tab") {
      sidebarOpen = !sidebarOpen;
      syncSidebar();
      return;
    }

    if (key.ctrl && key.name === "y") {
      copyLatestTranscriptMessage();
    }
  });

  shell.app.add(sidebar);
  shell.main.add(transcriptPanel);
  shell.main.add(composer);
  shell.main.add(statusbar.statusbar);
  shell.app.add(shell.main);
  shell.app.visible = false;
  sidebar.width = 0;
  sidebar.visible = false;
  renderer.root.add(landingView);
  renderer.root.add(shell.app);
  landingInput.focus();
  syncStatusbar();
}
