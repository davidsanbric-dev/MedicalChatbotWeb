import { QuadraticBezierLine } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { LAYERS } from '@/data/layers';
import { snapshot } from '@/data/snapshot';
import { useReducedMotion } from '@/hooks/use-media';
import { fmt } from '@/lib/format';
import { C, bump, ease, rand, win, aroundX, type SceneLabel, type Vec3 } from '../constants';
import { Belt, Bubble, Dot, NeighborStation, PLATFORM_H, PageSheet, Platform, RBox, RecordCard } from '../parts';
import { FocusRing, NeighborTag, SceneNote, ZoneTag } from '../scene-kit';
import { Stage } from '../stage';

const s = snapshot;
const GREEN = LAYERS[2].color;
const BASE = PLATFORM_H;
const TANK_Z = -0.25;

type TankId = 'raw' | 'processed' | 'documents' | 'chat';
const TANKS: Record<TankId, { x: number; r: number; h: number; color: string }> = {
  raw: { x: -2.75, r: 0.6, h: 1.65, color: LAYERS[0].color },
  processed: { x: -0.8, r: 0.6, h: 1.65, color: LAYERS[1].color },
  documents: { x: 1.3, r: 0.8, h: 1.9, color: GREEN },
  chat: { x: 3.25, r: 0.42, h: 0.95, color: LAYERS[3].color },
};
const CARDS = 40; // drawn per card tank (each stands for ~2 records)

const LINEAGE: { a: Vec3; b: Vec3; c: Vec3; d: Vec3 } = {
  a: [TANKS.documents.x + 0.25, BASE + 1.15, TANK_Z + 0.2],
  b: [TANKS.processed.x, BASE + 0.95, TANK_Z],
  c: [TANKS.raw.x, BASE + 1.0, TANK_Z],
  d: [TANKS.raw.x - 1.35, BASE + 1.55, TANK_Z + 0.35],
};

