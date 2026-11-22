import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { clsx } from 'clsx';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Headset,
  ListChecks,
  Loader2,
  MessageCircle,
  ShieldAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { lazy, useState, type ReactNode } from 'react';
import { LayerPage, Showcase } from '@/components/layout/layer-page';
import type { StoryStep } from '@/components/story/story-scene';
import { Card, Code, CodeBlock, Finding, StepFlow } from '@/components/ui/primitives';
import { AgentCases } from '@/components/viz/agent-cases';
import { AnswerModes } from '@/components/viz/answer-modes';
import { BarList } from '@/components/viz/bar-list';
import { QuestionGrid } from '@/components/viz/question-grid';
import { RerankChart } from '@/components/viz/rerank-chart';
import { ThresholdPicker } from '@/components/viz/threshold-picker';
import { MAX_ROUNDS, SCENARIOS, type Scenario } from '@/data/agent-scenarios';
import { evaluation } from '@/data/evaluation';
import { LAYERS } from '@/data/layers';
import { snapshot } from '@/data/snapshot';
import { fetchHealth, fetchTopSymptoms } from '@/lib/api';

const ApiScene = lazy(() => import('@/components/three/scenes/api-scene'));
const s = snapshot;
const m = s.meta;
const AMBER = LAYERS[3].color;
const ev = evaluation.retrieval;
const agentEval = evaluation.agent;
const agentPassed = agentEval.cases.filter((c) => c.passed).length;
const pct = (value: number) => `${Math.round(value * 100)}%`;
const count = (outcome: string) => ev.outcomes.filter((o) => o.outcome === outcome).length;

/** What each message in the scene's picker leads to. */
const ACTION_ICON: Record<Scenario['action'], LucideIcon> = {
  search_knowledge_base: BookOpen,
  list_conditions: ListChecks,
  request_human_handoff: Headset,
  reply: MessageCircle,
  guardrail: ShieldAlert,
};

const STEPS: StoryStep[] = [
  {
    title: 'Safety check first',
    term: 'guardrail · fixed rules, before any AI',
    caption: 'Every message meets fixed rules first. Emergency words, like chest pain, alert the care team at once instead of waiting for the AI.',
  },
  {
    title: 'The AI picks a tool',
    term: 'LLM tool calling',
    caption: 'The AI reads the conversation and the descriptions of its three tools, then decides: search, list its topics, call a person, or simply reply.',
  },
  {
    title: 'The tool does the work',
    term: 'tool call → tool result',
    caption: `The chosen tool runs. A search finds the ${m.topK} closest passages and double-checks each one; only those above the bar count.`,
  },
  {
    title: 'Read it, then answer',
    term: `agent loop · ≤ ${MAX_ROUNDS} AI rounds`,
    caption: `The result goes back to the AI, which can use another tool or answer, naming its sources. After ${MAX_ROUNDS} rounds it stops.`,
  },
];

/** The classic chat's fixed pipeline; its middle two steps are also the agent's search tool. */
const CLASSIC_STEPS = [
  {
    title: 'Understand the question',
    tag: 'query rephrasing (LLM)',
    body: 'The question is rewritten as a clear, complete search, using the conversation so far.',
  },
  {
    title: 'Find similar passages',
    tag: `vector search · top ${m.topK}`,
    body: `The question is turned into numbers too, and the ${m.topK} passages closest in meaning are pulled out.`,
  },
  {
    title: 'Double-check each one',
    tag: 're-ranking · cross-encoder',
    body: 'A second, more careful model scores every passage against the question. Only those above the bar go on.',
  },
  {
    title: 'Write the answer',
    tag: `LLM · top ${m.topN} · streamed`,
    body: `An AI writes the answer using at most ${m.topN} passages, and it is sent back word by word.`,
  },
];

const ENDPOINTS = [
  { method: 'POST', path: '/agent/stream', out: 'SSE: tool calls, handoff, conditions, final answer + sources (422 invalid, 429 rate limited)' },
  { method: 'POST', path: '/agent/', out: '{ response, sources, tools, handoff, conditions }' },
  { method: 'POST', path: '/chat/stream', out: 'SSE: stages, tokens, final answer' },
  { method: 'POST', path: '/chat/', out: '{ response }' },
  { method: 'GET', path: '/insights/condition-names', out: 'string[]' },
  { method: 'GET', path: '/insights/top-symptoms?top_n=10', out: '[symptom, conditions][]' },
  { method: 'GET', path: '/health', out: '{ status: "healthy" }' },
];

