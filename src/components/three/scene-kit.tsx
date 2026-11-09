import { useFrame } from '@react-three/fiber';
import { clsx } from 'clsx';
import { useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import type { Vec3 } from './constants';

function radialTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/** A soft spotlight on the floor that glides to whatever the current step is about. */
export function FocusRing({ target, radius, color, snap = false }: { target: Vec3; radius: number; color: string; snap?: boolean }) {
  const group = useRef<THREE.Group>(null);
  const tex = useMemo(() => radialTexture(), []);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const k = snap ? 1 : 1 - Math.exp(-5 * dt);
    g.position.x += (target[0] - g.position.x) * k;
    g.position.y += (target[1] - g.position.y) * k;
    g.position.z += (target[2] - g.position.z) * k;
    const s = g.scale.x + (radius - g.scale.x) * k;
    g.scale.set(s, 1, s);
  });
  return (
    <group ref={group} position={target} scale={[radius, 1, radius]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.012} renderOrder={1}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial map={tex} color={color} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.016} renderOrder={1}>
        <ringGeometry args={[0.97, 1, 72]} />
        <meshBasicMaterial color={color} transparent opacity={0.65} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Numbered tag that ties a place in the scene to a story step. */
export function ZoneTag({ n, children, active, color }: { n: number; children: ReactNode; active: boolean; color: string }) {
  return (
    <div
      className={clsx(
        'flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-1 text-xs whitespace-nowrap backdrop-blur-sm transition-colors duration-300',
        active ? 'border-transparent bg-surface-3/95 text-ink shadow-lg' : 'border-line bg-page/70 text-muted',
      )}
    >
      <span
        className="grid size-4.5 place-items-center rounded-full font-mono text-[10px] font-medium"
        style={active ? { background: color, color: '#0b1016' } : { boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.25)' }}
      >
        {n}
      </span>
      {children}
    </div>
  );
}

/** A short callout inside the scene for a concrete fact of the current step. */
export function SceneNote({ children, color, className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <div
      className={clsx(
        'max-w-[15rem] rounded-lg border bg-surface-3/95 px-2.5 py-1.5 text-xs leading-snug text-ink shadow-xl backdrop-blur-sm',
        className,
      )}
      style={{ borderColor: color ? `${color}80` : 'var(--color-line-strong)' }}
    >
      {children}
    </div>
  );
}

/** Small muted caption for a neighbor station ("from …" / "to …"). */
export function NeighborTag({ children }: { children: ReactNode }) {
  return <div className="text-center font-mono text-[10px] leading-tight whitespace-nowrap text-muted sm:text-[11px]">{children}</div>;
}
