import { OrbitControls } from '@react-three/drei';
import { useState } from 'react';
import { LAYERS } from '@/data/layers';
import { CONTENT_TYPE_COLOR, CONTENT_TYPE_LABEL } from '@/data/snapshot';
import { useMedia } from '@/hooks/use-media';
import { Ghost, Platform } from './parts';
import type { CloudPoint } from './cloud-data';
import { PointCloud } from './point-cloud';
import { Stage } from './stage';

const CENTER_Y = 1.65;

/**
 * The interactive meaning map: all passages floating above the database. Drag
 * to turn it (mouse), hover a point to read the passage.
 */
export default function MeaningMap({ highlight }: { highlight: Set<string> | null }) {
  const [hover, setHover] = useState<{ p: CloudPoint; x: number; y: number } | null>(null);
  const finePointer = useMedia('(pointer: fine)');

  return (
    <div className="relative h-full w-full">
      <Stage
        className="h-full w-full"
        bounds={{ min: [-2.05, 0.35, -1.5], max: [2.05, 2.85, 1.5] }}
        padding={[16, 16]}
        still
        description="A 3D cloud of every passage. Passages about the same condition form small clusters."
      >
        <Ghost>
          <Platform color={LAYERS[2].color} size={[3.4, 2.8]} />
        </Ghost>
        <group position={[0, CENTER_Y, 0]}>
          <PointCloud
            radius={1.75}
            size={0.042}
            highlight={highlight}
            spin={hover ? 0 : 0.08}
            onHover={(p, e) => setHover(p && e ? { p, x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY } : null)}
          />
        </group>
        {finePointer && <OrbitControls enableZoom={false} enablePan={false} target={[0, CENTER_Y, 0]} rotateSpeed={0.6} />}
      </Stage>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 w-64 rounded-lg border border-line-strong bg-surface-3/95 p-3 text-xs shadow-xl backdrop-blur"
          style={{
            left: `clamp(8px, ${hover.x - 128}px, calc(100% - 16.5rem))`,
            top: hover.y > 220 ? hover.y - 12 : hover.y + 16,
            transform: hover.y > 220 ? 'translateY(-100%)' : undefined,
          }}
        >
          <p className="font-semibold text-ink">{hover.p.condition}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-full" style={{ background: CONTENT_TYPE_COLOR[hover.p.type] }} />
            {CONTENT_TYPE_LABEL[hover.p.type]} passage
          </p>
          <p className="mt-1.5 leading-snug text-ink-2">{hover.p.preview}</p>
        </div>
      )}
    </div>
  );
}