/** Database page: one tank per stage, filling up, all linked back to the source page. */
export default function DatabaseScene({ step }: { step: number }) {
  const labels = useMemo<SceneLabel[]>(() => {
    const tag = (id: TankId, n: number | null, name: string, table: string, count?: number): SceneLabel => ({
      key: id,
      minor: n === null || step !== n - 1,
      at: [TANKS[id].x, BASE + TANKS[id].h + 0.2, TANK_Z],
      content: (
        <div className="flex flex-col items-center gap-1">
          {n ? (
            <ZoneTag n={n} active={step === n - 1} color={GREEN}>
              {name}
            </ZoneTag>
          ) : (
            <span className="rounded-full border border-line bg-page/70 px-2.5 py-0.5 text-xs text-ink-2">{name}</span>
          )}
          <span className="font-mono text-[10px] text-muted sm:text-[11px]">
            {table}
            {count !== undefined && ` · ${fmt.format(count)}`}
          </span>
        </div>
      ),
    });
    return [
      tag('raw', 1, 'Original pages', 'raw_data', s.stages.raw_data.rows),
      tag('processed', 2, 'Clean records', 'processed_data', s.stages.processed_data.rows),
      tag('documents', 3, 'Passages + numbers', 'documents', s.stages.documents.rows),
      tag('chat', null, 'Chat memory', 'chat_history'),
      { key: 'from', minor: true, at: [-6.4, 1.75, -0.2], content: <NeighborTag>from 2 · Worker</NeighborTag> },
      { key: 'to', minor: true, at: [6.5, 1.75, -0.2], content: <NeighborTag>to 4 · RAG API →</NeighborTag> },
      {
        key: 'link',
        at: LINEAGE.d,
        place: 'above',
        hidden: step !== 3,
        content: <ZoneTag n={4} active color={GREEN}>Everything is linked</ZoneTag>,
      },
      note(0, step, TANKS.raw.x, <>Every page exactly as collected, so nothing is ever lost.</>),
      note(1, step, TANKS.processed.x, <>The tidy version sits next to it, tagged with the worker version ({s.meta.processorVersion}).</>),
      note(
        2,
        step,
        TANKS.documents.x,
        <>
          {fmt.format(s.stages.documents.rows)} passages, each stored with its {s.meta.embeddingDims} numbers, ready for
          similarity search.
        </>,
      ),
      note(3, step, -0.8, <>Any passage points to its clean record, which points to the original page.</>),
    ];
  }, [step]);

  const focus: { target: Vec3; r: number }[] = [
    { target: [TANKS.raw.x, BASE, TANK_Z], r: 0.95 },
    { target: [TANKS.processed.x, BASE, TANK_Z], r: 0.95 },
    { target: [TANKS.documents.x, BASE, TANK_Z], r: 1.15 },
    { target: [-0.75, BASE, TANK_Z], r: 2.75 },
  ];

  return (
    <Stage
      className="h-full w-full"
      bounds={{ min: [-7.6, 0, -1.4], max: [7.7, 2.95, 1.45] }}
      core={aroundX(focus[step].target[0], step === 3 ? 3.4 : 2.6, 2.95)}
      labels={labels}
      description="The database as four glass tanks: original pages, clean records, passages with their numbers, and chat memory. Glowing threads link a passage back to its record and to the original page."
    >
      <FocusRing target={focus[step].target} radius={focus[step].r} color={GREEN} />
      <NeighborStation kind="worker" position={[-6.4, 0, 0]} />
      <NeighborStation kind="api" position={[6.5, 0, 0]} />
      <Platform color={GREEN} position={[0.25, 0, 0]} size={[8.6, 3]} />
      <Belt from={2.2} to={5.4} z={0.85} speed={0.9} />
      <Tank id="raw">
        <CardStack color={TANKS.raw.color} messy />
      </Tank>
      <Tank id="processed">
        <CardStack color={TANKS.processed.color} />
      </Tank>
      <Tank id="documents">
        <VectorSwirl fast={step === 2} />
      </Tank>
      <Tank id="chat">
        {[0, 1, 2].map((i) => (
          <group key={i} position={[(i % 2 ? 0.06 : -0.06), 0.22 + i * 0.27, 0]} rotation-y={0.4}>
            <Bubble color={i % 2 ? LAYERS[4].color : TANKS.chat.color} w={0.5} h={0.22} tail={i % 2 ? 'right' : 'left'} />
          </group>
        ))}
      </Tank>
      <Flows />
      {step === 3 && <Lineage />}
    </Stage>
  );
}

function note(forStep: number, step: number, x: number, children: ReactNode): SceneLabel {
  return {
    key: `note-${forStep}`,
    at: [x, BASE, 1.45],
    place: 'below',
    hidden: step !== forStep,
    content: <SceneNote color={GREEN}>{children}</SceneNote>,
  };
}

