import { Link } from '@tanstack/react-router';
import { ArrowRight, MessageSquareText } from 'lucide-react';
import { lazy } from 'react';
import { LayerPage, Showcase } from '@/components/layout/layer-page';
import type { StoryStep } from '@/components/story/story-scene';
import { Card, Code, CodeBlock, Finding, Pill, StepFlow } from '@/components/ui/primitives';
import { LAYERS } from '@/data/layers';
import { snapshot } from '@/data/snapshot';

const InterfaceScene = lazy(() => import('@/components/three/scenes/interface-scene'));
const PINK = LAYERS[4].color;

const STEPS: StoryStep[] = [
  { title: 'Ask anything', term: 'chat UI', caption: 'Type a question in plain words. Follow-up questions work too.' },
  {
    title: 'Watch it work',
    term: 'Server-Sent Events · stages',
    caption: 'While you wait, live status shows each step: understanding, searching, passages found.',
  },
  {
    title: 'Read it as it’s written',
    term: 'token streaming',
    caption: 'The answer appears word by word as soon as the AI writes it, instead of all at once at the end.',
  },
  {
    title: 'Take the tour',
    term: 'snapshot → zod → React',
    caption: 'These pages explain each station using real data exported from the pipeline’s own database.',
  },
];

const QUESTIONS = ['What are the symptoms of asthma?', 'How is acne treated?', 'What helps with insomnia?'];

const RESPONSIBILITIES = [
  { concern: 'Routing & code splitting', tool: 'TanStack Router', where: 'one lazy chunk per page' },
  { concern: 'Live API data', tool: 'TanStack Query', where: 'health, condition names, top symptoms' },
  { concern: 'Tables', tool: 'TanStack Table', where: 'sortable, filterable dataset views' },
  { concern: 'Client state', tool: 'Zustand', where: 'chat session (per tab) and the home hover link' },
  { concern: 'Runtime validation', tool: 'Zod', where: 'snapshot, REST responses, every SSE event' },
  { concern: 'Styling', tool: 'Tailwind CSS v4', where: 'one token set for surfaces, ink, stations, status' },
  { concern: '3D scenes', tool: 'react-three-fiber + drei', where: 'one shared stage: camera, lights, labels' },
  { concern: 'Answers', tool: 'react-markdown', where: 'lists and emphasis in LLM answers' },
];

export function InterfacePage() {
  return (
    <LayerPage
      id="interface"
      steps={STEPS}
      scene={(step) => <InterfaceScene step={step} />}
      numbers={[
        { value: '7', label: 'pages: the map, five stations and the chat' },
        { value: 'Live', label: 'answers stream in word by word' },
        { value: '100%', label: 'of the figures come from real pipeline data' },
      ]}
      details={[
        {
          id: 'tools',
          label: 'One tool per job',
          content: (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Libraries and what they are responsible for</caption>
                <tbody>
                  {RESPONSIBILITIES.map((r) => (
                    <tr key={r.concern} className="border-t border-line first:border-0">
                      <td className="px-4 py-2 text-ink">{r.concern}</td>
                      <td className="px-4 py-2 font-mono text-[12.5px] whitespace-nowrap text-interface">{r.tool}</td>
                      <td className="px-4 py-2 text-ink-2">{r.where}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ),
        },
        {
          id: 'snapshot',
          label: 'Data snapshot',
          content: (
            <>
              <StepFlow
                accent={PINK}
                steps={[
                  { title: 'Seed', tag: 'load_raw_from_json.py', body: 'The scraper’s JSON output goes into a throwaway pgvector database.' },
                  { title: 'Run the real worker', tag: 'unchanged code', body: 'Processing and embeddings exactly as in production.' },
                  {
                    title: 'Export',
                    tag: 'export_snapshot.py',
                    body: 'SQL aggregates, the audit, a 3-D t-SNE map (questions included) and re-rank traces.',
                  },
                  { title: 'Validate', tag: 'zod', body: 'The app checks the snapshot against a schema on start-up.' },
                ]}
              />
              <p className="mt-4 text-sm text-ink-2">
                Current snapshot: <Code>{snapshot.meta.generatedAt}</Code>, {snapshot.conditions.length} conditions,{' '}
                {snapshot.stages.documents.rows} chunks.
              </p>
            </>
          ),
        },
        {
          id: 'streaming',
          label: 'Streaming',
          content: (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <CodeBlock
                label="src/lib/api.ts (excerpt)"
                code={`const reader = res.body
  .pipeThrough(new TextDecoderStream())
  .getReader();

// split SSE frames, validate each event
const parsed = ChatEvent.safeParse(
  JSON.parse(line.slice(5).trim()),
);
if (parsed.success) yield parsed.data;`}
              />
              <div className="space-y-3">
                <Finding tone="info" title="POST + stream">
                  <Code>EventSource</Code> can’t send a body, so the client reads <Code>fetch</Code>’s stream and splits SSE
                  frames itself.
                </Finding>
                <Finding tone="info" title="Survives a reload">
                  Zustand persists the session id and finished messages to <Code>sessionStorage</Code>.
                </Finding>
                <Finding tone="info" title="Cancellable">
                  An <Code>AbortController</Code> backs Stop and New chat.
                </Finding>
              </div>
            </div>
          ),
        },
        {
          id: 'deploy',
          label: 'Deployment',
          content: (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <CodeBlock
                label="nginx/default.conf.template (excerpt)"
                code={`location /_api/ {
    proxy_pass \${API_UPSTREAM}/;
    proxy_buffering off;      # SSE: forward tokens immediately
}
location / {
    try_files $uri $uri/ /index.html;   # SPA routes
}`}
              />
              <div className="space-y-3 text-sm leading-relaxed text-ink-2">
                <p>
                  Node builds the app, nginx serves it. <Code>API_UPSTREAM</Code> is set per deployment, so one image fits
                  any API.
                </p>
                <p>The browser only talks to its own origin: no CORS, and no API URL in the bundle.</p>
                <p>It replaces the first Streamlit prototype, which proved the pipeline end to end.</p>
              </div>
            </div>
          ),
        },
        {
          id: 'run',
          label: 'Run it',
          content: (
            <CodeBlock
              label="shell"
              code={`npm install
API_UPSTREAM=http://localhost:8001 npm run dev

# production image
docker build -t medical-rag-frontend .
docker run -p 8504:80 -e API_UPSTREAM=https://<api-host> medical-rag-frontend`}
            />
          ),
        },
      ]}
    >
      <Showcase title="Try it yourself" lead="Every station works together the moment you ask.">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-interface/15">
                <MessageSquareText className="size-5 text-interface" />
              </span>
              <p className="font-semibold text-ink">Ask the chatbot</p>
            </div>
            <ul className="mt-4 flex flex-wrap gap-2">
              {QUESTIONS.map((q) => (
                <li key={q}>
                  <Link
                    to="/chat"
                    className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-ink-2 hover:border-line-strong hover:text-ink"
                  >
                    {q}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/chat"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-page hover:bg-white"
            >
              Open the chatbot <ArrowRight className="size-4" />
            </Link>
          </Card>
          <Card className="p-5">
            <p className="font-semibold text-ink">Built with</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {LAYERS[4].stack.map((t) => (
                <Pill key={t} color={PINK}>
                  {t}
                </Pill>
              ))}
            </div>
          </Card>
        </div>
      </Showcase>
    </LayerPage>
  );
}
