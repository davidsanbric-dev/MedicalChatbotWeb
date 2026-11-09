import { clsx } from 'clsx';
import { Pause, Play } from 'lucide-react';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useInView } from '@/hooks/use-in-view';
import { useReducedMotion } from '@/hooks/use-media';
import { SceneBoundary, SceneFallback } from './scene-boundary';

export interface StoryStep {
  /** Short plain-language name of the step. */
  title: string;
  /** The technical term for the same thing. */
  term: string;
  /** One sentence a non-technical reader can follow. */
  caption: string;
}

/**
 * A 3D scene told as a few short steps. The steps play on their own while the
 * scene is on screen; picking one pauses the tour on it. With reduced motion
 * nothing plays automatically.
 */
export function StoryScene({
  steps,
  color,
  scene,
  toolbar,
  duration = 7000,
}: {
  steps: StoryStep[];
  color: string;
  scene: (step: number) => ReactNode;
  /** Extra controls shown above the scene (e.g. a question picker). */
  toolbar?: ReactNode;
  duration?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref);
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(!reduced);
  const running = playing && inView;

  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => setStep((s) => (s + 1) % steps.length), duration);
    return () => window.clearTimeout(id);
  }, [running, step, steps.length, duration]);

  const current = steps[step];

  return (
    <section ref={ref} aria-label="How this station works" className="overflow-hidden rounded-2xl border border-line bg-[#0c1219]">
      {toolbar && <div className="border-b border-line px-3 py-2.5 sm:px-4">{toolbar}</div>}
      <div className="relative h-[330px] sm:h-[380px] lg:h-[410px]">
        <SceneBoundary>
          <Suspense fallback={<SceneFallback />}>{scene(step)}</Suspense>
        </SceneBoundary>
      </div>

      <div className="border-t border-line px-3 pt-3 pb-4 sm:px-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause the steps' : 'Play the steps'}
            className="grid size-8 shrink-0 place-items-center rounded-full border border-line-strong text-ink hover:bg-surface-2"
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </button>
          <ol className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
            {steps.map((s, i) => (
              <li key={s.title} className="shrink-0">
                <button
                  type="button"
                  aria-current={i === step ? 'step' : undefined}
                  onClick={() => {
                    setStep(i);
                    setPlaying(false);
                  }}
                  className={clsx(
                    'relative flex items-center gap-2 overflow-hidden rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                    i === step ? 'bg-surface-3 text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  <span
                    className="grid size-5 place-items-center rounded-full font-mono text-[11px] font-medium"
                    style={i === step ? { background: color, color: '#0b1016' } : { boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.2)' }}
                  >
                    {i + 1}
                  </span>
                  {s.title}
                  {i === step && (
                    <span
                      key={`${step}-${running}`}
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-0.5 origin-left"
                      style={{
                        background: color,
                        animation: running ? `story-progress ${duration}ms linear both` : undefined,
                      }}
                    />
                  )}
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-3 flex min-h-14 flex-col gap-1 sm:min-h-0 sm:flex-row sm:items-baseline sm:gap-3" aria-live={playing ? 'off' : 'polite'}>
          <p className="text-base leading-snug text-ink sm:text-lg">{current.caption}</p>
          <span className="shrink-0 font-mono text-xs text-muted">{current.term}</span>
        </div>
      </div>
    </section>
  );
}