/** A glass cylinder with colored rims; contents sit inside. */
function Tank({ id, children }: { id: TankId; children: ReactNode }) {
  const t = TANKS[id];
  return (
    <group position={[t.x, BASE, TANK_Z]}>
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <cylinderGeometry args={[t.r + 0.06, t.r + 0.1, 0.08, 48]} />
        <meshStandardMaterial color="#223040" />
      </mesh>
      {children}
      <mesh position={[0, t.h / 2 + 0.06, 0]}>
        <cylinderGeometry args={[t.r, t.r, t.h, 48, 1, true]} />
        <meshStandardMaterial color="#cfeee2" transparent opacity={0.1} roughness={0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {[0.09, t.h + 0.06].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[t.r, 0.022, 8, 64]} />
          <meshStandardMaterial color={t.color} emissive={t.color} emissiveIntensity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** Thin record cards stacked inside a tank (neat for clean records, messy for raw ones). */
function CardStack({ color, messy = false }: { color: string; messy?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < CARDS; i++) {
      o.position.set(messy ? (rand(i) - 0.5) * 0.12 : 0, 0.13 + i * 0.034, messy ? (rand(i, 1) - 0.5) * 0.12 : 0);
      o.rotation.set(0, messy ? (rand(i, 2) - 0.5) * 0.9 : 0, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [messy]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, CARDS]} castShadow>
      <boxGeometry args={[0.66, 0.018, 0.48]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} roughness={0.6} />
    </instancedMesh>
  );
}

/** Every passage as a small glowing point, slowly swirling inside the tank. */
function VectorSwirl({ fast }: { fast: boolean }) {
  const reduced = useReducedMotion();
  const ref = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  const n = s.stages.documents.rows;
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const r = TANKS.documents.r - 0.1;
    for (let i = 0; i < n; i++) {
      const a = rand(i) * Math.PI * 2;
      const d = Math.sqrt(rand(i, 1)) * r;
      o.position.set(Math.cos(a) * d, 0.16 + rand(i, 2) * (TANKS.documents.h - 0.25), Math.sin(a) * d);
      o.scale.setScalar(0.028);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [n]);
  useFrame((_, dt) => {
    if (!reduced && group.current) group.current.rotation.y += dt * (fast ? 0.9 : 0.25);
  });
  return (
    <group ref={group}>
      <instancedMesh ref={ref} args={[undefined, undefined, n]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#7ee2bd" emissive={GREEN} emissiveIntensity={0.9} />
      </instancedMesh>
    </group>
  );
}

/** Drops falling into each tank, and matching passages leaving toward the API. */
function Flows() {
  const reduced = useReducedMotion();
  const drops = useRef<(THREE.Group | null)[]>([]);
  const out = useRef<(THREE.Group | null)[]>([]);
  const kinds: TankId[] = ['raw', 'processed', 'documents'];
  useFrame(({ clock }) => {
    const t = reduced ? 1.1 : clock.elapsedTime;
    drops.current.forEach((g, i) => {
      if (!g) return;
      const tank = TANKS[kinds[i]];
      const u = (t + i * 0.9) % 2.7;
      const p = ease(win(u, 0, 1.1));
      g.position.set(tank.x, BASE + tank.h + 1.0 - p * 0.95, TANK_Z);
      g.scale.setScalar(Math.max(0.001, bump(u, 0, 1.25, 0.2)));
    });
    out.current.forEach((g, i) => {
      if (!g) return;
      const p = (t * 0.32 + i / 4) % 1;
      g.position.set(2.3 + p * 3.0, BASE + 0.16, 0.85);
      g.scale.setScalar(Math.max(0.001, bump(p, 0, 1, 0.15)));
    });
  });
  return (
    <>
      {kinds.map((k, i) => (
        <group key={k} ref={(g) => void (drops.current[i] = g)}>
          {k === 'raw' && <RecordCard scale={0.9} />}
          {k === 'processed' && <RecordCard color={LAYERS[1].color} scale={0.9} />}
          {k === 'documents' && <Dot />}
        </group>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} ref={(g) => void (out.current[i] = g)}>
          <Dot r={0.07} />
        </group>
      ))}
    </>
  );
}

/** Passage → clean record → raw record → original page, as moving dashed threads. */
function Lineage() {
  const lines = useRef<({ material: { dashOffset: number } } | null)[]>([]);
  useFrame((_, dt) => {
    lines.current.forEach((l) => {
      if (l) l.material.dashOffset -= dt * 0.8;
    });
  });
  const { a, b, c, d } = LINEAGE;
  const mid = (p: Vec3, q: Vec3, lift: number): Vec3 => [(p[0] + q[0]) / 2, Math.max(p[1], q[1]) + lift, (p[2] + q[2]) / 2 + 0.25];
  return (
    <group>
      {[
        [a, b],
        [b, c],
        [c, d],
      ].map(([p, q], i) => (
        <QuadraticBezierLine
          key={i}
          ref={(l) => void (lines.current[i] = l as unknown as { material: { dashOffset: number } } | null)}
          start={p}
          end={q}
          mid={mid(p, q, i === 2 ? 0.45 : 0.7)}
          color={C.ink}
          lineWidth={2.2}
          dashed
          dashSize={0.12}
          gapSize={0.08}
        />
      ))}
      <group position={a}>
        <mesh>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.2} />
        </mesh>
      </group>
      {[b, c].map((p, i) => (
        <group key={i} position={p}>
          <RBox size={[0.7, 0.04, 0.52]} radius={0.015} color="#ffffff" glow={0.6} />
        </group>
      ))}
      <group position={d} rotation-x={Math.PI / 2.4}>
        <PageSheet />
      </group>
    </group>
  );
}
