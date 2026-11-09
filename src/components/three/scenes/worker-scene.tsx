import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { LAYERS } from '@/data/layers';
import { CONTENT_TYPE_COLOR, CONTENT_TYPE_LABEL, snapshot } from '@/data/snapshot';
import { useReducedMotion } from '@/hooks/use-media';
import { C, bump, ease, rand, win, aroundX, type SceneLabel, type Vec3 } from '../constants';
import { Belt, ChunkTile, Ghost, PLATFORM_H, Platform, RBox, RecordCard } from '../parts';
import { cloudLocal, pointById } from '../cloud-data';
import { PointCloud } from '../point-cloud';
import { FocusRing, NeighborTag, SceneNote, ZoneTag } from '../scene-kit';
import { Stage } from '../stage';

const ORANGE = LAYERS[1].color;
const GREEN = LAYERS[2].color;
const s = snapshot;
const DOCS = s.sample.documents;
const ACNE_IDS = new Set(DOCS.map((d) => d.id));
const CYCLE = 5.8;

const PILE_X = -5.75;
const BRUSH_X = -3.2;
const CUT_X = -1.0;
const RING_X = 1.3;
const CLOUD: Vec3 = [4.4, 1.95, -0.1];
const CLOUD_R = 1.4;
const BELT_Z = 0.45;
const BELT_Y = PLATFORM_H + 0.1;

const typeCounts = DOCS.reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.contentType]: (acc[d.contentType] ?? 0) + 1 }), {});
const split = (Object.keys(CONTENT_TYPE_LABEL) as (keyof typeof CONTENT_TYPE_LABEL)[])
  .filter((t) => typeCounts[t])
  .map((t) => `${typeCounts[t]} ${CONTENT_TYPE_LABEL[t].toLowerCase()}${typeCounts[t] > 1 ? 's' : ''}`)
  .join(', ');
const vectorHead = DOCS[0].embeddingHead.slice(0, 4).map((v) => v.toFixed(3)).join(', ');
const titleExample = s.audit.normalizationExamples.find((n) => n.conditionName === s.sample.condition) ?? s.audit.normalizationExamples[0];

/** Worker page: tidy → cut → encode, and the passages landing in the meaning map. */
export default function WorkerScene({ step }: { step: number }) {
  const labels = useMemo<SceneLabel[]>(
    () => [
      { key: 'from', minor: true, at: [PILE_X, 1.45, 0], content: <NeighborTag>from 1 · Scraper:<br />raw records</NeighborTag> },
      { key: 'z1', minor: step !== 0, at: [BRUSH_X, 1.55, BELT_Z], content: <ZoneTag n={1} active={step === 0} color={ORANGE}>Tidy up</ZoneTag> },
      { key: 'z2', minor: step !== 1, at: [CUT_X, 1.75, BELT_Z], content: <ZoneTag n={2} active={step === 1} color={ORANGE}>Cut into passages</ZoneTag> },
      { key: 'z3', minor: step !== 2, at: [RING_X + 0.2, 1.08, BELT_Z], content: <ZoneTag n={3} active={step === 2} color={ORANGE}>Turn into numbers</ZoneTag> },
      {
        key: 'z4',
        minor: step !== 3,
        at: [CLOUD[0], CLOUD[1] + CLOUD_R * 0.75, CLOUD[2]],
        content: <ZoneTag n={4} active={step === 3} color={ORANGE}>Similar meanings, close together</ZoneTag>,
      },
      { key: 'to', minor: true, at: [CLOUD[0], PLATFORM_H, 1.35], place: 'below', content: <NeighborTag>kept in 3 · Database</NeighborTag> },
      {
        key: 'n0',
        at: [BRUSH_X, PLATFORM_H, 1.3],
        place: 'below',
        hidden: step !== 0,
        content: (
          <SceneNote color={ORANGE}>
            “{titleExample.title}” becomes <strong>“{titleExample.conditionName}”</strong>, and {s.audit.nbspRaw} invisible
            stray spaces are cleaned out.
          </SceneNote>
        ),
      },
      {
        key: 'n1',
        at: [CUT_X, PLATFORM_H, 1.3],
        place: 'below',
        hidden: step !== 1,
        content: (
          <SceneNote color={ORANGE}>
            The {s.sample.condition} page becomes {DOCS.length} passages: {split}.
          </SceneNote>
        ),
      },
      {
        key: 'n2',
        at: [RING_X, PLATFORM_H, 1.3],
        place: 'below',
        hidden: step !== 2,
        content: (
          <SceneNote color={ORANGE}>
            Each passage → {s.meta.embeddingDims} numbers, like <span className="font-mono">[{vectorHead}, …]</span>
          </SceneNote>
        ),
      },
      {
        key: 'n3',
        at: [CLOUD[0] - CLOUD_R - 0.1, CLOUD[1] - 0.2, CLOUD[2]],
        place: 'left',
        hidden: step !== 3,
        content: (
          <SceneNote color={GREEN}>
            The {DOCS.length} {s.sample.condition} passages (bright) sit side by side. Every condition forms its own
            little cluster.
          </SceneNote>
        ),
      },
    ],
    [step],
  );

  const focus: { target: Vec3; r: number }[] = [
    { target: [BRUSH_X, PLATFORM_H, 0.3], r: 1.15 },
    { target: [CUT_X, PLATFORM_H, 0.3], r: 1.15 },
    { target: [RING_X, PLATFORM_H, 0.3], r: 1.1 },
    { target: [CLOUD[0], PLATFORM_H, 0], r: 1.6 },
  ];

  return (
    <Stage
      className="h-full w-full"
      bounds={{ min: [-6.6, 0, -1.3], max: [5.95, 3.7, 1.35] }}
      core={aroundX(focus[step].target[0], 2.9, 3.7)}
      labels={labels}
      description="Raw records come in from the left. A brush tidies each record, a cutter splits it into short passages, and a ring turns every passage into a glowing point that flies into a 3D cloud where similar passages sit close together."
    >
      <FocusRing target={focus[step].target} radius={focus[step].r} color={ORANGE} />
      <Ghost>
        <Platform color={LAYERS[0].color} position={[PILE_X, 0, 0]} size={[1.7, 1.9]} />
        <Platform color={GREEN} position={[CLOUD[0], 0, 0]} size={[2.7, 2.6]} />
      </Ghost>
      <Platform color={ORANGE} position={[-1.05, 0, 0]} size={[6.5, 2.4]} />
      <Belt from={-4.9} to={1.95} z={BELT_Z} speed={1.3} />
      <Machines />
      <Process step={step} />
    </Stage>
  );
}

