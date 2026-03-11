import type { CliRenderer, InputRenderable, TextareaRenderable } from "@opentui/core";
import { createPickerModal } from "../layout/picker-modal";
import {
  searchCommandSuggestions,
  searchModelOptions,
  searchTargetOptions,
} from "../commands/settings";
import type { RunSettings } from "../state/run-settings";

type HomeKey = {
  name?: string;
  ctrl?: boolean;
};

type HomeModalControllerOptions = {
  renderer: CliRenderer;
  runSettings: RunSettings;
  workspaceInput: TextareaRenderable;
  landingInput: TextareaRenderable;
  appendSystemMessage: (content: string, accent?: string) => void;
  syncStatusbar: () => void;
  handleWorkspaceSubmit: (value: string) => Promise<void>;
  isWorkspaceActive: () => boolean;
};

export function createHomeModalController(
  options: HomeModalControllerOptions,
) {
  const commandPalette = createPickerModal(
    options.renderer,
    "Commands",
    "Search commands...",
  );
  const modelPicker = createPickerModal(
    options.renderer,
    "Models",
    "Search models...",
  );
  const targetPicker = createPickerModal(
    options.renderer,
    "Target",
    "Search targets or type a domain...",
  );

  let modalSelectionIndex = 0;
  let activeModal: "commands" | "models" | "targets" | null = null;

  function currentCommandPaletteItems() {
    return searchCommandSuggestions(commandPalette.search.value || "");
  }

  function currentModelPickerItems() {
    return searchModelOptions(modelPicker.search.value || "");
  }

  function currentTargetPickerItems() {
    return searchTargetOptions(
      targetPicker.search.value || "",
      options.runSettings.targetUrl,
    );
  }

  function syncModal() {
    const commandItems = currentCommandPaletteItems();
    const modelItems = currentModelPickerItems();
    const targetItems = currentTargetPickerItems();
    const activeItems =
      activeModal === "commands"
        ? commandItems
        : activeModal === "models"
          ? modelItems
          : activeModal === "targets"
            ? targetItems
            : [];

    if (modalSelectionIndex >= activeItems.length) {
      modalSelectionIndex = 0;
    }

    commandPalette.overlay.visible = activeModal === "commands";
    modelPicker.overlay.visible = activeModal === "models";
    targetPicker.overlay.visible = activeModal === "targets";

    commandPalette.update(
      activeModal === "commands"
        ? commandItems.map((item) => ({
            id: item.command,
            label: item.insertValue,
            summary: item.summary,
          }))
        : [],
      modalSelectionIndex,
    );

    modelPicker.update(
      activeModal === "models"
        ? modelItems.map((item) => ({
            id: item.id,
            label: item.label,
            summary: item.summary,
          }))
        : [],
      modalSelectionIndex,
    );

    targetPicker.update(
      activeModal === "targets"
        ? targetItems.map((item) => ({
            id: item.id,
            label: item.label,
            summary: item.summary,
          }))
        : [],
      modalSelectionIndex,
    );

    options.renderer.root.requestRender();
  }

  function focusActiveInput() {
    if (options.isWorkspaceActive()) {
      options.workspaceInput.focus();
      return;
    }
    options.landingInput.focus();
  }

  function closeModal() {
    activeModal = null;
    modalSelectionIndex = 0;
    commandPalette.search.clear();
    modelPicker.search.clear();
    targetPicker.search.clear();
    syncModal();
    focusActiveInput();
  }

  function openCommandPalette() {
    activeModal = "commands";
    modalSelectionIndex = 0;
    commandPalette.search.clear();
    syncModal();
    commandPalette.search.focus();
  }

  function openModelPicker() {
    activeModal = "models";
    modelPicker.search.clear();
    const items = currentModelPickerItems();
    const activeIndex = items.findIndex(
      (item) => item.id === options.runSettings.modelId,
    );
    modalSelectionIndex = activeIndex >= 0 ? activeIndex : 0;
    syncModal();
    modelPicker.search.focus();
  }

  function openTargetPicker() {
    activeModal = "targets";
    targetPicker.search.clear();
    const items = currentTargetPickerItems();
    const activeIndex = items.findIndex(
      (item) => item.url === options.runSettings.targetUrl,
    );
    modalSelectionIndex = activeIndex >= 0 ? activeIndex : 0;
    syncModal();
    targetPicker.search.focus();
  }

  async function selectActiveModalItem() {
    if (activeModal === "commands") {
      const selected = currentCommandPaletteItems()[modalSelectionIndex];
      if (!selected) {
        return;
      }

      closeModal();
      if (selected.requiresArgument) {
        options.workspaceInput.setText(selected.insertValue);
        options.workspaceInput.focus();
        return;
      }
      await options.handleWorkspaceSubmit(selected.insertValue);
      return;
    }

    if (activeModal === "models") {
      const selected = currentModelPickerItems()[modalSelectionIndex];
      if (!selected) {
        return;
      }

      options.runSettings.modelId = selected.id;
      options.appendSystemMessage(`Model updated to ${selected.id}.`, "#4ade80");
      options.syncStatusbar();
      closeModal();
      return;
    }

    if (activeModal === "targets") {
      const selected = currentTargetPickerItems()[modalSelectionIndex];
      if (!selected) {
        return;
      }

      options.runSettings.targetUrl = selected.url;
      options.runSettings.targetPreset = selected.preset;
      options.appendSystemMessage(
        `Target updated to ${selected.url}.`,
        "#4ade80",
      );
      options.syncStatusbar();
      closeModal();
    }
  }

  function handleKeypress(key: HomeKey) {
    if (key.ctrl && key.name === "p") {
      openCommandPalette();
      return true;
    }

    if (!activeModal) {
      return false;
    }

    if (key.name === "escape") {
      closeModal();
      return true;
    }

    const items =
      activeModal === "commands"
        ? currentCommandPaletteItems()
        : activeModal === "models"
          ? currentModelPickerItems()
          : currentTargetPickerItems();

    if (key.name === "down" && items.length > 0) {
      modalSelectionIndex = (modalSelectionIndex + 1) % items.length;
      syncModal();
      return true;
    }

    if (key.name === "up" && items.length > 0) {
      modalSelectionIndex = (modalSelectionIndex - 1 + items.length) % items.length;
      syncModal();
      return true;
    }

    if ((key.name === "return" || key.name === "linefeed") && items.length > 0) {
      void selectActiveModalItem();
      return true;
    }

    return false;
  }

  commandPalette.search.on("input", () => {
    modalSelectionIndex = 0;
    syncModal();
  });
  modelPicker.search.on("input", () => {
    modalSelectionIndex = 0;
    syncModal();
  });
  targetPicker.search.on("input", () => {
    modalSelectionIndex = 0;
    syncModal();
  });

  return {
    overlays: [
      commandPalette.overlay,
      modelPicker.overlay,
      targetPicker.overlay,
    ],
    openModelPicker,
    openTargetPicker,
    handleKeypress,
  };
}
