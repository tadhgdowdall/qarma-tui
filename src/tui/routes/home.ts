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
import { getEnvDiagnostic } from "../../infra/storage/env-diagnostics";

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
  const transcriptMessages: Message[] = [];

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
    } as const;
    transcriptMessages.push(message);
    addTranscriptMessage(renderer, transcript, message);
  }

  function appendStepMessage(step: TestRunStep) {
    const message = {
      speaker: "Qarma",
      accent: step.status === "failed" ? "#f87171" : "#f97316",
      content: `${step.title}${step.observation ? ` — ${step.observation}` : ""}`,
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
    } as const;
    transcriptMessages.push(message);
    addTranscriptMessage(renderer, transcript, message);
  }

  function appendSystemMessage(content: string, accent = "#a3a3a3") {
    const message = {
      speaker: "System",
      accent,
      content,
    } as const;
    transcriptMessages.push(message);
    addTranscriptMessage(renderer, transcript, message);
  }

  function syncStatusbar() {
    statusbar.update(runSettings);
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

    appendPromptExchange(trimmed);
    runInFlight = true;

    appendSystemMessage(`Starting ${formatRunSettings(runSettings)} run.`);
    const openAiEnv = getEnvDiagnostic("OPENAI_API_KEY");
    appendSystemMessage(
      `Preflight env ${openAiEnv.envName}: ${openAiEnv.available ? "available" : "missing"}.`,
      openAiEnv.available ? "#4ade80" : "#f87171",
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

      appendRunSummary(run);
    } catch (error) {
      appendSystemMessage(
        `Run failed to start: ${error instanceof Error ? error.message : String(error)}`,
        "#f87171",
      );
    } finally {
      runInFlight = false;
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

  function handleWorkspaceSubmit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    const commandResult = applySettingsCommand(trimmed, runSettings);
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
}
