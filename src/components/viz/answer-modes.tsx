import { Link } from '@tanstack/react-router';
import { ArrowRight, BrainCircuit, ChevronRight, Repeat, Workflow, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { MAX_ROUNDS } from '@/data/agent-scenarios';
import { useChatStore, type ChatMode } from '@/stores/chat-store';

const MODES: {
  mode: ChatMode;
  icon: LucideIcon;
  title: string;
  badge?: string;
  lead: string;
  steps: string[];
  loops: boolean;
  traits: string[];
  cta: string;
}[] = [
  {
    mode: 'agent',
    icon: BrainCircuit,
    title: 'Agent',
    badge: 'Default in the chat',
    lead: 'Decides its own steps, and can act.',
    steps: ['Safety check', 'AI picks a tool', 'Tool runs', 'Answer + sources'],
    loops: true,
    traits: [
      'Searches, lists its topics, or calls a person',
      'Names the conditions its answer comes from',
      'Shows each step live; the answer arrives whole',
    ],
    cta: 'Try the agent',
  },
  {
    mode: 'rag',
    icon: Workflow,
    title: 'Classic RAG',
    lead: 'Always the same four steps.',
    steps: ['Understand the question', 'Find similar passages', 'Double-check them', 'Write the answer'],
    loops: false,
    traits: ['Two AI calls for every question', 'Answers only, never acts', 'Streams the answer word by word'],
    cta: 'Try classic',
  },
];

/** The chat's two modes side by side, each with a link that opens the chat in that mode. */
export function AnswerModes({ color }: { color: string }) {
  const setMode = useChatStore((st) => st.setMode);
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {MODES.map((m) => (
        <Card key={m.mode} className="flex flex-col p-5">
          <div className="flex items-center gap-2">
            <m.icon className="size-5" style={{ color }} aria-hidden />
            <h3 className="font-semibold text-ink">{m.title}</h3>
            {m.badge && (
              <span className="ml-auto rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-2">{m.badge}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-2">{m.lead}</p>

          <ol className="mt-4 flex flex-wrap items-center gap-1" aria-label={`${m.title} steps`}>
            {m.steps.map((step, i) => (
              <li key={step} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3.5 text-muted" aria-hidden />}
                <span className="rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-ink">{step}</span>
              </li>
            ))}
          </ol>
          {m.loops && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-2">
              <Repeat className="size-3.5 shrink-0" style={{ color }} aria-hidden />
              Picks and runs tools again until it can answer, {MAX_ROUNDS} rounds at most
            </p>
          )}

          <ul className="mt-4 space-y-1 text-sm text-ink-2">
            {m.traits.map((trait) => (
              <li key={trait} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-muted" aria-hidden />
                {trait}
              </li>
            ))}
          </ul>

          <Link
            to="/chat"
            onClick={() => setMode(m.mode)}
            className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink hover:bg-surface-2"
          >
            {m.cta} <ArrowRight className="size-4" />
          </Link>
        </Card>
      ))}
    </div>
  );
}
