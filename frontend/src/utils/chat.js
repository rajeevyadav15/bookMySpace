export const MAX_API_MESSAGES = 20;

// Backend rule: max 20 messages and the first one must be from the user
export function trimForApi(messages, max = MAX_API_MESSAGES) {
  const recent = messages.slice(-max);
  const firstUser = recent.findIndex((m) => m.role === "user");
  return firstUser === -1 ? [] : recent.slice(firstUser);
}