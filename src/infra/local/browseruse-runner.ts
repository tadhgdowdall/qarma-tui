export type LocalRunInput = {
  prompt: string;
  targetUrl: string;
};

export async function runWithBrowserUse(_input: LocalRunInput) {
  return {
    status: "queued" as const,
  };
}
