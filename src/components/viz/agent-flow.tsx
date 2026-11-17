import { ArrowDown, ArrowRight, BookOpen, BrainCircuit, Headset, ListChecks, MessageSquareText, Repeat, ShieldAlert, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/primitives';

const TOOLS = [
  { icon: BookOpen, title: 'Search the knowledge base', term: 'search_knowledge_base', body: 'The same search and double-check as the steps above.' },
  { icon: ListChecks, title: 'List what it covers', term: 'list_conditions', body: 'When someone asks what it can help with.' },
  { icon: Headset, title: 'Call a person', term: 'request_human_handoff', body: 'Opens a request for the care team: routine, urgent or emergency.' },
];

/**
 * How the agent works, left to right: the emergency check comes first and never waits
 * for the AI; then the AI picks tools, reads what they return and decides again,
 * until it can answer.
 */
export function AgentFlow({ color }: { color: string }) {
  return (
    <figure>
      <figcaption className="sr-only">
        A message first passes an emergency check. If it sounds like an emergency, the care team is alerted at once.
        Otherwise the AI picks one of three tools, reads the result, and repeats up to four times before answering
        with its sources.
      </figcaption>
      <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-start">
        <Node icon={MessageSquareText} title="A visitor writes" color={color}>
          In English or Spanish.
        </Node>
        <Arrow />
        <div className="flex flex-col gap-2 lg:w-52 lg:shrink-0">
          <Node icon={ShieldAlert} title="Emergency check" term="guardrail" color="var(--color-critical)">
            Chest pain, can’t breathe, self-harm… are caught by fixed rules, not the AI.
          </Node>
          <p className="flex items-center gap-1.5 px-1 text-xs text-ink-2">
            <ArrowDown className="size-3.5 shrink-0 text-critical" />
            If so: care team alerted at once, safety advice shown
          </p>
        </div>
        <Arrow />
        <div className="min-w-0 flex-1 rounded-xl border border-dashed p-3" style={{ borderColor: color }}>
          <div className="flex items-center gap-2">
            <BrainCircuit className="size-4" style={{ color }} />
            <p className="text-sm font-semibold text-ink">The AI decides what to do</p>
            <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-muted">
              <Repeat className="size-3" /> up to 4 rounds
            </span>
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {TOOLS.map((tool) => (
              <li key={tool.term}>
                <Card className="h-full bg-surface-2 p-3">
                  <tool.icon className="size-4" style={{ color }} />
                  <p className="mt-2 text-sm font-medium text-ink">{tool.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-2">{tool.body}</p>
                  <p className="mt-2 font-mono text-[10.5px] break-all text-muted">{tool.term}</p>
                </Card>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Greetings and thanks need no tool: it just replies.</p>
        </div>
        <Arrow />
        <Node icon={Sparkles} title="Answer + sources" color={color}>
          In the visitor’s language, naming the conditions it used. No diagnoses or doses.
        </Node>
      </div>
    </figure>
  );
}

function Node({
  icon: Icon,
  title,
  term,
  color,
  children,
}: {
  icon: typeof Sparkles;
  title: string;
  term?: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-3 lg:w-44 lg:shrink-0">
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" style={{ color }} />
        <p className="text-sm font-semibold text-ink">{title}</p>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{children}</p>
      {term && <p className="mt-2 font-mono text-[10.5px] break-all text-muted">{term}</p>}
    </Card>
  );
}

function Arrow() {
  return (
    <span className="grid place-items-center text-muted lg:h-16" aria-hidden>
      <ArrowDown className="size-4 lg:hidden" />
      <ArrowRight className="hidden size-4 lg:block" />
    </span>
  );
}
