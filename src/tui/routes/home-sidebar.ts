import type { CliRenderer } from "@opentui/core";
import { createSidebar } from "../layout/sidebar";
import type { RecentRunSummary } from "../../shared/types";

type HomeKey = {
  name?: string;
};

type HomeSidebarControllerOptions = {
  renderer: CliRenderer;
  requestRender: () => void;
};

export function createHomeSidebarController(
  options: HomeSidebarControllerOptions,
) {
  const recentRuns: RecentRunSummary[] = [];
  const sidebarState = createSidebar(options.renderer, recentRuns);
  const sidebar = sidebarState.sidebar;

  let sidebarOpen = false;
  let sidebarWidth = 0;
  let sidebarAnimation: ReturnType<typeof setInterval> | null = null;
  let sidebarSelectionIndex = 0;

  function truncatePrompt(prompt: string) {
    return prompt.replace(/\s+/g, " ").trim().slice(0, 44);
  }

  function formatRelativeTime(timestamp: number) {
    const deltaSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (deltaSeconds < 5) return "just now";
    if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
    const minutes = Math.floor(deltaSeconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  function syncRecentRuns() {
    recentRuns.forEach((run, index) => {
      run.active = sidebarOpen && index === sidebarSelectionIndex;
      run.subtitle = formatRelativeTime(run.timestamp);
    });
    sidebarState.update(recentRuns);
  }

  function stopSidebarAnimation() {
    if (sidebarAnimation) {
      clearInterval(sidebarAnimation);
      sidebarAnimation = null;
    }
  }

  function animateSidebar(targetWidth: number) {
    stopSidebarAnimation();

    if (sidebarWidth === targetWidth) {
      sidebar.width = sidebarWidth;
      sidebar.visible = targetWidth > 0;
      options.requestRender();
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
      options.requestRender();
    }, 16);
  }

  function syncSidebar() {
    animateSidebar(sidebarOpen ? 24 : 0);
    syncRecentRuns();
  }

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
    syncSidebar();
  }

  function addRecentRun(prompt: string, targetUrl: string) {
    const entry: RecentRunSummary = {
      id: `run-${Date.now()}`,
      timestamp: Date.now(),
      prompt: truncatePrompt(prompt),
      target: targetUrl.replace(/^https?:\/\//, ""),
      status: "running",
      subtitle: "just now",
      active: false,
    };
    recentRuns.unshift(entry);
    if (recentRuns.length > 12) {
      recentRuns.length = 12;
    }
    sidebarSelectionIndex = 0;
    syncRecentRuns();
    return entry;
  }

  function updateRecentRun(entry: RecentRunSummary, status: RecentRunSummary["status"]) {
    entry.status = status;
    syncRecentRuns();
  }

  function handleKeypress(
    key: HomeKey,
    commandMenuOpen: boolean,
    runInFlight: boolean,
    rerunPrompt: (prompt: string) => void,
    focusInput: () => void,
  ) {
    if (key.name === "tab") {
      toggleSidebar();
      return true;
    }

    if (!sidebarOpen || commandMenuOpen) {
      return false;
    }

    if (key.name === "down" && recentRuns.length > 0) {
      sidebarSelectionIndex = (sidebarSelectionIndex + 1) % recentRuns.length;
      syncRecentRuns();
      return true;
    }

    if (key.name === "up" && recentRuns.length > 0) {
      sidebarSelectionIndex = (sidebarSelectionIndex - 1 + recentRuns.length) % recentRuns.length;
      syncRecentRuns();
      return true;
    }

    if ((key.name === "return" || key.name === "linefeed") && recentRuns.length > 0) {
      const selectedRun = recentRuns[sidebarSelectionIndex];
      if (selectedRun && !runInFlight) {
        rerunPrompt(selectedRun.prompt);
        focusInput();
      }
      return true;
    }

    return false;
  }

  sidebar.width = 0;
  sidebar.visible = false;

  return {
    sidebar,
    addRecentRun,
    updateRecentRun,
    syncSidebar,
    handleKeypress,
  };
}
