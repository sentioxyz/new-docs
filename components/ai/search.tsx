'use client';
import {
  type ComponentProps,
  createContext,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  use,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { MessageCircleIcon, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { basePath } from '@/lib/base-path.mjs';
import { buttonVariants } from '@/components/ui/button';
import { useChat, type UseChatHelpers } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from 'ai';
import { ASK_TOOL, DISMISSED, openAgentQuestions } from '@/lib/agent-questions';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';
import { Shimmer } from '@/components/ai-elements/shimmer';

export type ChatUIMessage = UIMessage<
  never,
  {
    // Sent by the panel; folded into the question by lib/ask-ai.ts
    client: {
      location: string;
    };
    // Streamed by the agent: status notices while the sandbox starts
    notice: {
      text: string;
    };
  }
>;

// Must match TAB_HEADER in lib/ask-ai.ts
const TAB_HEADER = 'x-ask-ai-tab';
const StorageKeyTab = '__ai_search_tab';

/*
 * Per-tab id (sessionStorage survives reloads but not new tabs). The server
 * uses it to pick the HttpOnly cookie that binds this tab's conversation.
 */
function getTabId() {
  try {
    let id = sessionStorage.getItem(StorageKeyTab);
    if (!id) {
      id = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
      sessionStorage.setItem(StorageKeyTab, id);
    }
    return id;
  } catch {
    return 'default';
  }
}

const Context = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
  chat: UseChatHelpers<ChatUIMessage>;
} | null>(null);

export function AISearchPanelHeader({ className, ...props }: ComponentProps<'div'>) {
  const { setOpen } = useAISearchContext();

  return (
    <div className={cn('flex items-center gap-2 ps-2', className)} {...props}>
      <p className="flex-1 text-sm font-medium">Ask AI</p>
      <button
        aria-label="Close"
        tabIndex={-1}
        className={cn(
          buttonVariants({ size: 'icon-xs', variant: 'ghost' }),
          'text-muted-foreground rounded-full',
        )}
        onClick={() => setOpen(false)}
      >
        <X />
      </button>
    </div>
  );
}

function AISearchInputActions() {
  const { messages, status, setMessages, regenerate } = useChatContext();
  const isBusy = status === 'streaming' || status === 'submitted';

  if (messages.length === 0) return null;

  return (
    <>
      {!isBusy && messages.at(-1)?.role === 'assistant' && (
        <button
          type="button"
          className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), 'text-muted-foreground')}
          onClick={() => regenerate()}
        >
          <RefreshCw />
          Retry
        </button>
      )}
      <button
        type="button"
        className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), 'text-muted-foreground')}
        onClick={() => setMessages([])}
      >
        Clear Chat
      </button>
    </>
  );
}

function AISearchInput() {
  const { status, sendMessage, stop } = useChatContext();
  const isBusy = status === 'streaming' || status === 'submitted';

  return (
    <PromptInput
      onSubmit={({ text }) => {
        // While answering, the submit button doubles as Stop
        if (isBusy) return void stop();
        const message = text.trim();
        if (message.length === 0) return;

        void sendMessage({
          role: 'user',
          parts: [
            // Folded into the question server-side as "Reader is on …"
            { type: 'data-client', data: { location: location.href } },
            { type: 'text', text: message },
          ],
        });
      }}
    >
      <PromptInputTextarea
        autoFocus
        placeholder={isBusy ? 'AI is answering...' : 'Ask a question'}
      />
      <PromptInputFooter>
        <PromptInputTools>
          <AISearchInputActions />
        </PromptInputTools>
        <PromptInputSubmit status={status} />
      </PromptInputFooter>
    </PromptInput>
  );
}

