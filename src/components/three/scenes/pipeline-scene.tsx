import { useFrame } from '@react-three/fiber';
import { clsx } from 'clsx';
import { useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { LAYERS, SOURCE, type LayerId } from '@/data/layers';
import { useUiStore } from '@/stores/ui-store';
import { bump, type SceneLabel, type StationKind, type Vec3 } from '../constants';
import { Belt, Bubble, ChunkTile, Dot, PLATFORM_H, PageSheet, Platform, RecordCard, StationModel } from '../parts';
import { Stage } from '../stage';

const STEP = 3.4;
const KINDS: StationKind[] = ['source', 'scraper', 'worker', 'database', 'api', 'interface'];
const X = KINDS.map((_, i) => (i - (KINDS.length - 1) / 2) * STEP);
const BELT_Z = 0.95;
const MODEL_Z = -0.3;
const ITEMS_PER_SEGMENT = 3;
const SPEED = 0.26; // segment traversals per second

const STATIONS = KINDS.map((kind, i) => {
  const layer = i > 0 ? LAYERS[i - 1] : null;
  return {
    kind,
    x: X[i],
    id: layer?.id,
    color: layer?.color ?? SOURCE.color,
    kicker: layer ? `${layer.index} · ${layer.verb}` : SOURCE.verb,
    name: layer?.name ?? SOURCE.name,
  };
});

/** What travels between each pair of stations, in order. */
const SEGMENTS: { label: string; item: ReactNode }[] = [
  { label: SOURCE.output, item: <PageSheet scale={0.8} /> },
  { label: LAYERS[0].output, item: <RecordCard scale={0.8} /> },
  {
    label: LAYERS[1].output,
    item: (
      <group>
        <group position={[-0.13, 0, 0]}><ChunkTile type="symptom" scale={0.85} /></group>
        <group position={[0.06, 0, 0.04]}><ChunkTile type="paragraph" scale={0.85} /></group>
        <group position={[0.02, 0.075, -0.06]}><ChunkTile type="list_item" scale={0.85} /></group>
      </group>
    ),
  },
  {
    label: LAYERS[2].output,
    item: (
      <group>
        <Dot r={0.075} />
        <group position={[0.2, 0.02, -0.05]}><Dot r={0.06} /></group>
      </group>
    ),
  },
  {
    label: LAYERS[3].output,
    item: (
      <group position={[0, 0.17, 0]}>
        <Bubble color={LAYERS[3].color} w={0.44} h={0.24} />
      </group>
    ),
  },
];

/**
 * Home scene: the whole pipeline as one horizontal line of stations. Items on
 * the belt change shape at every station (page → record → passages → matches →
 * answer). Hover a station to lift it; click to open its page.
 */
export default function PipelineScene({ onSelect }: { onSelect: (id: LayerId) => void }) {
  const active = useUiStore((s) => s.activeLayer);
  const setActive = useUiStore((s) => s.setActiveLayer);

  const labels = useMemo<SceneLabel[]>(
    () => [
      ...STATIONS.map((st) => ({
        key: st.kind,
        at: [st.x, 2.4, MODEL_Z] as Vec3,
        content: (
          <div
            className={clsx(
              'text-center whitespace-nowrap transition-transform duration-300',
              st.id && 'pointer-events-auto cursor-pointer',
              st.id && active === st.id && '-translate-y-2',
            )}
            onMouseEnter={st.id ? () => setActive(st.id!) : undefined}
            onMouseLeave={st.id ? () => setActive(null) : undefined}
            onClick={st.id ? () => onSelect(st.id!) : undefined}
          >
            <div className="font-mono text-[10px] tracking-wider uppercase sm:text-[11px]" style={{ color: st.color }}>
              {st.kicker}
            </div>
            <div className={clsx('text-sm font-semibold sm:text-[15px]', active === st.id ? 'text-white' : 'text-ink')}>
              {st.name}
            </div>
          </div>
        ),
      })),
      ...SEGMENTS.map((seg, i) => ({
        key: `flow-${i}`,
        at: [(X[i] + X[i + 1]) / 2, PLATFORM_H, BELT_Z + 0.32] as Vec3,
        place: 'below' as const,
        content: <span className="font-mono text-[10px] whitespace-nowrap text-muted sm:text-[11px]">{seg.label} →</span>,
      })),
    ],
    [active, setActive, onSelect],
  );

  return (
    <Stage
      className="h-full w-full"
      bounds={{ min: [X[0] - 1.3, 0, -1.3], max: [X[X.length - 1] + 1.3, 3.0, 1.6] }}
      labels={labels}
      padding={[12, 20]}
      description="The pipeline as a line of six stations: the source website, then the scraper, worker, database, RAG API and interface. Pages travel along a belt and change shape at each station."
    >
      {STATIONS.map((st) => (
        <Station key={st.kind} station={st} active={Boolean(st.id && active === st.id)} onHover={setActive} onSelect={onSelect} />
      ))}
      <Belt from={X[0] + 0.2} to={X[X.length - 1] - 0.2} z={BELT_Z} speed={SPEED * (STEP - 0.7)} />
      {SEGMENTS.map((seg, i) => (
        <FlowItems key={i} from={X[i] + 0.4} to={X[i + 1] - 0.4}>
          {seg.item}
        </FlowItems>
      ))}
    </Stage>
  );
}

function Station({
  station,
  active,
  onHover,
  onSelect,
}: {
  station: (typeof STATIONS)[number];
  active: boolean;
  onHover: (id: LayerId | null) => void;
  onSelect: (id: LayerId) => void;
}) {
  const { id } = station;
  return (
    <group position={[station.x, 0, 0]}>
      <Platform color={station.color} active={active}>
        <group position={[0, 0, MODEL_Z]} scale={1.15}>
          <StationModel kind={station.kind} />
        </group>
      </Platform>
      {id && (
        <mesh
          position={[0, 1.1, 0]}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHover(id);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            onHover(null);
            document.body.style.cursor = '';
          }}
          onClick={() => onSelect(id)}
        >
          <boxGeometry args={[2.6, 2.2, 2.6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/** Items riding the belt from one station to the next, growing in and shrinking out. */
function FlowItems({ from, to, children }: { from: number; to: number; children: ReactNode }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * SPEED;
    refs.current.forEach((g, i) => {
      if (!g) return;
      const p = (t + i / ITEMS_PER_SEGMENT) % 1;
      g.position.x = from + (to - from) * p;
      const s = bump(p, 0, 1, 0.14);
      g.scale.setScalar(Math.max(s, 0.001));
    });
  });
  return (
    <group position={[0, PLATFORM_H + 0.1, BELT_Z]}>
      {Array.from({ length: ITEMS_PER_SEGMENT }, (_, i) => (
        <group
          key={i}
          ref={(g) => void (refs.current[i] = g)}
          position={[from + ((to - from) * i) / ITEMS_PER_SEGMENT, 0, 0]}
        >
          {children}
        </group>
      ))}
    </group>
  );
}
