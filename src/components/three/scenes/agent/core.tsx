import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from '@/hooks/use-media';
import { useStepStart } from '../../use-step';
import { AMBER, BASE, CORE, LAMP_ANGLES, LAMP_OFF, T, roundsLit, stepTime, toolOf, type SceneProps } from './layout';

/** 2 · The AI: a faceted core that spins while it thinks, and four lamps that count its rounds. */
export function Core({ step, scenario }: SceneProps) {
  const reduced = useReducedMotion();
  const start = useStepStart(`${step}-${scenario.message}`);
  const gem = useRef<THREE.Mesh>(null);
  const gemMat = useRef<THREE.MeshStandardMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshStandardMaterial>(null);
  const lamps = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const speed = useRef(0.5);
  const emergency = scenario.action === 'guardrail';
  const tool = toolOf(scenario);

  useFrame(({ clock }, dt) => {
    const t = stepTime(step, clock.elapsedTime - start.current, reduced);
    // Thinking: choosing a tool, and reading its result before answering.
    const thinking =
      !emergency &&
      ((step === 1 && t < T.call[0]) || (step === 3 && t >= (tool ? T.result[1] - 0.1 : 0) && t < T.answer[0] + 0.15));
    const k = reduced ? 1 : 1 - Math.exp(-3 * dt);
    speed.current += ((emergency ? 0.12 : thinking ? 2.8 : 0.5) - speed.current) * k;
    if (!reduced) {
      if (gem.current) gem.current.rotation.y += dt * speed.current;
      if (ring.current) ring.current.rotation.z += dt * speed.current * 1.4;
    }
    if (gemMat.current) gemMat.current.emissiveIntensity += ((emergency ? 0.05 : thinking ? 0.95 : 0.4) - gemMat.current.emissiveIntensity) * k;
    if (ringMat.current) ringMat.current.emissiveIntensity += ((emergency ? 0.1 : 0.9) - ringMat.current.emissiveIntensity) * k;
    const lit = roundsLit(step, t, scenario);
    lamps.current.forEach((m, i) => {
      if (!m) return;
      const on = i < lit;
      m.color.set(on ? AMBER : LAMP_OFF);
      m.emissive.set(on ? AMBER : '#000000');
      m.emissiveIntensity = on ? 1.5 : 0;
    });
  });

  return (
    <group>
      <mesh position={[CORE[0], BASE + 0.14, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.45, 0.6, 0.28, 32]} />
        <meshStandardMaterial color="#3a3322" />
      </mesh>
      {LAMP_ANGLES.map((a, i) => (
        <mesh key={a} position={[CORE[0] + Math.sin(a) * 0.545, BASE + 0.14, Math.cos(a) * 0.545]}>
          <sphereGeometry args={[0.065, 16, 12]} />
          <meshStandardMaterial ref={(m) => void (lamps.current[i] = m)} color={LAMP_OFF} />
        </mesh>
      ))}
      <group position={CORE}>
        <mesh ref={gem} castShadow>
          <icosahedronGeometry args={[0.52, 0]} />
          <meshStandardMaterial ref={gemMat} color={AMBER} emissive={AMBER} emissiveIntensity={0.4} flatShading roughness={0.4} />
        </mesh>
        <mesh ref={ring} rotation-x={1.2}>
          <torusGeometry args={[0.86, 0.035, 12, 72]} />
          <meshStandardMaterial ref={ringMat} color="#ffd27a" emissive="#ffd27a" emissiveIntensity={0.9} />
        </mesh>
      </group>
    </group>
  );
}
