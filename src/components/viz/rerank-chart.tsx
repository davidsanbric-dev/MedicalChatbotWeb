import { CheckCircle2 } from 'lucide-react';
import { CONTENT_TYPE_LABEL, snapshot, type Candidate } from '@/data/snapshot';

/**
 * One row per vector-search candidate, ordered by cross-encoder score.
 * Bars diverge from 0; the dashed line marks the relevance threshold. Rows that
 * made it into the LLM context are marked with a status icon + label, so the
 * selection never depends on color alone.
 */
export function RerankChart({ candidates }: { candidates: Candidate[] }) {
  const threshold = snapshot.meta.relevanceThreshold;
  const lo = Math.min(-12, ...candidates.map((c) => c.rerankScore));
  const hi = Math.max(10, ...candidates.map((c) => c.rerankScore));
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const zero = pct(0);
  const thr = pct(threshold);

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-surface">
      <figcaption className="sr-only">
        Cross-encoder re-rank scores for the top {candidates.length} vector-search candidates
      </figcaption>
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(8rem,38%)] gap-x-3 border-b border-line bg-surface-2 px-4 py-2 text-xs font-medium text-ink-2 sm:grid-cols-[3rem_minmax(0,1fr)_minmax(10rem,40%)_4rem]">
        <span title="Rank in the cosine-similarity search">Vec #</span>
        <span>Chunk</span>
        <span className="relative">
          Re-rank score
          <span className="absolute -top-0.5 text-[10px] font-normal text-muted" style={{ left: `${thr}%` }}>
            {threshold}
          </span>
        </span>
        <span className="hidden text-right sm:block">Cosine</span>
      </div>
      <ul>
        {candidates.map((c) => {
          const left = Math.min(zero, pct(c.rerankScore));
          const width = Math.abs(pct(c.rerankScore) - zero);
          return (
            <li
              key={c.id}
              className="grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(8rem,38%)] items-center gap-x-3 border-b border-line px-4 py-2 last:border-0 hover:bg-surface-2/60 sm:grid-cols-[3rem_minmax(0,1fr)_minmax(10rem,40%)_4rem]"
              title={c.preview}
            >
              <span className="font-mono text-xs text-muted tabular">#{c.vectorRank}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm text-ink">
                  {c.selected && (
                    <CheckCircle2 className="size-4 shrink-0 text-good" aria-label="Sent to the LLM as context" />
                  )}
                  <span className="truncate">{c.condition}</span>
                  <span className="shrink-0 text-xs text-muted">· {CONTENT_TYPE_LABEL[c.type]}</span>
                </span>
                <span className="block truncate text-xs text-ink-2">{c.preview}</span>
              </span>
              <span className="relative h-5">
                <span className="absolute inset-y-0 w-px bg-line-strong" style={{ left: `${zero}%` }} />
                <span
                  className="absolute inset-y-[-4px] border-l border-dashed border-warning/70"
                  style={{ left: `${thr}%` }}
                />
                <span
                  className="absolute top-1 h-3 rounded-[3px]"
                  style={{
                    left: `${left}%`,
                    width: `max(${width}%, 2px)`,
                    background: c.selected ? 'var(--color-good)' : c.rerankScore > threshold ? '#a9b4c0' : '#4a5562',
                  }}
                />
                <span
                  className="absolute top-0 text-[11px] text-ink tabular"
                  style={
                    c.rerankScore >= 0
                      ? { left: `calc(${pct(c.rerankScore)}% + 4px)` }
                      : { right: `calc(${100 - pct(c.rerankScore)}% + 4px)` }
                  }
                >
                  {c.rerankScore.toFixed(1)}
                </span>
              </span>
              <span className="hidden text-right font-mono text-xs text-ink-2 tabular sm:block">
                {c.similarity.toFixed(3)}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-4 border-t border-line px-4 py-2.5 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-good" /> In LLM context (top {snapshot.meta.topN} above threshold)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3 rounded-sm bg-[#a9b4c0]" /> Relevant, not selected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3 rounded-sm bg-[#4a5562]" /> Below threshold
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 border-l border-dashed border-warning" /> Threshold {threshold}
        </span>
      </div>
    </figure>
  );
}
