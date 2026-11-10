import { snapshot } from './snapshot';

/**
 * The pipeline as a line of stations, source → user. One definition drives the
 * 3D scenes, the navigation, the pipeline map and every page header, so names,
 * colors and numbers can't drift between them.
 */

export type LayerId = 'scraper' | 'worker' | 'database' | 'api' | 'interface';

export interface Layer {
  id: LayerId;
  index: number;
  /** Plain-language job of the station. */
  verb: string;
  /** The data-engineering term for the same job. */
  stage: string;
  name: string;
  title: string;
  lead: string;
  /** One short line for the home cards. */
  blurb: string;
  /** What this station hands to the next one. */
  output: string;
  /** The one number shown on the home card. */
  number: { value: string; label: string };
  path: `/${LayerId}`;
  repo: { name: string; url: string | null };
  /** Categorical slot, validated for adjacent separation on the dark surface. */
  color: string;
  stack: string[];
}

const s = snapshot;

export const LAYERS: Layer[] = [
  {
    id: 'scraper',
    index: 1,
    verb: 'Collect',
    stage: 'Extract',
    name: 'Scraper',
    title: 'Collecting the pages',
    lead: 'A small program visits the source website, reads each health-condition page and keeps only the parts that matter.',
    blurb: 'Visits the website and saves each condition page as a record.',
    output: 'raw records',
    number: { value: String(s.audit.records), label: 'pages collected' },
    path: '/scraper',
    repo: { name: 'MedicalChatbotScraper', url: 'https://github.com/davidsanbric-dev/MedicalChatbotScraper' },
    color: '#3987e5',
    stack: ['Python 3.12', 'requests', 'BeautifulSoup4', 'SQLAlchemy', 'pytest', 'Docker'],
  },
  {
    id: 'worker',
    index: 2,
    verb: 'Prepare',
    stage: 'Transform',
    name: 'Worker',
    title: 'Preparing the knowledge',
    lead: 'Each record is tidied up and cut into short passages, and every passage is turned into numbers that capture its meaning.',
    blurb: 'Cleans each record, cuts it into passages and turns their meaning into numbers.',
    output: 'passages + numbers',
    number: { value: String(s.stages.documents.rows), label: 'passages' },
    path: '/worker',
    repo: { name: 'MedicalChatbotWorker', url: 'https://github.com/davidsanbric-dev/MedicalChatbotWorker' },
    color: '#d95926',
    stack: ['Python 3.12', 'fastembed (ONNX)', s.meta.embeddingModel, 'SQLAlchemy', 'pytest', 'Docker'],
  },
  {
    id: 'database',
    index: 3,
    verb: 'Store',
    stage: 'Load',
    name: 'Database',
    title: 'Keeping every stage',
    lead: 'One database keeps the original pages, the cleaned records and the searchable passages, each linked back to where it came from.',
    blurb: 'Keeps every stage in one place, linked back to the original page.',
    output: 'matching passages',
    number: { value: '3', label: 'stages kept, all linked' },
    path: '/database',
    repo: { name: 'MedicalChatbotAPI', url: 'https://github.com/davidsanbric-dev/MedicalChatbotAPI' },
    color: '#199e70',
    stack: ['PostgreSQL 15', 'pgvector', 'JSONB', 'HNSW (cosine)', 'Docker Compose'],
  },
  {
    id: 'api',
    index: 4,
    verb: 'Answer',
    stage: 'Serve',
    name: 'RAG API',
    title: 'Answering a question',
    lead: 'For every question it finds the passages that match, double-checks them, and has an AI write the answer from those passages only.',
    blurb: 'Finds the best passages for a question and writes an answer from them.',
    output: 'answers',
    number: { value: `top ${s.meta.topN}`, label: 'passages behind each answer' },
    path: '/api',
    repo: { name: 'MedicalChatbotAPI', url: 'https://github.com/davidsanbric-dev/MedicalChatbotAPI' },
    color: '#c98500',
    stack: ['FastAPI', 'LangChain', 'fastembed cross-encoder', 'OpenRouter → Gemini', 'SSE', 'pytest'],
  },
  {
    id: 'interface',
    index: 5,
    verb: 'Show',
    stage: 'Use',
    name: 'Interface',
    title: 'Where people meet the data',
    lead: 'This website. Chat with the assistant and watch it work, or take the tour through every station.',
    blurb: 'This website: the chat window and the guided tour you are on.',
    output: '',
    number: { value: 'live', label: 'answers appear word by word' },
    path: '/interface',
    repo: { name: 'MedicalChatbotWeb', url: 'https://github.com/davidsanbric-dev/MedicalChatbotWeb' },
    color: '#d55181',
    stack: ['React 19', 'TypeScript', 'TanStack Router/Query/Table', 'Zustand', 'Zod', 'Tailwind CSS', 'Three.js'],
  },
];

export const SOURCE = {
  name: 'The website',
  verb: 'Source',
  output: 'web pages',
  host: 'patients.amwell.com',
  url: s.meta.source,
  color: '#7d8794',
};

export const layerById = (id: LayerId) => LAYERS.find((l) => l.id === id)!;
