import { clsx } from 'clsx';
import { useState, type ReactNode } from 'react';
import { LAYERS } from '@/data/layers';
import { snapshot } from '@/data/snapshot';

type Block = { type?: string; text?: string; items?: unknown[] };
const raw = snapshot.sample.raw.content as {
  url?: string;
  title?: string;
  symptoms?: { heading?: string; list?: string[] };
  onlineDiagnosingAndTreating?: { heading?: string; content?: Block[] };
};

const REGIONS = [
  { n: 1, name: 'Title', color: '#e8edf2' },
  { n: 2, name: 'Symptoms', color: LAYERS[0].color },
  { n: 3, name: 'Treatment', color: '#c9a7ff' },
] as const;

const treatment = raw.onlineDiagnosingAndTreating?.content ?? [];
const paragraphs = treatment.filter((b) => b.type !== 'ul' && b.type !== 'ol').length;
const lists = treatment.length - paragraphs;

/**
 * The real page for the sample condition, drawn as a wireframe: the three
 * regions the scraper keeps are numbered and matched to the record it saves;
 * menus and footers are left behind.
 */
export function PageAnatomy() {
  const [hover, setHover] = useState<number | null>(null);
  const bind = (n: number) => ({
    onMouseEnter: () => setHover(n),
    onMouseLeave: () => setHover(null),
  });
  const ring = (n: number) => {
    const r = REGIONS[n - 1];
    const on = hover === null || hover === n;
    return {
      className: clsx('relative rounded-lg border-2 p-3 transition-opacity', on ? 'opacity-100' : 'opacity-35'),
      style: { borderColor: r.color },
    };
  };

  return (
    <div className="grid grid-cols-1 items-center gap-4 lg:grid-cols-[minmax(0,1.1fr)_auto_minmax(0,1fr)]">
      {/* The web page */}
      <figure className="overflow-hidden rounded-xl border border-line bg-[#0f151c]">
        <figcaption className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
          <span className="flex gap-1">
            <span className="size-2 rounded-full bg-[#d03b3b]" />
            <span className="size-2 rounded-full bg-[#fab219]" />
            <span className="size-2 rounded-full bg-[#0ca30c]" />
          </span>
          <span className="truncate rounded bg-page px-2 py-0.5 font-mono text-[11px] text-ink-2">
            {raw.url?.replace('https://', '')}
          </span>
        </figcaption>
        <div className="space-y-2.5 p-3">
          <Ignored>menu · logo · “Get started” button</Ignored>
          <div {...ring(1)} {...bind(1)}>
            <Badge n={1} />
            <p className="text-lg font-semibold text-ink">{raw.title}</p>
          </div>
          <div {...ring(2)} {...bind(2)}>
            <Badge n={2} />
            <p className="text-xs text-ink-2">{raw.symptoms?.heading}:</p>
            <ul className="mt-1.5 flex flex-wrap gap-1">
              {raw.symptoms?.list?.map((s) => (
                <li key={s} className="rounded-full bg-scraper/20 px-2 py-0.5 text-xs text-ink">
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div {...ring(3)} {...bind(3)}>
            <Badge n={3} />
            <p className="text-sm font-medium text-ink">{raw.onlineDiagnosingAndTreating?.heading}</p>
            <div className="mt-2 space-y-1.5" aria-hidden>
              {[92, 100, 78, 96, 64].map((w, i) => (
                <span key={i} className="block h-1.5 rounded-full bg-ink-2/30" style={{ width: `${w}%` }} />
              ))}
              <span className="block pl-3">
                {[56, 48, 60].map((w, i) => (
                  <span key={i} className="mt-1.5 block h-1.5 rounded-full bg-ink-2/30" style={{ width: `${w}%` }} />
                ))}
              </span>
            </div>
          </div>
          <Ignored>footer · links · legal</Ignored>
        </div>
      </figure>

      <div className="hidden text-center font-mono text-xs text-muted lg:block" aria-hidden>
        keeps
        <br />→
      </div>

      {/* The saved record */}
      <figure className="rounded-xl border border-line bg-surface">
        <figcaption className="border-b border-line px-4 py-2.5 text-sm font-medium text-ink">
          Saved record <span className="font-normal text-muted">· one per page</span>
        </figcaption>
        <dl className="divide-y divide-line">
          <Field n={1} name="title" hover={hover} bind={bind(1)}>
            “{raw.title}”
          </Field>
          <Field n={2} name="symptoms" hover={hover} bind={bind(2)}>
            {raw.symptoms?.list?.length} items
          </Field>
          <Field n={3} name="treatment" hover={hover} bind={bind(3)}>
            {paragraphs} paragraphs · {lists} list{lists === 1 ? '' : 's'}
          </Field>
        </dl>
      </figure>
    </div>
  );
}

function Badge({ n }: { n: number }) {
  const r = REGIONS[n - 1];
  return (
    <span
      className="absolute -top-2.5 -left-2.5 grid size-5 place-items-center rounded-full font-mono text-[11px] font-semibold text-page"
      style={{ background: r.color }}
    >
      {n}
    </span>
  );
}

function Ignored({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-line-strong px-3 py-1.5 text-xs text-muted">
      <span className="line-through decoration-muted/60">{children}</span>
      <span className="ml-auto shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-[10px] tracking-wide uppercase">ignored</span>
    </div>
  );
}

function Field({
  n,
  name,
  hover,
  bind,
  children,
}: {
  n: number;
  name: string;
  hover: number | null;
  bind: { onMouseEnter: () => void; onMouseLeave: () => void };
  children: ReactNode;
}) {
  const r = REGIONS[n - 1];
  return (
    <div
      {...bind}
      className={clsx('flex items-center gap-3 px-4 py-3 transition-opacity', hover !== null && hover !== n && 'opacity-35')}
    >
      <span className="grid size-5 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold text-page" style={{ background: r.color }}>
        {n}
      </span>
      <dt className="w-20 shrink-0 font-mono text-xs text-muted">{name}</dt>
      <dd className="min-w-0 text-sm text-ink">{children}</dd>
    </div>
  );
}
