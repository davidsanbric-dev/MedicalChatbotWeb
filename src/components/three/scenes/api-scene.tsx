import { QuadraticBezierLine } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { LAYERS } from '@/data/layers';
import { snapshot, type Candidate } from '@/data/snapshot';
import { useReducedMotion } from '@/hooks/use-media';
import { C, bump, ease, win, aroundX, type SceneLabel, type Vec3 } from '../constants';
import { Bubble, Ghost, Laptop, PLATFORM_H, Platform } from '../parts';
import { cloudLocal, pointById } from '../cloud-data';
import { PointCloud } from '../point-cloud';
import { FocusRing, NeighborTag, SceneNote, ZoneTag } from '../scene-kit';
import { Stage } from '../stage';
import { useStepStart } from '../use-step';

const s = snapshot;
const AMBER = LAYERS[3].color;
const PINK = LAYERS[4].color;
const GOOD = '#0ca30c';
const BASE = PLATFORM_H;

const CLOUD: Vec3 = [-5.45, 1.95, -0.1];
const CLOUD_R = 1.3;
const JUDGE_X = -1.35;
const CORE: Vec3 = [2.15, BASE + 1.05, 0];
const LAPTOP_X = 5.55;
const BAR_W = 0.13;
const BAR_GAP = 0.045;
const MIN_SCORE = -12;
const BAR_SCALE = 0.085;
const barHeight = (score: number) => Math.max(0.04, (score - MIN_SCORE) * BAR_SCALE);
const THRESHOLD_Y = barHeight(s.meta.relevanceThreshold);

type Trace = (typeof s.retrievalTraces)[number];

/** API page: question → closest passages in the meaning map → re-check → answer. */
export default function ApiScene({ step, trace }: { step: number; trace: Trace }) {
  const used = trace.candidates.filter((c) => c.selected);
  const labels = useMemo<SceneLabel[]>(
    () => [
      { key: 'z1', minor: step !== 0, at: [CORE[0] - 0.15, CORE[1] + 1.0, CORE[2]], content: <ZoneTag n={1} active={step === 0} color={AMBER}>Understand the question</ZoneTag> },
      { key: 'z2', minor: step !== 1, at: [CLOUD[0], CLOUD[1] + CLOUD_R * 0.8, CLOUD[2]], content: <ZoneTag n={2} active={step === 1} color={AMBER}>Find similar passages</ZoneTag> },
      { key: 'z3', minor: step !== 2, at: [JUDGE_X, BASE + 2.0, 0], content: <ZoneTag n={3} active={step === 2} color={AMBER}>Double-check each one</ZoneTag> },
      { key: 'z4', minor: step !== 3, at: [(CORE[0] + LAPTOP_X) / 2 + 0.25, BASE + 0.35, 1.05], content: <ZoneTag n={4} active={step === 3} color={AMBER}>Write the answer</ZoneTag> },
      { key: 'db', minor: true, at: [CLOUD[0], BASE, 1.35], place: 'below', content: <NeighborTag>3 · Database: {s.stages.documents.rows} passages</NeighborTag> },
      {
        key: 'q',
        at: [LAPTOP_X + 0.2, BASE + 1.75, -0.2],
        content: (
          <SceneNote color={PINK} className="max-w-[12rem]">
            <span className="text-muted">5 · Interface asks:</span> “{trace.question}”
          </SceneNote>
        ),
      },
      note(0, step, CORE[0], <>The question is rewritten as a clear, complete search, so follow-ups like “and how is it treated?” work.</>),
      note(1, step, CLOUD[0] + 0.6, <>It lands in the meaning map. The {s.meta.topK} closest passages light up.</>),
      note(
        2,
        step,
        JUDGE_X,
        trace.relevantCount ? (
          <>A second model scores each one against the question. {trace.relevantCount} of {s.meta.topK} clear the bar.</>
        ) : (
          <>A second model scores each one against the question. None clears the bar: they only looked similar.</>
        ),
      ),
      note(
        3,
        step,
        (CORE[0] + LAPTOP_X) / 2,
        used.length ? (
          <>The AI writes the answer from these {used.length} passages only ({[...new Set(used.map((c) => c.condition))].join(', ')}).</>
        ) : (
          <>Nothing passed, so the bot says it doesn’t know instead of guessing.</>
        ),
      ),
    ],
    [step, trace, used],
  );

  const focus: { target: Vec3; r: number }[] = [
    { target: [CORE[0], BASE, 0], r: 1.0 },
    { target: [CLOUD[0], 0, CLOUD[2]], r: 1.65 },
    { target: [JUDGE_X, BASE, 0], r: 1.75 },
    { target: [(CORE[0] + LAPTOP_X) / 2 + 0.4, 0, 0.2], r: 2.0 },
  ];

  return (
    <Stage
      className="h-full w-full"
      bounds={{ min: [-7.05, 0, -1.4], max: [6.95, 3.1, 1.45] }}
      core={aroundX(focus[step].target[0], 2.9, 3.1)}
      labels={labels}
      description={`A question arrives from the website and lands in the 3D meaning map. Its ${s.meta.topK} closest passages light up, are re-scored as a row of bars against a pass line, and the best ones feed the answer that goes back to the website.`}
    >
      <FocusRing target={focus[step].target} radius={focus[step].r} color={AMBER} />
      <Ghost>
        <Platform color={LAYERS[2].color} position={[CLOUD[0], 0, 0]} size={[2.6, 2.5]} />
        <Platform color={PINK} position={[LAPTOP_X, 0, 0]} size={[2.3, 2.3]}>
          <group position={[0, 0, -0.15]} rotation-y={-0.35}>
            <Laptop color={PINK} scale={0.85} />
          </group>
        </Platform>
      </Ghost>
      <Platform color={AMBER} position={[0.4, 0, 0]} size={[6.2, 2.6]} />
      <Engine step={step} />
      <Retrieval step={step} trace={trace} />
    </Stage>
  );
}

