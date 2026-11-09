import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

/**
 * Elapsed-time origin of the current story step (restarted whenever `key`
 * changes). Also requests a frame, so scenes rendered on demand (reduced
 * motion) still update.
 */
export function useStepStart(key: unknown) {
  const clock = useThree((s) => s.clock);
  const invalidate = useThree((s) => s.invalidate);
  const start = useRef(0);
  useEffect(() => {
    start.current = clock.elapsedTime;
    invalidate();
  }, [key, clock, invalidate]);
  return start;
}
