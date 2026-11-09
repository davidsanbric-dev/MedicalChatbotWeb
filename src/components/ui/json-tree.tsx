import { ChevronRight } from 'lucide-react';
import { useState } from 'react';

const NBSP = ' ';

/**
 * Collapsible JSON viewer. Non-breaking spaces are rendered as a visible "⍽"
 * marker so the data-quality issue they represent can be seen in place.
 */
export function JsonTree({ value, depth = 2, label }: { value: unknown; depth?: number; label?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-[#0d131a] p-4 font-mono text-[12.5px] leading-relaxed">
      <Node value={value} name={label} open={depth} level={0} />
    </div>
  );
}

function Node({ value, name, open, level }: { value: unknown; name?: string; open: number; level: number }) {
  const [expanded, setExpanded] = useState(level < open);
  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === 'object';

  const key = name !== undefined && (
    <span className="text-[#7fb2ef]">{/^\d+$/.test(name) ? name : `"${name}"`}</span>
  );

  if (!isObject) {
    return (
      <div className="pl-4">
        {key}
        {key && <span className="text-muted">: </span>}
        <Primitive value={value} />
      </div>
    );
  }

  const entries = isArray ? (value as unknown[]).map((v, i) => [String(i), v] as const) : Object.entries(value);
  const [openB, closeB] = isArray ? ['[', ']'] : ['{', '}'];

  return (
    <div className={level ? 'pl-4' : ''}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="-ml-4 inline-flex items-center text-left hover:text-ink"
        aria-expanded={expanded}
      >
        <ChevronRight className={`size-4 text-muted transition-transform ${expanded ? 'rotate-90' : ''}`} />
        {key}
        {key && <span className="text-muted">: </span>}
        <span className="text-muted">{openB}</span>
        {!expanded && (
          <span className="text-muted">
            {' '}
            {entries.length} {isArray ? 'items' : 'keys'} {closeB}
          </span>
        )}
      </button>
      {expanded && (
        <>
          {entries.map(([k, v]) => (
            <Node key={k} name={k} value={v} open={open} level={level + 1} />
          ))}
          <div className="text-muted">{closeB}</div>
        </>
      )}
    </div>
  );
}

function Primitive({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    const parts = value.split(NBSP);
    return (
      <span className="break-words whitespace-pre-wrap text-[#9fd8b6]">
        "
        {parts.map((p, i) => (
          <span key={i}>
            {p}
            {i < parts.length - 1 && (
              <span className="rounded bg-[#fab219]/20 px-0.5 text-[#fab219]" title="Non-breaking space (U+00A0)">
                ⍽
              </span>
            )}
          </span>
        ))}
        "
      </span>
    );
  }
  if (typeof value === 'number') return <span className="text-[#f0b46a]">{value}</span>;
  if (typeof value === 'boolean') return <span className="text-[#e28fb0]">{String(value)}</span>;
  return <span className="text-muted">null</span>;
}
