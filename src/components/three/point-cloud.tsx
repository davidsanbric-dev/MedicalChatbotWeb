import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import { CONTENT_TYPE_COLOR } from '@/data/snapshot';

import { POINTS, cloudLocal, type CloudPoint } from './cloud-data';

const DIM = new THREE.Color('#1d2835');

/**
 * Every passage as a point in the 3-D meaning map (t-SNE of the 384-number
 * embeddings), colored by content type. One instanced draw call.
 */
export function PointCloud({
  radius,
  size = 0.045,
  highlight,
  dim = 0.62,
  spin = 0,
  groupRef,
  onHover,
  children,
}: {
  radius: number;
  size?: number;
  /** Passages to emphasize; all others are dimmed when set. */
  highlight?: Set<string> | null;
  dim?: number;
  /** Radians per second around the vertical axis. */
  spin?: number;
  groupRef?: RefObject<THREE.Group | null>;
  onHover?: (p: CloudPoint | null, e?: ThreeEvent<PointerEvent>) => void;
  /** Extra objects that rotate with the cloud (query point, links…). */
  children?: ReactNode;
}) {
  const own = useRef<THREE.Group>(null);
  const group = groupRef ?? own;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const hiMesh = useRef<THREE.InstancedMesh>(null);
  const hit = useRef<THREE.InstancedMesh>(null);
  const colors = useMemo(() => POINTS.map((p) => new THREE.Color(CONTENT_TYPE_COLOR[p.type])), []);
  const hiPoints = useMemo(() => (highlight ? POINTS.filter((p) => highlight.has(p.id)) : []), [highlight]);

  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    POINTS.forEach((p, i) => {
      cloudLocal(p, radius, o.position);
      o.scale.setScalar(highlight?.has(p.id) ? 0.0001 : size);
      o.updateMatrix();
      mesh.current?.setMatrixAt(i, o.matrix);
      o.scale.setScalar(size * 3);
      o.updateMatrix();
      hit.current?.setMatrixAt(i, o.matrix);
      c.copy(colors[i]);
      if (highlight) c.lerp(DIM, dim);
      mesh.current?.setColorAt(i, c);
    });
    // Highlighted passages: bigger, glowing, drawn by their own mesh.
    hiPoints.forEach((p, i) => {
      cloudLocal(p, radius, o.position);
      o.scale.setScalar(size * 2.3);
      o.updateMatrix();
      hiMesh.current?.setMatrixAt(i, o.matrix);
      hiMesh.current?.setColorAt(i, c.set(CONTENT_TYPE_COLOR[p.type]));
    });
    for (const m of [mesh.current, hit.current, hiMesh.current]) {
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [radius, size, highlight, hiPoints, dim, colors]);

  useFrame((_, dt) => {
    if (spin && group.current) group.current.rotation.y += spin * dt;
  });

  return (
    <group ref={group}>
      <instancedMesh ref={mesh} args={[undefined, undefined, POINTS.length]} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.35} emissive="#ffffff" emissiveIntensity={0.08} />
      </instancedMesh>
      {hiPoints.length > 0 && (
        <instancedMesh key={hiPoints.length} ref={hiMesh} args={[undefined, undefined, hiPoints.length]} castShadow>
          <icosahedronGeometry args={[1, 2]} />
          <meshStandardMaterial roughness={0.3} emissive="#ffffff" emissiveIntensity={0.35} />
        </instancedMesh>
      )}
      {onHover && (
        <instancedMesh
          ref={hit}
          args={[undefined, undefined, POINTS.length]}
          onPointerMove={(e) => {
            e.stopPropagation();
            onHover(e.instanceId === undefined ? null : POINTS[e.instanceId], e);
          }}
          onPointerOut={() => onHover(null)}
        >
          <icosahedronGeometry args={[1, 0]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </instancedMesh>
      )}
      {children}
    </group>
  );
}
