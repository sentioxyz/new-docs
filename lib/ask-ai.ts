import { getCloudflareContext } from '@opennextjs/cloudflare';
import { basePath } from './base-path.mjs';
import { refuseAgentAnswers } from './agent-questions';

/*
 * Ask AI proxy to an AgentConnect agent (AI SDK chat endpoint).
 *
 * The browser only ever talks to /api/chat. This module holds the API key,
 * pins each tab to one conversation (`chatId`), and streams the relay's AI SDK
 * UI-message response back unchanged. The key never reaches the client.
 *
 * Env (server-only; `wrangler secret put` in production, `.env.local` for
 * `next dev`): AGENTCONNECT_API_URL (relay base, no path), AGENTCONNECT_API_KEY,
 * AGENTCONNECT_AGENT_ID.
 */

// Header the client sends so each browser tab keeps its own conversation
export const TAB_HEADER = 'x-ask-ai-tab';
const TAB_ID = /^[a-z0-9]{8,32}$/;
const CONVERSATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COOKIE_PREFIX = 'ask_ai_conv_';

class AskAIError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function config() {
  const { AGENTCONNECT_API_URL, AGENTCONNECT_API_KEY, AGENTCONNECT_AGENT_ID } = process.env;
  if (!AGENTCONNECT_API_URL || !AGENTCONNECT_API_KEY || !AGENTCONNECT_AGENT_ID) {
    throw new AskAIError(503, 'Ask AI is not configured on this site.');
  }
  return {
    endpoint: `${AGENTCONNECT_API_URL.replace(/\/$/, '')}/ai-sdk/agents/${encodeURIComponent(AGENTCONNECT_AGENT_ID)}/chat`,
    key: AGENTCONNECT_API_KEY,
  };
}

// Messages shown in the panel; upstream bodies are never forwarded verbatim
function describe(status: number, reason?: string): string {
  switch (status) {
    case 404:
      return 'This conversation has expired. Clear the chat to start a new one.';
    case 409:
      return reason === 'turn_ended'
        ? 'The assistant stopped waiting on this question. Please ask again.'
        : 'The assistant is still answering the previous question. Please wait a moment.';
    case 413:
      return 'Your message is too long. Please shorten it and try again.';
    case 429:
      return 'Too many questions in a short time. Please wait a minute and try again.';
    case 503:
      return 'The docs assistant is offline right now. Please try again later.';
    default:
      return 'The docs assistant could not answer right now. Please try again.';
  }
}

