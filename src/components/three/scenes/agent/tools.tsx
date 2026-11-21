import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from '@/hooks/use-media';
import { C, bump, ease, win } from '../../constants';
import { Mat, RBox } from '../../parts';
import { useStepStart } from '../../use-step';
import { ALERT, AMBER, BASE, DESK_SCALE, DESK_X, LIST_ROWS, LIST_X, PAD_D, SURFACE, T, TOOLS, stepTime, toolOf, type SceneProps } from './layout';

/** 3 · The tools: three pads that light up as the AI considers them, the topic list and the care desk. */
export function Tools({ step, scenario }: SceneProps) {
  const reduced = useReducedMotion();
  const start = useStepStart(`${step}-${scenario.message}`);
  const rims = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const ticket = useRef<THREE.Group>(null);
  const mic = useRef<THREE.MeshStandardMaterial>(null);
  // One material per list row, shared by its bullet and its line, so a row lights up as one.
  const rows = useMemo(
    () => Array.from({ length: LIST_ROWS }, () => new THREE.MeshStandardMaterial({ color: C.line, roughness: 0.6 })),
    [],
  );
  useEffect(() => () => rows.forEach((m) => m.dispose()), [rows]);
  const tool = toolOf(scenario);
  const emergency = scenario.action === 'guardrail';
  const chosen = TOOLS.findIndex((t) => t.name === tool);

  useFrame(({ clock }) => {
    const t = stepTime(step, clock.elapsedTime - start.current, reduced);
    const alerted = emergency && (step > 0 || t >= T.alert[1]);
    const blink = reduced ? 1 : 0.6 + 0.4 * Math.sin(clock.elapsedTime * 8);

    // While deciding, each tool lights in turn; then the chosen one stays lit.
    rims.current.forEach((m, i) => {
      if (!m) return;
      let glow = 0.22;
      if (step === 1 && !emergency) {
        const a = T.consider + i * 0.35;
        glow = Math.max(glow, 1.3 * bump(t, a, a + 0.45, 0.1));
      }
      if (i === chosen && ((step === 1 && t >= T.pick) || step >= 2)) glow = 1.5;
      const red = i === 2 && alerted;
      if (red) glow = 1.5 * blink;
      m.color.set(red ? ALERT : AMBER);
      m.emissive.set(red ? ALERT : AMBER);
      m.emissiveIntensity = glow;
    });

    rows.forEach((m, i) => {
      const on = tool === 'list_conditions' && (step === 3 || (step === 2 && t >= T.rows + i * 0.22));
      m.color.set(on ? AMBER : C.line);
      m.emissive.set(on ? AMBER : '#000000');
      m.emissiveIntensity = on ? 0.8 : 0;
    });

    const g = ticket.current;
    if (g) {
      const rise = emergency
        ? step === 0
          ? ease(win(t, T.alert[1] - 0.1, T.alert[1] + 0.5))
          : 1
        : tool === 'request_human_handoff'
          ? step === 2
            ? ease(win(t, T.ticket[0], T.ticket[1]))
            : step === 3
              ? 1
              : 0
          : 0;
      g.position.y = 0.03 + rise * 0.28;
      g.visible = rise > 0.01;
    }

    if (mic.current) {
      const busy = alerted || (tool === 'request_human_handoff' && step >= 2);
      mic.current.emissiveIntensity = busy ? 0.4 + 0.9 * Math.abs(Math.sin(clock.elapsedTime * 4)) : 0.08;
    }
  });

  return (
    <>
      {TOOLS.map((t, i) => (
        <group key={t.name} position={[t.x, BASE, 0]}>
          <mesh position={[0, 0.012, 0]}>
            <boxGeometry args={[t.w + 0.05, 0.024, PAD_D + 0.05]} />
            <meshStandardMaterial ref={(m) => void (rims.current[i] = m)} color={AMBER} emissive={AMBER} emissiveIntensity={0.22} />
          </mesh>
          <RBox size={[t.w, 0.05, PAD_D]} radius={0.02} color="#141c25" position={[0, 0.03, 0]} />
        </group>
      ))}

      {/* List topics: a card whose rows light up one by one */}
      <group position={[LIST_X, SURFACE, -0.15]} rotation-x={-0.1}>
        <RBox size={[0.6, 0.82, 0.04]} radius={0.03} color="#1e2935" position={[0, 0.43, 0]} />
        <mesh position={[0, 0.75, 0.022]}>
          <planeGeometry args={[0.48, 0.07]} />
          <meshStandardMaterial color={AMBER} emissive={AMBER} emissiveIntensity={0.4} />
        </mesh>
        {rows.map((mat, i) => (
          <group key={i} position={[0, 0.62 - i * 0.095, 0.022]}>
            <mesh position={[-0.2, 0, 0]} material={mat}>
              <circleGeometry args={[0.022, 12]} />
            </mesh>
            <mesh position={[0.045, 0, 0]} material={mat}>
              <planeGeometry args={[i % 3 === 2 ? 0.26 : 0.38, 0.03]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Call a person: someone from the care team with a headset, and the request ticket printer */}
      <group position={[DESK_X, SURFACE, 0]} scale={DESK_SCALE}>
        <group position={[-0.2, 0, -0.15]}>
          <mesh position={[0, 0.22, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.21, 0.44, 24]} />
            <Mat color="#5b6878" />
          </mesh>
          <mesh position={[0, 0.58, 0]} castShadow>
            <sphereGeometry args={[0.135, 24, 18]} />
            <Mat color="#c3ccd6" />
          </mesh>
          <group position={[0, 0.6, 0]}>
            <mesh>
              <torusGeometry args={[0.15, 0.024, 10, 32, Math.PI]} />
              <Mat color={AMBER} glow={0.35} />
            </mesh>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.15, -0.025, 0]} rotation-z={Math.PI / 2}>
                <cylinderGeometry args={[0.06, 0.06, 0.06, 16]} />
                <Mat color={AMBER} glow={0.35} />
              </mesh>
            ))}
            <mesh position={[-0.105, -0.1, 0.075]} rotation={[0.8, 0, 0.55]}>
              <cylinderGeometry args={[0.012, 0.012, 0.17, 6]} />
              <Mat color={AMBER} />
            </mesh>
            <mesh position={[-0.05, -0.155, 0.13]}>
              <sphereGeometry args={[0.028, 12, 10]} />
              <meshStandardMaterial ref={mic} color="#ffffff" emissive={AMBER} emissiveIntensity={0.08} />
            </mesh>
          </group>
        </group>
        <group position={[0.22, 0, 0.22]}>
          <RBox size={[0.36, 0.16, 0.26]} radius={0.03} color="#2b3a4c" position={[0, 0.08, 0]} />
          <mesh position={[0, 0.161, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.28, 0.03]} />
            <meshBasicMaterial color="#0d131a" />
          </mesh>
          <group ref={ticket} position={[0, 0.03, 0]} visible={false}>
            <RBox size={[0.24, 0.26, 0.012]} radius={0.01} color={C.paper} />
            <mesh position={[0, 0.085, 0.007]}>
              <planeGeometry args={[0.2, 0.045]} />
              <meshBasicMaterial color={emergency ? ALERT : AMBER} />
            </mesh>
            {[0.015, -0.045].map((y, i) => (
              <mesh key={y} position={[i ? -0.03 : 0, y, 0.007]}>
                <planeGeometry args={[i ? 0.14 : 0.2, 0.022]} />
                <meshBasicMaterial color={C.line} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </>
  );
}
