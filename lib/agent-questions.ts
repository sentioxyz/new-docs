/*
 * The agent chat API hands a turn's questions and tool approvals to the caller
 * as AI SDK dynamic tool calls: `agentconnect_ask` (answered with a tool
 * output) and `agentconnect_approval` (answered with an approval response).
 * Nobody answers the docs agent from Ask AI, so every question is dismissed
 * and every approval refused. A refusal never reaches the agent's editors.
 *
 * Shared by the panel (answers them) and the proxy (enforces the refusal).
 */

export const ASK_TOOL = 'agentconnect_ask';
export const APPROVAL_TOOL = 'agentconnect_approval';
export const DISMISSED = 'unanswered';

type ToolPart = {
  type?: unknown;
  toolName?: unknown;
  state?: unknown;
  toolCallId?: unknown;
  approval?: { id?: unknown; approved?: unknown; reason?: unknown };
};

/** The open questions and approvals in a message's parts */
export function openAgentQuestions(parts: readonly unknown[]): {
  dismiss: string[];
  refuse: string[];
} {
  const dismiss: string[] = [];
  const refuse: string[] = [];
  for (const part of parts) {
    const p = part as ToolPart;
    if (p.type !== 'dynamic-tool') continue;
    if (p.toolName === ASK_TOOL && p.state === 'input-available' && typeof p.toolCallId === 'string')
      dismiss.push(p.toolCallId);
    if (
      p.toolName === APPROVAL_TOOL &&
      p.state === 'approval-requested' &&
      typeof p.approval?.id === 'string'
    )
      refuse.push(p.approval.id);
  }
  return { dismiss, refuse };
}

/**
 * Rewrites any answer in the parts to a dismissal or refusal, so a forged
 * request can neither grant an approval nor answer a question. Everything
 * else passes through unchanged.
 */
export function refuseAgentAnswers<T>(parts: readonly T[]): T[] {
  return parts.map((part) => {
    const p = part as ToolPart & Record<string, unknown>;
    if (p.type !== 'dynamic-tool') return part;
    if (p.toolName === APPROVAL_TOOL && p.state === 'approval-responded' && p.approval) {
      return { ...p, approval: { id: p.approval.id, approved: false } } as T;
    }
    if (p.toolName === ASK_TOOL && (p.state === 'output-available' || p.state === 'output-error')) {
      const { output: _output, ...rest } = p;
      return { ...rest, state: 'output-error', errorText: DISMISSED } as T;
    }
    return part;
  });
}
