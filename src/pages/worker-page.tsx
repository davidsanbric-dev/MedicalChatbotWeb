import { Suspense, lazy, useMemo, useState } from 'react';
import { LayerPage, Showcase } from '@/components/layout/layer-page';
import { SceneBoundary, SceneFallback } from '@/components/story/scene-boundary';
import type { StoryStep } from '@/components/story/story-scene';
import { JsonTree } from '@/components/ui/json-tree';
import { Card, Code, CodeBlock, Finding, Tabs } from '@/components/ui/primitives';
import { CONTENT_TYPE_COLOR, CONTENT_TYPE_LABEL, snapshot, type ContentType } from '@/data/snapshot';
import { fmt } from '@/lib/format';

const WorkerScene = lazy(() => import('@/components/three/scenes/worker-scene'));
const MeaningMap = lazy(() => import('@/components/three/meaning-map'));

const s = snapshot;
const listCount = s.chunkTypes.find((t) => t.type === 'list_item')?.count ?? 0;
const afterAcne = s.sample.documents.find((d) => d.contentType === 'list_item')?.content ?? '';
const renamedConditions = s.conditions.filter((c) => c.slug !== c.name.toLowerCase()).length;

// Exactly what the v5 chunker produced for the same list (f"{heading}: {', '.join(str(item) ...)}").
const BEFORE_ACNE =
  "Options for treatment of acne may include:: ['For mild acne:', ['Gentle cleansing', 'Applying benzoyl peroxide (i.e. Brevoxyl)', 'Applying salicylic acid (i.e. Stridex)']], ['For moderate to severe acne:', ['Benzoyl peroxide', 'Draining of large pimples', ['A prescription for:', ['Antibiotic gels, creams or lotions', 'Retinoids', 'Azelaic acid']]]]";

const STEPS: StoryStep[] = [
  {
    title: 'Tidy up',
    term: 'normalization',
    caption: 'Names are simplified and stray characters cleaned, so every record follows the same shape.',
  },
  {
    title: 'Cut into passages',
    term: 'chunking',
    caption: 'Each page is cut into short passages that each say one thing: the symptoms, a paragraph or a list.',
  },
  {
    title: 'Turn into numbers',
    term: 'embeddings',
    caption: `A small AI model turns every passage into ${s.meta.embeddingDims} numbers that capture what it means.`,
  },
  {
    title: 'Similar meanings, close together',
    term: 'vector space',
    caption: 'Placed by those numbers, passages about the same thing end up side by side, which is what makes search work.',
  },
];

type View = 'raw' | 'processed' | 'chunks';

