import { evaluation } from './evaluation';
import { snapshot } from './snapshot';

/**
 * The messages the API page's agent scene can play. Nothing here is invented:
 * health questions replay the snapshot's real retrieval traces (what the search
 * tool finds for that exact question), and the other messages are the agent
 * evaluation's own test cases, with the run that tested them.
 */

export type ToolName = 'search_knowledge_base' | 'list_conditions' | 'request_human_handoff';
export type RetrievalTrace = (typeof snapshot.retrievalTraces)[number];
export type AgentCase = (typeof evaluation.agent.cases)[number];

export interface Scenario {
  message: string;
  /** What the agent does: call one of its tools, reply directly, or stop at the emergency check. */
  action: ToolName | 'reply' | 'guardrail';
  /** Search only: the retrieval trace for this exact question. */
  trace?: RetrievalTrace;
  /** The evaluation's run of this exact message, when it has one. */
  tested?: AgentCase;
}

/** AgentService.MAX_STEPS in the API: model calls per message before it gives up. */
export const MAX_ROUNDS = 4;

/** The conditions an answer built from this trace can cite, once each, best first. */
export const sourcesOf = (trace: RetrievalTrace) => [
  ...new Set(trace.candidates.filter((c) => c.selected).map((c) => c.condition)),
];

function tested(expected: string, action: Scenario['action']): Scenario[] {
  const run = evaluation.agent.cases.find((c) => c.expected === expected);
  return run ? [{ message: run.message, action, tested: run }] : [];
}

export const SCENARIOS: Scenario[] = [
  ...snapshot.retrievalTraces
    .filter((trace) => trace.selectedCount > 0)
    .slice(0, 2)
    .map((trace): Scenario => ({ message: trace.question, action: 'search_knowledge_base', trace })),
  ...tested('list_conditions', 'list_conditions'),
  ...tested('request_human_handoff', 'request_human_handoff'),
  ...tested('none', 'reply'),
  ...tested('guardrail', 'guardrail'),
];
