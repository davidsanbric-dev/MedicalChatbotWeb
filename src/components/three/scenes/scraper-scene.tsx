import { useFrame } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { LAYERS, SOURCE } from '@/data/layers';
import { snapshot } from '@/data/snapshot';
import { useReducedMotion } from '@/hooks/use-media';
import { C, bump, ease, rand, win, aroundX, type SceneLabel, type Vec3 } from '../constants';
import { Belt, Magnifier, NeighborStation, PLATFORM_H, PageSheet, Platform, RBox, RecordCard } from '../parts';
import { FocusRing, NeighborTag, SceneNote, ZoneTag } from '../scene-kit';
import { Stage } from '../stage';
import { useStepStart } from '../use-step';

const BLUE = LAYERS[0].color;
const PAGES = snapshot.conditions.length;
const COLS = 12;
const CYCLE = 4; // seconds per page: fetch, read, save, polite pause

const WALL_X = -4.6;
const SCAN_X = -0.7;
const PILE_X = 2.5;
const BELT_Z = 0.5;
const BELT_Y = PLATFORM_H + 0.1;
const PILE_MAX = 12;
const PILE_STEP = 0.115;

const tile = (i: number): Vec3 => {
  const c = i % COLS;
  const r = Math.floor(i / COLS);
  return [-1.485 + c * 0.25 + 0.11, 1.5 - r * 0.2 - 0.085, 0.04];
};

const sample = snapshot.sample.raw.content as {
  title?: string;
  symptoms?: { list?: string[] };
  onlineDiagnosingAndTreating?: { content?: unknown[] };
};

/** Scraper page: the website as a wall of pages, read one at a time and saved as records. */
export default function ScraperScene({ step }: { step: number }) {
  const counter = useRef<HTMLSpanElement>(null);
  // Written straight to the DOM from the frame loop: no React render per page.
  const onSaved = useCallback((n: number) => {
    if (counter.current) counter.current.textContent = String(n);
  }, []);

  const labels = useMemo<SceneLabel[]>(
    () => [
      { key: 'z1', minor: step !== 0, at: [WALL_X, 2.3, -0.45], content: <ZoneTag n={1} active={step === 0} color={BLUE}>Find every page</ZoneTag> },
      { key: 'z2', minor: step !== 1, at: [-2.55, 1.7, 0.3], content: <ZoneTag n={2} active={step === 1} color={BLUE}>Visit one at a time</ZoneTag> },
      { key: 'z3', minor: step !== 2, at: [SCAN_X, 2.2, BELT_Z], content: <ZoneTag n={3} active={step === 2} color={BLUE}>Pick out what matters</ZoneTag> },
      {
        key: 'z4',
        minor: step !== 3,
        at: [PILE_X, 2.05, 0],
        content: (
          <div className="flex flex-col items-center gap-1">
            <ZoneTag n={4} active={step === 3} color={BLUE}>Save the record</ZoneTag>
            <span className="font-mono text-[11px] text-ink-2">
              <span ref={counter}>0</span> / {PAGES} saved
            </span>
          </div>
        ),
      },
      { key: 'next', minor: true, at: [5.9, 1.75, -0.2], content: <NeighborTag>next: 2 · Worker →</NeighborTag> },
      {
        key: 'n0',
        at: [WALL_X, PLATFORM_H, 1.25],
        place: 'below',
        hidden: step !== 0,
        content: (
          <SceneNote color={BLUE}>
            The site’s map (<span className="font-mono">sitemap.xml</span>) lists {PAGES} condition pages on{' '}
            {SOURCE.host}.
          </SceneNote>
        ),
      },
      {
        key: 'n1',
        at: [-2.35, PLATFORM_H, 1.15],
        place: 'below',
        hidden: step !== 1,
        content: <SceneNote color={BLUE}>One page, then a 1-second pause. Pages already saved are skipped.</SceneNote>,
      },
      {
        key: 'n2',
        at: [SCAN_X, PLATFORM_H, 1.3],
        place: 'below',
        hidden: step !== 2,
        content: (
          <SceneNote color={BLUE}>
            From “{sample.title}” it keeps the title, {sample.symptoms?.list?.length ?? 0} symptoms and{' '}
            {sample.onlineDiagnosingAndTreating?.content?.length ?? 0} treatment blocks.
          </SceneNote>
        ),
      },
      {
        key: 'n3',
        at: [PILE_X, PLATFORM_H, 1.15],
        place: 'below',
        hidden: step !== 3,
        content: <SceneNote color={LAYERS[2].color}>Stored exactly as found, one record per page, in the database.</SceneNote>,
      },
    ],
    [step],
  );

  const focus: { target: Vec3; r: number }[] = [
    { target: [WALL_X, PLATFORM_H, 0], r: 2.3 },
    { target: [-2.45, 0, 0.45], r: 1.2 },
    { target: [SCAN_X, PLATFORM_H, 0.2], r: 1.55 },
    { target: [PILE_X, PLATFORM_H, 0], r: 1.35 },
  ];

  return (
    <Stage
      className="h-full w-full"
      bounds={{ min: [-6.45, 0, -1.25], max: [7.2, 2.35, 1.3] }}
      core={aroundX(focus[step].target[0], 2.9, 2.35)}
      labels={labels}
      description="The source website is shown as a wall of 76 page tiles. The scraper flies to one page at a time, reads it under a magnifier, splits out the title, symptoms and treatment, and stacks the resulting record on a pile that is saved to the database."
    >
      <FocusRing target={focus[step].target} radius={focus[step].r} color={BLUE} />
      <Platform color={SOURCE.color} position={[WALL_X, 0, 0]} size={[3.6, 2.4]} />
      <Platform color={BLUE} position={[SCAN_X, 0, 0]} size={[2.4, 2.4]} active={step === 2} />
      <Platform color={LAYERS[2].color} position={[PILE_X, 0, 0]} size={[1.9, 2.0]} active={step === 3} />
      <NeighborStation kind="worker" position={[6.0, 0, 0]} />
      <Belt from={-2.8} to={1.55} z={BELT_Z} speed={2.9} />
      <Process step={step} onSaved={onSaved} />
    </Stage>
  );
}

