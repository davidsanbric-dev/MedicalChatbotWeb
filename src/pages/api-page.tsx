import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { ArrowRight, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { lazy, useState } from 'react';
import { LayerPage, Showcase } from '@/components/layout/layer-page';
import type { StoryStep } from '@/components/story/story-scene';
import { Card, Code, CodeBlock, Finding } from '@/components/ui/primitives';
import { AgentFlow } from '@/components/viz/agent-flow';
import { BarList } from '@/components/viz/bar-list';
import { QuestionGrid } from '@/components/viz/question-grid';
import { RerankChart } from '@/components/viz/rerank-chart';
import { ThresholdPicker } from '@/components/viz/threshold-picker';
import { evaluation } from '@/data/evaluation';
import { LAYERS } from '@/data/layers';
import { snapshot } from '@/data/snapshot';
import { fetchHealth, fetchTopSymptoms } from '@/lib/api';
import { useChatStore } from '@/stores/chat-store';

const ApiScene = lazy(() => import('@/components/three/scenes/api-scene'));
const s = snapshot;
const m = s.meta;
const AMBER = LAYERS[3].color;
const ev = evaluation.retrieval;
const agentEval = evaluation.agent;
const pct = (value: number) => `${Math.round(value * 100)}%`;
const count = (outcome: string) => ev.outcomes.filter((o) => o.outcome === outcome).length;

/** The agent evaluation's expected actions, in plain words. */
const AGENT_CASES: { expected: string; label: string }[] = [
  { expected: 'search_knowledge_base', label: 'Health questions → search' },
  { expected: 'list_conditions', label: '“What can you help with?” → list topics' },
  { expected: 'request_human_handoff', label: 'Asks for a person → hand off' },
  { expected: 'none', label: 'Greetings and thanks → just reply' },
  { expected: 'guardrail', label: 'Emergencies → alert the care team' },
];

const STAGE_LABELS = {
  vector: `Vector search, top ${ev.k}`,
  reranked: `+ re-rank, top ${ev.k}`,
  pipeline: `+ threshold ${ev.threshold} (production)`,
} as const;

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
  { method: 'POST', path: '/chat/stream', out: 'SSE: stages, tokens, final answer (422 invalid, 429 rate limited)' },
  { method: 'POST', path: '/chat/', out: '{ response }' },
  { method: 'POST', path: '/agent/stream', out: 'SSE: tool calls, handoff, final answer + sources' },
  { method: 'POST', path: '/agent/', out: '{ response, sources, tools, handoff }' },
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
          source: 'app/services/retrieval.py',
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
          source: 'app/routes/chat.py',
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
          id: 'agent',
          label: 'Agent',
          source: 'app/services/agent.py',
          content: (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="space-y-3">
                <p className="text-sm text-ink-2">
                  A tool-calling loop on the same OpenRouter → Gemini setup: the model gets the conversation and three tool
                  schemas, and each tool call is validated, run in a worker thread and returned as a tool message. At most{' '}
                  4 model calls per turn. Tested with a scripted model in <Code>tests/test_agent.py</Code>.
                </p>
                <Finding tone="good" title="Emergencies don’t wait for the model">
                  English and Spanish emergency wording opens an <Code>emergency</Code> handoff and returns fixed safety
                  advice before the LLM is called, so a model mistake can’t miss it.
                </Finding>
                <Finding tone="good" title="Bad tool calls don’t end the turn">
                  Arguments are checked by each tool’s schema (urgency must be routine, urgent or emergency); a failing
                  tool returns an error message the model can react to.
                </Finding>
                <Finding tone="info" title="A handoff is a ticket">
                  <Code>request_human_handoff</Code> writes a <Code>handoff_requests</Code> row, the stand-in for a CRM or
                  help-desk ticket. In this demo nobody is notified.
                </Finding>
                <Finding tone="info" title="Memory without the tool traffic">
                  Only the visitor’s message and the final answer are saved, in the same history as the classic chat, so
                  switching modes keeps the conversation.
                </Finding>
              </div>
              <CodeBlock
                label="POST /agent/stream · text/event-stream"
                code={`data: {"tool": "search_knowledge_base",
       "args": {"query": "plantar fasciitis treatment"}}
data: {"answer": "Treatment options for plantar fasciitis
       may include…", "sources": ["Plantar fasciitis"]}

# asking for a person
data: {"tool": "request_human_handoff",
       "args": {"reason": "…", "urgency": "routine"}}
data: {"handoff": {"id": "0319fbe8-…", "urgency": "routine"}}
data: {"answer": "A member of our care team will follow up…",
       "sources": []}`}
              />
            </div>
          ),
        },
        {
          id: 'evaluation',
          label: 'Evaluation',
          source: 'evals/retrieval.py',
          content: (
            <div className="space-y-6">
              <p className="max-w-3xl text-sm text-ink-2">
                {ev.onTopic} questions, one per condition, written the way visitors ask, plus {ev.offTopic} the knowledge
                base can’t answer (10 unrelated, 6 medical topics it doesn’t cover). A passage counts as relevant when it
                comes from the question’s condition. Run on {ev.date} against {ev.documents} passages from worker{' '}
                {ev.processor}; no LLM involved, so the numbers are free to reproduce.
              </p>
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Retrieval quality at each stage</caption>
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      {['Stage', 'Precision', 'Recall', 'Hit rate', 'MRR', 'Real questions with nothing', 'Unanswerable kept empty'].map((h) => (
                        <th key={h} className="px-4 py-2 font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(['vector', 'reranked', 'pipeline'] as const).map((stage) => {
                      const st = ev.stages[stage];
                      return (
                        <tr key={stage} className="border-t border-line">
                          <td className="px-4 py-2 text-ink">{STAGE_LABELS[stage]}</td>
                          {[pct(st.precision), pct(st.recall), pct(st.hit_rate), st.mrr.toFixed(2), pct(st.empty_on_topic), pct(st.abstained_off_topic)].map((v, i) => (
                            <td key={i} className="px-4 py-2 text-ink-2 tabular">{v}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Finding tone="fixed" title="The evaluation caught a silent embedding mismatch">
                  On an older local copy, embedded before the worker used the API’s question model, vector search alone
                  found the right condition for 72% of questions and the re-ranker had to rescue it (88%). Re-embedded with
                  the same model as the questions, vector search finds it for {pct(ev.stages.vector.hit_rate)}.
                </Finding>
                <Finding tone="info" title="Why keep the re-ranker?">
                  It hardly changes the order now, but its scores are what the threshold uses to stay silent on questions
                  the knowledge base can’t answer; cosine similarity can’t tell those apart.
                </Finding>
                <Finding tone="good" title={`Threshold ${ev.threshold}, chosen from a sweep`}>
                  Every threshold from −6 to 0 was scored on the same questions (slider above). The one in use answers{' '}
                  {pct(ev.stages.pipeline.hit_rate)} of real questions with the right condition and keeps{' '}
                  {pct(ev.stages.pipeline.abstained_off_topic)} of unanswerable ones empty.
                </Finding>
                <Finding tone="warning" title={`${ev.misses.length + ev.leaks.length} questions still go wrong`}>
                  {ev.misses.map((m) => `“${m.question}” (${m.expected})`).join(', ')}
                  {ev.leaks.length > 0 && `; and “${ev.leaks.map((l) => l.question).join('”, “')}” gets passages it shouldn’t`}.
                </Finding>
              </div>
              <p className="text-sm text-ink-2">
                The agent has its own test: {agentEval.cases.length} messages in English and Spanish, each labelled with the
                action expected. On <Code>{agentEval.model}</Code> it chose correctly in{' '}
                {agentEval.cases.filter((c) => c.passed).length} of {agentEval.cases.length} (<Code>evals/agent.py</Code>).
              </p>
            </div>
          ),
        },
        {
          id: 'notes',
          label: 'Design notes',
          source: 'app/services/chat.py',
          content: (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Finding tone="good" title="Off-topic questions retrieve nothing">
                The threshold turns “no good context” into an explicit state instead of feeding the LLM the least-bad
                neighbours (try the football question). In the evaluation, {count('silent')} of {ev.offTopic} unanswerable
                questions get no passages.
              </Finding>
              <Finding tone="good" title="Provider failover">
                <Code>ChatOpenAI(...).with_fallbacks([gemini])</Code> sends a failed OpenRouter call straight to Gemini,
                without first retrying a busy free model.
              </Finding>
              <Finding tone="info" title="Two LLM calls per turn">
                Rephrasing makes follow-ups work and turns questions into English, at the cost of a round-trip. Stage
                events keep the chat informative meanwhile.
              </Finding>
              <Finding tone="fixed" title="Nobody waits for someone else">
                Both LLM calls are awaited and the search runs in a worker thread, so one visitor’s question never pauses
                another’s stream.
              </Finding>
              <Finding tone="fixed" title="Chat is rate limited">
                Each visitor gets 6 questions a minute and 60 a day, with 500 a day in total; past that the API answers{' '}
                <Code>429</Code> with a <Code>Retry-After</Code>. Questions must be 1–1000 characters. Sign-in is still
                left out of the demo.
              </Finding>
              <Finding tone="fixed" title="Errors stay private">
                When something fails, the visitor gets a plain message. Database and provider details only reach the
                server log.
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
  -d '{"query":"How is acne treated?","session_id":"demo"}'

# the agent: same body, different path
curl -N -X POST localhost:8001/agent/stream \\
  -H 'Content-Type: application/json' \\
  -d '{"query":"I want to talk to a doctor","session_id":"demo"}'

make eval-retrieval   # retrieval quality, no LLM needed
make eval-agent       # the agent's tool choices (uses the LLM)`}
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

      <Showcase
        title={`Tested with ${ev.onTopic + ev.offTopic} questions`}
        lead={`We ask the search ${ev.onTopic} questions people might type, one for each condition, plus ${ev.offTopic} it shouldn’t be able to answer, and check what comes back.`}
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card className="p-5">
            <QuestionGrid rows={ev.outcomes} />
          </Card>
          <Card className="p-5">
            <ThresholdPicker rows={ev.sweep} current={ev.threshold} color={AMBER} />
            <p className="mt-5 text-xs leading-relaxed text-muted">
              The double-check scores every passage, and this bar decides which ones reach the AI. Slide it to see the
              trade-off; the setting in use was picked from these results.
            </p>
          </Card>
        </div>
      </Showcase>

      <Showcase
        title="It can also act, not just answer"
        lead="In agent mode the AI chooses its own steps: search, list what it covers, or hand the conversation to a person."
      >
        <Card className="p-5">
          <AgentFlow color={AMBER} />
        </Card>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card className="p-5">
            <p className="text-sm text-ink-2">
              Picked the right action for{' '}
              <span className="font-semibold text-ink">
                {agentEval.cases.filter((c) => c.passed).length} of {agentEval.cases.length}
              </span>{' '}
              test messages, in English and Spanish
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {AGENT_CASES.map(({ expected, label }) => {
                const cases = agentEval.cases.filter((c) => c.expected === expected);
                const passed = cases.filter((c) => c.passed).length;
                return (
                  <li key={expected} className="flex items-center gap-2 text-sm text-ink-2" title={cases.map((c) => c.message).join('\n')}>
                    {passed === cases.length ? (
                      <CheckCircle2 className="size-4 shrink-0 text-good" aria-label="all passed" />
                    ) : (
                      <XCircle className="size-4 shrink-0 text-critical" aria-label="some failed" />
                    )}
                    {label}
                    <span className="ml-auto text-xs text-muted tabular">
                      {passed}/{cases.length}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card className="flex flex-col justify-between gap-4 p-5">
            <p className="text-sm text-ink-2">Ask it for a doctor, or what it can help with, and watch the steps it takes.</p>
            <Link
              to="/chat"
              onClick={() => useChatStore.getState().setMode('agent')}
              className="inline-flex w-fit items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-page hover:bg-white"
            >
              Try the agent <ArrowRight className="size-4" />
            </Link>
          </Card>
        </div>
      </Showcase>
    </LayerPage>
  );
}
