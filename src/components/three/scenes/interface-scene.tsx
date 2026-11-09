import { QuadraticBezierLine } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { LAYERS } from '@/data/layers';
import { snapshot } from '@/data/snapshot';
import { useReducedMotion } from '@/hooks/use-media';
import { C, bump, ease, win, aroundX, type SceneLabel, type Vec3 } from '../constants';
import { Laptop, NeighborStation, PLATFORM_H, Platform, RBox } from '../parts';
import { FocusRing, NeighborTag, SceneNote, ZoneTag } from '../scene-kit';
import { Stage } from '../stage';
import { useStepStart } from '../use-step';

const PINK = LAYERS[4].color;
const AMBER = LAYERS[3].color;
const BASE = PLATFORM_H;
const LAPTOP_X = -0.55;
const LAPTOP_SCALE = 2.05;
const TOUR_X = 4.35;
const CABLE: [number, number] = [-4.85, -2.3];
const s = snapshot;

/** Interface page: you ask, you watch it work, the answer streams in, and the tour explains it all. */
export default function InterfaceScene({ step }: { step: number }) {
  const labels = useMemo<SceneLabel[]>(
    () => [
      { key: 'from', minor: true, at: [-6.1, 1.75, -0.2], content: <NeighborTag>4 · RAG API</NeighborTag> },
      { key: 'z1', minor: step !== 0, at: [LAPTOP_X + 1.35, BASE + 2.55, -0.6], content: <ZoneTag n={1} active={step === 0} color={PINK}>Ask anything</ZoneTag> },
      { key: 'z2', minor: step !== 1, at: [LAPTOP_X - 1.55, BASE + 2.2, -0.6], content: <ZoneTag n={2} active={step === 1} color={PINK}>Watch it work</ZoneTag> },
      { key: 'z3', minor: step !== 2, at: [LAPTOP_X - 0.4, BASE + 0.1, 1.45], place: 'below', content: <ZoneTag n={3} active={step === 2} color={PINK}>Read it as it’s written</ZoneTag> },
      { key: 'z4', minor: step !== 3, at: [TOUR_X, BASE + 1.75, -0.2], content: <ZoneTag n={4} active={step === 3} color={PINK}>Take the tour</ZoneTag> },
      note(0, step, [LAPTOP_X + 2.2, BASE + 1.7, 0.6], 'right', <>Type a question in plain words, like “How is acne treated?”</>),
      note(1, step, [LAPTOP_X - 2.4, BASE + 1.6, 0.4], 'left', <>Live status: understanding → searching → found {s.meta.topN} passages.</>),
      note(2, step, [LAPTOP_X + 2.2, BASE + 1.2, 0.6], 'right', <>Words appear as soon as the AI writes them, no waiting for the whole answer.</>),
      note(3, step, [TOUR_X, BASE, 1.35], 'below', <>Every number on these pages comes from the real pipeline database.</>),
    ],
    [step],
  );

  const focus: { target: Vec3; r: number }[] = [
    { target: [LAPTOP_X + 0.5, BASE, 0], r: 1.6 },
    { target: [LAPTOP_X - 0.6, BASE, 0], r: 1.6 },
    { target: [LAPTOP_X, BASE, 0.2], r: 1.9 },
    { target: [TOUR_X, BASE, 0], r: 1.45 },
  ];

  return (
    <Stage
      className="h-full w-full"
      bounds={{ min: [-7.2, 0, -1.5], max: [5.95, 3.15, 1.6] }}
      core={aroundX(focus[step].target[0], 3.0, 3.15)}
      labels={labels}
      description="This website as a big laptop: a question is asked, live status lights come on, and the answer appears line by line while signals travel to and from the RAG API. Next to it, five tour pages fan out of a box of real pipeline data."
    >
      <FocusRing target={focus[step].target} radius={focus[step].r} color={PINK} />
      <NeighborStation kind="api" position={[-6.1, 0, 0]} />
      <Platform color={PINK} position={[0.75, 0, 0]} size={[8.1, 3]} />
      <Screen step={step} />
      <Tour step={step} />
    </Stage>
  );
}

function note(forStep: number, step: number, at: Vec3, place: SceneLabel['place'], children: ReactNode): SceneLabel {
  return { key: `note-${forStep}`, at, place, hidden: step !== forStep, content: <SceneNote color={PINK}>{children}</SceneNote> };
}

