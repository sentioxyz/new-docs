import { getCloudflareContext } from '@opennextjs/cloudflare';

/*
 * Ask AI proxy to an AgentConnect agent (Agent chat API).
 *
 * The browser only ever talks to /api/chat. This module holds the
 * `agent:chat` key, exchanges it for a short-lived webchat token, and streams
 * the relay's AI SDK UI-message response back unchanged. Neither the key nor
 * the token ever reaches the client.
 *
 * Env (server-only; `wrangler secret put` in production, `.env.local` for
 * `next dev`): AGENTCONNECT_API_URL, AGENTCONNECT_API_KEY, AGENTCONNECT_ORG_ID,
 * AGENTCONNECT_AGENT_ID.
 */

// Header the client sends so each browser tab keeps its own conversation
export const TAB_HEADER = 'x-ask-ai-tab';
const TAB_ID = /^[a-z0-9]{8,32}$/;
const CONVERSATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COOKIE_PREFIX = 'ask_ai_conv_';

type Minted = {
  token: string;
  relayUrl: string;
  conversationId: string;
  expiresAt: string;
};

class AskAIError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// Tokens live 5 minutes; reuse one per conversation until 30s before expiry
const tokens = new Map<string, Minted>();
const EXPIRY_MARGIN_MS = 30_000;

function isFresh(minted: Minted) {
  return Date.parse(minted.expiresAt) - EXPIRY_MARGIN_MS > Date.now();
}

function config() {
  const { AGENTCONNECT_API_URL, AGENTCONNECT_API_KEY, AGENTCONNECT_ORG_ID, AGENTCONNECT_AGENT_ID } =
    process.env;
  if (
    !AGENTCONNECT_API_URL ||
    !AGENTCONNECT_API_KEY ||
    !AGENTCONNECT_ORG_ID ||
    !AGENTCONNECT_AGENT_ID
  ) {
    throw new AskAIError(503, 'Ask AI is not configured on this site.');
  }
  return {
    api: AGENTCONNECT_API_URL.replace(/\/$/, ''),
    key: AGENTCONNECT_API_KEY,
    orgId: AGENTCONNECT_ORG_ID,
    agentId: AGENTCONNECT_AGENT_ID,
  };
}

async function mint(conversationId?: string): Promise<Minted> {
  const cached = conversationId ? tokens.get(conversationId) : undefined;
  if (cached && isFresh(cached)) return cached;

  const { api, key, orgId, agentId } = config();
  const res = await fetch(
    `${api}/orgs/${encodeURIComponent(orgId)}/agents/${encodeURIComponent(agentId)}/webchat/token`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(conversationId ? { conversationId } : {}),
    },
  );
  if (!res.ok) throw new AskAIError(res.status, `token mint failed: ${res.status}`);

  const minted = (await res.json()) as Minted;
  for (const [id, entry] of tokens) if (!isFresh(entry)) tokens.delete(id);
  tokens.set(minted.conversationId, minted);
  return minted;
}

// Messages shown in the panel; upstream bodies are never forwarded verbatim
function describe(status: number): string {
  switch (status) {
    case 404:
      return 'This conversation has expired. Clear the chat to start a new one.';
    case 409:
      return 'The assistant is still answering the previous question. Please wait a moment.';
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
  const out = [404, 409, 413, 429, 503].includes(status) ? status : 502;
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

  let minted: Minted;
  try {
    if (userTurns > 1 && bound && CONVERSATION_ID.test(bound)) {
      // An unknown (404) or moved (409) conversation starts over; other failures surface
      minted = await mint(bound).catch((err: unknown) => {
        if (err instanceof AskAIError && (err.status === 404 || err.status === 409)) return mint();
        throw err;
      });
    } else {
      // A lone first question (new chat, or after Clear Chat) starts a new conversation
      minted = await mint();
    }
  } catch (err) {
    if (err instanceof AskAIError) {
      console.error(`[ask-ai] ${err.message}`);
      return errorResponse(err.status, err.status === 503 ? err.message : undefined);
    }
    console.error('[ask-ai] token mint error', err);
    return errorResponse(502);
  }

  const { token, relayUrl, conversationId } = minted;
  let upstream: Response;
  try {
    upstream = await fetch(`${relayUrl.replace(/\/$/, '')}/ai-sdk/chat/${conversationId}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, messages: foldClientContext(body.messages) }),
      signal: req.signal,
    });
  } catch (err) {
    console.error('[ask-ai] relay error', err);
    return errorResponse(502);
  }

  const cookie = `${cookieName}=${conversationId}; Path=/api/chat; HttpOnly; Secure; SameSite=Lax`;
  if (!upstream.ok) {
    console.error(`[ask-ai] relay responded ${upstream.status}`);
    // The token may be stale for this conversation; mint a fresh one next time
    if (upstream.status === 401 || upstream.status === 403) tokens.delete(conversationId);
    const res = errorResponse(upstream.status);
    res.headers.append('set-cookie', cookie);
    return res;
  }

  const headers = new Headers({ 'cache-control': 'no-store' });
  for (const name of ['content-type', 'x-vercel-ai-ui-message-stream']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.append('set-cookie', cookie);
  return new Response(upstream.body, { status: upstream.status, headers });
}