function errorResponse(status: number, message = describe(status)) {
  // Collapse internal failures (bad key, unknown agent, ...) into a 502
  const out = [400, 404, 409, 413, 429, 503].includes(status) ? status : 502;
  return new Response(message, {
    status: out,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

type RateLimiter = { limit: (opts: { key: string }) => Promise<{ success: boolean }> };

/*
 * AgentConnect only caps concurrent turns per conversation, so limit per
 * visitor here. Uses the ASK_AI_RATE_LIMITER Workers binding when deployed;
 * `next dev` has no binding and skips the check.
 */
async function withinRateLimit(req: Request): Promise<boolean> {
  let limiter: RateLimiter | undefined;
  try {
    const { env } = getCloudflareContext();
    limiter = (env as unknown as { ASK_AI_RATE_LIMITER?: RateLimiter }).ASK_AI_RATE_LIMITER;
  } catch {
    return true;
  }
  if (!limiter) return true;
  const visitor = req.headers.get('cf-connecting-ip') ?? 'unknown';
  const { success } = await limiter.limit({ key: visitor });
  return success;
}

type Part = { type: string; text?: string; data?: unknown };
type Message = { role: string; parts?: Part[] };

/*
 * A request whose last message is the assistant's answers the agent's
 * questions and tool approvals, continuing its turn. Ask AI refuses them all
 * (lib/agent-questions.ts); enforce that here too, since the client is not
 * trusted and this key must never grant an approval or bother the editors.
 */
function refuseAnswers(messages: Message[]): Message[] {
  const last = messages.at(-1);
  if (last?.role !== 'assistant' || !last.parts) return messages;
  return [...messages.slice(0, -1), { ...last, parts: refuseAgentAnswers(last.parts) }];
}

/*
 * The panel sends the reader's location as a `data-client` part. Fold it into
 * the question as text so the agent knows which page the reader is on.
 */
function foldClientContext(messages: Message[]): Message[] {
  return messages.map((message) => {
    if (message.role !== 'user' || !message.parts) return message;
    const parts = message.parts.flatMap<Part>((part) => {
      if (part.type !== 'data-client') return [part];
      const location = (part.data as { location?: unknown } | undefined)?.location;
      if (typeof location !== 'string') return [];
      let path: string;
      try {
        path = new URL(location).pathname;
      } catch {
        return [];
      }
      return [{ type: 'text', text: `Reader is on ${path.slice(0, 512)}\n\n` }];
    });
    return { ...message, parts };
  });
}

function readCookie(req: Request, name: string) {
  for (const pair of req.headers.get('cookie')?.split(/;\s*/) ?? []) {
    const eq = pair.indexOf('=');
    if (eq > 0 && pair.slice(0, eq) === name) return pair.slice(eq + 1);
  }
}

export async function handleChat(req: Request): Promise<Response> {
  if (!(await withinRateLimit(req))) return errorResponse(429);

  let body: { messages?: Message[] } & Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Invalid request.');
  }
  if (!Array.isArray(body.messages)) return errorResponse(400, 'Invalid request.');

  // One conversation per tab, bound by an HttpOnly cookie; the client's chat `id` is not trusted
  const tab = req.headers.get(TAB_HEADER) ?? '';
  const cookieName = COOKIE_PREFIX + (TAB_ID.test(tab) ? tab : 'default');
  const bound = readCookie(req, cookieName);
  const userTurns = body.messages.filter((m) => m.role === 'user').length;
  const answering = body.messages.at(-1)?.role === 'assistant';

  // A lone first question (new chat, or after Clear Chat) starts a new conversation;
  // answers to the agent's questions continue the turn, even on the first question
  const conversationId =
    (userTurns > 1 || answering) && bound && CONVERSATION_ID.test(bound)
      ? bound
      : crypto.randomUUID();

  let cfg: ReturnType<typeof config>;
  try {
    cfg = config();
  } catch (err) {
    if (err instanceof AskAIError) {
      console.error(`[ask-ai] ${err.message}`);
      return errorResponse(err.status, err.message);
    }
    return errorResponse(502);
  }

  let upstream: Response;
  try {
    upstream = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${cfg.key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        ...body,
        id: conversationId,
        messages: refuseAnswers(foldClientContext(body.messages)),
      }),
      signal: req.signal,
    });
  } catch (err) {
    console.error('[ask-ai] relay error', err);
    return errorResponse(502);
  }

  const cookie = `${cookieName}=${conversationId}; Path=${basePath}/api/chat; HttpOnly; Secure; SameSite=Lax`;
  if (!upstream.ok) {
    const reason = await upstream
      .json()
      .then((b: { reason?: unknown }) => (typeof b?.reason === 'string' ? b.reason : undefined))
      .catch(() => undefined);
    console.error(`[ask-ai] relay responded ${upstream.status}${reason ? ` (${reason})` : ''}`);
    const res = errorResponse(upstream.status, describe(upstream.status, reason));
    res.headers.append('set-cookie', cookie);
    return res;
  }

  const headers = new Headers({ 'cache-control': 'no-store' });
  for (const name of ['content-type', 'x-vercel-ai-ui-message-stream']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.append('set-cookie', cookie);
  const stream = upstream.body?.pipeThrough(new TextDecoderStream()).pipeThrough(hideAgentWork());
  return new Response(stream?.pipeThrough(new TextEncoderStream()), {
    status: upstream.status,
    headers,
  });
}

// Agent internals (sandbox notices, reasoning, its shell/search steps) never reach the reader
const HIDDEN_CHUNKS = new Set([
  'data-notice',
  'data-tool',
  'reasoning-start',
  'reasoning-delta',
  'reasoning-end',
]);

/*
 * Filters the relay's SSE UI-message stream: drops HIDDEN_CHUNKS and replaces
 * error texts (which carry runtime internals) with a generic message. The
 * agent's questions and approvals (dynamic tool chunks) pass through, since
 * the panel must refuse them.
 */
function hideAgentWork(): TransformStream<string, string> {
  let buffer = '';
  const filter = (event: string): string | undefined => {
    const data = event.startsWith('data: ') ? event.slice(6) : undefined;
    // Keep comments (keepalives) and the [DONE] terminator
    if (data === undefined || data === '[DONE]') return event;
    let chunk: { type?: unknown; errorText?: unknown };
    try {
      chunk = JSON.parse(data);
    } catch {
      return event;
    }
    if (typeof chunk.type !== 'string' || HIDDEN_CHUNKS.has(chunk.type)) return undefined;
    if (chunk.type === 'error') {
      console.error(`[ask-ai] agent error: ${String(chunk.errorText)}`);
      return `data: ${JSON.stringify({ type: 'error', errorText: describe(502) })}`;
    }
    return event;
  };
  return new TransformStream({
    transform(text, controller) {
      buffer += text;
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const event of events) {
        const kept = filter(event);
        if (kept !== undefined) controller.enqueue(`${kept}\n\n`);
      }
    },
    flush(controller) {
      const kept = buffer && filter(buffer);
      if (kept) controller.enqueue(kept);
    },
  });
}