function note(forStep: number, step: number, x: number, children: ReactNode): SceneLabel {
  return {
    key: `note-${forStep}`,
    at: [x, BASE, 1.4],
    place: 'below',
    hidden: step !== forStep,
    content: <SceneNote color={AMBER}>{children}</SceneNote>,
  };
}

/** The answering engine: a faceted core inside a ring; it spins up while working. */
function Engine({ step }: { step: number }) {
  const core = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const speed = useRef(0.5);
  useFrame((_, dt) => {
    speed.current = THREE.MathUtils.damp(speed.current, step === 0 || step === 3 ? 2.6 : 0.5, 3, dt);
    if (core.current) core.current.rotation.y += dt * speed.current;
    if (ring.current) ring.current.rotation.z += dt * speed.current * 1.4;
  });
  return (
    <group>
      <mesh position={[CORE[0], BASE + 0.14, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.45, 0.6, 0.28, 32]} />
        <meshStandardMaterial color="#3a3322" />
      </mesh>
      <group position={CORE}>
        <mesh ref={core} castShadow>
          <icosahedronGeometry args={[0.46, 0]} />
          <meshStandardMaterial color={AMBER} emissive={AMBER} emissiveIntensity={0.45} flatShading roughness={0.4} />
        </mesh>
        <mesh ref={ring} rotation-x={1.2}>
          <torusGeometry args={[0.78, 0.035, 12, 72]} />
          <meshStandardMaterial color="#ffd27a" emissive="#ffd27a" emissiveIntensity={0.9} />
        </mesh>
      </group>
    </group>
  );
}

