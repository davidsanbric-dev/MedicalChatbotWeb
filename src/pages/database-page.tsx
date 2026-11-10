import type { ColumnDef } from '@tanstack/react-table';
import { KeyRound, Link2 } from 'lucide-react';
import { lazy } from 'react';
import { LayerPage, Showcase } from '@/components/layout/layer-page';
import type { StoryStep } from '@/components/story/story-scene';
import { DataTable } from '@/components/ui/data-table';
import { Card, Code, CodeBlock, Finding } from '@/components/ui/primitives';
import { BarList } from '@/components/viz/bar-list';
import { LineageTrace } from '@/components/viz/lineage-trace';
import { LAYERS } from '@/data/layers';
import { snapshot, type Condition } from '@/data/snapshot';
import { fmt } from '@/lib/format';

const DatabaseScene = lazy(() => import('@/components/three/scenes/database-scene'));
const s = snapshot;

const STEPS: StoryStep[] = [
  {
    title: 'Keep the original',
    term: 'raw_data · JSONB',
    caption: 'Every page is stored exactly as it was collected, so any later step can be re-run from the source.',
  },
  {
    title: 'Keep the clean version',
    term: 'processed_data',
    caption: 'The tidied record is stored next to it, labeled with the version of the worker that produced it.',
  },
  {
    title: 'Keep passages + numbers',
    term: 'documents · pgvector',
    caption: `${fmt.format(s.stages.documents.rows)} passages, each saved with its ${s.meta.embeddingDims} numbers, ready to be searched by meaning.`,
  },
  {
    title: 'Everything is linked',
    term: 'lineage · foreign keys',
    caption: 'Each passage points back to its record and its web page, so any answer can be traced to its source.',
  },
];

type Col = { name: string; type: string; pk?: boolean; fk?: string; note?: string };
const TABLES: { name: string; writer: string; color: string; cols: Col[] }[] = [
  {
    name: 'raw_data',
    writer: 'Scraper',
    color: LAYERS[0].color,
    cols: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'content', type: 'jsonb', note: 'page as scraped' },
      { name: 'source', type: 'varchar', note: 'medical_conditions:<slug>' },
      { name: 'created_at', type: 'timestamptz' },
    ],
  },
  {
    name: 'processed_data',
    writer: 'Worker',
    color: LAYERS[1].color,
    cols: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'raw_data_id', type: 'uuid', fk: 'raw_data.id' },
      { name: 'content', type: 'jsonb' },
      { name: 'processor_version', type: 'varchar' },
      { name: 'condition_name', type: 'varchar' },
      { name: 'processing_metadata', type: 'jsonb' },
    ],
  },
  {
    name: 'documents',
    writer: 'Worker',
    color: LAYERS[2].color,
    cols: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'processed_data_id', type: 'uuid', fk: 'processed_data.id' },
      { name: 'content', type: 'text', note: 'the passage' },
      { name: 'content_type', type: 'varchar' },
      { name: 'metadata_', type: 'jsonb' },
      { name: 'embedding', type: `vector(${s.meta.embeddingDims})`, note: 'HNSW, cosine' },
    ],
  },
  {
    name: 'chat_history',
    writer: 'API',
    color: LAYERS[3].color,
    cols: [
      { name: 'session_id', type: 'varchar', pk: true },
      { name: 'history', type: 'jsonb', note: 'LangChain messages' },
      { name: 'updated_at', type: 'timestamptz' },
    ],
  },
];

const columns: ColumnDef<Condition, unknown>[] = [
  { accessorKey: 'name', header: 'Condition' },
  { accessorKey: 'symptoms', header: 'Symptoms', meta: { numeric: true } },
  { accessorKey: 'paragraphs', header: 'Paragraphs', meta: { numeric: true } },
  { accessorKey: 'lists', header: 'Lists', meta: { numeric: true } },
  { accessorKey: 'chunks', header: 'Chunks', meta: { numeric: true } },
  { accessorKey: 'chunkChars', header: 'Chunk chars', meta: { numeric: true }, cell: (c) => fmt.format(Number(c.getValue())) },
];

const kib = (b: number) => Math.round(b / 1024);

