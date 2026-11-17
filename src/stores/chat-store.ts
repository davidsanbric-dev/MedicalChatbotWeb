import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ApiError, streamAgent, streamChat } from '@/lib/api';

export type ChatStage = 'rephrasing' | 'retrieving' | 'found' | 'answering' | 'deciding';

/** 'rag': the fixed four-step pipeline (/chat). 'agent': the model picks its own tools (/agent). */
export type ChatMode = 'rag' | 'agent';

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'streaming' | 'done' | 'error';
  stage?: ChatStage;
  passages?: number;
  /** Agent answers only: the tools it called, the handoff it opened, the conditions it cited. */
  tools?: ToolCall[];
  handoff?: { id: string; urgency: string };
  sources?: string[];
}

interface ChatState {
  sessionId: string;
  mode: ChatMode;
  messages: ChatMessage[];
  isStreaming: boolean;
  setMode: (mode: ChatMode) => void;
  send: (query: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

// Not persisted: an in-flight request cannot survive a reload anyway.
let controller: AbortController | null = null;

const newId = () => crypto.randomUUID();

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => {
      const patchLast = (patch: Partial<ChatMessage>) =>
        set((s) => {
          const messages = s.messages.slice();
          const last = messages[messages.length - 1];
          if (last?.role === 'assistant') messages[messages.length - 1] = { ...last, ...patch };
          return { messages };
        });

      return {
        // The API keys conversational memory by session_id, so a new id = a new conversation.
        sessionId: newId(),
        mode: 'rag',
        messages: [],
        isStreaming: false,

        // Both modes keep the same conversation memory, so switching mid-chat keeps the context.
        setMode: (mode) => set({ mode }),

        send: async (query) => {
          const text = query.trim();
          if (!text || get().isStreaming) return;

          controller = new AbortController();
          const agent = get().mode === 'agent';
          set((s) => ({
            isStreaming: true,
            messages: [
              ...s.messages,
              { id: newId(), role: 'user', content: text, status: 'done' },
              agent
                ? { id: newId(), role: 'assistant', content: '', status: 'streaming', stage: 'deciding', tools: [] }
                : { id: newId(), role: 'assistant', content: '', status: 'streaming', stage: 'rephrasing' },
            ],
          }));

          let streamed = '';
          try {
            if (agent) {
              await runAgent(text, get().sessionId, controller.signal, patchLast, () => get().messages.at(-1));
              return;
            }
            for await (const event of streamChat(text, get().sessionId, controller.signal)) {
              if ('token' in event) {
                streamed += event.token;
                patchLast({ content: streamed, stage: 'answering' });
              } else if ('answer' in event) {
                patchLast({ content: event.answer || streamed, status: 'done' });
              } else if ('error' in event) {
                patchLast({ content: event.error, status: 'error' });
              } else if (event.stage === 'found') {
                patchLast({ stage: 'found', passages: event.count });
              } else {
                patchLast({ stage: event.stage });
              }
            }
            const last = get().messages.at(-1);
            if (last?.status === 'streaming') {
              patchLast({ content: streamed || 'No answer was received.', status: streamed ? 'done' : 'error' });
            }
          } catch (err) {
            const aborted = err instanceof DOMException && err.name === 'AbortError';
            // A rate limit is not an outage: show the API's own explanation.
            const limited = err instanceof ApiError && err.status === 429;
            patchLast(
              aborted
                ? { content: streamed || 'Stopped.', status: streamed ? 'done' : 'error' }
                : {
                    content: limited
                      ? err.message
                      : 'Could not reach the chatbot API. Please try again in a moment.',
                    status: 'error',
                  },
            );
          } finally {
            controller = null;
            set({ isStreaming: false });
          }
        },

        stop: () => controller?.abort(),

        reset: () => {
          controller?.abort();
          set({ sessionId: newId(), messages: [], isStreaming: false });
        },
      };
    },
    {
      name: 'medical-rag-chat',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        sessionId: s.sessionId,
        mode: s.mode,
        messages: s.messages.filter((m) => m.status !== 'streaming'),
      }),
    },
  ),
);

/** One agent turn: tool calls arrive as they happen, then the whole answer at once. */
async function runAgent(
  text: string,
  sessionId: string,
  signal: AbortSignal,
  patchLast: (patch: Partial<ChatMessage>) => void,
  last: () => ChatMessage | undefined,
) {
  for await (const event of streamAgent(text, sessionId, signal)) {
    if ('tool' in event) {
      patchLast({ tools: [...(last()?.tools ?? []), { name: event.tool, args: event.args }] });
    } else if ('handoff' in event) {
      patchLast({ handoff: event.handoff });
    } else if ('answer' in event) {
      patchLast({ content: event.answer, sources: event.sources, status: 'done' });
    } else {
      patchLast({ content: event.error, status: 'error' });
    }
  }
  if (last()?.status === 'streaming') patchLast({ content: 'No answer was received.', status: 'error' });
}
