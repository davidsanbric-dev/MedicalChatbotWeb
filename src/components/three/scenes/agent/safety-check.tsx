import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from '@/hooks/use-media';
import { bump } from '../../constants';
import { RBox } from '../../parts';
import { useStepStart } from '../../use-step';
import { ALERT, BASE, GATE_X, GOOD, IDLE_LIGHT, T, stepTime, type SceneProps } from './layout';

/** 1 · The safety check: a lamp over the path that looks at each message before the AI does. */
export function SafetyCheck({ step, scenario }: SceneProps) {
  const reduced = useReducedMotion();
  const start = useStepStart(`${step}-${scenario.message}`);
  const cone = useRef<THREE.MeshBasicMaterial>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const lens = useRef<THREE.MeshStandardMaterial>(null);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  const color = useMemo(() => new THREE.Color(), []);
  const emergency = scenario.action === 'guardrail';

  useFrame(({ clock }) => {
    const t = stepTime(step, clock.elapsedTime - start.current, reduced);
    const scanning = step === 0 ? bump(t, T.scan[0], T.scan[1] + 0.3, 0.15) : 0;
    const tripped = emergency && (step > 0 || t >= T.scan[0]);
    const blink = reduced ? 1 : Math.max(0, Math.sin(clock.elapsedTime * 9));
    color.set(tripped ? ALERT : scanning > 0.01 ? GOOD : IDLE_LIGHT);
    const strength = tripped ? 0.65 + 0.35 * blink : 0.2 + 0.7 * scanning;
    if (cone.current) {
      cone.current.color.copy(color);
      cone.current.opacity = strength * 0.5;
    }
    if (ring.current) {
      ring.current.color.copy(color);
      ring.current.opacity = 0.35 + strength * 0.6;
    }
    if (lens.current) {
      lens.current.emissive.copy(color);
      lens.current.emissiveIntensity = 0.5 + strength * 1.8;
    }
    if (beacon.current) beacon.current.emissiveIntensity = tripped ? 0.3 + 1.6 * blink : 0.08;
  });

  return (
    <group position={[GATE_X, BASE, 0]}>
      {/* a post behind the path and the arm that holds the lamp over it */}
      <RBox size={[0.14, 2.3, 0.14]} color="#33414f" position={[0, 1.15, -0.75]} />
      <RBox size={[0.14, 0.12, 0.88]} color="#33414f" position={[0, 2.24, -0.36]} />
      <mesh position={[0, 2.14, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.26, 0.2, 24]} />
        <meshStandardMaterial color="#33414f" roughness={0.5} />
      </mesh>
      <mesh position={[0, 2.035, 0]} rotation-x={Math.PI / 2}>
        <circleGeometry args={[0.24, 28]} />
        <meshStandardMaterial ref={lens} color="#ffffff" emissive={IDLE_LIGHT} emissiveIntensity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 2.24, 0]}>
        <sphereGeometry args={[0.09, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial ref={beacon} color={ALERT} emissive={ALERT} emissiveIntensity={0.08} />
      </mesh>
      {/* the light it shines down, and where it lands */}
      <mesh position={[0, 1.02, 0]}>
        <coneGeometry args={[0.6, 2.03, 36, 1, true]} />
        <meshBasicMaterial
          ref={cone}
          color={IDLE_LIGHT}
          transparent
          opacity={0.1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]}>
        <ringGeometry args={[0.53, 0.6, 56]} />
        <meshBasicMaterial ref={ring} color={IDLE_LIGHT} transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  );
}
