import { Link, useLocation } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, ChevronDown, ExternalLink, Wrench } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StoryScene, type StoryStep } from '@/components/story/story-scene';
import { GithubIcon } from '@/components/ui/github-icon';
import { Pill, Tabs } from '@/components/ui/primitives';
import { LAYERS, SOURCE, layerById, type Layer, type LayerId } from '@/data/layers';
import { PipelineMap } from './pipeline-map';

export interface DetailSection {
  /** Also the tab's address: /scraper#mapping opens "Under the hood" on this tab. */
  id: string;
  label: string;
  content: ReactNode;
  /** The code behind the tab, as a path inside the station's repository. */
  source?: string;
}

/**
 * The one template every station page uses, in reading order:
 * where it sits in the pipeline → a 3D scene told in a few steps → three
 * numbers → one picture worth looking at → the technical details, folded away.
 */
export function LayerPage({
  id,
  steps,
  scene,
  toolbar,
  numbers,
  children,
  details,
}: {
  id: LayerId;
  steps: StoryStep[];
  scene: (step: number) => ReactNode;
  toolbar?: ReactNode;
  numbers: { value: ReactNode; label: string }[];
  children?: ReactNode;
  details: DetailSection[];
}) {
  const layer = layerById(id);
  const i = LAYERS.indexOf(layer);
  const prev = LAYERS[i - 1];
  const next = LAYERS[i + 1];
  const hash = useLocation({ select: (location) => location.hash });

  useEffect(() => {
    document.title = `${layer.title} · Medical RAG pipeline`;
  }, [layer.title]);

  return (
    <article>
      <header className="mx-auto max-w-6xl px-4 pt-6 sm:pt-8">
        <PipelineMap current={id} />
        <p className="mt-8 font-mono text-xs tracking-wider uppercase sm:mt-10" style={{ color: layer.color }}>
          Station {layer.index} of {LAYERS.length} · {layer.verb}
          <span className="text-muted"> ({layer.stage.toLowerCase()})</span>
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{layer.title}</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-2">{layer.lead}</p>
      </header>

      <div className="mx-auto max-w-6xl px-4">
        <div className="mt-6">
          <StoryScene steps={steps} color={layer.color} scene={scene} toolbar={toolbar} />
        </div>

        <dl className="grid grid-cols-1 gap-3 py-8 sm:grid-cols-3">
          {numbers.map((n) => (
            <div key={n.label} className="relative flex flex-col-reverse overflow-hidden rounded-xl border border-line bg-surface p-5">
              <span className="absolute inset-y-0 left-0 w-1" style={{ background: layer.color }} />
              <dt className="mt-1 text-sm text-ink-2">{n.label}</dt>
              <dd className="text-3xl font-semibold tracking-tight text-ink">{n.value}</dd>
            </div>
          ))}
        </dl>

        {children}

        <UnderTheHood key={hash} layer={layer} sections={details} linkedTab={hash} />

        <nav aria-label="Pipeline" className="grid grid-cols-1 gap-3 py-10 sm:grid-cols-2">
          {prev ? (
            <NavCard to={prev.path} dir="prev" label={`${prev.index} · ${prev.name}`} color={prev.color} />
          ) : (
            <NavCard to="/" dir="prev" label="The whole pipeline" color={SOURCE.color} />
          )}
          {next ? (
            <NavCard to={next.path} dir="next" label={`${next.index} · ${next.name}`} color={next.color} />
          ) : (
            <NavCard to="/chat" dir="next" label="Try the chatbot" color={layer.color} />
          )}
        </nav>
      </div>
    </article>
  );
}

/** A picture-first section: short title, one optional sentence, then the visual. */
export function Showcase({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section className="pb-10">
      <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h2>
      {lead && <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-ink-2">{lead}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Opens on the tab named in the URL hash, so code comments and READMEs can link straight to it. */
function UnderTheHood({ layer, sections, linkedTab }: { layer: Layer; sections: DetailSection[]; linkedTab: string }) {
  const linkedId = sections.find((s) => s.id === linkedTab)?.id;
  const [tab, setTab] = useState(linkedId ?? sections[0]?.id ?? '');
  const active = sections.find((s) => s.id === tab) ?? sections[0];
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (linkedId) ref.current?.scrollIntoView({ block: 'start' });
  }, [linkedId]);

  return (
    <details ref={ref} open={Boolean(linkedId)} className="group scroll-mt-20 rounded-2xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl px-5 py-4 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-3">
          <Wrench className="size-4 text-ink-2" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-ink">Under the hood</span>
          <span className="block text-sm text-muted">For engineers: code, real data samples, audit findings and how to run it.</span>
        </span>
        <ChevronDown className="ml-auto size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-line px-4 pt-4 pb-6 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          {layer.repo.url ? (
            <a
              href={layer.repo.url}
              className="mr-1 inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-sm text-ink hover:bg-surface-3"
            >
              <GithubIcon className="size-4" /> {layer.repo.name}
            </a>
          ) : (
            <span className="mr-1 inline-flex items-center gap-1.5 font-mono text-sm text-ink-2">
              <GithubIcon className="size-4" /> {layer.repo.name}
            </span>
          )}
          {layer.stack.map((t) => (
            <Pill key={t}>{t}</Pill>
          ))}
        </div>
        <div className="mt-5">
          <Tabs label="Technical details" value={active.id} onChange={setTab} options={sections.map((s) => ({ value: s.id, label: s.label }))} />
        </div>
        {active.source && layer.repo.url && (
          <a
            href={`${layer.repo.url}/blob/main/${active.source}`}
            className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs text-muted hover:text-ink"
          >
            <GithubIcon className="size-3.5" /> {active.source}
            <ExternalLink className="size-3" />
          </a>
        )}
        <div className="mt-5">{active.content}</div>
      </div>
    </details>
  );
}

function NavCard({ to, dir, label, color }: { to: string; dir: 'prev' | 'next'; label: string; color: string }) {
  return (
    <Link
      to={to}
      className={`group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:border-line-strong hover:bg-surface-2 ${dir === 'next' ? 'sm:flex-row-reverse sm:text-right' : ''}`}
    >
      {dir === 'prev' ? (
        <ArrowLeft className="size-4 text-muted group-hover:text-ink" />
      ) : (
        <ArrowRight className="size-4 text-muted group-hover:text-ink" />
      )}
      <span>
        <span className="block text-xs text-muted">{dir === 'prev' ? 'Previous station' : 'Next station'}</span>
        <span className="flex items-center gap-2 font-medium text-ink">
          <span className="size-2 rounded-full" style={{ background: color }} />
          {label}
        </span>
      </span>
    </Link>
  );
}
