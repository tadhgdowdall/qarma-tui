export type SendMessageInput = {
  value: string;
};

export function sendMessage(input: SendMessageInput) {
  return input.value.trim();
}
