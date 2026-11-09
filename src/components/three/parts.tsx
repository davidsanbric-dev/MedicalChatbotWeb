import { RoundedBoxGeometry } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useContext, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { LAYERS, SOURCE } from '@/data/layers';
import { CONTENT_TYPE_COLOR, type ContentType } from '@/data/snapshot';
import { C, GhostContext, STATION_COLOR, type StationKind, type Vec3 } from './constants';

/* ------------------------------------------------------------------ */
/* Materials                                                            */
/* ------------------------------------------------------------------ */

/** Inside <Ghost>, every part renders as a faint silhouette (neighbor stations). */
export function Ghost({ children }: { children: ReactNode }) {
  return <GhostContext.Provider value>{children}</GhostContext.Provider>;
}
const useGhost = () => useContext(GhostContext);

export function Mat({
  color,
  glow = 0,
  opacity = 1,
  rough = 0.55,
  flat,
  side,
}: {
  color: string;
  glow?: number;
  opacity?: number;
  rough?: number;
  flat?: boolean;
  side?: THREE.Side;
}) {
  const ghost = useGhost();
  if (ghost)
    return <meshStandardMaterial color={C.ghost} roughness={0.9} transparent opacity={0.55 * opacity} depthWrite={false} side={side} />;
  return (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={glow}
      roughness={rough}
      metalness={0.05}
      transparent={opacity < 1}
      opacity={opacity}
      depthWrite={opacity >= 1}
      flatShading={flat}
      side={side}
    />
  );
}