export function DatabasePage() {
  return (
    <LayerPage
      id="database"
      steps={STEPS}
      scene={(step) => <DatabaseScene step={step} />}
      numbers={[
        { value: '1', label: 'database holds every stage' },
        { value: fmt.format(s.stages.documents.rows), label: 'passages searchable by meaning' },
        { value: '100%', label: 'of passages traceable to their page' },
      ]}
      details={[
        {
          id: 'schema',
          label: 'Tables',
          source: 'app/core/models.py',
          content: (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {TABLES.map((t) => (
                <Card key={t.name} className="relative overflow-hidden">
                  <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: t.color }} />
                  <div className="flex items-baseline justify-between gap-2 border-b border-line px-4 py-3">
                    <h3 className="font-mono text-sm font-medium text-ink">{t.name}</h3>
                    <span className="text-xs text-muted">by {t.writer}</span>
                  </div>
                  <ul className="divide-y divide-line">
                    {t.cols.map((c) => (
                      <li key={c.name} className="px-4 py-1.5">
                        <div className="flex items-center gap-2 font-mono text-[12.5px]">
                          {c.pk ? (
                            <KeyRound className="size-3.5 text-warning" aria-label="primary key" />
                          ) : c.fk ? (
                            <Link2 className="size-3.5 text-database" aria-label="foreign key" />
                          ) : (
                            <span className="size-3.5" />
                          )}
                          <span className="text-ink">{c.name}</span>
                          <span className="ml-auto text-muted">{c.type}</span>
                        </div>
                        {(c.fk || c.note) && <p className="pl-5.5 text-xs text-ink-2">{c.fk ? `→ ${c.fk}` : c.note}</p>}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          ),
        },
        {
          id: 'explorer',
          label: 'Per condition',
          content: (
            <DataTable
              caption="Per-condition counts of processed content and chunks"
              data={s.conditions}
              columns={columns}
              initialSort={[{ id: 'chunks', desc: true }]}
              searchPlaceholder="Filter conditions…"
            />
          ),
        },
        {
          id: 'sql',
          label: 'SQL',
          source: 'app/repositories/documents.py',
          content: (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <CodeBlock
                label="Retrieval (what the API's ORM query compiles to)"
                code={`SELECT d.id, d.content, d.metadata_,
       d.embedding <=> :query_vec AS distance
FROM documents d
ORDER BY d.embedding <=> :query_vec   -- cosine distance
LIMIT ${s.meta.topK};`}
              />
              <CodeBlock
                label="Lineage: a passage back to its page"
                code={`SELECT r.content->>'url' AS page, p.processor_version
FROM documents d
JOIN processed_data p ON p.id = d.processed_data_id
JOIN raw_data r       ON r.id = p.raw_data_id
WHERE d.id = :passage_id;`}
              />
            </div>
          ),
        },
        {
          id: 'notes',
          label: 'Design notes',
          source: 'app/core/database.py',
          content: (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Finding tone="info" title="Exact search at this size">
                With {fmt.format(s.stages.documents.rows)} vectors Postgres scans them all: exact and cheaper than the
                HNSW index, so recall is 100%.
              </Finding>
              <Finding tone="fixed" title="An index that needs no rebuild">
                The old ivfflat index was built on the empty table, and with the wrong distance, so search could never
                use it. It is now HNSW (cosine), which needs no data to build and takes over as the table grows.
              </Finding>
              <Finding tone="info" title="JSONB for evolving stages">
                Raw and processed records keep their nested shape, so the schema stays stable while the parser evolves. A
                new <Code>processor_version</Code> replaces older rows in one transaction.
              </Finding>
              <Finding tone="info" title="Chat memory: one row per session">
                Rewritten each turn. Fine for a demo; append-only message rows would scale better.
              </Finding>
            </div>
          ),
        },
      ]}
    >
      <Showcase title="Follow one condition through the database" lead="Pick any condition to see what each stage keeps about it.">
        <LineageTrace />
      </Showcase>
      <Showcase
        title="Where the space goes"
        lead={`The passages and their numbers take ${Math.round(s.stages.documents.bytes / s.stages.raw_data.bytes)}× more space than the pages they came from.`}
      >
        <Card className="p-5">
          <BarList
            caption="Storage per stage in KiB"
            color={LAYERS[2].color}
            unit="KiB"
            rows={[
              { label: 'Original pages', value: kib(s.stages.raw_data.bytes) },
              { label: 'Clean records', value: kib(s.stages.processed_data.bytes) },
              { label: 'Passages + numbers', value: kib(s.stages.documents.bytes) },
            ]}
          />
        </Card>
      </Showcase>
    </LayerPage>
  );
}