function Machines() {
  const roller = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (roller.current) roller.current.rotation.z -= dt * 6;
  });
  return (
    <>
      {/* 1 · brush roller */}
      <group position={[BRUSH_X, PLATFORM_H, BELT_Z]}>
        {[-1, 1].map((sd) => (
          <RBox key={sd} size={[0.12, 0.75, 0.12]} radius={0.03} color="#9b3f19" position={[0, 0.375, sd * 0.42]} />
        ))}
        <group ref={roller} position={[0, 0.5, 0]}>
          <mesh rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.17, 0.17, 0.72, 20]} />
            <meshStandardMaterial color={ORANGE} roughness={0.5} />
          </mesh>
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0]} rotation-z={a}>
                <boxGeometry args={[0.07, 0.035, 0.7]} />
                <meshStandardMaterial color="#f2b48f" />
              </mesh>
            );
          })}
        </group>
      </group>

      {/* 2 · cutter frame (the blade moves in Process) */}
      <group position={[CUT_X, PLATFORM_H, BELT_Z]}>
        {[-1, 1].map((sd) => (
          <RBox key={sd} size={[0.14, 1.25, 0.14]} radius={0.03} color="#9b3f19" position={[0, 0.625, sd * 0.47]} />
        ))}
        <RBox size={[0.3, 0.14, 1.08]} radius={0.04} color={ORANGE} position={[0, 1.25, 0]} />
      </group>

      {/* 3 · encoder ring the passages fly through */}
      <group position={[RING_X, BELT_Y + 0.12, BELT_Z]} rotation-y={Math.PI / 2}>
        <mesh castShadow>
          <torusGeometry args={[0.46, 0.055, 16, 64]} />
          <meshStandardMaterial color={ORANGE} emissive={ORANGE} emissiveIntensity={0.9} />
        </mesh>
        <mesh>
          <torusGeometry args={[0.36, 0.015, 8, 64]} />
          <meshBasicMaterial color="#ffd0b5" />
        </mesh>
      </group>
    </>
  );
}

