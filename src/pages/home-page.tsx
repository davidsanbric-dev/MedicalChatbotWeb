import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight, MessageSquareText } from 'lucide-react';
import { Suspense, lazy, useEffect } from 'react';
import { SceneBoundary, SceneFallback } from '@/components/story/scene-boundary';
import { LAYERS, SOURCE, type LayerId } from '@/data/layers';
import { snapshot } from '@/data/snapshot';
import { useUiStore } from '@/stores/ui-store';

const PipelineScene = lazy(() => import('@/components/three/scenes/pipeline-scene'));

export function HomePage() {
  const navigate = useNavigate();
  const active = useUiStore((st) => st.activeLayer);
  const setActive = useUiStore((st) => st.setActiveLayer);

  useEffect(() => {
    document.title = 'Medical RAG · How the chatbot learns';
    return () => setActive(null);
  }, [setActive]);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_0%,rgba(57,135,229,0.13),transparent_70%),radial-gradient(45%_50%_at_90%_80%,rgba(213,81,129,0.08),transparent_70%)]" />
        <div className="relative mx-auto max-w-3xl px-4 pt-12 text-center sm:pt-16">
          <p className="font-mono text-xs tracking-wider text-muted uppercase">A data pipeline, station by station</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance text-ink sm:text-5xl">
            How a chatbot learns to answer health questions
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-balance text-ink-2">
            Follow {snapshot.audit.records} public web pages as they travel through five stations and become the
            knowledge behind every answer.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/scraper"
              className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-page hover:bg-white"
            >
              Start the tour <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/chat"
              className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-2"
            >
              <MessageSquareText className="size-4" /> Ask the chatbot
            </Link>
          </div>
        </div>

        <div className="relative mx-auto max-w-7xl">
          <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:none]">
            <div className="h-[360px] min-w-[800px] sm:h-[420px] lg:h-[470px]">
              <SceneBoundary>
                <Suspense fallback={<SceneFallback />}>
                  <PipelineScene onSelect={(id: LayerId) => navigate({ to: LAYERS.find((l) => l.id === id)!.path })} />
                </Suspense>
              </SceneBoundary>
            </div>
          </div>
          <p className="pb-6 text-center text-xs text-muted">
            <span className="hidden sm:inline">Hover a station to light it up · click it to step inside</span>
            <span className="sm:hidden">Swipe to follow the data · tap a station to step inside</span>
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        <section aria-labelledby="stations-title" className="py-12">
          <h2 id="stations-title" className="sr-only">
            The five stations
          </h2>
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {LAYERS.map((l) => (
              <li key={l.id}>
                <Link
                  to={l.path}
                  onMouseEnter={() => setActive(l.id)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(l.id)}
                  onBlur={() => setActive(null)}
                  className="group relative flex h-full flex-col overflow-hidden rounded-xl border bg-surface p-4 transition-colors hover:bg-surface-2"
                  style={{ borderColor: active === l.id ? l.color : 'var(--color-line)' }}
                >
                  <span className="absolute inset-x-0 top-0 h-1" style={{ background: l.color }} />
                  <span className="font-mono text-[11px] tracking-wider uppercase" style={{ color: l.color }}>
                    {l.index} · {l.verb}
                  </span>
                  <span className="mt-1 text-lg font-semibold text-ink">{l.name}</span>
                  <span className="mt-1 text-sm leading-snug text-ink-2">{l.blurb}</span>
                  <span className="mt-auto pt-4">
                    <span className="block text-2xl font-semibold tracking-tight text-ink">{l.number.value}</span>
                    <span className="block text-xs text-muted">{l.number.label}</span>
                  </span>
                  <ArrowRight className="absolute right-4 bottom-4 size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-center text-sm text-muted">
            Source:{' '}
            <a href={SOURCE.url} className="text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
              {SOURCE.host}
            </a>{' '}
            · in data-engineering terms: <span className="text-ink-2">extract → transform → load → serve → use</span>
          </p>
        </section>

        <section className="pb-14">
          <Link
            to="/chat"
            className="group flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface p-6 hover:bg-surface-2 sm:flex-row sm:items-center"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-interface/15">
              <MessageSquareText className="size-6 text-interface" />
            </span>
            <span>
              <span className="block text-lg font-semibold text-ink">See all five stations work together</span>
              <span className="block text-sm text-ink-2">
                Ask a question and watch it get understood, matched, double-checked and answered live.
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink sm:ml-auto">
              Open the chatbot <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </section>
      </div>
    </div>
  );
}
