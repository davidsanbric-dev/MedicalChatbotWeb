import type { ColumnDef } from '@tanstack/react-table';
import { ExternalLink } from 'lucide-react';
import { lazy } from 'react';
import { LayerPage, Showcase } from '@/components/layout/layer-page';
import type { StoryStep } from '@/components/story/story-scene';
import { DataTable } from '@/components/ui/data-table';
import { JsonTree } from '@/components/ui/json-tree';
import { Card, Code, CodeBlock, Finding } from '@/components/ui/primitives';
import { PageAnatomy } from '@/components/viz/page-anatomy';
import { snapshot, type Condition } from '@/data/snapshot';

const ScraperScene = lazy(() => import('@/components/three/scenes/scraper-scene'));
const s = snapshot;

const STEPS: StoryStep[] = [
  {
    title: 'Find every page',
    term: 'sitemap discovery',
    caption: `It reads the website’s map and finds all ${s.audit.records} condition pages.`,
  },
  {
    title: 'Visit one at a time',
    term: 'polite crawling',
    caption: 'Pages are downloaded one by one with a short pause, so the website is never overloaded. A hiccup is simply retried.',
  },
  {
    title: 'Pick out what matters',
    term: 'HTML parsing',
    caption: 'From each page it keeps the condition’s name, its symptoms and how it is treated, and leaves menus behind.',
  },
  {
    title: 'Save the record',
    term: 'raw_data · JSONB',
    caption: 'Each page becomes one record, saved exactly as found. Pages already saved are skipped next time.',
  },
];

const MAPPING = [
  { selector: 'h1', field: 'title', note: 'Falls back to the slug in title case when missing.' },
  {
    selector: 'div.contact-us-card > h2, ul > li',
    field: 'symptoms',
    note: 'Drops the “And more.” placeholder item. The heading was an h3 before the 2026 redesign; both are read.',
  },
  {
    selector: 'div.rtf--with-margin > h2',
    field: 'onlineDiagnosingAndTreating.heading',
    note: 'The clinical narrative of each page. Was section.rtf before the 2026 redesign; both are read.',
  },
  {
    selector: 'div.rtf--with-margin > p | ul | ol',
    field: 'onlineDiagnosingAndTreating.content[]',
    note: 'Typed blocks; consecutive lists merged; nested <li> trees kept by recursion.',
  },
  { selector: 'section, div.section', field: 'sections[]', note: 'Other headed sections (duplicates skipped).' },
];

const columns: ColumnDef<Condition, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Condition',
    cell: ({ row }) => (
      <a href={row.original.url} className="inline-flex items-center gap-1 hover:underline" rel="noreferrer">
        {row.original.name}
        <ExternalLink className="size-3 text-muted" />
      </a>
    ),
  },
  { accessorKey: 'symptoms', header: 'Symptoms', meta: { numeric: true } },
  { accessorKey: 'rawBlocks', header: 'Content blocks', meta: { numeric: true } },
  { accessorKey: 'nbsp', header: 'NBSP chars', meta: { numeric: true } },
  {
    accessorKey: 'rawBytes',
    header: 'JSON size',
    meta: { numeric: true },
    cell: (c) => `${(Number(c.getValue()) / 1024).toFixed(1)} KiB`,
  },
];

export function ScraperPage() {
  return (
    <LayerPage
      id="scraper"
      steps={STEPS}
      scene={(step) => <ScraperScene step={step} />}
      numbers={[
        { value: s.audit.records, label: 'pages collected' },
        { value: '1 s', label: 'pause between two pages' },
        { value: s.audit.distinctSymptoms, label: 'different symptoms found' },
      ]}
      details={[
        {
          id: 'mapping',
          label: 'HTML → JSON',
          source: 'jobs/parser.py',
          content: (
            <Card className="divide-y divide-line">
              {MAPPING.map((m) => (
                <div key={m.field} className="grid grid-cols-1 gap-1 px-4 py-3 md:grid-cols-[minmax(0,14rem)_minmax(0,16rem)_1fr] md:gap-4">
                  <span className="font-mono text-[13px] text-scraper">{m.selector}</span>
                  <span className="font-mono text-[13px] text-ink">→ {m.field}</span>
                  <span className="text-sm text-ink-2">{m.note}</span>
                </div>
              ))}
            </Card>
          ),
        },
        {
          id: 'record',
          label: 'Raw record',
          source: 'jobs/persistence.py',
          content: (
            <>
              <p className="mb-3 text-sm text-ink-2">
                Exactly what was stored in <Code>raw_data.content</Code> for “{s.sample.condition}”. Non-breaking spaces
                from the HTML are marked <span className="rounded bg-warning/20 px-1 font-mono text-warning">⍽</span>.
              </p>
              <JsonTree value={s.sample.raw.content} depth={3} />
            </>
          ),
        },
        {
          id: 'dataset',
          label: 'All pages',
          content: (
            <DataTable
              caption="Scraped conditions"
              data={s.conditions}
              columns={columns}
              initialSort={[{ id: 'name', desc: false }]}
              searchPlaceholder="Filter conditions…"
            />
          ),
        },
        {
          id: 'quality',
          label: 'Data quality',
          source: 'tests/test_parser.py',
          content: (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Finding tone="good" title="Every page parsed">
                {s.audit.missingSymptoms} of {s.audit.records} records lack a symptom list. The parser reads both the
                original page layout and the site’s 2026 redesign, and unit tests cover both.
              </Finding>
              <Finding tone="fixed" title="Two empty fields retired">
                <Code>introduction</Code> and <Code>faqs</Code> were empty in all {s.audit.records} records: the pages
                have no intro or FAQ block. The scraper no longer writes them; stored records keep the empty keys.
              </Finding>
              <Finding tone="info" title="Raw stays raw">
                {s.audit.nbspRaw} non-breaking spaces in {s.audit.recordsWithNbsp} records are kept here on purpose; the
                worker normalizes them.
              </Finding>
              <Finding tone="fixed" title="Retries, then re-runs">
                A failed request is retried up to 3 times with growing pauses, honoring the site’s Retry-After. Anything
                still failing is listed at the end, and re-running fills the gap, because saved pages are skipped.
              </Finding>
            </div>
          ),
        },
        {
          id: 'run',
          label: 'Run it',
          source: 'main.py',
          content: (
            <CodeBlock
              label="shell"
              code={`# list what can be scraped
uv run python main.py --list-conditions

# scrape everything into the shared database, 2 s apart
uv run python main.py --all --database --delay 2.0

# one condition, in Docker
docker compose run --rm scraper \\
  uv run python main.py --condition acne --database`}
            />
          ),
        },
      ]}
    >
      <Showcase
        title="What it reads on each page"
        lead={`The real page for “${s.sample.condition}”. Three parts are kept; everything else is left behind. Hover a part to match it.`}
      >
        <PageAnatomy />
      </Showcase>
    </LayerPage>
  );
}