export function WorkerPage() {
  const [focus, setFocus] = useState(s.sample.condition);
  const highlight = useMemo(
    () => (focus ? new Set(s.projection.points.filter((p) => p.condition === focus).map((p) => p.id)) : null),
    [focus],
  );
  const [view, setView] = useState<View>('chunks');

  return (
    <LayerPage
      id="worker"
      steps={STEPS}
      scene={(step) => <WorkerScene step={step} />}
      numbers={[
        { value: s.stages.processed_data.rows, label: 'records tidied up' },
        { value: fmt.format(s.stages.documents.rows), label: 'passages cut from them' },
        { value: s.meta.embeddingDims, label: 'numbers describe each passage' },
      ]}
      details={[
        {
          id: 'stages',
          label: 'One record, three forms',
          source: 'services/processing.py',
          content: (
            <>
              <div className="mb-4">
                <Tabs<View>
                  label="Pipeline stage"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'raw', label: 'raw_data' },
                    { value: 'processed', label: 'processed_data' },
                    { value: 'chunks', label: `documents (${s.sample.documents.length})` },
                  ]}
                />
              </div>
              {view === 'raw' && <JsonTree value={s.sample.raw.content} depth={3} />}
              {view === 'processed' && (
                <div className="space-y-3">
                  <JsonTree value={s.sample.processed.content} depth={4} />
                  <JsonTree value={s.sample.processed.processingMetadata} label="processing_metadata" depth={1} />
                </div>
              )}
              {view === 'chunks' && (
                <ul className="space-y-2">
                  {s.sample.documents.map((d) => (
                    <li key={d.id}>
                      <Card className="p-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1.5 text-ink">
                            <span className="size-2 rounded-full" style={{ background: CONTENT_TYPE_COLOR[d.contentType] }} />
                            {CONTENT_TYPE_LABEL[d.contentType]} chunk
                          </span>
                          <span className="text-muted">· {d.content.length} chars</span>
                          <span className="ml-auto truncate font-mono text-muted">
                            [{d.embeddingHead.map((v) => v.toFixed(3)).join(', ')}, … +{s.meta.embeddingDims - d.embeddingHead.length}]
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-ink-2">{d.content}</p>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ),
        },
        {
          id: 'chunks',
          label: 'Chunk stats',
          source: 'services/chunking.py',
          content: (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Chunk counts and lengths per content type</caption>
                <thead className="bg-surface-2 text-ink-2">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-left font-medium">Type</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Chunks</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Min chars</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Avg</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Max</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {s.chunkTypes.map((t) => (
                    <tr key={t.type} className="border-t border-line">
                      <td className="px-4 py-2 text-ink">
                        <span className="mr-2 inline-block size-2 rounded-full" style={{ background: CONTENT_TYPE_COLOR[t.type] }} />
                        {CONTENT_TYPE_LABEL[t.type]}
                      </td>
                      <td className="px-3 py-2 text-right text-ink">{t.count}</td>
                      <td className="px-3 py-2 text-right text-ink-2">{t.minChars}</td>
                      <td className="px-3 py-2 text-right text-ink">{t.avgChars}</td>
                      <td className="px-4 py-2 text-right text-ink-2">{fmt.format(t.maxChars)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ),
        },
        {
          id: 'fixes',
          label: 'Audit & fixes',
          source: 'tests/test_processing.py',
          content: (
            <>
              <p className="mb-4 max-w-3xl text-sm leading-relaxed text-ink-2">
                Auditing this data surfaced four worker bugs, fixed in processor <Code>v6</Code>; a later code audit fixed
                two more. Unit tests cover the rules (<Code>tests/</Code>), and re-running the worker migrates older rows
                instead of duplicating them.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Finding tone="fixed" title="Re-runs no longer duplicate">
                  A second run used to double <Code>documents</Code> ({fmt.format(s.stages.documents.rows)} →{' '}
                  {fmt.format(s.stages.documents.rows * 2)}). Embedded records are now skipped; <Code>--reembed</Code> replaces
                  them in one transaction.
                </Finding>
                <Finding tone="fixed" title="Lists are readable text">
                  14 of {listCount} list chunks embedded Python syntax. Now they are nested bullets (
                  {s.audit.listChunksWithPythonRepr} left).
                </Finding>
                <Finding tone="fixed" title="No list loses its items">
                  13 lists embedded only their heading. Every list shape now keeps its items.
                </Finding>
                <Finding tone="fixed" title="Text is normalized">
                  {s.audit.nbspRaw} non-breaking spaces stay in <Code>raw_data</Code>; {s.audit.chunksWithNbsp} reach the
                  embeddings (NFKC).
                </Finding>
                <Finding tone="fixed" title="Slug or name, both work">
                  <Code>--list-conditions</Code> printed page slugs that <Code>--condition</Code> did not accept for{' '}
                  {renamedConditions} of {s.audit.records} conditions (<Code>allergies</Code> vs “Allergy”). Either form
                  works now, and an unknown one is an error instead of a silent no-op.
                </Finding>
                <Finding tone="fixed" title="Same output, half the code">
                  Unused helpers and queries were removed. Every record, passage and embedding was then re-checked: identical
                  on all {s.audit.records} pages.
                </Finding>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="flex flex-col">
                  <p className="mb-2 font-mono text-xs text-muted">Before · v5 chunk for Acne</p>
                  <pre className="flex-1 overflow-x-auto rounded-xl border border-critical/30 bg-[#0d131a] p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink-2">
                    {BEFORE_ACNE}
                  </pre>
                </div>
                <div className="flex flex-col">
                  <p className="mb-2 font-mono text-xs text-muted">After · v6 chunk for Acne</p>
                  <pre className="flex-1 overflow-x-auto rounded-xl border border-good/30 bg-[#0d131a] p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink-2">
                    {afterAcne}
                  </pre>
                </div>
              </div>
            </>
          ),
        },
        {
          id: 'run',
          label: 'Run it',
          source: 'main.py',
          content: (
            <CodeBlock
              label="shell"
              code={`# process what is new, then embed what has no chunks yet
uv run python main.py

# one condition, by page slug or by name / rebuild its passages
uv run python main.py --condition acid-reflux-gerd
uv run python main.py --condition Acne --reembed

# unit tests for the processing and chunking rules
uv run pytest`}
            />
          ),
        },
      ]}
    >
      <Showcase
        title="The meaning map"
        lead={`All ${fmt.format(s.stages.documents.rows)} passages, placed by meaning. Each dot is one passage; close dots say similar things. Drag to turn it, hover a dot to read it.`}
      >
        <div className="overflow-hidden rounded-2xl border border-line bg-[#0c1219]">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-4 py-3 text-sm">
            <label className="flex items-center gap-2 text-ink-2">
              Light up
              <select
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-ink focus:border-line-strong focus:outline-none"
              >
                <option value="">Nothing</option>
                {s.conditions.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <ul className="flex flex-wrap gap-4 text-xs text-ink-2" aria-label="Legend">
              {(Object.keys(CONTENT_TYPE_LABEL) as ContentType[]).map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: CONTENT_TYPE_COLOR[t] }} />
                  {CONTENT_TYPE_LABEL[t]} passage
                </li>
              ))}
            </ul>
          </div>
          <div className="h-[380px] sm:h-[460px]">
            <SceneBoundary>
              <Suspense fallback={<SceneFallback />}>
                <MeaningMap highlight={highlight} />
              </Suspense>
            </SceneBoundary>
          </div>
        </div>
      </Showcase>
    </LayerPage>
  );
}