function Retrieval({ step, trace }: { step: number; trace: Trace }) {
  const reduced = useReducedMotion();
  const stepStart = useStepStart(`${step}-${trace.question}`);
  const cloud = useRef<THREE.Group>(null);
  const question = useRef<THREE.Group>(null);
  const beam = useRef<{ setPoints: (a: THREE.Vector3, b: THREE.Vector3, m: THREE.Vector3) => void; visible: boolean } | null>(null);
  const links = useRef<THREE.LineSegments>(null);
  const bars = useRef<(THREE.Mesh | null)[]>([]);
  const feeds = useRef<(THREE.Mesh | null)[]>([]);
  const answer = useRef<THREE.Group>(null);
  const v = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), m: new THREE.Vector3() }), []);

  const candidateIds = useMemo(() => new Set(trace.candidates.map((c) => c.id)), [trace]);
  const queryLocal = useMemo(() => cloudLocal(trace.query, CLOUD_R), [trace]);
  // Bars sorted so the best candidates stand closest to the engine.
  const ranked = useMemo(() => [...trace.candidates].sort((x, y) => x.rerankScore - y.rerankScore), [trace]);
  const barX = (i: number) => JUDGE_X - ((ranked.length - 1) / 2) * (BAR_W + BAR_GAP) + i * (BAR_W + BAR_GAP);
  const used = useMemo(() => ranked.map((c, i) => ({ c, i })).filter(({ c }) => c.selected), [ranked]);

  const linkGeometry = useMemo(() => {
    const pts: number[] = [];
    for (const c of trace.candidates) {
      const p = cloudLocal(pointById(c.id), CLOUD_R);
      pts.push(queryLocal.x, queryLocal.y, queryLocal.z, p.x, p.y, p.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [trace, queryLocal]);

  useFrame(({ clock }) => {
    const ts = reduced ? 2.5 : clock.elapsedTime - stepStart.current;

    // 1 · question bubble flies from the website into the engine
    const q = question.current;
    if (q) {
      const p = step === 0 ? ease(win(ts % 3.2, 0.2, 1.4)) : 1;
      q.position.set(
        THREE.MathUtils.lerp(LAPTOP_X - 0.1, CORE[0] + 0.15, p),
        THREE.MathUtils.lerp(BASE + 1.35, CORE[1] + 0.1, p) + Math.sin(Math.PI * p) * 0.5,
        THREE.MathUtils.lerp(0.1, 0.1, p),
      );
      q.scale.setScalar(step === 0 ? Math.max(0.001, 1 - win(ts % 3.2, 1.3, 1.5)) : 0.001);
    }

    // 2 · beam from the engine to where the question lands, and links to its neighbours
    const cl = cloud.current;
    if (beam.current && cl) {
      v.b.copy(queryLocal);
      cl.localToWorld(v.b);
      v.a.set(...CORE);
      v.m.set((v.a.x + v.b.x) / 2, Math.max(v.a.y, v.b.y) + 1.1, (v.a.z + v.b.z) / 2);
      const grow = step === 1 ? ease(win(ts, 0, 0.8)) : step > 1 ? 1 : 0;
      v.b.lerpVectors(v.a, v.b, Math.max(grow, 0.001));
      beam.current.setPoints(v.a, v.b, v.m);
      beam.current.visible = step === 1;
    }
    if (links.current) {
      const mat = links.current.material as THREE.LineBasicMaterial;
      mat.opacity = step === 1 ? 0.55 * ease(win(ts, 0.6, 1.3)) : step === 2 ? 0.25 : 0;
      links.current.visible = mat.opacity > 0.01;
    }

    // 3 · bars rise to their re-rank score
    bars.current.forEach((m, i) => {
      if (!m) return;
      const h = barHeight(ranked[i].rerankScore);
      const grow = step < 2 ? 0 : step === 2 ? ease(win(ts, 0.2 + i * 0.05, 0.9 + i * 0.05)) : 1;
      m.scale.y = Math.max(0.001, grow);
      m.position.y = BASE + (h * m.scale.y) / 2;
    });

    // 4 · the passages that passed feed the engine; the answer goes back to the website
    feeds.current.forEach((m, k) => {
      if (!m) return;
      const { i, c } = used[k] ?? {};
      if (c === undefined || step !== 3) {
        m.scale.setScalar(0.001);
        return;
      }
      const p = ease(win(ts % 3.6, 0.1 + k * 0.12, 0.9 + k * 0.12));
      const fromY = BASE + barHeight(c.rerankScore) + 0.08;
      m.position.set(
        THREE.MathUtils.lerp(barX(i), CORE[0], p),
        THREE.MathUtils.lerp(fromY, CORE[1], p) + Math.sin(Math.PI * p) * 0.5,
        THREE.MathUtils.lerp(0, 0, p),
      );
      m.scale.setScalar(p >= 1 ? 0.001 : 1);
    });
    const a = answer.current;
    if (a) {
      const p = ease(win(ts % 3.6, 1.6, 2.9));
      a.position.set(
        THREE.MathUtils.lerp(CORE[0] + 0.4, LAPTOP_X - 0.2, p),
        THREE.MathUtils.lerp(CORE[1], BASE + 1.3, p) + Math.sin(Math.PI * p) * 0.45,
        0.35,
      );
      a.scale.setScalar(step === 3 ? Math.max(0.001, bump(ts % 3.6, 1.55, 3.05, 0.15)) : 0.001);
    }
  });

  return (
    <>
      <group position={CLOUD}>
        <PointCloud
          radius={CLOUD_R}
          size={0.036}
          groupRef={cloud}
          spin={reduced ? 0 : 0.1}
          highlight={step >= 1 ? candidateIds : null}
          dim={0.72}
        >
          {step >= 1 && (
            <group position={queryLocal}>
              <mesh>
                <octahedronGeometry args={[0.1, 0]} />
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.5} />
              </mesh>
              <mesh>
                <sphereGeometry args={[0.2, 20, 20]} />
                <meshBasicMaterial color={PINK} transparent opacity={0.22} depthWrite={false} />
              </mesh>
            </group>
          )}
          <lineSegments ref={links} geometry={linkGeometry}>
            <lineBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
          </lineSegments>
        </PointCloud>
      </group>

      <QuadraticBezierLine
        ref={(l) => void (beam.current = l as unknown as typeof beam.current)}
        start={CORE}
        end={CORE}
        color="#ffffff"
        lineWidth={2}
        transparent
        opacity={0.8}
      />

      <group ref={question}>
        <Bubble color={PINK} w={0.5} h={0.27} tail="right" />
      </group>

      {/* The judge: one bar per candidate, and the pass line */}
      {ranked.map((c, i) => (
        <mesh key={`${trace.question}-${c.id}`} ref={(m) => void (bars.current[i] = m)} position={[barX(i), BASE, 0]} castShadow>
          <boxGeometry args={[BAR_W, barHeight(c.rerankScore), 0.34]} />
          <meshStandardMaterial {...barLook(c)} />
        </mesh>
      ))}
      {/* The pass line: two bright rails and a faint glass sheet between them */}
      <group position={[JUDGE_X, BASE + THRESHOLD_Y, 0]} visible={step >= 2}>
        {[-0.3, 0.3].map((z) => (
          <mesh key={z} position={[0, 0, z]}>
            <boxGeometry args={[ranked.length * (BAR_W + BAR_GAP) + 0.35, 0.018, 0.018]} />
            <meshBasicMaterial color="#ffd27a" />
          </mesh>
        ))}
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[ranked.length * (BAR_W + BAR_GAP) + 0.35, 0.6]} />
          <meshBasicMaterial color="#ffd27a" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>

      {Array.from({ length: s.meta.topN }, (_, k) => (
        <mesh key={k} ref={(m) => void (feeds.current[k] = m)} scale={0.001}>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshStandardMaterial color={GOOD} emissive={GOOD} emissiveIntensity={1.2} />
        </mesh>
      ))}

      <group ref={answer} scale={0.001}>
        <Bubble color={used.length ? AMBER : C.line} w={0.62} h={0.32} />
      </group>
    </>
  );
}

function barLook(c: Candidate) {
  if (c.selected) return { color: GOOD, emissive: GOOD, emissiveIntensity: 0.55 };
  if (c.rerankScore > s.meta.relevanceThreshold) return { color: '#c3ccd6', emissive: '#000000', emissiveIntensity: 0 };
  return { color: '#3a4655', emissive: '#000000', emissiveIntensity: 0 };
}