/** A rounded box with a Mat; shadows are off for ghosts. */
export function RBox({
  size,
  radius = 0.04,
  color,
  glow,
  opacity,
  position,
  rotation,
}: {
  size: Vec3;
  radius?: number;
  color: string;
  glow?: number;
  opacity?: number;
  position?: Vec3;
  rotation?: Vec3;
}) {
  const ghost = useGhost();
  return (
    <mesh position={position} rotation={rotation} castShadow={!ghost} receiveShadow>
      <RoundedBoxGeometry args={size} radius={Math.min(radius, Math.min(...size) / 2 - 0.001)} smoothness={3} />
      <Mat color={color} glow={glow} opacity={opacity} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Platform and belt                                                    */
/* ------------------------------------------------------------------ */

export const PLATFORM_H = 0.28;

/** A station base: dark rounded slab with a glowing rim in the layer color. */
export function Platform({
  size = [2.5, 2.5],
  color,
  active = false,
  position,
  children,
}: {
  size?: [number, number];
  color: string;
  active?: boolean;
  position?: Vec3;
  children?: ReactNode;
}) {
  const ghost = useGhost();
  const rim = useRef<THREE.MeshStandardMaterial>(null);
  const top = useRef<THREE.Group>(null);
  const [w, d] = size;

  useFrame((_, dt) => {
    if (rim.current) {
      const target = ghost ? 0.12 : active ? 1.6 : 0.45;
      rim.current.emissiveIntensity = THREE.MathUtils.damp(rim.current.emissiveIntensity, target, 8, dt);
    }
    if (top.current) {
      top.current.position.y = THREE.MathUtils.damp(top.current.position.y, PLATFORM_H + (active ? 0.16 : 0), 9, dt);
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, PLATFORM_H / 2, 0]} castShadow={!ghost} receiveShadow>
        <RoundedBoxGeometry args={[w, PLATFORM_H, d]} radius={0.09} smoothness={3} />
        <meshStandardMaterial
          color={ghost ? C.baseGhost : C.base}
          roughness={0.85}
          transparent={ghost}
          opacity={ghost ? 0.7 : 1}
        />
      </mesh>
      <mesh position={[0, PLATFORM_H - 0.035, 0]}>
        <boxGeometry args={[w - 0.1, 0.035, d + 0.025]} />
        <meshStandardMaterial
          ref={rim}
          color={color}
          emissive={color}
          emissiveIntensity={0.45}
          transparent={ghost}
          opacity={ghost ? 0.45 : 1}
        />
      </mesh>
      <mesh position={[0, PLATFORM_H - 0.035, 0]}>
        <boxGeometry args={[w + 0.025, 0.035, d - 0.1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={ghost ? 0.12 : 0.45}
          transparent={ghost}
          opacity={ghost ? 0.45 : 1}
        />
      </mesh>
      <group ref={top} position={[0, PLATFORM_H, 0]}>
        {children}
      </group>
    </group>
  );
}

function stripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 8;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#121a23';
  ctx.fillRect(0, 0, 64, 8);
  ctx.fillStyle = '#26323f';
  ctx.fillRect(0, 0, 10, 8);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A conveyor belt along +x with moving stripes. */
export function Belt({
  from,
  to,
  z = 0,
  y = PLATFORM_H,
  width = 0.5,
  speed = 0.6,
  moving = true,
}: {
  from: number;
  to: number;
  z?: number;
  y?: number;
  width?: number;
  speed?: number;
  moving?: boolean;
}) {
  const length = to - from;
  const tex = useMemo(() => {
    const t = stripeTexture();
    t.repeat.set(length / 0.32, 1);
    return t;
  }, [length]);
  const top = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((_, dt) => {
    const map = top.current?.map;
    if (moving && map) map.offset.x -= (dt * speed) / 0.32;
  });
  return (
    <group position={[(from + to) / 2, y, z]}>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[length, 0.06, width]} />
        <meshStandardMaterial attach="material-0" color="#1c2631" />
        <meshStandardMaterial attach="material-1" color="#1c2631" />
        <meshStandardMaterial ref={top} attach="material-2" map={tex} roughness={0.9} />
        <meshStandardMaterial attach="material-3" color="#1c2631" />
        <meshStandardMaterial attach="material-4" color="#1c2631" />
        <meshStandardMaterial attach="material-5" color="#1c2631" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.07, (s * width) / 2]}>
          <boxGeometry args={[length, 0.03, 0.03]} />
          <meshStandardMaterial color="#33414f" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Things that travel through the pipeline                              */
/* ------------------------------------------------------------------ */

/** A web page lying flat: paper with a title bar and text lines. */
export function PageSheet({ accent = SOURCE.color, scale = 1 }: { accent?: string; scale?: number }) {
  return (
    <group scale={scale}>
      <RBox size={[0.42, 0.03, 0.54]} radius={0.012} color={C.paper} />
      <mesh position={[0, 0.017, -0.19]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.32, 0.06]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      {[-0.07, 0.03, 0.13].map((z, i) => (
        <mesh key={z} position={[i === 2 ? -0.05 : 0, 0.017, z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[i === 2 ? 0.22 : 0.32, 0.035]} />
          <meshStandardMaterial color={C.line} />
        </mesh>
      ))}
    </group>
  );
}

/** A structured record: a card with three labeled fields. */
export function RecordCard({ color = LAYERS[0].color, scale = 1 }: { color?: string; scale?: number }) {
  return (
    <group scale={scale}>
      <RBox size={[0.46, 0.09, 0.34]} radius={0.03} color={color} glow={0.15} />
      {[
        [-0.1, C.ink, 0.3],
        [0, '#9ec5f5', 0.22],
        [0.1, C.line, 0.26],
      ].map(([z, c, w]) => (
        <mesh key={String(z)} position={[-0.06 + (0.3 - Number(w)) / 2, 0.047, Number(z)]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[Number(w), 0.045]} />
          <meshStandardMaterial color={String(c)} />
        </mesh>
      ))}
    </group>
  );
}

/** One passage: a small tile in its content-type color. */
export function ChunkTile({ type = 'paragraph', scale = 1 }: { type?: ContentType; scale?: number }) {
  return (
    <group scale={scale}>
      <RBox size={[0.2, 0.08, 0.15]} radius={0.025} color={CONTENT_TYPE_COLOR[type]} glow={0.2} />
    </group>
  );
}

/** A passage as numbers: a small glowing point. */
export function Dot({ color = LAYERS[2].color, r = 0.085 }: { color?: string; r?: number }) {
  return (
    <mesh castShadow>
      <sphereGeometry args={[r, 18, 18]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} roughness={0.3} />
    </mesh>
  );
}

/** A speech bubble standing up (questions and answers). */
export function Bubble({ color, w = 0.5, h = 0.26, tail = 'left' }: { color: string; w?: number; h?: number; tail?: 'left' | 'right' }) {
  const s = tail === 'left' ? -1 : 1;
  return (
    <group>
      <RBox size={[w, h, 0.06]} radius={0.06} color={color} glow={0.25} />
      <mesh position={[s * (w / 2 - 0.08), -h / 2 - 0.035, 0]} rotation-z={s * 0.6}>
        <coneGeometry args={[0.05, 0.1, 3]} />
        <Mat color={color} glow={0.25} />
      </mesh>
      {[0.05, -0.04].map((y, i) => (
        <mesh key={y} position={[-w * 0.08 * i, y, 0.032]}>
          <planeGeometry args={[w * (i ? 0.5 : 0.66), 0.035]} />
          <meshBasicMaterial color={C.dark} transparent opacity={0.45} />
        </mesh>
      ))}
    </group>
  );
}

/** A gear (cylinder + teeth) that spins around its axis. */
export function Gear({
  r = 0.2,
  color,
  speed = 1,
  position,
  spin = true,
}: {
  r?: number;
  color: string;
  speed?: number;
  position?: Vec3;
  spin?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const teeth = Math.round(r * 40);
  useFrame((_, dt) => {
    if (spin && ref.current) ref.current.rotation.z += dt * speed;
  });
  return (
    <group position={position}>
      <group ref={ref}>
        <mesh rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[r, r, 0.07, 24]} />
          <Mat color={color} />
        </mesh>
        {Array.from({ length: teeth }, (_, i) => {
          const a = (i / teeth) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * r, Math.sin(a) * r, 0]} rotation-z={a}>
              <boxGeometry args={[0.07, 0.06, 0.07]} />
              <Mat color={color} />
            </mesh>
          );
        })}
        <mesh rotation-x={Math.PI / 2} position={[0, 0, 0.03]}>
          <cylinderGeometry args={[r * 0.35, r * 0.35, 0.03, 16]} />
          <Mat color={C.dark} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Station models (home line, and faint neighbors on each page)         */
/* ------------------------------------------------------------------ */

export function BrowserPanel({ w = 1.2, h = 0.85, accent = SOURCE.color }: { w?: number; h?: number; accent?: string }) {
  return (
    <group>
      <RBox size={[w, h, 0.05]} radius={0.04} color={C.paper} />
      <mesh position={[0, h / 2 - 0.07, 0.027]}>
        <planeGeometry args={[w - 0.06, 0.09]} />
        <Mat color="#3a4655" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-w / 2 + 0.08 + i * 0.06, h / 2 - 0.07, 0.03]}>
          <circleGeometry args={[0.018, 12]} />
          <Mat color={['#d03b3b', '#fab219', '#0ca30c'][i]} />
        </mesh>
      ))}
      <mesh position={[-w * 0.12, h / 2 - 0.2, 0.027]}>
        <planeGeometry args={[w * 0.6, 0.07]} />
        <Mat color={accent} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[i === 3 ? -w * 0.16 : 0, h / 2 - 0.33 - i * 0.1, 0.027]}>
          <planeGeometry args={[i === 3 ? w * 0.52 : w * 0.84, 0.04]} />
          <Mat color={C.line} />
        </mesh>
      ))}
    </group>
  );
}

