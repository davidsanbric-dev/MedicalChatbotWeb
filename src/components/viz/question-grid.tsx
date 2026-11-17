import { clsx } from 'clsx';
import { useState } from 'react';
import type { Outcome } from '@/data/evaluation';

const OUTCOME: Record<Outcome, { color: string; label: string; good: boolean }> = {
  found: { color: 'var(--color-good)', label: 'Right condition found', good: true },
  wrong: { color: 'var(--color-warning)', label: 'Only other conditions found', good: false },
  none: { color: '#4a5562', label: 'Nothing found', good: false },
  silent: { color: 'var(--color-good)', label: 'Correctly found nothing', good: true },
  leak: { color: 'var(--color-warning)', label: 'Found unrelated passages', good: false },
};

interface Row {
  question: string;
  condition: string | null;
  outcome: Outcome;
}

/**
 * One square per test question, coloured by what the search returned. Two groups:
 * questions about a condition in the knowledge base, and questions it can't answer.
 * Status is spelled out in the legend and on selection, never by colour alone.
 */
export function QuestionGrid({ rows }: { rows: Row[] }) {
  const [selected, setSelected] = useState<Row | null>(null);
  const groups = [
    { title: 'Questions about a condition it covers', rows: rows.filter((r) => r.condition !== null), outcomes: ['found', 'wrong', 'none'] as Outcome[] },
    { title: 'Questions it can’t answer', rows: rows.filter((r) => r.condition === null), outcomes: ['silent', 'leak'] as Outcome[] },
  ];

  return (
    <figure>
      <figcaption className="sr-only">
        Each square is one test question, grouped by whether the knowledge base covers it, and coloured by what the
        search returned.
      </figcaption>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="text-sm text-ink-2">
              {group.title} <span className="text-muted">· {group.rows.length}</span>
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {group.rows.map((row) => {
                const o = OUTCOME[row.outcome];
                return (
                  <li key={row.question}>
                    <button
                      type="button"
                      title={`${row.question} · ${o.label}`}
                      aria-label={`${row.question}: ${o.label}`}
                      aria-pressed={selected?.question === row.question}
                      onClick={() => setSelected(selected?.question === row.question ? null : row)}
                      className={clsx(
                        'block size-5 rounded-[4px] transition-transform hover:scale-125 focus-visible:scale-125 sm:size-6',
                        selected?.question === row.question && 'ring-2 ring-ink ring-offset-2 ring-offset-surface',
                      )}
                      style={{ background: o.color }}
                    />
                  </li>
                );
              })}
            </ul>
            <ul className="mt-3 space-y-1">
              {group.outcomes.map((outcome) => {
                const count = group.rows.filter((r) => r.outcome === outcome).length;
                return (
                  <li key={outcome} className="flex items-center gap-2 text-xs text-ink-2">
                    <span className="size-3 rounded-[3px]" style={{ background: OUTCOME[outcome].color }} />
                    <span className="tabular text-ink">{count}</span> {OUTCOME[outcome].label.toLowerCase()}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-4 min-h-10 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink-2" aria-live="polite">
        {selected ? (
          <>
            <span className="text-ink">“{selected.question}”</span>
            {selected.condition && <span className="text-muted"> · about {selected.condition}</span>} →{' '}
            {OUTCOME[selected.outcome].label.toLowerCase()}
          </>
        ) : (
          'Tap a square to see its question.'
        )}
      </p>
    </figure>
  );
}
