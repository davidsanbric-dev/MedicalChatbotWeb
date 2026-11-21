import * as THREE from 'three';
import { MAX_ROUNDS, type Scenario, type ToolName } from '@/data/agent-scenarios';
import { LAYERS } from '@/data/layers';
import { snapshot } from '@/data/snapshot';
import { C, type Bounds, type Vec3 } from '../../constants';
import { PLATFORM_H } from '../../parts';

/**
 * Where everything stands in the API page's agent scene, and when each thing
 * happens. Shared by the scene's parts so their positions and timing agree.
 */

const s = snapshot;
export const AMBER = LAYERS[3].color;
export const PINK = LAYERS[4].color;
export const GOOD = C.good;
export const ALERT = '#d03b3b';
export const IDLE_LIGHT = '#cfe3ff';
export const LAMP_OFF = '#3a3322';
export const BASE = PLATFORM_H;
const PAD_TOP = 0.055;
export const SURFACE = BASE + PAD_TOP;

/* Left to right: the knowledge base, the three tools, the AI, the safety check, the website. */
export const CLOUD: Vec3 = [-5.85, 1.95, -0.1];
export const CLOUD_R = 1.2;
export const LENS_X = -3.95;
export const BARS_X = -2.4;
export const LIST_X = -0.35;
export const DESK_X = 1.2;
export const CORE: Vec3 = [2.75, BASE + 1.2, 0];
export const GATE_X = 4.2;
export const LAPTOP_X = 5.9;
export const API_X: [number, number] = [-4.55, 4.8];
export const BOUNDS: Bounds = { min: [-7.15, 0, -1.4], max: [7.0, 3.15, 1.45] };

export const TOOLS: { name: ToolName; label: string; x: number; w: number }[] = [
  { name: 'search_knowledge_base', label: 'Search', x: -2.75, w: 3.2 },
  { name: 'list_conditions', label: 'List topics', x: LIST_X, w: 0.95 },
  { name: 'request_human_handoff', label: 'Call a person', x: DESK_X, w: 1.15 },
];
export const PAD_D = 1.15;
export const DESK_SCALE = 1.3;
export const LIST_ROWS = 6;
/** One lamp per possible round, on the front of the AI's base. */
export const LAMP_ANGLES = Array.from({ length: MAX_ROUNDS }, (_, i) => THREE.MathUtils.degToRad(-48 + i * 32));

export const BAR_W = 0.085;
export const BAR_GAP = 0.03;
export const STUB = 0.05;
const MIN_SCORE = -12;
const BAR_SCALE = 0.085;
export const barHeight = (score: number) => Math.max(STUB, (score - MIN_SCORE) * BAR_SCALE);
export const barX = (i: number) => BARS_X - ((s.meta.topK - 1) / 2) * (BAR_W + BAR_GAP) + i * (BAR_W + BAR_GAP);

/* Where things leave and arrive. */
export const WEB: Vec3 = [LAPTOP_X - 0.15, BASE + 1.4, 0.05];
export const WEB_IN: Vec3 = [LAPTOP_X - 0.25, BASE + 1.3, 0.35];
export const GATE: Vec3 = [GATE_X, BASE + 0.95, 0];
export const GATE_OUT: Vec3 = [GATE_X + 0.1, BASE + 1.0, 0.25];
export const INTO_CORE: Vec3 = [CORE[0] + 0.2, CORE[1], 0];
export const CORE_OUT: Vec3 = [CORE[0] + 0.45, CORE[1] - 0.05, 0.25];
export const CORE_BACK: Vec3 = [CORE[0] - 0.45, CORE[1] - 0.15, 0.1];
export const TICKET: Vec3 = [DESK_X + 0.22 * DESK_SCALE, SURFACE + 0.31 * DESK_SCALE, 0.22 * DESK_SCALE];
export const TOOL_IN: Record<ToolName, Vec3> = {
  search_knowledge_base: [LENS_X + 0.05, BASE + 1.0, 0],
  list_conditions: [LIST_X, BASE + 1.05, -0.12],
  request_human_handoff: [DESK_X - 0.26, SURFACE + 1.0, -0.2],
};
export const TOOL_OUT: Record<ToolName, Vec3> = {
  search_knowledge_base: [BARS_X + 0.95, BASE + 1.15, 0.05],
  list_conditions: [LIST_X + 0.1, BASE + 0.75, 0.1],
  request_human_handoff: TICKET,
};
export const arcMid = (a: Vec3, b: Vec3, lift: number, z: number): Vec3 => [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + lift, z];
export const MSG_MID = arcMid(WEB, GATE, 0.45, 0.05);
export const TO_CORE_MID = arcMid(GATE, INTO_CORE, 0.35, 0);
export const ALERT_MID = arcMid(GATE, TICKET, 1.75, -0.6);
export const ANSWER_MID = arcMid(CORE_OUT, WEB_IN, 0.95, 0.3);
export const ADVICE_MID = arcMid(GATE_OUT, WEB_IN, 0.6, 0.3);

/**
 * When things happen inside each step, in seconds. Steps 1, 2 and 4 loop; the
 * tool step plays once and holds. With reduced motion, STILL is the one frame
 * shown per step.
 */
const LOOP = [3.6, 3.8, Infinity, 3.8];
const STILL = [1.4, 2.0, 4.0, 2.1];
export const T = {
  msgIn: [0.15, 1.05], // the website → the safety check
  scan: [1.05, 1.75],
  msgOn: [1.75, 2.5], // → the AI
  alert: [1.75, 2.85], // an emergency → the care desk
  consider: 0.15, // each tool lights in turn, 0.35 s apart
  pick: 1.35,
  call: [1.5, 2.45], // the AI → the chosen tool
  beam: [0, 0.8],
  links: [0.6, 1.3],
  bars: [0.2, 1.0], // + 0.05 s per bar
  rows: 0.25, // + 0.22 s per row
  ticket: [0.4, 1.3],
  result: [0.1, 1.1], // the tool → the AI
  answer: [1.4, 2.75], // the AI → the website
} as const;

export function stepTime(step: number, elapsed: number, reduced: boolean) {
  if (reduced) return STILL[step];
  return Number.isFinite(LOOP[step]) ? elapsed % LOOP[step] : elapsed;
}

export const toolOf = (sc: Scenario): ToolName | null => (sc.action === 'reply' || sc.action === 'guardrail' ? null : sc.action);

/** Model calls made so far this turn: one to pick the tool, one to answer from its result. */
export function roundsLit(step: number, t: number, sc: Scenario) {
  if (sc.action === 'guardrail' || step === 0) return 0;
  if (step === 1) return t >= T.pick ? 1 : 0;
  if (step === 2 || !toolOf(sc)) return 1;
  return t >= T.result[1] ? 2 : 1;
}

export function bezier(out: THREE.Vector3, a: Vec3, m: Vec3, b: Vec3, t: number) {
  const u = 1 - t;
  return out.set(
    u * u * a[0] + 2 * u * t * m[0] + t * t * b[0],
    u * u * a[1] + 2 * u * t * m[1] + t * t * b[1],
    u * u * a[2] + 2 * u * t * m[2] + t * t * b[2],
  );
}

export interface SceneProps {
  step: number;
  scenario: Scenario;
}

/**
 * drei's lines pass their extra props to the material too, so `visible={false}`
 * would hide the material for good: lines start hidden here instead, and each
 * frame decides whether they show.
 */
export function hidden<T>(line: unknown) {
  const object = line as THREE.Object3D | null;
  if (object) object.visible = false;
  return object as T | null;
}

