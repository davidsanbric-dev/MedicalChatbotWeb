import { clsx } from 'clsx';
import { Database, Headset, ShieldAlert, X } from 'lucide-react';
import { useEffect } from 'react';
import type { HandoffTicket } from '@/lib/api';
import { useToastStore } from '@/stores/toast-store';

/** Routine and urgent requests close on their own; an emergency stays until dismissed. */
const AUTO_CLOSE_MS = 12_000;

const URGENCY: Record<HandoffTicket['urgency'], { label: string; className: string }> = {
  routine: { label: 'Routine', className: 'border-line-strong text-ink-2' },
  urgent: { label: 'Urgent · today', className: 'border-warning/50 bg-warning/10 text-warning' },
  emergency: { label: 'Emergency', className: 'border-critical/50 bg-critical/15 text-critical' },
};

/**
 * The agent's request_human_handoff result, outside the chat: the handoff_requests row it
 * saved, so a person from the care team can pick the conversation up.
 */
export function HandoffToaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed top-16 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((ticket) => (
        <HandoffToast key={ticket.id} ticket={ticket} />
      ))}
    </div>
  );
}

function HandoffToast({ ticket }: { ticket: HandoffTicket }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const emergency = ticket.urgency === 'emergency';
  const urgency = URGENCY[ticket.urgency];
  const Icon = emergency ? ShieldAlert : Headset;

  useEffect(() => {
    if (emergency) return;
    const timer = window.setTimeout(() => dismiss(ticket.id), AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [emergency, dismiss, ticket.id]);

  const opened = new Date(ticket.opened_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <section
      role={emergency ? 'alert' : 'status'}
      aria-label={emergency ? 'Emergency request sent to the care team' : 'A person from the care team will contact you'}
      className={clsx(
        'toast-in pointer-events-auto overflow-hidden rounded-xl border bg-surface shadow-2xl shadow-black/40',
        emergency ? 'border-critical/60' : 'border-interface/50',
      )}
    >
      <header className="flex items-start gap-3 px-4 pt-3">
        <span
          className={clsx(
            'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg',
            emergency ? 'bg-critical/15 text-critical' : 'bg-interface/15 text-interface',
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-ink">
            {emergency ? 'Emergency request sent to the care team' : 'A person from the care team will contact you'}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            <Database className="mr-1 inline size-3 align-[-2px]" aria-hidden />
            Handoff request saved to the database
          </p>
        </div>
        <button
          type="button"
          onClick={() => dismiss(ticket.id)}
          className="-mr-1 grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </header>

      <dl className="mx-4 mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-xs">
        <dt className="text-muted">Request</dt>
        <dd className="font-mono text-ink">#{ticket.reference}</dd>
        <dt className="text-muted">Urgency</dt>
        <dd>
          <span className={clsx('inline-block rounded border px-1.5 py-px text-[11px] font-medium', urgency.className)}>
            {urgency.label}
          </span>
        </dd>
        <dt className="text-muted">Reason</dt>
        <dd className="text-ink-2">{ticket.reason}</dd>
        <dt className="text-muted">Status</dt>
        <dd className="text-ink-2">
          Open · since <time dateTime={ticket.opened_at}>{opened}</time>
        </dd>
        <dt className="text-muted">Saved by</dt>
        <dd className="truncate font-mono text-ink-2">request_human_handoff()</dd>
      </dl>

      <p className="px-4 pt-2 pb-3 text-[11px] text-muted">Demo only: nobody is actually notified.</p>
    </section>
  );
}
