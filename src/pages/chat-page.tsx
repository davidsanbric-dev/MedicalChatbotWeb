import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { ArrowUp, Info, Loader2, RotateCcw, Search, Square, Stethoscope, User } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card } from '@/components/ui/primitives';
import { BarList } from '@/components/viz/bar-list';
import { LAYERS } from '@/data/layers';
import { snapshot } from '@/data/snapshot';
import { fetchConditionNames, fetchTopSymptoms } from '@/lib/api';
import { useChatStore, type ChatMessage } from '@/stores/chat-store';

const SUGGESTIONS = [
  'What are the symptoms of asthma?',
  'How is acne treated?',
  'Can an online doctor help with a UTI?',
  'What helps with insomnia?',
];

function stageText(m: ChatMessage) {
  switch (m.stage) {
    case 'rephrasing':
      return 'Understanding your question…';
    case 'retrieving':
      return 'Searching the knowledge base…';
    case 'found':
      return m.passages
        ? `Found ${m.passages} relevant passage${m.passages > 1 ? 's' : ''} — composing the answer…`
        : 'No matching passages — answering with general guidance…';
    default:
      return 'Thinking…';
  }
}

export function ChatPage() {
  const { messages, isStreaming, send, stop, reset } = useChatStore();
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    document.title = 'Chatbot · Medical RAG pipeline';
  }, []);

  // Follow the stream only while the reader is already at the bottom.
  useEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = (text: string) => {
    if (!text.trim() || isStreaming) return;
    stickToBottom.current = true;
    void send(text);
    setDraft('');
  };

  const ask = (text: string) => {
    submit(text);
    inputRef.current?.focus();
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-label="Chat" className="flex h-[calc(100dvh-8.5rem)] min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-line bg-surface">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="grid size-8 place-items-center rounded-lg bg-interface/15">
            <Stethoscope className="size-4 text-interface" />
          </span>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-ink">Medical conditions assistant</h1>
            <p className="truncate text-xs text-muted">
              Answers grounded in {snapshot.conditions.length} condition pages · retrieval + re-ranking + LLM
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            disabled={messages.length === 0 && !isStreaming}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-40"
          >
            <RotateCcw className="size-3.5" /> New chat
          </button>
        </header>

        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          className="flex-1 overflow-y-auto px-4 py-6"
          aria-live="polite"
          aria-busy={isStreaming}
        >
          {messages.length === 0 ? (
            <EmptyState onAsk={ask} />
          ) : (
            <ol className="mx-auto max-w-3xl space-y-6">
              {messages.map((m) => (
                <MessageRow key={m.id} message={m} />
              ))}
            </ol>
          )}
        </div>

        <form
          className="border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft);
          }}
        >
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-line-strong bg-surface-2 p-2 focus-within:border-ink-2">
            <label htmlFor="chat-input" className="sr-only">
              Ask about a medical condition
            </label>
            <textarea
              id="chat-input"
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit(draft);
                }
              }}
              rows={1}
              maxLength={1000}
              placeholder="Ask about a condition, its symptoms or treatment…"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] text-ink placeholder:text-muted focus:outline-none"
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={stop}
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink hover:bg-line-strong"
                aria-label="Stop generating"
              >
                <Square className="size-4 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim()}
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink text-page hover:bg-white disabled:opacity-30"
                aria-label="Send"
              >
                <ArrowUp className="size-4" />
              </button>
            )}
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted">
            Educational demo — not medical advice. Answers come from scraped telehealth pages and an LLM, and can be
            wrong.
          </p>
        </form>
      </section>

      <KnowledgeBase onAsk={ask} />
    </div>
  );
}

