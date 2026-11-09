import { Grid } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { clsx } from 'clsx';
import { useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import { useInView } from '@/hooks/use-in-view';
import { useReducedMotion } from '@/hooks/use-media';
import { VIEW_DIR, type Bounds, type SceneLabel } from './constants';

const PLACE = {
  above: '-translate-x-1/2 -translate-y-full pb-2',
  below: '-translate-x-1/2 pt-2',
  left: '-translate-x-full -translate-y-1/2 pr-2',
  right: '-translate-y-1/2 pl-2',
  center: '-translate-x-1/2 -translate-y-1/2',
} as const;

/**
 * The one 3D stage every scene uses: same camera angle, lights, floor grid and
 * label overlay, so all scenes read as one system.
 *
 * - The orthographic camera is fitted to `bounds` (or `core` on narrow screens).
 * - Labels are plain DOM nodes positioned from projected 3D anchors: crisp text,
 *   never clipped by the canvas.
 * - Rendering stops while the stage is offscreen; with reduced motion it only
 *   renders on change.
 */
export function Stage({
  bounds,
  core,
  labels = [],
  className,
  description,
  padding = [28, 36],
  still = false,
  children,
}: {
  bounds: Bounds;
  core?: Bounds;
  labels?: SceneLabel[];
  className?: string;
  /** Text alternative for the whole scene. */
  description: string;
  /** Minimum gap in px between the fitted bounds and the canvas edge: [x, y]. */
  padding?: [number, number];
  /** Snap the camera instead of gliding (scenes with orbit controls). */
  still?: boolean;
  children: ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const inView = useInView(wrap, '120px');
  const reduced = useReducedMotion();
  const els = useRef(new Map<string, HTMLDivElement>());

  return (
    <div ref={wrap} className={clsx('relative', className)}>
      <p className="sr-only">{description}</p>
      <Canvas
        orthographic
        shadows
        dpr={[1, 2]}
        frameloop={!inView ? 'never' : reduced ? 'demand' : 'always'}
        camera={{ near: 0.1, far: 300, zoom: 40, position: [0, 10, 20] }}
        gl={{ antialias: true, alpha: true }}
        aria-hidden
      >
        <Fit bounds={bounds} core={core} padding={padding} still={still} />
        <Lights bounds={bounds} />
        <Floor />
        {children}
        <LabelProjector labels={labels} els={els} />
      </Canvas>
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {labels.map((l) => (
          <div
            key={l.key}
            ref={(el) => {
              if (!el) return;
              els.current.set(l.key, el);
              return () => void els.current.delete(l.key);
            }}
            className="absolute top-0 left-0 opacity-0 transition-opacity duration-300 will-change-transform"
          >
            <div className={PLACE[l.place ?? 'above']}>{l.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const EDGE = 6;

/**
 * Writes each label's projected screen position straight to its DOM node every
 * frame, nudged so the whole label stays inside the canvas.
 */
function LabelProjector({ labels, els }: { labels: SceneLabel[]; els: RefObject<Map<string, HTMLDivElement>> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const narrow = size.width < 640;
    for (const l of labels) {
      const el = els.current.get(l.key);
      if (!el) continue;
      if (l.hidden || (narrow && l.minor)) {
        el.style.opacity = '0';
        continue;
      }
      if (Array.isArray(l.at)) v.set(l.at[0], l.at[1], l.at[2]);
      else if (l.at.current) l.at.current.getWorldPosition(v);
      else continue;
      v.project(camera);
      let x = ((v.x + 1) / 2) * size.width;
      let y = ((1 - v.y) / 2) * size.height;
      // The label box's extent around its anchor, from its placement.
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const place = l.place ?? 'above';
      const [left, right] = place === 'left' ? [w, 0] : place === 'right' ? [0, w] : [w / 2, w / 2];
      const [up, down] = place === 'above' ? [h, 0] : place === 'below' ? [0, h] : [h / 2, h / 2];
      x = Math.min(Math.max(x, EDGE + left), size.width - EDGE - right);
      y = Math.min(Math.max(y, EDGE + up), size.height - EDGE - down);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = '1';
    }
  });
  return null;
}

/**
 * Point the camera at the bounds' center and zoom so the whole box fits. When
 * the box changes (a new story step on a narrow screen), the camera glides
 * there; `still` snaps instead (for scenes with orbit controls).
 */
function Fit({ bounds, core, padding, still }: { bounds: Bounds; core?: Bounds; padding: [number, number]; still: boolean }) {
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const reduced = useReducedMotion();
  const goal = useRef<{ position: THREE.Vector3; zoom: number } | null>(null);
  const box = size.width < 640 && core ? core : bounds;
  const key = `${box.min.join()}|${box.max.join()}`;

  useLayoutEffect(() => {
    const camera = get().camera as THREE.OrthographicCamera;
    const min = new THREE.Vector3(...box.min);
    const max = new THREE.Vector3(...box.max);
    const center = min.clone().add(max).multiplyScalar(0.5);
    const position = center.clone().addScaledVector(VIEW_DIR, 60);
    // Measure the box in view space (orientation is fixed: always along VIEW_DIR).
    const view = new THREE.Matrix4().lookAt(position, center, new THREE.Vector3(0, 1, 0));
    view.setPosition(position);
    view.invert();
    const c = center.clone().applyMatrix4(view);
    const v = new THREE.Vector3();
    let halfW = 0;
    let halfH = 0;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z).applyMatrix4(view);
      halfW = Math.max(halfW, Math.abs(v.x - c.x));
      halfH = Math.max(halfH, Math.abs(v.y - c.y));
    }
    const zoom = Math.max(1, Math.min((size.width / 2 - padding[0]) / halfW, (size.height / 2 - padding[1]) / halfH));
    const first = goal.current === null;
    goal.current = { position, zoom };
    if (first || still || reduced) {
      camera.position.copy(position);
      camera.up.set(0, 1, 0);
      camera.lookAt(center);
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures the box by value
  }, [get, size.width, size.height, key, padding, still, reduced, invalidate]);

  useFrame(({ camera }, dt) => {
    const g = goal.current;
    if (!g || still) return;
    const far = camera.position.distanceToSquared(g.position) > 1e-6 || Math.abs(camera.zoom - g.zoom) > 1e-3;
    if (!far) return;
    const k = 1 - Math.exp(-4 * dt);
    camera.position.lerp(g.position, k);
    camera.zoom += (g.zoom - camera.zoom) * k;
    camera.updateProjectionMatrix();
  });
  return null;
}

function Lights({ bounds }: { bounds: Bounds }) {
  const r = useMemo(() => {
    const [x0, y0, z0] = bounds.min;
    const [x1, y1, z1] = bounds.max;
    return Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2 + 1.5;
  }, [bounds]);
  return (
    <>
      <hemisphereLight args={['#eef4ff', '#0d131a', 1.25]} />
      <directionalLight
        castShadow
        position={[-7, 15, 10]}
        intensity={1.6}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      >
        <orthographicCamera attach="shadow-camera" args={[-r, r, r, -r, 0.1, 80]} />
      </directionalLight>
      <directionalLight position={[9, 6, -8]} intensity={0.5} color="#a8c4ff" />
    </>
  );
}

/** Shadow catcher plus a blueprint grid that fades out toward the edges. */
function Floor() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <shadowMaterial transparent opacity={0.34} />
      </mesh>
      <Grid
        infiniteGrid
        fadeFrom={0}
        fadeDistance={24}
        fadeStrength={2.2}
        cellSize={0.5}
        cellThickness={0.55}
        cellColor="#1b2733"
        sectionSize={2}
        sectionThickness={0.9}
        sectionColor="#26384a"
        position={[0, -0.01, 0]}
      />
    </group>
  );
}
