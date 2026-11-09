import { Link } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { BrainCircuit, Cog, Database, Globe, MessagesSquare, ScanSearch, type LucideIcon } from 'lucide-react';
import { Fragment } from 'react';
import { LAYERS, SOURCE, type LayerId } from '@/data/layers';

const ICON: Record<LayerId | 'source', LucideIcon> = {
  source: Globe,
  scraper: ScanSearch,
  worker: Cog,
  database: Database,
  api: BrainCircuit,
  interface: MessagesSquare,
};

const NODES = [
  { id: 'source' as const, name: SOURCE.name, color: SOURCE.color, path: null, output: SOURCE.output },
  ...LAYERS.map((l) => ({ id: l.id, name: l.name, color: l.color, path: l.path, output: l.output })),
];

/**
 * The bigger picture on every station page: the whole line, with this station
 * lit and what flows in and out of it animated.
 */
export function PipelineMap({ current }: { current: LayerId }) {
  const at = NODES.findIndex((n) => n.id === current);
  return (
    <nav aria-label="Where this station sits in the pipeline">
      <ol className="flex items-start">
        {NODES.map((n, i) => {
          const Icon = ICON[n.id];
          const isCurrent = i === at;
          const node = (
            <span
              className={clsx(
                'grid place-items-center rounded-full border transition-colors',
                isCurrent ? 'size-11' : 'size-9 group-hover:bg-surface-2',
              )}
              style={
                isCurrent
                  ? { background: n.color, borderColor: n.color, color: '#0b1016', boxShadow: `0 0 24px ${n.color}66` }
                  : { borderColor: `${n.color}66`, color: n.color, background: 'var(--color-surface)' }
              }
            >
              <Icon className={isCurrent ? 'size-5' : 'size-4'} aria-hidden />
            </span>
          );
          const label = (
            <span
              className={clsx(
                'mt-1.5 text-center text-[11px] leading-tight whitespace-nowrap sm:text-xs',
                isCurrent ? 'font-semibold text-ink' : 'hidden text-ink-2 group-hover:text-ink sm:block',
              )}
            >
              {n.name}
            </span>
          );
          const flowIn = i === at - 1;
          const flowOut = i === at;
          return (
            <Fragment key={n.id}>
              <li className="flex w-11 shrink-0 flex-col items-center">
                {n.path && !isCurrent ? (
                  <Link to={n.path} className="group flex flex-col items-center" aria-label={`Station: ${n.name}`}>
                    {node}
                    {label}
                  </Link>
                ) : (
                  <span className="flex flex-col items-center" aria-current={isCurrent ? 'page' : undefined}>
                    {node}
                    {label}
                  </span>
                )}
              </li>
              {i < NODES.length - 1 && (
                <li aria-hidden className="relative mt-[21px] min-w-3 flex-1 px-1">
                  <span
                    className={clsx('block h-0.5 rounded-full', (flowIn || flowOut) && 'flow-dash')}
                    style={{
                      color: flowIn || flowOut ? n.color : undefined,
                      background: flowIn || flowOut ? undefined : 'var(--color-line-strong)',
                    }}
                  />
                  <span
                    className={clsx(
                      'absolute inset-x-0 top-2 hidden text-center font-mono text-[10px] leading-tight lg:block',
                      flowIn || flowOut ? 'text-ink-2' : 'text-muted/70',
                    )}
                  >
                    {n.output}
                  </span>
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
