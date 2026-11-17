import { useState } from 'react';
import type { SweepRow } from '@/data/evaluation';

/**
 * "Where should the bar be?": a slider over the evaluated thresholds, showing the
 * trade-off the threshold controls. A lower bar answers more real questions but lets
 * more unanswerable ones through. The threshold in use is marked.
 */
export function ThresholdPicker({ rows, current, color }: { rows: SweepRow[]; current: number; color: string }) {
  const sorted = [...rows].sort((a, b) => a.threshold - b.threshold);
  const currentIndex = Math.max(0, sorted.findIndex((r) => r.threshold === current));
  const [index, setIndex] = useState(currentIndex);
  const row = sorted[index];

  const meters = [
    { label: 'Real questions that reach the right condition', value: row.hit_rate },
    { label: 'Questions it can’t answer that get no passages', value: row.abstained_off_topic },
  ];

  return (
    <div>
      <label htmlFor="threshold" className="flex items-baseline justify-between gap-3 text-sm text-ink-2">
        <span>How strict is the double-check?</span>
        <span className="shrink-0 font-mono whitespace-nowrap text-ink">
          score &gt; {row.threshold}
          {row.threshold === current && (
            <span className="ml-2 rounded-md px-1.5 py-0.5 font-sans text-[11px] text-page" style={{ background: color }}>
              in use
            </span>
          )}
        </span>
      </label>
      <input
        id="threshold"
        type="range"
        min={0}
        max={sorted.length - 1}
        step={1}
        value={index}
        onChange={(e) => setIndex(Number(e.target.value))}
        aria-valuetext={`threshold ${row.threshold}`}
        className="mt-3 w-full"
        style={{ accentColor: color }}
      />
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>More lenient</span>
        <span>Stricter</span>
      </div>
      <dl className="mt-5 space-y-4">
        {meters.map((m) => (
          <div key={m.label}>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-ink-2">{m.label}</dt>
              <dd className="text-lg font-semibold text-ink tabular">{Math.round(m.value * 100)}%</dd>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${m.value * 100}%`, background: color }} />
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