/** The laptop: question bubble, status lights and a growing answer, plus the cable to the API. */
function Screen({ step }: { step: number }) {
  const reduced = useReducedMotion();
  const stepStart = useStepStart(step);
  const question = useRef<THREE.Group>(null);
  const chips = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const lines = useRef<(THREE.Group | null)[]>([]);
  const answer = useRef<THREE.Group>(null);
  const pulses = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const ts = reduced ? 3 : clock.elapsedTime - stepStart.current;
    const loop = ts % 4.2;

    if (question.current) {
      const p = step === 0 ? ease(win(loop, 0.2, 0.7)) : 1;
      question.current.scale.setScalar(Math.max(0.001, p));
    }
    chips.current.forEach((m, i) => {
      if (!m) return;
      const on = step === 0 ? 0 : step === 1 ? (loop > 0.4 + i * 0.9 ? 1 : 0) : 1;
      m.emissiveIntensity = THREE.MathUtils.lerp(0.05, 0.9, on);
      m.color.set(on ? AMBER : '#3a4655');
      m.emissive.set(on ? AMBER : '#000000');
    });
    if (answer.current) answer.current.scale.setScalar(step >= 2 ? 1 : 0.001);
    lines.current.forEach((g, i) => {
      if (!g) return;
      const w = step < 2 ? 0 : step === 2 ? ease(win(loop, 0.2 + i * 0.6, 0.8 + i * 0.6)) : 1;
      g.scale.x = Math.max(0.001, w);
    });

    // Signals on the cable: out to the API while asking, back in while it answers
    pulses.current.forEach((m, i) => {
      if (!m) return;
      const p = (ts * 0.7 + i / 3) % 1;
      const out = step === 0;
      const live = step === 0 || step === 1 || step === 2;
      m.position.x = out ? THREE.MathUtils.lerp(CABLE[1], CABLE[0], p) : THREE.MathUtils.lerp(CABLE[0], CABLE[1], p);
      m.scale.setScalar(live ? Math.max(0.001, bump(p, 0, 1, 0.15)) : 0.001);
      (m.material as THREE.MeshStandardMaterial).color.set(out ? PINK : AMBER);
      (m.material as THREE.MeshStandardMaterial).emissive.set(out ? PINK : AMBER);
    });
  });

  const screen = (
    <>
      {/* question, right-aligned */}
      <group ref={question} position={[0.3, 0.27, 0]}>
        <RBox size={[0.62, 0.13, 0.02]} radius={0.05} color={PINK} glow={0.35} />
      </group>
      {/* status lights */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.52 + i * 0.2, 0.1, 0.012]}>
          <boxGeometry args={[0.17, 0.05, 0.012]} />
          <meshStandardMaterial ref={(m) => void (chips.current[i] = m)} color="#3a4655" />
        </mesh>
      ))}
      {/* answer bubble whose lines grow */}
      <group ref={answer} position={[-0.17, -0.17, 0]}>
        <RBox size={[0.9, 0.42, 0.02]} radius={0.06} color="#26313d" />
        {[0, 1, 2, 3].map((i) => (
          <group key={i} ref={(g) => void (lines.current[i] = g)} position={[-0.37, 0.13 - i * 0.085, 0.013]}>
            <mesh position={[(i === 3 ? 0.42 : 0.74) / 2, 0, 0]}>
              <planeGeometry args={[i === 3 ? 0.42 : 0.74, 0.035]} />
              <meshBasicMaterial color={C.paper} />
            </mesh>
          </group>
        ))}
      </group>
    </>
  );

  return (
    <>
      <group position={[LAPTOP_X, BASE, -0.25]} rotation-y={0.12}>
        <Laptop color={PINK} scale={LAPTOP_SCALE} screen={screen} />
      </group>
      <mesh position={[(CABLE[0] + CABLE[1]) / 2, BASE + 0.03, 0.75]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.03, 0.03, CABLE[1] - CABLE[0], 8]} />
        <meshStandardMaterial color="#33414f" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => void (pulses.current[i] = m)} position={[CABLE[0], BASE + 0.08, 0.75]}>
          <sphereGeometry args={[0.07, 14, 14]} />
          <meshStandardMaterial color={PINK} emissive={PINK} emissiveIntensity={1.1} />
        </mesh>
      ))}
    </>
  );
}

/** Five tour pages (one per station) fanning out of a box of real pipeline data. */
function Tour({ step }: { step: number }) {
  const cards = useRef<(THREE.Group | null)[]>([]);
  const open = useRef(0);
  useFrame((_, dt) => {
    open.current = THREE.MathUtils.damp(open.current, step === 3 ? 1 : 0, 4, dt);
    cards.current.forEach((g, i) => {
      if (!g) return;
      const k = i - 2;
      g.position.set(TOUR_X + k * (0.34 + open.current * 0.14), BASE + 0.62 + open.current * (0.32 - Math.abs(k) * 0.06), -0.35 + Math.abs(k) * 0.06);
      g.rotation.set(-0.05, -k * (0.1 + open.current * 0.12), k * -0.04 * open.current);
    });
  });
  const crate: Vec3 = [TOUR_X, BASE, 0.75];
  return (
    <>
      {LAYERS.map((l, i) => (
        <group key={l.id} ref={(g) => void (cards.current[i] = g)}>
          <RBox size={[0.6, 0.82, 0.03]} radius={0.03} color="#1e2935" />
          <mesh position={[0, 0.32, 0.017]}>
            <planeGeometry args={[0.52, 0.09]} />
            <meshStandardMaterial color={l.color} emissive={l.color} emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[0, 0.06, 0.017]}>
            <circleGeometry args={[0.13, 24]} />
            <meshStandardMaterial color={l.color} emissive={l.color} emissiveIntensity={0.25} />
          </mesh>
          {[0, 1].map((r) => (
            <mesh key={r} position={[0, -0.18 - r * 0.08, 0.017]}>
              <planeGeometry args={[r ? 0.3 : 0.44, 0.03]} />
              <meshBasicMaterial color={C.line} />
            </mesh>
          ))}
        </group>
      ))}
      <group position={crate}>
        <RBox size={[0.9, 0.36, 0.55]} radius={0.05} color="#223040" position={[0, 0.18, 0]} />
        <RBox size={[0.94, 0.06, 0.59]} radius={0.02} color={LAYERS[2].color} glow={step === 3 ? 0.9 : 0.3} position={[0, 0.38, 0]} />
      </group>
      {step === 3 &&
        LAYERS.map((l, i) => (
          <QuadraticBezierLine
            key={l.id}
            start={[crate[0], crate[1] + 0.42, crate[2]]}
            end={[TOUR_X + (i - 2) * 0.48, BASE + 0.62, -0.3]}
            mid={[TOUR_X + (i - 2) * 0.3, BASE + 1.2, 0.3]}
            color={l.color}
            lineWidth={1.5}
            transparent
            opacity={0.7}
          />
        ))}
    </>
  );
}
