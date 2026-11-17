import { z } from 'zod';
import agentRaw from './evaluation/agent.json';
import retrievalRaw from './evaluation/retrieval.json';

/**
 * Results of the API's offline evaluations (medical_conditions_api/evals), copied
 * here by `bun run sync:evals` after `make eval-retrieval` / `make eval-agent`.
 * Like the snapshot, nothing in them is hand-written; they are validated once at
 * startup so a format change in the API's evals fails loudly.
 */

const StageScores = z.object({
  precision: z.number(),
  recall: z.number(),
  hit_rate: z.number(),
  mrr: z.number(),
  empty_on_topic: z.number(),
  abstained_off_topic: z.number(),
});

const SweepRow = z.object({
  threshold: z.number(),
  hit_rate: z.number(),
  precision: z.number(),
  empty_on_topic: z.number(),
  abstained_off_topic: z.number(),
});

/** found / wrong / none: a question about a condition. silent / leak: one the knowledge base can't answer. */
const Outcome = z.enum(['found', 'wrong', 'none', 'silent', 'leak']);
export type Outcome = z.infer<typeof Outcome>;

const Retrieval = z.object({
  date: z.string(),
  processor: z.string(),
  documents: z.number().int(),
  k: z.number().int(),
  topN: z.number().int(),
  threshold: z.number(),
  onTopic: z.number().int(),
  offTopic: z.number().int(),
  stages: z.object({ vector: StageScores, reranked: StageScores, pipeline: StageScores }),
  sweep: z.array(SweepRow),
  misses: z.array(z.object({ question: z.string(), expected: z.string(), got: z.array(z.string()) })),
  leaks: z.array(z.object({ question: z.string(), got: z.array(z.string()) })),
  outcomes: z.array(z.object({ question: z.string(), condition: z.string().nullable(), outcome: Outcome })),
});
export type SweepRow = z.infer<typeof SweepRow>;

/** search_knowledge_base / list_conditions / request_human_handoff, "none" (plain answer) or "guardrail". */
const AgentCase = z.object({
  message: z.string(),
  expected: z.string(),
  did: z.string(),
  passed: z.boolean(),
  tools: z.array(z.string()),
  seconds: z.number(),
});

const Agent = z.object({
  date: z.string(),
  model: z.string(),
  fallback: z.string().nullable(),
  cases: z.array(AgentCase),
});

export const evaluation = {
  retrieval: Retrieval.parse(retrievalRaw),
  agent: Agent.parse(agentRaw),
};
