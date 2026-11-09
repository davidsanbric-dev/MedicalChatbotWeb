import { createContext, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import { LAYERS, SOURCE } from '@/data/layers';

/**
 * One camera angle for every scene: front-left and slightly above, so a row of
 * stations laid out along +x reads left → right and rises gently.
 */
const AZIMUTH = THREE.MathUtils.degToRad(-15);
const ELEVATION = THREE.MathUtils.degToRad(28);
export const VIEW_DIR = new THREE.Vector3(
  Math.sin(AZIMUTH) * Math.cos(ELEVATION),
  Math.sin(ELEVATION),
  Math.cos(AZIMUTH) * Math.cos(ELEVATION),
);

/** Neutral scene colors (layer colors come from data/layers.ts). */
export const C = {
  base: '#1a2430',
  baseGhost: '#141c25',
  ghost: '#2c3846',
  paper: '#dde4ec',
  line: '#9aa6b3',
  ink: '#e8edf2',
  dark: '#0d131a',
  dim: '#243040',
  good: '#0ca30c',
} as const;

export type Vec3 = [number, number, number];
export interface Bounds {
  min: Vec3;
  max: Vec3;
}

export interface SceneLabel {
  key: string;
  /** A fixed world position, or an object to follow. */
  at: Vec3 | RefObject<THREE.Object3D | null>;
  content: ReactNode;
  /** Where the label sits relative to its anchor (default: above it). */
  place?: 'above' | 'below' | 'left' | 'right' | 'center';
  hidden?: boolean;
  /** Hidden on narrow canvases, where there is no room for every tag. */
  minor?: boolean;
}

/** A box around one x position: what a narrow screen frames for the current step. */
export const aroundX = (x: number, half: number, top: number): Bounds => ({
  min: [x - half, 0, -1.35],
  max: [x + half, top, 1.45],
});

/** Deterministic pseudo-random number in [0, 1) (no Math.random during render). */
export function rand(i: number, salt = 0) {
  const x = Math.sin(i * 127.1 + salt * 311.7 + 0.5) * 43758.5453;
  return x - Math.floor(x);
}

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
/** Smoothstep easing. */
export const ease = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
/** Progress of t inside the window [a, b], clamped to 0..1. */
export const win = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
/** 0 → 1 → 0 bump inside [a, b] with soft edges of width `edge`. */
export const bump = (t: number, a: number, b: number, edge = 0.15) =>
  ease(win(t, a, a + edge)) * (1 - ease(win(t, b - edge, b)));

/** True inside <Ghost>: parts render as faint silhouettes (neighbor stations). */
export const GhostContext = createContext(false);

export type StationKind = 'source' | 'scraper' | 'worker' | 'database' | 'api' | 'interface';

export const STATION_COLOR: Record<StationKind, string> = {
  source: SOURCE.color,
  scraper: LAYERS[0].color,
  worker: LAYERS[1].color,
  database: LAYERS[2].color,
  api: LAYERS[3].color,
  interface: LAYERS[4].color,
};
