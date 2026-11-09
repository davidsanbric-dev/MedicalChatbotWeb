import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { streamChat } from '@/lib/api';

export type ChatStage = 'rephrasing' | 'retrieving' | 'found' | 'answering';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'streaming' | 'done' | 'error';
  stage?: ChatStage;
  passages?: number;
}

interface ChatState {
  sessionId: string;
  messages: ChatMessage[];
  isStreaming: boolean;
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
        messages: [],
        isStreaming: false,

        send: async (query) => {
          const text = query.trim();
          if (!text || get().isStreaming) return;

          controller = new AbortController();
          set((s) => ({
            isStreaming: true,
            messages: [
              ...s.messages,
              { id: newId(), role: 'user', content: text, status: 'done' },
              { id: newId(), role: 'assistant', content: '', status: 'streaming', stage: 'rephrasing' },
            ],
          }));

          let streamed = '';
          try {
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
            patchLast(
              aborted
                ? { content: streamed || 'Stopped.', status: streamed ? 'done' : 'error' }
                : { content: 'Could not reach the chatbot API. Please try again in a moment.', status: 'error' },
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
      partialize: (s) => ({ sessionId: s.sessionId, messages: s.messages.filter((m) => m.status !== 'streaming') }),
    },
  ),
);