function WebsiteModel() {
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <group key={i} position={[-0.32 + i * 0.3, 0.46 + i * 0.02, -0.42 + i * 0.36]} rotation-y={0.18}>
          <BrowserPanel w={1.15} h={0.82} />
        </group>
      ))}
    </group>
  );
}

function ScraperModel({ animate }: { animate: boolean }) {
  const bob = useRef<THREE.Group>(null);
  const color = LAYERS[0].color;
  useFrame(({ clock }) => {
    if (animate && bob.current) {
      const t = clock.elapsedTime;
      bob.current.position.y = 0.95 + Math.sin(t * 1.6) * 0.06;
      bob.current.position.x = -0.05 + Math.sin(t * 0.8) * 0.18;
    }
  });
  return (
    <group>
      <group position={[0.05, 0.02, 0.2]} rotation-y={0.25}>
        <PageSheet />
      </group>
      <group ref={bob} position={[-0.05, 0.95, 0]}>
        <Magnifier color={color} />
      </group>
    </group>
  );
}

/** Ring + lens + handle, facing the camera and tilted down toward the belt. */
export function Magnifier({ color, scale = 1 }: { color: string; scale?: number }) {
  const ghost = useGhost();
  return (
    <group scale={scale} rotation={[-0.75, -0.35, 0]}>
      <mesh castShadow={!ghost}>
        <torusGeometry args={[0.36, 0.065, 16, 48]} />
        <Mat color={color} glow={0.3} />
      </mesh>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.34, 0.34, 0.015, 40]} />
        <Mat color="#cfe3ff" opacity={0.28} glow={0.2} />
      </mesh>
      <group rotation-z={0.75}>
        <mesh position={[0, -0.68, 0]} castShadow={!ghost}>
          <cylinderGeometry args={[0.065, 0.075, 0.55, 16]} />
          <Mat color="#2b3a4c" />
        </mesh>
      </group>
    </group>
  );
}

function WorkerModel({ animate }: { animate: boolean }) {
  const color = LAYERS[1].color;
  return (
    <group>
      <RBox size={[1.35, 0.78, 0.95]} radius={0.08} color={color} position={[0, 0.39, 0]} />
      <RBox size={[1.1, 0.5, 0.02]} radius={0.01} color="#9b3f19" position={[0, 0.4, 0.48]} />
      <mesh position={[-0.28, 0.95, -0.05]} castShadow>
        <cylinderGeometry args={[0.32, 0.14, 0.34, 24, 1, true]} />
        <Mat color="#b8491f" side={THREE.DoubleSide} />
      </mesh>
      <Gear position={[-0.22, 0.42, 0.5]} r={0.2} color={C.paper} speed={1.2} spin={animate} />
      <Gear position={[0.17, 0.52, 0.5]} r={0.13} color="#f2b48f" speed={-1.85} spin={animate} />
      <group position={[0.35, 0.86, 0.1]}>
        {(['symptom', 'paragraph', 'list_item'] as const).map((t, i) => (
          <group key={t} position={[i * 0.0, i * 0.09, -i * 0.04]}>
            <ChunkTile type={t} scale={0.9} />
          </group>
        ))}
      </group>
    </group>
  );
}