function Process({ step, onSaved }: { step: number; onSaved: (n: number) => void }) {
  const reduced = useReducedMotion();
  const stepStart = useStepStart(step);
  const wall = useRef<THREE.Group>(null);
  const tiles = useRef<THREE.InstancedMesh>(null);
  const page = useRef<THREE.Group>(null);
  const beam = useRef<THREE.MeshBasicMaterial>(null);
  const parts = useRef<(THREE.Group | null)[]>([]);
  const card = useRef<THREE.Group>(null);
  const pile = useRef<(THREE.Group | null)[]>([]);
  const lastK = useRef(-1);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const palette = useMemo(
    () => ({
      hidden: new THREE.Color('#263241'),
      found: new THREE.Color('#2b5180'),
      done: new THREE.Color(BLUE),
      now: new THREE.Color('#ffffff'),
    }),
    [],
  );

  useLayoutEffect(() => {
    const m = tiles.current;
    if (!m) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < PAGES; i++) {
      o.position.set(...tile(i));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, palette.hidden);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    (m.material as THREE.Material).needsUpdate = true;
  }, [palette]);

  useFrame(({ clock }) => {
    const t = reduced ? CYCLE * 7 + 1.2 : clock.elapsedTime;
    const ts = reduced ? 2.2 : clock.elapsedTime - stepStart.current;
    const k = Math.floor(t / CYCLE) % PAGES; // index of the page in flight
    const u = t % CYCLE;

    // Wall tiles: a discovery sweep in step 1, visit progress otherwise.
    const m = tiles.current;
    if (m) {
      const sweep = step === 0 ? ((ts % 3.2) / 2.4) * PAGES : Infinity;
      for (let i = 0; i < PAGES; i++) {
        if (step === 0) col.copy(i < sweep ? palette.found : palette.hidden);
        else if (i < k) col.copy(palette.done);
        else if (i === k) col.copy(palette.found).lerp(palette.now, bump(u, 0, 0.8, 0.2));
        else col.copy(palette.found);
        m.setColorAt(i, col);
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }

    // Page: tile → belt (arc), along the belt, under the magnifier.
    const pg = page.current;
    if (pg && wall.current) {
      tmp.set(...tile(k));
      wall.current.localToWorld(tmp);
      if (u < 0.7) {
        const p = ease(u / 0.7);
        pg.position.set(
          THREE.MathUtils.lerp(tmp.x, -2.6, p),
          THREE.MathUtils.lerp(tmp.y, BELT_Y, p) + Math.sin(Math.PI * p) * 0.7,
          THREE.MathUtils.lerp(tmp.z, BELT_Z, p),
        );
        pg.rotation.x = (1 - p) * (Math.PI / 2);
        pg.scale.setScalar(0.55 + 0.45 * p);
      } else {
        const p = ease(win(u, 0.7, 1.5));
        pg.position.set(THREE.MathUtils.lerp(-2.6, SCAN_X, p), BELT_Y, BELT_Z);
        pg.rotation.x = 0;
        pg.scale.setScalar(u < 1.95 ? 1 : Math.max(0.001, 1 - win(u, 1.95, 2.1)));
      }
    }

    // Scanning beam pulses while the page is under the lens.
    if (beam.current) beam.current.opacity = 0.05 + 0.3 * bump(u, 1.45, 2.05, 0.12);

    // Parts: title / symptoms / treatment lift off, spread, then merge into a record.
    parts.current.forEach((g, i) => {
      if (!g) return;
      const out = ease(win(u, 1.95, 2.25));
      const merge = ease(win(u, 2.3, 2.6));
      const spread = (i - 1) * 0.32;
      g.position.set(
        THREE.MathUtils.lerp(SCAN_X + spread * out, -0.05, merge),
        BELT_Y + 0.05 + out * 0.42 * (1 - merge),
        BELT_Z,
      );
      g.scale.setScalar(Math.max(0.001, bump(u, 1.95, 2.62, 0.08)));
    });

    // Record card: along the belt, then hop onto the pile.
    const cd = card.current;
    const height = Math.min(PILE_MAX, 2 + Math.floor(k / 6));
    if (cd) {
      const pileTop = PLATFORM_H + 0.05 + height * PILE_STEP;
      if (u < 3.0) {
        const p = ease(win(u, 2.55, 3.0));
        cd.position.set(THREE.MathUtils.lerp(-0.05, 1.5, p), BELT_Y, BELT_Z);
      } else {
        const p = ease(win(u, 3.0, 3.4));
        cd.position.set(
          THREE.MathUtils.lerp(1.5, PILE_X, p),
          THREE.MathUtils.lerp(BELT_Y, pileTop, p) + Math.sin(Math.PI * p) * 0.5,
          THREE.MathUtils.lerp(BELT_Z, 0, p),
        );
      }
      cd.scale.setScalar(u < 2.5 || u > 3.42 ? 0.001 : 1 + 0.25 * ease(win(u, 3.0, 3.4)));
    }

    // Pile grows with the number of pages saved; the counter follows.
    pile.current.forEach((g, i) => {
      if (g) g.visible = i < height;
    });
    const saved = k + (u > 3.4 ? 1 : 0);
    if (saved !== lastK.current) {
      lastK.current = saved;
      onSaved(saved);
    }
  });

  return (
    <>
      {/* The website: a browser window whose content is one tile per condition page */}
      <group ref={wall} position={[WALL_X, PLATFORM_H, -0.5]} rotation-y={0.1}>
        <RBox size={[3.3, 1.86, 0.06]} radius={0.06} color="#c9d2dc" position={[0, 0.95, 0]} />
        <mesh position={[0, 1.78, 0.032]}>
          <planeGeometry args={[3.2, 0.13]} />
          <meshStandardMaterial color="#3a4655" />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[-1.5 + i * 0.07, 1.78, 0.035]}>
            <circleGeometry args={[0.022, 12]} />
            <meshStandardMaterial color={['#d03b3b', '#fab219', '#0ca30c'][i]} />
          </mesh>
        ))}
        <mesh position={[0, 0.95, 0.032]}>
          <planeGeometry args={[3.16, 1.6]} />
          <meshStandardMaterial color="#141c25" />
        </mesh>
        <instancedMesh ref={tiles} args={[undefined, undefined, PAGES]}>
          <boxGeometry args={[0.22, 0.17, 0.02]} />
          <meshStandardMaterial roughness={0.6} />
        </instancedMesh>
      </group>

      {/* The scraper: a magnifier with a scanning beam over the belt */}
      <group position={[SCAN_X, PLATFORM_H + 1.2, BELT_Z - 0.05]}>
        <Magnifier color={BLUE} scale={1.15} />
      </group>
      <mesh position={[SCAN_X, PLATFORM_H + 0.62, BELT_Z]}>
        <cylinderGeometry args={[0.3, 0.42, 0.95, 32, 1, true]} />
        <meshBasicMaterial ref={beam} color="#7fb4ff" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <group ref={page}>
        <PageSheet />
      </group>

      {/* title · symptoms · treatment */}
      <group ref={(g) => void (parts.current[0] = g)}>
        <RBox size={[0.36, 0.05, 0.1]} radius={0.02} color={C.ink} glow={0.3} />
      </group>
      <group ref={(g) => void (parts.current[1] = g)}>
        {[-0.12, 0, 0.12].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <RBox size={[0.1, 0.06, 0.1]} radius={0.02} color={BLUE} glow={0.5} />
          </group>
        ))}
      </group>
      <group ref={(g) => void (parts.current[2] = g)}>
        <RBox size={[0.36, 0.05, 0.22]} radius={0.02} color={C.line} />
      </group>

      <group ref={card}>
        <RecordCard />
      </group>

      {/* The pile of saved raw records */}
      <group position={[PILE_X, PLATFORM_H + 0.05, 0]}>
        {Array.from({ length: PILE_MAX }, (_, i) => (
          <group
            key={i}
            ref={(g) => void (pile.current[i] = g)}
            position={[(rand(i) - 0.5) * 0.06, i * PILE_STEP, (rand(i, 1) - 0.5) * 0.06]}
            rotation-y={(rand(i, 2) - 0.5) * 0.35}
          >
            <RecordCard scale={1.25} />
          </group>
        ))}
      </group>
    </>
  );
}
