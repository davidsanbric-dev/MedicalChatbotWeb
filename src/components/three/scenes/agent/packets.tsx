import { QuadraticBezierLine } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from '@/hooks/use-media';
import { C, ease, win, type Vec3 } from '../../constants';
import { Bubble, RBox } from '../../parts';
import { useStepStart } from '../../use-step';
import {
  ADVICE_MID,
  ALERT,
  ALERT_MID,
  AMBER,
  ANSWER_MID,
  CORE,
  CORE_BACK,
  CORE_OUT,
  GATE,
  GATE_OUT,
  GOOD,
  INTO_CORE,
  MSG_MID,
  PINK,
  T,
  TICKET,
  TOOL_IN,
  TOOL_OUT,
  TO_CORE_MID,
  WEB,
  WEB_IN,
  arcMid,
  bezier,
  hidden,
  stepTime,
  toolOf,
  type SceneProps,
} from './layout';

type LineHandle = THREE.Object3D & { material: { opacity: number; dashOffset: number } };

/** What travels: the message, the tool call and its result, and the answer or safety advice. */
export function Packets({
  step,
  scenario,
  onCall,
  onAnswer,
}: SceneProps & { onCall: (o: THREE.Object3D | null) => void; onAnswer: (o: THREE.Object3D | null) => void }) {
  const reduced = useReducedMotion();
  const start = useStepStart(`${step}-${scenario.message}`);
  const tool = toolOf(scenario);
  const emergency = scenario.action === 'guardrail';
  const message = useRef<THREE.Group>(null);
  const alert = useRef<THREE.Group>(null);
  const call = useRef<THREE.Group | null>(null);
  const result = useRef<THREE.Group>(null);
  const answer = useRef<THREE.Group | null>(null);
  const advice = useRef<THREE.Group>(null);
  const outLine = useRef<LineHandle | null>(null);
  const backLine = useRef<LineHandle | null>(null);

  // The loop for the chosen tool: the call goes out behind, the result comes back in front.
  const arcs = useMemo(() => {
    if (!tool) return null;
    const from: Vec3 = [CORE[0] - 0.4, CORE[1] + 0.2, 0];
    const to = TOOL_IN[tool];
    const back = TOOL_OUT[tool];
    return {
      out: { a: from, m: arcMid(from, to, 0.9, -0.9), b: to },
      back: { a: back, m: arcMid(back, CORE_BACK, 0.2, 0.95), b: CORE_BACK },
    };
  }, [tool]);

  useFrame(({ clock }, dt) => {
    const t = stepTime(step, clock.elapsedTime - start.current, reduced);

    // The message: website → safety check → the AI, or held at the check.
    const msg = message.current;
    if (msg) {
      let shown = step === 0 && t >= T.msgIn[0];
      if (step === 0) {
        if (t < T.msgIn[1]) bezier(msg.position, WEB, MSG_MID, GATE, ease(win(t, T.msgIn[0], T.msgIn[1])));
        else if (emergency || t < T.msgOn[0]) msg.position.set(GATE[0], GATE[1] + Math.sin(t * 6) * 0.02, GATE[2]);
        else bezier(msg.position, GATE, TO_CORE_MID, INTO_CORE, ease(win(t, T.msgOn[0], T.msgOn[1])));
        if (!emergency && t >= T.msgOn[1]) shown = false;
      }
      msg.visible = shown;
    }

    // An emergency: the alert goes straight to the care desk.
    const al = alert.current;
    if (al) {
      al.visible = emergency && step === 0 && t >= T.alert[0] && t < T.alert[1];
      if (al.visible) bezier(al.position, GATE, ALERT_MID, TICKET, ease(win(t, T.alert[0], T.alert[1])));
    }

    // The tool call flies to the chosen tool; its result flies back.
    const c = call.current;
    if (c && arcs) {
      c.visible = step === 1 && t >= T.call[0] && t < T.call[1];
      if (c.visible) bezier(c.position, arcs.out.a, arcs.out.m, arcs.out.b, ease(win(t, T.call[0], T.call[1])));
    }
    const r = result.current;
    if (r && arcs) {
      r.visible = step === 3 && tool !== 'search_knowledge_base' && t >= T.result[0] && t < T.result[1];
      if (r.visible) bezier(r.position, arcs.back.a, arcs.back.m, arcs.back.b, ease(win(t, T.result[0], T.result[1])));
    }
    const out = outLine.current;
    if (out) {
      out.visible = (step === 1 && t >= T.call[0]) || step === 2 || step === 3;
      out.material.opacity = step === 1 ? 0.9 : 0.35;
      if (!reduced) out.material.dashOffset -= dt * 0.6;
    }
    const back = backLine.current;
    if (back) {
      back.visible = step === 3;
      if (!reduced) back.material.dashOffset -= dt * 0.6;
    }

    // The answer (or, for an emergency, the fixed safety advice) goes back to the website.
    const flying = step === 3 && t >= T.answer[0] && t < T.answer[1] + 0.3;
    const p = ease(win(t, T.answer[0], T.answer[1]));
    const an = answer.current;
    if (an) {
      an.visible = !emergency && flying;
      if (an.visible) bezier(an.position, CORE_OUT, ANSWER_MID, WEB_IN, p);
    }
    const ad = advice.current;
    if (ad) {
      ad.visible = emergency && flying;
      if (ad.visible) bezier(ad.position, GATE_OUT, ADVICE_MID, WEB_IN, p);
    }
  });

  return (
    <>
      {arcs && (
        <>
          <QuadraticBezierLine
            ref={(l) => void (outLine.current = hidden<LineHandle>(l))}
            start={arcs.out.a}
            mid={arcs.out.m}
            end={arcs.out.b}
            color={AMBER}
            lineWidth={1.6}
            dashed
            dashSize={0.14}
            gapSize={0.09}
            transparent
            opacity={0.9}
          />
          <QuadraticBezierLine
            ref={(l) => void (backLine.current = hidden<LineHandle>(l))}
            start={arcs.back.a}
            mid={arcs.back.m}
            end={arcs.back.b}
            color={GOOD}
            lineWidth={1.6}
            dashed
            dashSize={0.14}
            gapSize={0.09}
            transparent
            opacity={0.9}
          />
        </>
      )}
      <group ref={message} visible={false}>
        <Bubble color={PINK} w={0.5} h={0.27} tail="right" />
      </group>
      <group ref={alert} visible={false}>
        <RBox size={[0.2, 0.24, 0.02]} radius={0.02} color={ALERT} glow={0.9} />
      </group>
      <group
        ref={(g) => {
          call.current = g;
          onCall(g);
        }}
        visible={false}
      >
        <RBox size={[0.24, 0.13, 0.13]} radius={0.06} color={AMBER} glow={0.9} />
      </group>
      <group ref={result} visible={false}>
        <RBox size={[0.24, 0.17, 0.025]} radius={0.02} color={C.paper} />
        <mesh position={[0, 0.045, 0.014]}>
          <planeGeometry args={[0.18, 0.035]} />
          <meshBasicMaterial color={AMBER} />
        </mesh>
      </group>
      <group
        ref={(g) => {
          answer.current = g;
          onAnswer(g);
        }}
        visible={false}
      >
        <Bubble color={AMBER} w={0.62} h={0.32} />
      </group>
      <group ref={advice} visible={false}>
        <Bubble color={ALERT} w={0.62} h={0.32} />
      </group>
    </>
  );
}