export function AISearch({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const chat = useChat<ChatUIMessage>({
    id: 'search',
    transport: new DefaultChatTransport({
      // Our own proxy (lib/ask-ai.ts), which holds the AgentConnect key; fetch is not basePath-aware
      api: `${basePath}/api/chat`,
      headers: () => ({ [TAB_HEADER]: getTabId() }),
    }),
    // The refusals below go back at once, so the agent's turn carries on without them
    sendAutomaticallyWhen: (options) =>
      lastAssistantMessageIsCompleteWithApprovalResponses(options) ||
      lastAssistantMessageIsCompleteWithToolCalls(options),
  });

  // Nobody here answers the agent: dismiss its questions and refuse its tool approvals
  const { messages, status, addToolOutput, addToolApprovalResponse } = chat;
  useEffect(() => {
    const last = messages.at(-1);
    if (status !== 'ready' || last?.role !== 'assistant') return;
    const { dismiss, refuse } = openAgentQuestions(last.parts);
    for (const toolCallId of dismiss)
      void addToolOutput({
        state: 'output-error',
        tool: ASK_TOOL as never,
        toolCallId,
        errorText: DISMISSED,
      });
    for (const id of refuse) void addToolApprovalResponse({ id, approved: false });
  }, [messages, status, addToolOutput, addToolApprovalResponse]);

  return (
    <Context value={useMemo(() => ({ chat, open, setOpen }), [chat, open])}>{children}</Context>
  );
}

export function AISearchTrigger({
  position = 'default',
  className,
  ...props
}: ComponentProps<'button'> & { position?: 'default' | 'float' }) {
  const { open, setOpen } = useAISearchContext();

  return (
    <button
      data-state={open ? 'open' : 'closed'}
      className={cn(
        position === 'float' && [
          'fixed bottom-4 gap-3 w-24 inset-e-[calc(--spacing(4)+var(--removed-body-scroll-bar-size,0px))] shadow-lg z-20 transition-[translate,opacity]',
          open && 'translate-y-10 opacity-0',
        ],
        className,
      )}
      onClick={() => setOpen(!open)}
      {...props}
    >
      {props.children}
    </button>
  );
}

const StorageKeyWidth = '__ai_search_width';
const MIN_WIDTH = 320;
const maxWidth = () => Math.max(MIN_WIDTH, Math.min(900, window.innerWidth * 0.6));
const clampWidth = (width: number) => Math.round(Math.min(maxWidth(), Math.max(MIN_WIDTH, width)));

/* Desktop panel width, dragged from the panel's left edge and remembered per browser */
function usePanelWidth() {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(StorageKeyWidth));
      if (saved) setWidth(clampWidth(saved));
    } catch {
      // storage unavailable: keep the default width
    }
  }, []);

  const onResizeStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    const panel = e.currentTarget.parentElement;
    if (!panel) return;
    e.preventDefault();
    const handle = e.currentTarget;
    const startX = e.clientX;
    const startWidth = panel.getBoundingClientRect().width;
    let latest = startWidth;
    handle.setPointerCapture(e.pointerId);
    document.body.style.userSelect = 'none';

    const onMove = (ev: PointerEvent) => {
      latest = clampWidth(startWidth + startX - ev.clientX);
      setWidth(latest);
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      document.body.style.userSelect = '';
      try {
        localStorage.setItem(StorageKeyWidth, String(latest));
      } catch {
        // ignore
      }
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  };

  const onResizeReset = () => {
    setWidth(null);
    try {
      localStorage.removeItem(StorageKeyWidth);
    } catch {
      // ignore
    }
  };

  return { width, onResizeStart, onResizeReset };
}