function DatabaseModel({ animate }: { animate: boolean }) {
  const color = LAYERS[2].color;
  const orbit = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (animate && orbit.current) orbit.current.rotation.y += dt * 0.8;
  });
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <group key={i} position={[0, 0.17 + i * 0.37, 0]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.62, 0.62, 0.3, 48]} />
            <Mat color={color} />
          </mesh>
          <mesh position={[0, 0.151, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.45, 0.62, 48]} />
            <Mat color="#5fd0a6" glow={0.4} />
          </mesh>
        </group>
      ))}
      <group ref={orbit} position={[0, 0.62, 0]}>
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2;
          return (
            <group key={i} position={[Math.cos(a) * 0.86, Math.sin(a * 2) * 0.18, Math.sin(a) * 0.86]}>
              <Dot color="#7ee2bd" r={0.055} />
            </group>
          );
        })}
      </group>
    </group>
  );
}

function ApiModel({ animate }: { animate: boolean }) {
  const color = LAYERS[3].color;
  const core = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (!animate) return;
    if (core.current) core.current.rotation.y += dt * 0.6;
    if (ring.current) ring.current.rotation.z += dt * 0.9;
  });
  return (
    <group>
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.55, 0.24, 32]} />
        <Mat color="#3a3322" />
      </mesh>
      <group position={[0, 0.95, 0]}>
        <mesh ref={core} castShadow>
          <icosahedronGeometry args={[0.42, 0]} />
          <Mat color={color} glow={0.35} flat />
        </mesh>
        <mesh ref={ring} rotation-x={1.25}>
          <torusGeometry args={[0.7, 0.03, 12, 64]} />
          <Mat color="#ffd27a" glow={0.8} />
        </mesh>
      </group>
    </group>
  );
}

export function Laptop({ color, scale = 1, screen }: { color: string; scale?: number; screen?: ReactNode }) {
  return (
    <group scale={scale}>
      <RBox size={[1.5, 0.07, 1.0]} radius={0.03} color="#3a4655" position={[0, 0.035, 0.12]} />
      <mesh position={[0, 0.072, 0.32]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.5, 0.26]} />
        <Mat color="#4a5767" />
      </mesh>
      <group position={[0, 0.07, -0.36]} rotation-x={-0.2}>
        <RBox size={[1.5, 1.0, 0.05]} radius={0.03} color="#3a4655" position={[0, 0.5, 0]} />
        <mesh position={[0, 0.5, 0.027]}>
          <planeGeometry args={[1.38, 0.88]} />
          <Mat color="#0f1720" glow={0.15} />
        </mesh>
        <group position={[0, 0.5, 0.03]}>
          {screen ?? (
            <>
              <group position={[0.28, 0.22, 0]}>
                <RBox size={[0.62, 0.15, 0.02]} radius={0.05} color={color} glow={0.3} />
              </group>
              <group position={[-0.16, -0.06, 0]}>
                <RBox size={[0.86, 0.3, 0.02]} radius={0.06} color={C.paper} />
              </group>
              <group position={[-0.36, -0.3, 0]}>
                <RBox size={[0.46, 0.1, 0.02]} radius={0.04} color="#5b6878" />
              </group>
            </>
          )}
        </group>
      </group>
    </group>
  );
}

function InterfaceModel() {
  return (
    <group rotation-y={0.2} position={[0, 0, 0.05]}>
      <Laptop color={LAYERS[4].color} scale={0.95} />
    </group>
  );
}

/** The recognizable model of each station, shared by the home line and the page scenes. */
export function StationModel({ kind, animate = true }: { kind: StationKind; animate?: boolean }) {
  switch (kind) {
    case 'source':
      return <WebsiteModel />;
    case 'scraper':
      return <ScraperModel animate={animate} />;
    case 'worker':
      return <WorkerModel animate={animate} />;
    case 'database':
      return <DatabaseModel animate={animate} />;
    case 'api':
      return <ApiModel animate={animate} />;
    case 'interface':
      return <InterfaceModel />;
  }
}


/** A faint neighbor station at the edge of a page scene: where data comes from / goes to. */
export function NeighborStation({ kind, position }: { kind: StationKind; position: Vec3 }) {
  return (
    <Ghost>
      <Platform color={STATION_COLOR[kind]} position={position} size={[2.3, 2.3]}>
        <group position={[0, 0, -0.2]} scale={0.9}>
          <StationModel kind={kind} animate={false} />
        </group>
      </Platform>
    </Ghost>
  );
}
