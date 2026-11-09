import { ArrowRight, FileText, Globe, Sparkles } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { LAYERS, SOURCE } from '@/data/layers';
import { CONTENT_TYPE_COLOR, CONTENT_TYPE_LABEL, snapshot, type ContentType } from '@/data/snapshot';

const s = snapshot;

/**
 * One condition followed through every stage the database keeps: the web page,
 * its raw record, its clean record and the passages cut from it.
 */
export function LineageTrace() {
  const [name, setName] = useState(s.sample.condition);
  const c = s.conditions.find((x) => x.name === name) ?? s.conditions[0];
  const symptomChunks = c.chunks - c.paragraphs - c.lists;
  const chunks: ContentType[] = [
    ...Array<ContentType>(symptomChunks).fill('symptom'),
    ...Array<ContentType>(c.paragraphs).fill('paragraph'),
    ...Array<ContentType>(c.lists).fill('list_item'),
  ];

  return (
    <div className="rounded-2xl border border-line bg-[#0c1219] p-4 sm:p-5">
      <label className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
        Follow
        <select
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-ink focus:border-line-strong focus:outline-none"
        >
          {s.conditions.map((x) => (
            <option key={x.name} value={x.name}>
              {x.name}
            </option>
          ))}
        </select>
        through the database
      </label>

      <ol className="mt-5 grid grid-cols-1 items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1.3fr]">
        <Node icon={<Globe className="size-4" />} color={SOURCE.color} title="Web page" sub={SOURCE.host}>
          <a href={c.url} className="break-all text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink" rel="noreferrer">
            /conditions/{c.slug}
          </a>
        </Node>
        <Arrow />
        <Node icon={<FileText className="size-4" />} color={LAYERS[0].color} title="Original record" sub="raw_data">
          {c.symptoms} symptoms · {c.rawBlocks} text blocks · {(c.rawBytes / 1024).toFixed(1)} KiB
        </Node>
        <Arrow />
        <Node icon={<FileText className="size-4" />} color={LAYERS[1].color} title="Clean record" sub="processed_data">
          {c.paragraphs} paragraphs · {c.lists} list{c.lists === 1 ? '' : 's'} · {c.processorVersion}
        </Node>
        <Arrow />
        <Node icon={<Sparkles className="size-4" />} color={LAYERS[2].color} title={`${c.chunks} passages`} sub="documents">
          <span className="flex flex-wrap gap-1.5" aria-label={`${c.chunks} passages`}>
            {chunks.map((t, i) => (
              <span
                key={i}
                title={`${CONTENT_TYPE_LABEL[t]} passage`}
                className="h-5 w-7 rounded-[4px]"
                style={{ background: CONTENT_TYPE_COLOR[t] }}
              />
            ))}
          </span>
        </Node>
      </ol>

      <ul className="mt-4 flex flex-wrap gap-4 text-xs text-ink-2" aria-label="Passage types">
        {(Object.keys(CONTENT_TYPE_LABEL) as ContentType[]).map((t) => (
          <li key={t} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-[3px]" style={{ background: CONTENT_TYPE_COLOR[t] }} />
            {CONTENT_TYPE_LABEL[t]}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Node({ icon, color, title, sub, children }: { icon: ReactNode; color: string; title: string; sub: string; children: ReactNode }) {
  return (
    <li className="relative overflow-hidden rounded-xl border border-line bg-surface p-3.5">
      <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: color }} />
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg" style={{ background: `${color}26`, color }}>
          {icon}
        </span>
        <span>
          <span className="block text-sm font-semibold text-ink">{title}</span>
          <span className="block font-mono text-[11px] text-muted">{sub}</span>
        </span>
      </div>
      <div className="mt-2.5 text-sm leading-snug text-ink">{children}</div>
    </li>
  );
}

function Arrow() {
  return (
    <li aria-hidden className="flex items-center justify-center text-muted">
      <ArrowRight className="size-4 rotate-90 md:rotate-0" />
    </li>
  );
}
