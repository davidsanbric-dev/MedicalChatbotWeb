import { BookOpen, CheckCircle2, Headset, ListChecks, MessageCircle, ShieldAlert, XCircle, type LucideIcon } from 'lucide-react';
import type { AgentCase } from '@/data/agent-scenarios';

/** The evaluation's expected actions, in plain words. */
const ACTIONS: { expected: string; icon: LucideIcon; title: string; action: string }[] = [
  { expected: 'search_knowledge_base', icon: BookOpen, title: 'Health questions', action: 'search the knowledge base' },
  { expected: 'list_conditions', icon: ListChecks, title: '“What can you help with?”', action: 'list its topics' },
  { expected: 'request_human_handoff', icon: Headset, title: 'Needs a person', action: 'call a person' },
  { expected: 'none', icon: MessageCircle, title: 'Greetings and thanks', action: 'just reply' },
  { expected: 'guardrail', icon: ShieldAlert, title: 'Emergencies', action: 'alert the care team, no AI' },
];

/**
 * Every message of the agent evaluation, grouped by the action it should lead
 * to, each marked with whether the agent did that and how long the turn took.
 * Pass and fail carry an icon and a label, never color alone.
 */
export function AgentCases({ cases, color }: { cases: AgentCase[]; color: string }) {
  return (
    <figure>
      <figcaption className="sr-only">
        The agent evaluation’s test messages, grouped by the action each should lead to, each marked right or wrong
        with the time it took.
      </figcaption>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {ACTIONS.map(({ expected, icon: Icon, title, action }) => {
          const group = cases.filter((c) => c.expected === expected);
          const passed = group.filter((c) => c.passed).length;
          return (
            <section key={expected} className="rounded-xl border border-line bg-surface p-4">
              <header className="flex items-start gap-2">
                <Icon
                  className="mt-0.5 size-4 shrink-0"
                  style={{ color: expected === 'guardrail' ? 'var(--color-critical)' : color }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-ink">{title}</h3>
                  <p className="text-xs text-ink-2">→ {action}</p>
                </div>
                <span className="ml-auto text-xs text-muted tabular">
                  {passed}/{group.length}
                </span>
              </header>
              <ul className="mt-3 space-y-2">
                {group.map((c) => (
                  <li key={c.message} className="flex items-start gap-2 text-[13px] leading-snug text-ink-2">
                    {c.passed ? (
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-good" aria-label="Right action" />
                    ) : (
                      <XCircle className="mt-0.5 size-3.5 shrink-0 text-critical" aria-label={`Wrong action: ${c.did}`} />
                    )}
                    <span className="min-w-0 flex-1">“{c.message}”</span>
                    <span className="shrink-0 text-[11px] text-muted tabular">
                      {c.did === 'guardrail' ? 'instant' : `${c.seconds.toFixed(1)} s`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </figure>
  );
}