function Process({ step }: { step: number }) {
  const reduced = useReducedMotion();
  const cloud = useRef<THREE.Group>(null);
  const card = useRef<THREE.Group>(null);
  const specks = useRef<THREE.Group>(null);
  const dust = useRef<(THREE.Mesh | null)[]>([]);
  const blade = useRef<THREE.Group>(null);
  const tiles = useRef<(THREE.Group | null)[]>([]);
  const dots = useRef<(THREE.Mesh | null)[]>([]);
  const target = useMemo(() => new THREE.Vector3(), []);
  const highlight = useMemo(() => (step === 3 ? ACNE_IDS : null), [step]);
  const targets = useMemo(() => DOCS.map((d) => cloudLocal(pointById(d.id), CLOUD_R)), []);

  useFrame(({ clock }) => {
    const t = reduced ? 3.95 : clock.elapsedTime;
    const u = t % CYCLE;

    // Card: pile → belt → brush → cutter
    const cd = card.current;
    if (cd) {
      if (u < 0.5) {
        const p = ease(u / 0.5);
        cd.position.set(THREE.MathUtils.lerp(PILE_X, -4.7, p), THREE.MathUtils.lerp(PLATFORM_H + 0.75, BELT_Y, p) + Math.sin(Math.PI * p) * 0.4, THREE.MathUtils.lerp(0, BELT_Z, p));
      } else if (u < 1.9) {
        const p = ease(win(u, 0.5, 1.3));
        cd.position.set(THREE.MathUtils.lerp(-4.7, BRUSH_X, p), BELT_Y, BELT_Z);
      } else {
        const p = ease(win(u, 1.9, 2.5));
        cd.position.set(THREE.MathUtils.lerp(BRUSH_X, CUT_X, p), BELT_Y, BELT_Z);
      }
      cd.scale.setScalar(u < 2.65 ? 1.1 : 0.001);
    }
    if (specks.current) specks.current.scale.setScalar(Math.max(0.001, 1 - win(u, 1.35, 1.85)));

    // Dust flying off under the brush
    dust.current.forEach((m, i) => {
      if (!m) return;
      const p = win(u, 1.35 + (i % 4) * 0.1, 1.95 + (i % 4) * 0.1);
      m.position.set(BRUSH_X + (rand(i) - 0.5) * 0.3 - p * 0.5, BELT_Y + 0.12 + p * (0.5 + rand(i, 1) * 0.6), BELT_Z + (rand(i, 2) - 0.5) * 0.6);
      m.scale.setScalar(Math.max(0.001, bump(p, 0, 1, 0.3)));
    });

    // Blade: down at 2.62, back up
    if (blade.current) {
      const down = bump(u, 2.5, 2.85, 0.15);
      blade.current.position.y = PLATFORM_H + 1.08 - down * 0.78;
    }

    // Tiles: burst out of the card, line up, ride to the ring at a steady pace, then become dots
    const cl = cloud.current;
    const n = DOCS.length;
    tiles.current.forEach((g, i) => {
      const dot = dots.current[i];
      if (!g || !dot) return;
      const born = ease(win(u, 2.65, 2.95));
      const rowX = CUT_X + 0.3 + i * 0.26;
      const arrive = 3.6 + (n - 1 - i) * 0.2;
      const depart = arrive - (RING_X - rowX) / 2;
      const travel = win(u, depart, arrive);
      g.position.set(
        travel > 0 ? THREE.MathUtils.lerp(rowX, RING_X, travel) : THREE.MathUtils.lerp(CUT_X, rowX, born),
        BELT_Y + 0.02 + Math.sin(Math.PI * born) * 0.25,
        BELT_Z,
      );
      g.scale.setScalar(u < 2.65 || travel >= 1 ? 0.001 : 1);

      // Dot: from the ring to the passage's real place in the cloud
      const fly = ease(win(u, arrive, arrive + 0.85));
      if (cl && travel >= 1 && fly < 1) {
        target.copy(targets[i]);
        cl.localToWorld(target);
        dot.position.set(
          THREE.MathUtils.lerp(RING_X, target.x, fly),
          THREE.MathUtils.lerp(BELT_Y + 0.12, target.y, fly) + Math.sin(Math.PI * fly) * 0.9,
          THREE.MathUtils.lerp(BELT_Z, target.z, fly),
        );
        dot.scale.setScalar(1);
      } else {
        dot.scale.setScalar(0.001);
      }
    });
  });

  return (
    <>
      {/* Input pile */}
      <group position={[PILE_X, PLATFORM_H + 0.05, 0]}>
        {Array.from({ length: 6 }, (_, i) => (
          <group key={i} position={[0, i * 0.115, 0]} rotation-y={(rand(i, 3) - 0.5) * 0.3}>
            <RecordCard scale={1.25} />
          </group>
        ))}
      </group>

      <group ref={card}>
        <RecordCard />
        <group ref={specks}>
          {[[-0.12, -0.06], [0.08, 0.1], [0.15, -0.09], [-0.03, 0.04]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.065, z]}>
              <boxGeometry args={[0.05, 0.03, 0.05]} />
              <meshStandardMaterial color="#59636e" />
            </mesh>
          ))}
        </group>
      </group>

      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} ref={(m) => void (dust.current[i] = m)}>
          <boxGeometry args={[0.045, 0.045, 0.045]} />
          <meshStandardMaterial color={C.line} />
        </mesh>
      ))}

      <group ref={blade} position={[CUT_X, PLATFORM_H + 1.08, BELT_Z]}>
        <RBox size={[0.05, 0.36, 0.86]} radius={0.015} color="#e6edf5" />
      </group>

      {DOCS.map((d, i) => (
        <group key={d.id} ref={(g) => void (tiles.current[i] = g)}>
          <ChunkTile type={d.contentType} />
        </group>
      ))}
      {DOCS.map((d, i) => (
        <mesh key={d.id} ref={(m) => void (dots.current[i] = m)} scale={0.001}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial color={CONTENT_TYPE_COLOR[d.contentType]} emissive={CONTENT_TYPE_COLOR[d.contentType]} emissiveIntensity={1.2} />
        </mesh>
      ))}

      <group position={CLOUD}>
        <PointCloud radius={CLOUD_R} groupRef={cloud} spin={reduced ? 0 : 0.12} highlight={highlight} size={0.04} />
      </group>
    </>
  );
}
