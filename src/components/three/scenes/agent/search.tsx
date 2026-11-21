import { QuadraticBezierLine } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { snapshot, type Candidate } from '@/data/snapshot';
import { useReducedMotion } from '@/hooks/use-media';
import { ease, win, type Vec3 } from '../../constants';
import { Magnifier } from '../../parts';
import { cloudLocal, pointById } from '../../cloud-data';
import { PointCloud } from '../../point-cloud';
import { useStepStart } from '../../use-step';
import {
  AMBER,
  BARS_X,
  BAR_GAP,
  BAR_W,
  BASE,
  CLOUD,
  CLOUD_R,
  CORE_BACK,
  GOOD,
  LENS_X,
  PINK,
  STUB,
  SURFACE,
  T,
  arcMid,
  barHeight,
  barX,
  bezier,
  hidden,
  stepTime,
  type SceneProps,
} from './layout';

const s = snapshot;

type BeamHandle = { setPoints: (a: THREE.Vector3, b: THREE.Vector3, m: THREE.Vector3) => void; visible: boolean };

/** The search tool: the meaning map, a beam into it, and one score bar per candidate passage. */
export function Search({ step, scenario }: SceneProps) {
  const reduced = useReducedMotion();
  const start = useStepStart(`${step}-${scenario.message}`);
  const trace = scenario.trace;
  const cloud = useRef<THREE.Group>(null);
  const beam = useRef<BeamHandle | null>(null);
  const links = useRef<THREE.LineSegments>(null);
  const bars = useRef<(THREE.Mesh | null)[]>([]);
  const feeds = useRef<(THREE.Mesh | null)[]>([]);
  const v = useMemo(() => ({ a: new THREE.Vector3(LENS_X, BASE + 1.0, 0), b: new THREE.Vector3(), m: new THREE.Vector3() }), []);

  // Bars sorted so the best candidates stand closest to the AI.
  const ranked = useMemo(() => (trace ? [...trace.candidates].sort((x, y) => x.rerankScore - y.rerankScore) : []), [trace]);
  const feedPaths = useMemo(
    () =>
      ranked.flatMap((c, i) => {
        if (!c.selected) return [];
        const from: Vec3 = [barX(i), SURFACE + barHeight(c.rerankScore) + 0.08, 0];
        return [{ from, mid: arcMid(from, CORE_BACK, 0.25, 0.95) }];
      }),
    [ranked],
  );
  const candidateIds = useMemo(() => (trace ? new Set(trace.candidates.map((c) => c.id)) : null), [trace]);
  const queryLocal = useMemo(() => (trace ? cloudLocal(trace.query, CLOUD_R) : null), [trace]);
  const linkGeometry = useMemo(() => {
    const pts: number[] = [];
    if (trace && queryLocal) {
      for (const c of trace.candidates) {
        const p = cloudLocal(pointById(c.id), CLOUD_R);
        pts.push(queryLocal.x, queryLocal.y, queryLocal.z, p.x, p.y, p.z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [trace, queryLocal]);
  const searching = Boolean(trace) && step >= 2;

  useFrame(({ clock }) => {
    const t = stepTime(step, clock.elapsedTime - start.current, reduced);

    // The lens beams into the meaning map where the question lands.
    const cl = cloud.current;
    if (beam.current) {
      beam.current.visible = Boolean(queryLocal) && step === 2;
      if (beam.current.visible && cl && queryLocal) {
        v.b.copy(queryLocal);
        cl.localToWorld(v.b);
        v.m.set((v.a.x + v.b.x) / 2, Math.max(v.a.y, v.b.y) + 0.9, (v.a.z + v.b.z) / 2);
        v.b.lerpVectors(v.a, v.b, Math.max(ease(win(t, T.beam[0], T.beam[1])), 0.001));
        beam.current.setPoints(v.a, v.b, v.m);
      }
    }
    if (links.current) {
      const mat = links.current.material as THREE.LineBasicMaterial;
      mat.opacity = !trace ? 0 : step === 2 ? 0.55 * ease(win(t, T.links[0], T.links[1])) : step === 3 ? 0.25 : 0;
      links.current.visible = mat.opacity > 0.01;
    }

    // Each candidate's bar rises to its double-check score.
    bars.current.forEach((m, i) => {
      if (!m) return;
      const c = ranked[i];
      const full = c ? barHeight(c.rerankScore) : STUB;
      const grow = !c || step < 2 ? 0 : step === 2 ? ease(win(t, T.bars[0] + i * 0.05, T.bars[1] + i * 0.05)) : 1;
      const h = STUB + (full - STUB) * grow;
      m.scale.y = h;
      m.position.y = SURFACE + h / 2;
    });

    // The passages that passed travel back to the AI.
    feeds.current.forEach((m, k) => {
      const path = feedPaths[k];
      if (!m || !path) return;
      const p = ease(win(t, T.result[0] + k * 0.08, T.result[1] + k * 0.08));
      bezier(m.position, path.from, path.mid, CORE_BACK, p);
      m.visible = step === 3 && p < 1;
    });
  });

  return (
    <>
      <group position={CLOUD}>
        <PointCloud
          radius={CLOUD_R}
          size={0.034}
          groupRef={cloud}
          spin={reduced ? 0 : 0.1}
          highlight={searching ? candidateIds : null}
          dim={0.72}
        >
          {searching && queryLocal && (
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
        ref={(l) => void (beam.current = hidden<BeamHandle>(l))}
        start={[LENS_X, BASE + 1.0, 0]}
        end={[LENS_X, BASE + 1.0, 0]}
        color="#ffffff"
        lineWidth={2}
        transparent
        opacity={0.8}
      />

      <group position={[LENS_X, SURFACE + 0.62, 0.05]}>
        <Magnifier color={AMBER} scale={0.5} />
      </group>

      {/* One bar per candidate, and the pass line */}
      {Array.from({ length: s.meta.topK }, (_, i) => (
        <mesh key={i} ref={(m) => void (bars.current[i] = m)} position={[barX(i), SURFACE + STUB / 2, 0]} scale={[1, STUB, 1]} castShadow>
          <boxGeometry args={[BAR_W, 1, 0.26]} />
          <meshStandardMaterial {...barLook(step >= 2 ? ranked[i] : undefined)} />
        </mesh>
      ))}
      <group position={[BARS_X, SURFACE + barHeight(s.meta.relevanceThreshold), 0]} visible={searching}>
        {[-0.3, 0.3].map((z) => (
          <mesh key={z} position={[0, 0, z]}>
            <boxGeometry args={[s.meta.topK * (BAR_W + BAR_GAP) + 0.3, 0.018, 0.018]} />
            <meshBasicMaterial color="#ffd27a" />
          </mesh>
        ))}
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[s.meta.topK * (BAR_W + BAR_GAP) + 0.3, 0.6]} />
          <meshBasicMaterial color="#ffd27a" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>

      {feedPaths.map((path, k) => (
        <mesh key={`${trace?.question}-${k}`} ref={(m) => void (feeds.current[k] = m)} position={path.from} visible={false}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial color={GOOD} emissive={GOOD} emissiveIntensity={1.2} />
        </mesh>
      ))}
    </>
  );
}

function barLook(c: Candidate | undefined) {
  if (!c) return { color: '#2a3542', emissive: '#000000', emissiveIntensity: 0 };
  if (c.selected) return { color: GOOD, emissive: GOOD, emissiveIntensity: 0.55 };
  if (c.rerankScore > s.meta.relevanceThreshold) return { color: '#c3ccd6', emissive: '#000000', emissiveIntensity: 0 };
  return { color: '#3a4655', emissive: '#000000', emissiveIntensity: 0 };
}