export function ApiPage() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const scenario = SCENARIOS[scenarioIndex];
  const health = useQuery({ queryKey: ['health'], queryFn: ({ signal }) => fetchHealth(signal), staleTime: 30_000 });
  const symptoms = useQuery({ queryKey: ['top-symptoms', 8], queryFn: ({ signal }) => fetchTopSymptoms(8, signal) });

  return (
    <LayerPage
      id="api"
      steps={STEPS}
      scene={(step) => <ApiScene step={step} scenario={scenario} />}
      toolbar={
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          <span className="shrink-0 text-xs text-muted">Pick a message:</span>
          {SCENARIOS.map((sc, i) => {
            const Icon = ACTION_ICON[sc.action];
            return (
              <Chip key={sc.message} active={i === scenarioIndex} onClick={() => setScenarioIndex(i)}>
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {sc.message}
              </Chip>
            );
          })}
        </div>
      }
      numbers={[
        { value: 3, label: 'tools the AI can choose from' },
        { value: `≤ ${MAX_ROUNDS}`, label: 'AI rounds per message, then it stops' },
        { value: `${agentPassed}/${agentEval.cases.length}`, label: 'test messages handled the right way' },
      ]}
      details={[
        {
          id: 'agent',
          label: 'Agent loop',
          source: 'app/services/agent.py',
          content: (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="space-y-3">
                <p className="text-sm text-ink-2">
                  A tool-calling loop on the same OpenRouter → Gemini setup as the chat. The model gets the conversation
                  and three tool schemas; each tool call is validated, run in a worker thread and returned as a tool
                  message, and the model is asked again. At most {MAX_ROUNDS} model calls per turn. Tested with a scripted
                  model in <Code>tests/test_agent.py</Code>.
                </p>
                <Finding tone="good" title="Emergencies don’t wait for the model">
                  English and Spanish emergency wording opens an <Code>emergency</Code> handoff and returns fixed safety
                  advice before the LLM is called, so a model mistake can’t miss it (<Code>app/domain/triage.py</Code>).
                </Finding>
                <Finding tone="good" title="Bad tool calls don’t end the turn">
                  Arguments are checked by each tool’s schema (urgency must be routine, urgent or emergency); a failing
                  tool returns an error message the model can react to.
                </Finding>
                <Finding tone="info" title="Retrieval is one of its tools">
                  <Code>search_knowledge_base</Code> runs the classic pipeline’s search and double-check, and returns
                  numbered passages labelled with their condition, so the answer can name its sources.
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
data: {"handoff": {"id": "0319fbe8-…", "reference": "0319fbe8",
       "urgency": "routine", "reason": "…",
       "opened_at": "2026-11-21T15:04:05+00:00"}}
data: {"answer": "A member of our care team will follow up…",
       "sources": []}

# what can you help with? (the full list arrives as data)
data: {"tool": "list_conditions", "args": {}}
data: {"conditions": ["Acid reflux & GERD", "Acne", …]}
data: {"answer": "I can help with 76 conditions. Ask me
       about any of them.", "sources": []}`}
              />
            </div>
          ),
        },
        {
          id: 'classic',
          label: 'Classic RAG',
          source: 'app/services/chat.py',
          content: (
            <div className="space-y-4">
              <p className="max-w-3xl text-sm text-ink-2">
                The chat’s Classic mode makes no decisions: every question takes the same four steps and two LLM calls,
                and the answer streams token by token. Steps 2 and 3 are also the agent’s{' '}
                <Code>search_knowledge_base</Code> tool (<Code>RetrievalService.search()</Code>).
              </p>
              <StepFlow accent={AMBER} steps={CLASSIC_STEPS} />
            </div>
          ),
        },
        {
          id: 'rerank',
          label: 'Re-rank scores',
          source: 'app/services/retrieval.py',
          content: <RerankScores />,
        },
        {
          id: 'endpoints',
          label: 'Endpoints & streaming',
          source: 'app/routes/agent.py',
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
                  {ev.misses.map((miss) => `“${miss.question}” (${miss.expected})`).join(', ')}
                  {ev.leaks.length > 0 && `; and “${ev.leaks.map((l) => l.question).join('”, “')}” gets passages it shouldn’t`}.
                </Finding>
              </div>
              <p className="text-sm text-ink-2">
                The agent has its own test: {agentEval.cases.length} messages in English and Spanish, each labelled with the
                action expected. On <Code>{agentEval.model}</Code> it chose correctly in {agentPassed} of{' '}
                {agentEval.cases.length} (<Code>evals/agent.py</Code>).
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
                neighbours (try the football question under Re-rank scores). In the evaluation, {count('silent')} of{' '}
                {ev.offTopic} unanswerable questions get no passages.
              </Finding>
              <Finding tone="good" title="Provider failover">
                <Code>ChatOpenAI(...).with_fallbacks([gemini])</Code> sends a failed OpenRouter call straight to Gemini,
                without first retrying a busy free model. The agent binds its tools to both providers.
              </Finding>
              <Finding tone="info" title="What a turn costs">
                Classic mode always makes two LLM calls: rephrasing makes follow-ups work and turns questions into
                English, at the cost of a round-trip. The agent makes one per round: usually two, one for a greeting,
                none for an emergency.
              </Finding>
              <Finding tone="fixed" title="Nobody waits for someone else">
                LLM calls are awaited, and the search and the agent’s tools run in worker threads, so one visitor’s
                question never pauses another’s stream.
              </Finding>
              <Finding tone="fixed" title="Chat and agent are rate limited">
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

# the agent
curl -N -X POST localhost:8001/agent/stream \\
  -H 'Content-Type: application/json' \\
  -d '{"query":"I want to talk to a doctor","session_id":"demo"}'

# the classic pipeline: same body, different path
curl -N -X POST localhost:8001/chat/stream \\
  -H 'Content-Type: application/json' \\
  -d '{"query":"How is acne treated?","session_id":"demo"}'

make eval-agent       # the agent's tool choices (uses the LLM)
make eval-retrieval   # retrieval quality, no LLM needed`}
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
        title={`Tested with ${agentEval.cases.length} messages`}
        lead={`Each test message is labelled with what the agent should do. It did the right thing for ${agentPassed} of ${agentEval.cases.length}, in English and Spanish.`}
      >
        <AgentCases cases={agentEval.cases} color={AMBER} />
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Run on {agentEval.date} with <span className="font-mono">{agentEval.model}</span> through OpenRouter
          {agentEval.fallback && <>, with {agentEval.fallback} as the backup</>}. Times depend on the free tier.
        </p>
      </Showcase>

      <Showcase
        title={`Its search, tested with ${ev.onTopic + ev.offTopic} questions`}
        lead={`The search tool gets ${ev.onTopic} questions people might type, one for each condition, plus ${ev.offTopic} it shouldn’t be able to answer. Each square shows what came back.`}
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
        title="Two ways to answer"
        lead="The chat can switch between the agent and the fixed pipeline it grew from. Both share the conversation’s memory."
      >
        <AnswerModes color={AMBER} />
      </Showcase>
    </LayerPage>
  );
}

const STAGE_LABELS = {
  vector: `Vector search, top ${ev.k}`,
  reranked: `+ re-rank, top ${ev.k}`,
  pipeline: `+ threshold ${ev.threshold} (production)`,
} as const;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
        active ? 'border-transparent text-page' : 'border-line text-ink-2 hover:text-ink',
      )}
      style={active ? { background: AMBER } : undefined}
    >
      {children}
    </button>
  );
}

/** The search's double-check for a sample question, with its own question picker. */
function RerankScores() {
  const [traceIndex, setTraceIndex] = useState(0);
  const trace = s.retrievalTraces[traceIndex];
  return (
    <>
      <div className="mb-4 flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
        <span className="shrink-0 text-xs text-muted">Question:</span>
        {s.retrievalTraces.map((t, i) => (
          <Chip key={t.question} active={i === traceIndex} onClick={() => setTraceIndex(i)}>
            {t.question}
          </Chip>
        ))}
      </div>
      <p className="mb-3 text-sm text-ink-2">
        “{trace.question}”: the {m.topK} cosine-search candidates ordered by cross-encoder score ({m.rerankModel},
        threshold {m.relevanceThreshold}). The agent’s search tool and the classic chat both run this for every question.
      </p>
      <RerankChart candidates={trace.candidates} />
    </>
  );
}
