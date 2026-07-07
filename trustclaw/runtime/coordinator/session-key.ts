/** OpenClaw session keys use `agent:<agentId>:<conversationId>`; bare ids need agent scope for pack binding. */
export function resolveCoordinatorSessionKey(params: {
  sessionKey: string;
  openclawAgentId?: string;
}): string {
  const key = params.sessionKey.trim();
  if (!key) {
    return key;
  }
  if (key.startsWith("agent:")) {
    return key;
  }
  const agentId = params.openclawAgentId?.trim();
  if (agentId) {
    return `agent:${agentId}:${key}`;
  }
  return key;
}
