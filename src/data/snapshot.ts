import { z } from 'zod';
import raw from './snapshot.json';

/**
 * Static snapshot of the pipeline database, produced by
 * `scripts/export_snapshot.py` after running the real scraper output through
 * the real worker. Validated once at startup so a schema drift between the
 * exporter and the UI fails loudly instead of rendering wrong numbers.
 */

const ContentType = z.enum(['symptom', 'paragraph', 'list_item']);
export type ContentType = z.infer<typeof ContentType>;

const Condition = z.object({
  name: z.string(),
  slug: z.string(),
  url: z.string().url(),
  symptoms: z.number().int(),
  rawBlocks: z.number().int(),
  paragraphs: z.number().int(),
  lists: z.number().int(),
  chunks: z.number().int(),
  chunkChars: z.number().int(),
  rawBytes: z.number().int(),
  nbsp: z.number().int(),
  processorVersion: z.string(),
});
export type Condition = z.infer<typeof Condition>;

const Candidate = z.object({
  id: z.string(),
  type: ContentType,
  condition: z.string(),
  preview: z.string(),
  similarity: z.number(),
  vectorRank: z.number().int(),
  rerankScore: z.number(),
  selected: z.boolean(),
});
export type Candidate = z.infer<typeof Candidate>;

const Snapshot = z.object({
  meta: z.object({
    generatedAt: z.string(),
    source: z.string().url(),
    embeddingModel: z.string(),
    embeddingDims: z.number().int(),
    rerankModel: z.string(),
    topK: z.number().int(),
    topN: z.number().int(),
    relevanceThreshold: z.number(),
    processorVersion: z.string(),
  }),
  stages: z.record(
    z.enum(['raw_data', 'processed_data', 'documents']),
    z.object({ rows: z.number().int(), bytes: z.number().int() }),
  ),
  chunkTypes: z.array(
    z.object({
      type: ContentType,
      count: z.number().int(),
      avgChars: z.number().int(),
      minChars: z.number().int(),
      maxChars: z.number().int(),
    }),
  ),
  conditions: z.array(Condition),
  topSymptoms: z.array(z.tuple([z.string(), z.number().int()])),
  audit: z.object({
    records: z.number().int(),
    nbspRaw: z.number().int(),
    nbspProcessed: z.number().int(),
    recordsWithNbsp: z.number().int(),
    emptyIntroduction: z.number().int(),
    emptySections: z.number().int(),
    emptyFaqs: z.number().int(),
    missingSymptoms: z.number().int(),
    normalizedTitles: z.number().int(),
    normalizationExamples: z.array(z.object({ title: z.string(), conditionName: z.string() })),
    distinctSymptoms: z.number().int(),
    listChunksWithPythonRepr: z.number().int(),
    chunksWithNbsp: z.number().int(),
  }),
  sample: z.object({
    condition: z.string(),
    raw: z.object({
      id: z.string(),
      source: z.string(),
      createdAt: z.string(),
      content: z.record(z.string(), z.unknown()),
    }),
    processed: z.object({
      id: z.string(),
      content: z.record(z.string(), z.unknown()),
      processingMetadata: z.record(z.string(), z.unknown()),
    }),
    documents: z.array(
      z.object({
        id: z.string(),
        contentType: ContentType,
        content: z.string(),
        metadata: z.record(z.string(), z.unknown()),
        embeddingHead: z.array(z.number()),
      }),
    ),
  }),
  projection: z.object({
    method: z.string(),
    pcaExplainedVariance: z.array(z.number()),
    points: z.array(
      z.object({
        id: z.string(),
        x: z.number(),
        y: z.number(),
        z: z.number(),
        type: ContentType,
        condition: z.string(),
        preview: z.string(),
      }),
    ),
  }),
  retrievalTraces: z.array(
    z.object({
      question: z.string(),
      /** Where the question lands in the 3-D map (fitted together with the passages). */
      query: z.object({ x: z.number(), y: z.number(), z: z.number() }),
      candidates: z.array(Candidate),
      relevantCount: z.number().int(),
      selectedCount: z.number().int(),
    }),
  ),
});

export type Snapshot = z.infer<typeof Snapshot>;

export const snapshot: Snapshot = Snapshot.parse(raw);

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  symptom: 'Symptom',
  paragraph: 'Paragraph',
  list_item: 'List',
};

/** Categorical slots 1–3 (validated all-pairs on the dark surface). */
export const CONTENT_TYPE_COLOR: Record<ContentType, string> = {
  symptom: '#3987e5',
  paragraph: '#d95926',
  list_item: '#199e70',
};
