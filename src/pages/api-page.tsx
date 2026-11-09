import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { ArrowRight, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { lazy, useState } from 'react';
import { LayerPage, Showcase } from '@/components/layout/layer-page';
import type { StoryStep } from '@/components/story/story-scene';
import { Card, Code, CodeBlock, Finding } from '@/components/ui/primitives';
import { BarList } from '@/components/viz/bar-list';
import { RerankChart } from '@/components/viz/rerank-chart';
import { LAYERS } from '@/data/layers';
import { snapshot } from '@/data/snapshot';
import { fetchHealth, fetchTopSymptoms } from '@/lib/api';

const ApiScene = lazy(() => import('@/components/three/scenes/api-scene'));
const s = snapshot;
const m = s.meta;
const AMBER = LAYERS[3].color;

const STEPS: StoryStep[] = [
  {
    title: 'Understand the question',
    term: 'query rephrasing (LLM)',
    caption: 'The question is rewritten as a clear, complete search, using the conversation so far.',
  },
  {
    title: 'Find similar passages',
    term: `vector search · top ${m.topK}`,
    caption: `The question is turned into numbers too, and the ${m.topK} passages closest in meaning are pulled out.`,
  },
  {
    title: 'Double-check each one',
    term: 're-ranking · cross-encoder',
    caption: 'A second, more careful model scores every passage against the question. Only those above the bar go on.',
  },
  {
    title: 'Write the answer',
    term: `LLM · top ${m.topN} · streamed`,
    caption: `An AI writes the answer using at most ${m.topN} passages, and it is sent back word by word.`,
  },
];

const ENDPOINTS = [
  { method: 'POST', path: '/chat/stream', out: 'SSE: stages, tokens, final answer (429 when rate limited)' },
  { method: 'POST', path: '/chat/', out: '{ response }' },
  { method: 'GET', path: '/insights/condition-names', out: 'string[]' },
  { method: 'GET', path: '/insights/top-symptoms?top_n=10', out: '[symptom, conditions][]' },
  { method: 'GET', path: '/health', out: '{ status: "healthy" }' },
];

export function ApiPage() {
  const [traceIndex, setTraceIndex] = useState(0);
  const trace = s.retrievalTraces[traceIndex];
  const health = useQuery({ queryKey: ['health'], queryFn: ({ signal }) => fetchHealth(signal), staleTime: 30_000 });
  const symptoms = useQuery({ queryKey: ['top-symptoms', 8], queryFn: ({ signal }) => fetchTopSymptoms(8, signal) });

  return (
    <LayerPage
      id="api"
      steps={STEPS}
      scene={(step) => <ApiScene step={step} trace={trace} />}
      toolbar={
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          <span className="shrink-0 text-xs text-muted">Pick a question:</span>
          {s.retrievalTraces.map((t, i) => (
            <button
              key={t.question}
              type="button"
              aria-pressed={i === traceIndex}
              onClick={() => setTraceIndex(i)}
              className={clsx(
                'shrink-0 rounded-full border px-3 py-1 text-sm transition-colors',
                i === traceIndex ? 'border-transparent text-page' : 'border-line text-ink-2 hover:text-ink',
              )}
              style={i === traceIndex ? { background: AMBER } : undefined}
            >
              {t.question}
            </button>
          ))}
        </div>
      }
      numbers={[
        { value: m.topK, label: 'closest passages checked per question' },
        { value: `≤ ${m.topN}`, label: 'passages behind each answer' },
        { value: '2', label: 'AI providers, one as a backup' },
      ]}
      details={[
        {
          id: 'rerank',
          label: 'Re-rank scores',
          content: (
            <>
              <p className="mb-3 text-sm text-ink-2">
                “{trace.question}”: the {m.topK} cosine-search candidates ordered by cross-encoder score ({m.rerankModel},
                threshold {m.relevanceThreshold}). Change the question above the scene to compare.
              </p>
              <RerankChart candidates={trace.candidates} />
            </>
          ),
        },
        {
          id: 'endpoints',
          label: 'Endpoints & streaming',
          content: (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">API endpoints</caption>
                  <tbody>
                    {ENDPOINTS.map((e) => (
                      <tr key={e.path} className="border-t border-line first:border-0">
                        <td className="px-4 py-2 font-mono text-[12.5px] whitespace-nowrap">
                          <span className={e.method === 'POST' ? 'text-api' : 'text-database'}>{e.method}</span>{' '}
                          <span className="text-ink">{e.path}</span>
                        </td>
                        <td className="px-4 py-2 text-ink-2">{e.out}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <CodeBlock
                label="POST /chat/stream · text/event-stream"
                code={`data: {"stage": "rephrasing"}
data: {"stage": "retrieving"}
data: {"stage": "found", "count": 5}
data: {"token": "Acne is usually"}
…
data: {"answer": "Acne is usually treated with…"}`}
              />
            </div>
          ),
        },
        {
          id: 'notes',
          label: 'Design notes',
          content: (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Finding tone="good" title="Off-topic questions retrieve nothing">
                The threshold turns “no good context” into an explicit state instead of feeding the LLM the least-bad
                neighbours (try the football question).
              </Finding>
              <Finding tone="good" title="Provider failover">
                <Code>ChatOpenAI(...).with_fallbacks([gemini])</Code> retries a failed OpenRouter call on Gemini.
              </Finding>
              <Finding tone="info" title="Two LLM calls per turn">
                Rephrasing makes follow-ups work and turns questions into English, but adds a round-trip. Both calls are
                awaited, so one visitor’s wait never stalls another’s; stage events keep the UI informative meanwhile.
              </Finding>
              <Finding tone="fixed" title="Chat is rate limited">
                Each visitor gets 6 questions a minute and 60 a day, with 500 a day in total; past that the API answers{' '}
                <Code>429</Code> with a <Code>Retry-After</Code>. Sign-in is still left out of the demo.
              </Finding>
            </div>
          ),
        },
        {
          id: 'run',
          label: 'Run it',
          content: (
            <CodeBlock
              label="shell"
              code={`cp .env.example .env   # OPENROUTER_API_KEY / GEMINI_API_KEY
docker compose up -d --build   # Postgres + pgvector :5433, API :8001

curl -N -X POST localhost:8001/chat/stream \\
  -H 'Content-Type: application/json' \\
  -d '{"query":"How is acne treated?","session_id":"demo"}'`}
            />
          ),
        },
      ]}
    >
      <Showcase title="Live from the running service" lead="Fetched from the API right now, through this website.">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Card className="flex flex-col justify-between gap-4 p-5">
            <div>
              <p className="text-sm text-ink-2">Service status</p>
              <p className="mt-1 text-2xl font-semibold text-ink">
                {health.isPending ? (
                  <span className="inline-flex items-center gap-2 text-ink-2">
                    <Loader2 className="size-5 animate-spin" /> Checking
                  </span>
                ) : health.data?.status === 'healthy' ? (
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="size-6 text-good" /> Online
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <XCircle className="size-6 text-critical" /> Unreachable
                  </span>
                )}
              </p>
            </div>
            <Link
              to="/chat"
              className="inline-flex w-fit items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-page hover:bg-white"
            >
              Ask your own question <ArrowRight className="size-4" />
            </Link>
          </Card>
          <Card className="p-5">
            <p className="mb-4 text-sm text-ink-2">Most common symptoms across all conditions</p>
            {symptoms.data ? (
              <BarList
                caption="Number of conditions listing each symptom, live"
                color={AMBER}
                unit="conditions"
                rows={symptoms.data.map(([label, value]) => ({ label, value }))}
              />
            ) : symptoms.isError ? (
              <BarList
                caption="Number of conditions listing each symptom, from the snapshot"
                color={AMBER}
                unit="conditions"
                rows={s.topSymptoms.slice(0, 8).map(([label, value]) => ({ label, value }))}
              />
            ) : (
              <p className="text-sm text-muted">Loading…</p>
            )}
          </Card>
        </div>
      </Showcase>
    </LayerPage>
  );
}
