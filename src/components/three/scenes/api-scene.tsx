import { clsx } from 'clsx';
import { useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { MAX_ROUNDS, sourcesOf, type Scenario, type ToolName } from '@/data/agent-scenarios';
import { LAYERS } from '@/data/layers';
import { snapshot } from '@/data/snapshot';
import { aroundX, type Bounds, type SceneLabel, type Vec3 } from '../constants';
import { Ghost, Laptop, Platform } from '../parts';
import { FocusRing, NeighborTag, SceneNote, ZoneTag } from '../scene-kit';
import { Stage } from '../stage';
import { Core } from './agent/core';
import {
  ALERT,
  AMBER,
  API_X,
  BASE,
  BOUNDS,
  CLOUD,
  CORE,
  DESK_X,
  GATE_X,
  LAPTOP_X,
  LIST_X,
  PINK,
  SURFACE,
  TOOLS,
  toolOf,
  type SceneProps,
} from './agent/layout';
import { Packets } from './agent/packets';
import { SafetyCheck } from './agent/safety-check';
import { Search } from './agent/search';
import { Tools } from './agent/tools';

const s = snapshot;

/**
 * API page: the agent loop. A message passes a fixed safety check, the AI picks
 * one of three tools, the tool's result comes back, and the AI answers. Four
 * lamps on the AI's base count its rounds (model calls); it never takes more.
 */
export default function ApiScene({ step, scenario }: SceneProps) {
  const callAnchor = useRef<THREE.Object3D | null>(null);
  const answerAnchor = useRef<THREE.Object3D | null>(null);

  const labels = useMemo<SceneLabel[]>(() => {
    const tool = toolOf(scenario);
    const emergency = scenario.action === 'guardrail';
    const busy = emergency ? 'request_human_handoff' : tool;
    const sources = scenario.trace ? sourcesOf(scenario.trace) : [];
    // The round counter rides on the AI's tag: "round 2 of 4".
    const round = step === 0 ? null : emergency ? 'not asked' : `round ${step === 3 && tool ? 2 : 1} of ${MAX_ROUNDS}`;
    return [
      zone(1, step, [GATE_X, BASE + 2.45, -0.35], 'Safety check'),
      zone(
        2,
        step,
        [CORE[0], BASE + 2.2, 0],
        <>
          The AI decides
          {round && <span className="font-mono text-[10px] text-muted">· {round}</span>}
        </>,
      ),
      zone(3, step, [-1.05, BASE + 2.05, -0.5], 'Its tools'),
      zone(4, step, [(CORE[0] + LAPTOP_X) / 2 + 0.3, BASE + 0.35, 1.05], 'Answer + sources'),
      ...TOOLS.map(
        (t): SceneLabel => ({
          key: `tool-${t.name}`,
          minor: true,
          at: [t.x, SURFACE, 0.5],
          place: 'below',
          content: <ToolTag active={step >= 1 && busy === t.name}>{t.label}</ToolTag>,
        }),
      ),
      {
        key: 'db',
        minor: true,
        at: [CLOUD[0], BASE, 1.3],
        place: 'below',
        content: <NeighborTag>3 · Database: {s.stages.documents.rows} passages</NeighborTag>,
      },
      {
        // Pinned to the top-right corner, above the website it comes from (labels are clamped inside the canvas).
        key: 'ask',
        at: [BOUNDS.max[0] + 2, BOUNDS.max[1] + 2, BOUNDS.min[2]],
        content: (
          <SceneNote color={PINK} className="max-w-[13rem]">
            <span className="text-muted">5 · Interface asks:</span> “{scenario.message}”
          </SceneNote>
        ),
      },
      {
        key: 'call',
        minor: true,
        hidden: step !== 1 || !tool,
        at: callAnchor,
        content: <span className="rounded bg-surface-3/95 px-1.5 py-0.5 font-mono text-[10px] text-ink shadow-lg">{tool}()</span>,
      },
      {
        key: 'sources',
        minor: true,
        hidden: step !== 3 || sources.length === 0,
        at: answerAnchor,
        place: 'below',
        content: <SceneNote color={AMBER}>From: {sources.join(', ')}</SceneNote>,
      },
      ...[0, 1, 2, 3].map(
        (n): SceneLabel => ({
          key: `note-${n}`,
          at: [noteX(n, scenario), BASE, 1.55],
          place: 'below',
          hidden: step !== n,
          content: <SceneNote color={emergency ? ALERT : AMBER}>{noteText(n, scenario)}</SceneNote>,
        }),
      ),
    ];
  }, [step, scenario]);

  const focus = focusOf(step, scenario);

  return (
    <Stage
      className="h-full w-full"
      bounds={BOUNDS}
      core={focus.frame}
      labels={labels}
      description="The agent at work. A message leaves the website on the right and passes under a safety lamp. Unless it sounds like an emergency, it reaches the AI in the middle, which sends a call to one of three tools on its left: a search through the knowledge base's meaning map with a row of score bars, a list of topics, or a person with a headset who prints a request ticket. The result flows back to the AI, four lamps count its rounds, and the answer returns to the website."
    >
      <FocusRing target={focus.target} radius={focus.r} color={AMBER} />
      <Ghost>
        <Platform color={LAYERS[2].color} position={[CLOUD[0], 0, 0]} size={[2.3, 2.4]} />
        <Platform color={PINK} position={[LAPTOP_X, 0, 0]} size={[2.0, 2.2]}>
          <group position={[0, 0, -0.15]} rotation-y={-0.35}>
            <Laptop color={PINK} scale={0.8} />
          </group>
        </Platform>
      </Ghost>
      <Platform color={AMBER} position={[(API_X[0] + API_X[1]) / 2, 0, 0]} size={[API_X[1] - API_X[0], 2.6]} />
      <Search step={step} scenario={scenario} />
      <Tools step={step} scenario={scenario} />
      <Core step={step} scenario={scenario} />
      <SafetyCheck step={step} scenario={scenario} />
      <Packets
        step={step}
        scenario={scenario}
        onCall={(o) => void (callAnchor.current = o)}
        onAnswer={(o) => void (answerAnchor.current = o)}
      />
    </Stage>
  );
}

function zone(n: number, step: number, at: Vec3, text: ReactNode): SceneLabel {
  return {
    key: `z${n}`,
    minor: step !== n - 1,
    at,
    content: (
      <ZoneTag n={n} active={step === n - 1} color={AMBER}>
        {text}
      </ZoneTag>
    ),
  };
}

function ToolTag({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div
      className={clsx(
        'text-center text-[10px] font-medium whitespace-nowrap transition-colors duration-300 sm:text-[11px]',
        active ? 'text-ink' : 'text-muted',
      )}
    >
      {children}
    </div>
  );
}

const andList = (items: string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

const DECISION: Record<ToolName, string> = {
  search_knowledge_base: 'calls the search',
  list_conditions: 'asks for the list of topics',
  request_human_handoff: 'calls a person',
};

/** What the current step shows for this message, in plain words. */
function noteText(step: number, sc: Scenario): ReactNode {
  const tool = toolOf(sc);
  const emergency = sc.action === 'guardrail';
  if (step === 0)
    return emergency
      ? 'Emergency words trip the fixed rules, so the care team is alerted at once.'
      : 'No emergency words, so the message goes on to the AI.';
  if (step === 1) {
    if (emergency) return 'The AI is never asked, so a model mistake can’t miss an emergency.';
    if (!tool) return 'A greeting needs no tool, so the AI decides to simply reply.';
    return `The AI reads the message and its three tool descriptions, and ${DECISION[tool]}.`;
  }
  if (step === 2) {
    if (emergency) return 'The request is saved as an emergency. In this demo, nobody is notified.';
    if (tool === 'search_knowledge_base' && sc.trace) {
      const { relevantCount: passed, selectedCount: kept } = sc.trace;
      return passed > kept
        ? `The ${s.meta.topK} closest passages are double-checked: ${passed} clear the bar, and the best ${kept} go back to the AI.`
        : `The ${s.meta.topK} closest passages are double-checked: ${passed} clear the bar and go back to the AI.`;
    }
    if (tool === 'list_conditions') return `It returns the ${s.conditions.length} conditions the knowledge base covers.`;
    if (tool === 'request_human_handoff') return 'It saves a request for the care team, with a reason and an urgency the AI chose.';
    return 'No tool this time: there is nothing to look up.';
  }
  if (emergency) return 'Fixed safety advice comes straight back: call your local emergency number, plus the request number.';
  if (tool === 'search_knowledge_base' && sc.trace)
    return `The passages go back to the AI, which answers in round 2 of at most ${MAX_ROUNDS}, citing ${andList(sourcesOf(sc.trace))}.`;
  if (tool === 'list_conditions') return `The list goes back to the AI, which answers in round 2 of at most ${MAX_ROUNDS} with the topics it covers.`;
  if (tool === 'request_human_handoff')
    return `The request number goes back to the AI, which says a person will follow up (round 2 of at most ${MAX_ROUNDS}).`;
  return `It answers in round 1 of at most ${MAX_ROUNDS}, with one short sentence.`;
}

function noteX(step: number, sc: Scenario) {
  const emergency = sc.action === 'guardrail';
  const tool = toolOf(sc);
  if (step === 0) return GATE_X;
  if (step === 1) return CORE[0] + 0.5;
  if (step === 2) return emergency ? DESK_X : (TOOLS.find((t) => t.name === tool)?.x ?? CORE[0]);
  return emergency ? (GATE_X + LAPTOP_X) / 2 : (CORE[0] + LAPTOP_X) / 2;
}

/** The spotlight for each step, and what a narrow screen frames. */
function focusOf(step: number, sc: Scenario): { target: Vec3; r: number; frame: Bounds } {
  const tool = toolOf(sc);
  const emergency = sc.action === 'guardrail';
  if (step === 0) return { target: [GATE_X, BASE, 0], r: 0.9, frame: aroundX(GATE_X + 0.8, 2.5, 3.15) };
  if (step === 1) return { target: [CORE[0], BASE, 0], r: 1.05, frame: aroundX(CORE[0] - 1.6, 3.4, 3.15) };
  if (step === 2) {
    if (tool === 'search_knowledge_base') return { target: [TOOLS[0].x, BASE, 0], r: 1.8, frame: aroundX(-4.15, 2.95, 3.2) };
    if (tool === 'list_conditions') return { target: [LIST_X, BASE, 0], r: 0.75, frame: aroundX(LIST_X + 0.5, 2.3, 3.15) };
    if (tool === 'request_human_handoff' || emergency) return { target: [DESK_X, BASE, 0], r: 0.85, frame: aroundX(DESK_X + 0.5, 2.3, 3.15) };
    return { target: [CORE[0], BASE, 0], r: 1.05, frame: aroundX(CORE[0], 2.5, 3.15) };
  }
  const x = emergency ? (GATE_X + LAPTOP_X) / 2 : (CORE[0] + LAPTOP_X) / 2;
  return { target: [x, BASE, 0.2], r: emergency ? 1.35 : 1.9, frame: aroundX(x + 0.1, emergency ? 2.2 : 2.7, 3.15) };
}