function EmptyState({ onAsk }: { onAsk: (q: string) => void }) {
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-interface/15">
        <Stethoscope className="size-6 text-interface" />
      </span>
      <h2 className="mt-4 text-xl font-semibold text-ink">Ask the knowledge base</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Each question is rephrased, embedded, matched against {snapshot.stages.documents.rows} chunks, re-ranked and
        answered with the best passages. Follow-up questions keep the context.
      </p>
      <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onAsk(q)}
            className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-left text-sm text-ink-2 hover:border-line-strong hover:text-ink"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageRow({ message: m }: { message: ChatMessage }) {
  if (m.role === 'user') {
    return (
      <li className="flex justify-end gap-3">
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-surface-3 px-4 py-2.5 text-[15px] whitespace-pre-wrap text-ink">
          {m.content}
        </div>
        <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-surface-3">
          <User className="size-4 text-ink-2" />
          <span className="sr-only">You</span>
        </span>
      </li>
    );
  }

  const waiting = m.status === 'streaming' && !m.content;
  return (
    <li className="flex gap-3">
      <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-interface/15">
        <Stethoscope className="size-4 text-interface" />
        <span className="sr-only">Assistant</span>
      </span>
      <div className="min-w-0 flex-1">
        {(m.status === 'streaming' || m.passages !== undefined) && (
          <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted">
            {m.status === 'streaming' && waiting && <Loader2 className="size-3.5 animate-spin" />}
            {m.status === 'streaming' && waiting
              ? stageText(m)
              : m.passages
                ? `Grounded in ${m.passages} passage${m.passages > 1 ? 's' : ''}`
                : 'No matching passages in the knowledge base'}
          </p>
        )}
        {m.status === 'error' ? (
          <p className="flex items-start gap-2 rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-ink">
            <Info className="mt-0.5 size-4 shrink-0 text-critical" />
            {m.content}
          </p>
        ) : (
          <div className={clsx('prose-chat text-[15px] leading-relaxed text-ink-2', m.status === 'streaming' && m.content && 'caret')}>
            <Markdown remarkPlugins={[remarkGfm]}>{m.content}</Markdown>
          </div>
        )}
      </div>
    </li>
  );
}

function KnowledgeBase({ onAsk }: { onAsk: (q: string) => void }) {
  const [filter, setFilter] = useState('');
  const names = useQuery({ queryKey: ['condition-names'], queryFn: ({ signal }) => fetchConditionNames(signal) });
  const symptoms = useQuery({ queryKey: ['top-symptoms', 5], queryFn: ({ signal }) => fetchTopSymptoms(5, signal) });

  // Fall back to the snapshot so the sidebar is useful even if the API is cold.
  const conditionList = names.data ?? snapshot.conditions.map((c) => c.name);
  const symptomRows = (symptoms.data ?? snapshot.topSymptoms.slice(0, 5)).map(([label, value]) => ({ label, value }));
  const filtered = useMemo(
    () => conditionList.filter((n) => n.toLowerCase().includes(filter.toLowerCase())),
    [conditionList, filter],
  );

  return (
    <aside aria-label="Knowledge base" className="space-y-4 lg:max-h-[calc(100dvh-8.5rem)] lg:overflow-y-auto">
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-ink">Knowledge base</h2>
        <p className="mt-1 text-xs text-muted">
          {conditionList.length} conditions{names.data ? ' · live from the API' : ' · from the snapshot'}. Click one
          to ask about it.
        </p>
        <label className="relative mt-3 block">
          <span className="sr-only">Filter conditions</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            className="w-full rounded-lg border border-line bg-surface-2 py-1.5 pr-3 pl-8 text-sm text-ink placeholder:text-muted focus:border-line-strong focus:outline-none"
          />
        </label>
        <ul className="mt-3 flex max-h-56 flex-wrap gap-1.5 overflow-y-auto lg:max-h-72">
          {filtered.map((n) => (
            <li key={n}>
              <button
                type="button"
                onClick={() => onAsk(`What are the symptoms of ${n} and how is it treated?`)}
                className="rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-ink-2 hover:border-line-strong hover:text-ink"
              >
                {n}
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="text-xs text-muted">No match.</li>}
        </ul>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-ink">Most common symptoms</h2>
        <p className="mt-1 mb-3 text-xs text-muted">Number of conditions listing each one</p>
        <BarList caption="Top five symptoms by number of conditions" color={LAYERS[3].color} rows={symptomRows} />
      </Card>

      <Card className="p-4 text-sm text-ink-2">
        <h2 className="text-sm font-semibold text-ink">How an answer is made</h2>
        <ol className="mt-2 space-y-1.5">
          {LAYERS.slice(0, 4).map((l) => (
            <li key={l.id} className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: l.color }} />
              <Link to={l.path} className="hover:text-ink hover:underline">
                {l.stage}: {l.name}
              </Link>
            </li>
          ))}
        </ol>
      </Card>
    </aside>
  );
}
