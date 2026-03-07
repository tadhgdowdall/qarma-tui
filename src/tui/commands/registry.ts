export type CommandHandler = () => void;

export type CommandRegistry = Record<string, CommandHandler>;

export const commandRegistry: CommandRegistry = {};
