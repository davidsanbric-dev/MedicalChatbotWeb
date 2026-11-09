import { clsx } from 'clsx';
import { AlertTriangle, CheckCircle2, Info, Wrench, XCircle } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

export function Card({
  className,
  children,
  style,
}: {
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className={clsx('rounded-xl border border-line bg-surface', className)} style={style}>
      {children}
    </div>
  );
}

export function Pill({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
      {color && <span className="size-1.5 rounded-full" style={{ background: color }} />}
      {children}
    </span>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[0.85em] text-ink">{children}</code>
  );
}

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[#0d131a]">
      {label && (
        <div className="border-b border-line px-4 py-2 font-mono text-xs text-muted">{label}</div>
      )}
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-ink-2">
        <code>{code}</code>
      </pre>
    </div>
  );
}

type Tone = 'good' | 'fixed' | 'warning' | 'critical' | 'info';

const TONE: Record<Tone, { icon: typeof Info; color: string; label: string }> = {
  good: { icon: CheckCircle2, color: 'var(--color-good)', label: 'OK' },
  fixed: { icon: Wrench, color: 'var(--color-good)', label: 'Fixed' },
  warning: { icon: AlertTriangle, color: 'var(--color-warning)', label: 'Issue' },
  critical: { icon: XCircle, color: 'var(--color-critical)', label: 'Bug' },
  info: { icon: Info, color: 'var(--color-ink-2)', label: 'Note' },
};

/** Status always carries icon + text label, never color alone. */
export function Finding({ tone, title, children }: { tone: Tone; title: string; children: ReactNode }) {
  const t = TONE[tone];
  const Icon = t.icon;
  return (
    <Card className="flex gap-3 p-4">
      <Icon className="mt-0.5 size-5 shrink-0" style={{ color: t.color }} aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">
          <span className="mr-2 font-mono text-[11px] tracking-wide uppercase" style={{ color: t.color }}>
            {t.label}
          </span>
          {title}
        </p>
        <div className="mt-1 text-sm leading-relaxed text-ink-2">{children}</div>
      </div>
    </Card>
  );
}

/** Numbered flow of steps (vertical on mobile, grid on desktop). */
export function StepFlow({
  steps,
  accent,
}: {
  steps: { title: string; body: ReactNode; tag?: string }[];
  accent: string;
}) {
  return (
    <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {steps.map((step, i) => (
        <li key={step.title}>
          <Card className="h-full p-4">
            <div className="flex items-center gap-2">
              <span
                className="grid size-6 place-items-center rounded-md font-mono text-xs font-medium text-page"
                style={{ background: accent }}
              >
                {i + 1}
              </span>
              <h3 className="text-sm font-semibold text-ink">{step.title}</h3>
              {step.tag && <span className="ml-auto font-mono text-[11px] text-muted">{step.tag}</span>}
            </div>
            <div className="mt-2 text-sm leading-relaxed text-ink-2">{step.body}</div>
          </Card>
        </li>
      ))}
    </ol>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'rounded-md px-3 py-1.5 text-sm transition-colors',
            value === o.value ? 'bg-surface-3 text-ink' : 'text-ink-2 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

