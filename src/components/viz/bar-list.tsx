import { fmt } from '@/lib/format';

/**
 * Ranked horizontal bars for a single series: the title names the series, so
 * no legend; category and value are direct labels in ink (never series color).
 */
export function BarList({
  rows,
  color,
  unit,
  max,
  caption,
}: {
  rows: { label: string; value: number; hint?: string }[];
  color: string;
  unit?: string;
  max?: number;
  caption: string;
}) {
  const top = max ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <figure>
      <figcaption className="sr-only">{caption}</figcaption>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li
            key={r.label}
            className="group grid grid-cols-[minmax(6rem,11rem)_1fr_auto] items-center gap-3 rounded-md px-1 py-0.5 hover:bg-surface-2"
            title={`${r.label}: ${fmt.format(r.value)}${unit ? ` ${unit}` : ''}${r.hint ? ` · ${r.hint}` : ''}`}
          >
            <span className="truncate text-sm text-ink-2 group-hover:text-ink">{r.label}</span>
            <span className="relative h-3">
              <span
                className="absolute inset-y-0 left-0 rounded-r-[4px] transition-[filter] group-hover:brightness-125"
                style={{ width: `${(r.value / top) * 100}%`, background: color, minWidth: 2 }}
              />
            </span>
            <span className="text-right text-sm text-ink tabular">
              {fmt.format(r.value)}
              {unit && <span className="ml-1 text-xs text-muted">{unit}</span>}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