export function AISearchPanel() {
  const { open, setOpen } = useAISearchContext();
  const [actualOpen, setActualOpen] = useState(open);
  const { width, onResizeStart, onResizeReset } = usePanelWidth();
  useHotKey();

  if (open && !actualOpen) setActualOpen(open);

  return (
    <>
      <style>
        {`
        @keyframes ask-ai-open {
          from {
            translate: 100% 0;
          }
          to {
            translate: 0 0;
          }
        }
        @keyframes ask-ai-close {
          from {
            width: var(--ai-chat-width);
          }
          to {
            width: 0px;
          }
        }`}
      </style>
      {actualOpen && (
        <div
          className={cn(
            'fixed inset-0 z-30 backdrop-blur-xs bg-fd-overlay lg:hidden',
            open ? 'animate-fd-fade-in' : 'animate-fd-fade-out',
          )}
          onClick={() => setOpen(false)}
          onAnimationEnd={() => {
            if (!open) flushSync(() => setActualOpen(false));
          }}
        />
      )}
      {actualOpen && (
        <div
          id="nd-ai-panel"
          className={cn(
            // Opaque surface: the theme's --card is translucent and would show the TOC underneath
            'overflow-hidden z-30 bg-fd-background max-lg:bg-fd-popover text-fd-foreground [--ai-chat-width:400px] 2xl:[--ai-chat-width:460px]',
            'max-lg:fixed max-lg:inset-x-2 max-lg:inset-y-4 max-lg:border max-lg:rounded-2xl max-lg:shadow-xl',
            'lg:sticky lg:top-(--fd-docs-row-1) lg:h-[calc(var(--fd-docs-height)-var(--fd-docs-row-1))] lg:border-s lg:ms-auto lg:in-[#nd-docs-layout]:[grid-area:toc] lg:in-[#nd-notebook-layout]:row-span-full lg:in-[#nd-notebook-layout]:col-start-5',
            open
              ? 'animate-fd-dialog-in lg:animate-[ask-ai-open_200ms]'
              : 'animate-fd-dialog-out lg:animate-[ask-ai-close_200ms]',
          )}
          style={width ? ({ '--ai-chat-width': `${width}px` } as CSSProperties) : undefined}
          onAnimationEnd={() => {
            if (!open) flushSync(() => setActualOpen(false));
          }}
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize Ask AI panel"
            title="Drag to resize, double-click to reset"
            className="absolute inset-y-0 start-0 z-10 hidden w-1.5 -translate-x-1/2 cursor-col-resize touch-none transition-colors hover:bg-(--s-accent-ring) lg:block"
            onPointerDown={onResizeStart}
            onDoubleClick={onResizeReset}
          />
          <div className="flex flex-col size-full p-2 lg:p-3 lg:w-(--ai-chat-width)">
            <AISearchPanelHeader />
            <AISearchPanelList />
            <AISearchInput />
            <p className="pt-1.5 text-center text-[11px] text-muted-foreground">
              AI can be inaccurate, please verify the answers.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function AISearchPanelList() {
  const { messages, status, error } = useChatContext();
  const visible = messages.filter((msg) => msg.role !== 'system');
  const last = visible.at(-1);
  const busy = status === 'submitted' || status === 'streaming';
  // Until the first reply text arrives, show the agent's latest status notice (sandbox start, ...)
  const waiting =
    busy && (last?.role === 'user' || !last?.parts.some((part) => part.type === 'text'));
  const notice =
    last?.role === 'assistant'
      ? last.parts.findLast(
          (part): part is Extract<typeof part, { type: 'data-notice' }> =>
            part.type === 'data-notice',
        )?.data.text
      : undefined;

  return (
    <Conversation className="min-h-0">
      <ConversationContent className="gap-4 px-1 py-4">
        {visible.length === 0 ? (
          <ConversationEmptyState
            icon={<MessageCircleIcon className="size-6" />}
            title="Ask about Sentio"
            description="Start a new chat below."
          />
        ) : (
          visible.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent>
                {message.parts.map((part, i) =>
                  part.type === 'text' ? (
                    <MessageResponse key={i}>{part.text}</MessageResponse>
                  ) : null,
                )}
              </MessageContent>
            </Message>
          ))
        )}
        {waiting && (
          <Shimmer className="text-sm">{notice?.replace(/^\W+/, '') || 'Thinking...'}</Shimmer>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            {error.message}
          </div>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}

export function useHotKey() {
  const { open, setOpen } = useAISearchContext();

  const onKeyPress = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      setOpen(false);
      e.preventDefault();
    }

    if (e.key === '/' && (e.metaKey || e.ctrlKey) && !open) {
      setOpen(true);
      e.preventDefault();
    }
  });

  useEffect(() => {
    window.addEventListener('keydown', onKeyPress);
    return () => window.removeEventListener('keydown', onKeyPress);
  }, []);
}

export function useAISearchContext() {
  return use(Context)!;
}

function useChatContext() {
  return use(Context)!.chat;
}
