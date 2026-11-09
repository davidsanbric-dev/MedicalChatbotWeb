import * as THREE from 'three';
import { snapshot } from '@/data/snapshot';

export type CloudPoint = (typeof snapshot.projection.points)[number];

export const POINTS = snapshot.projection.points;
const INDEX = new Map(POINTS.map((p, i) => [p.id, i]));

/** Local position of a passage (or any map coordinate) inside a cloud of the given radius. */
export function cloudLocal(p: { x: number; y: number; z: number }, radius: number, out = new THREE.Vector3()) {
  return out.set(p.x * radius, p.y * radius, p.z * radius);
}

export const pointById = (id: string) => POINTS[INDEX.get(id) ?? 0];
