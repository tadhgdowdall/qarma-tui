export type UiState = {
  focusedPane: "sidebar" | "transcript" | "composer";
};

export const initialUiState: UiState = {
  focusedPane: "composer",
};
