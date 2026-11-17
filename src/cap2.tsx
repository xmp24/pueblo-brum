// Pueblo Brum · Capítulo 2: ¡La campana gigante! (10 min, 60 fps)
import React, {useEffect, useMemo, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig, getInputProps, OffthreadVideo, Img, staticFile, Sequence} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import '@fontsource/lilita-one';
import {prog, lerp, clamp, easeInOut, easeOut, easeIn, easeOutBack, damped, hash, V3} from './anim';
import type {B2Pose} from './Bruno2';
import {useLib, Lib, applyNight} from './world/assets';
import {World, ScriptCar, Char, CharPose} from './world/World';
import {BrunoGLB} from './world/BrunoGLB';
import {Post} from './world/Post';
import {resolve} from './world/traffic';
import {RAIL_Z, MUD, Place} from './world/layout';
import {Puffs, Sparkles, Confetti} from './fx';
import {blinkAt} from './talk';
import {makeTalk} from './talk2';
import VO from './vo2.json';
import MK from './cap2.json';

const vo = VO as Record<string, {t: number; d: number}>;
const M = MK as Record<string, number>;
const S = (k: string) => vo[k].t;
const E = (k: string) => vo[k].t + vo[k].d;
const IP = getInputProps() as {nopost?: boolean; noao?: boolean; t?: number};
const talk = makeTalk(vo);
const PXB = /^b\d/, PXT = /^t\d/, PXL = /^l\d/, PXO = /^o\d/, PXX = /^x\d/;
type Cam = {pos: V3; at: V3; fov: number};
const F = (pos: V3, at: V3, fov = 40): Cam => ({pos, at, fov});
const mix3 = (a: V3, b: V3, u: number): V3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
const yawTo = (ax: number, az: number, bx: number, bz: number) => Math.atan2(bx - ax, bz - az);
const angLerp = (a: number, b: number, u: number) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * u; };
const hop = (t: number, t0: number, d = 0.45, h = 0.7) => { const q = prog(t, t0, t0 + d); return q > 0 && q < 1 ? Math.sin(q * Math.PI) * h : 0; };
const pulse = (t: number, t0: number, d: number) => { const q = prog(t, t0, t0 + d); return q > 0 && q < 1 ? Math.sin(q * Math.PI) : 0; };

// ---------------------------------------------------------------- rutas
type Path = {pts: [number, number][]; cum: number[]; len: number};
function mkPath(ctrl: [number, number][]): Path {
  const pts: [number, number][] = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.6));
    for (let k = 0; k < n; k++) {
      const u = k / n, u2 = u * u, u3 = u2 * u;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  pts.push(ctrl[ctrl.length - 1]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return {pts, cum, len: cum[cum.length - 1]};
}
function at(p: Path, s: number) {
  s = clamp(s, 0, p.len);
  let i = 1; while (i < p.cum.length - 1 && p.cum[i] < s) i++;
  const a = p.pts[i - 1], b = p.pts[i], u = (s - p.cum[i - 1]) / Math.max(1e-6, p.cum[i] - p.cum[i - 1]);
  const look = (d: number) => { const ss = clamp(s + d, 0, p.len); let j = 1; while (j < p.cum.length - 1 && p.cum[j] < ss) j++; return p.pts[j]; };
  const f = look(1.2), r = look(-1.2);
  return {x: lerp(a[0], b[0], u), z: lerp(a[1], b[1], u), yaw: Math.atan2(f[0] - r[0], f[1] - r[1])};
}
const sOfZ = (p: Path, z: number) => { let b = 0, bd = 1e9; p.pts.forEach((q, i) => { const d = Math.abs(q[1] - z) + (q[0] > 60 && q[0] < 80 ? 0 : 50); if (d < bd) { bd = d; b = i; } }); return p.cum[b]; };
const sOfX = (p: Path, x: number) => { let b = 0, bd = 1e9; p.pts.forEach((q, i) => { const d = Math.abs(q[0] - x) + (Math.abs(q[1]) < 8 ? 0 : 50); if (d < bd) { bd = d; b = i; } }); return p.cum[b]; };

// ---------------------------------------------------------------- lugares
const L = 1.75;
export const DIG: [number, number] = [110, -112];
const BURY = -1.25, CROWN = 1.72, EXT = 2.0, ARM_PULL = -8, ARM_HI = 5;
// gancho en coordenadas locales de Bruno (y, z) según ángulo del brazo (grados) y extensión telescópica
function hookLocal(arm: number, ext: number): [number, number] {
  const a = (arm * Math.PI) / 180, ty = 0.86 + 0.573 * ext, tz = -1.23 - 0.8196 * ext;
  return [1.55 + ty * Math.cos(a) - tz * Math.sin(a), -0.55 + ty * Math.sin(a) + tz * Math.cos(a)];
}
const hookOf = (b: B2Pose, arm: number, ext: number): V3 => { const [ly, lz] = hookLocal(arm, ext); return [b.x + lz * Math.sin(b.yaw), (b.y ?? 0) + (b.lift ?? 0) + ly, b.z + lz * Math.cos(b.yaw)]; };
const placeFor = (hx: number, hz: number, yaw: number, arm: number, ext: number) => { const [, lz] = hookLocal(arm, ext); return {x: hx - lz * Math.sin(yaw), z: hz - lz * Math.cos(yaw)}; };
const BR_PULL = placeFor(DIG[0], DIG[1], 0, ARM_PULL, EXT);
const BR_SET = {x: BR_PULL.x, z: BR_PULL.z + 5};
const G: [number, number] = [BR_SET.x, BR_SET.z + hookLocal(ARM_PULL, EXT)[1]];
const RAILX = 114;
const BR_RAIL = placeFor(RAILX, RAIL_Z, Math.PI, ARM_HI, EXT);
const COCO_STOP = RAILX - 4.3, STATION_X = -3;
const DECK = 1.28;
const TICO_D = {x: 115.2, z: -115.6, yaw: yawTo(115.2, -115.6, DIG[0], DIG[1])};
const LOLA_D = {x: 103.4, z: -116.0, yaw: yawTo(103.4, -116.0, DIG[0], DIG[1])};
const CH_D = {x: 104.4, z: -105.6, yaw: yawTo(104.4, -105.6, DIG[0], DIG[1] + 2)};
const BELL_P: [number, number] = [2.4, 4.6];
const PL: Record<string, [number, number]> = {bruno: [5.0, 7.2], lola: [-5.6, 4.4], tico: [-5.4, -4.4], chispa: [0.4, 7.9]};
const plYaw = (w: string) => yawTo(PL[w][0], PL[w][1], 0, 0);
const JZ = 22, RAMP_X = 157.2, PUD_X = MUD.x;
const FARM = {lola: [176, 31.5, -2.2], tico: [158, 31.5, 2.6], coco: [0, 0, 0]} as Record<string, [number, number, number]>;
const LIGHT: V3 = [66.0, 0, 5.0];
// rutas
const P_DRIVE = mkPath([[20, -1.2], [21, 0.9], [24.5, L], [36, L], [50, L], [60.5, L], [66.5, L - 0.4], [69.3, -1.5], [70 + L, -6], [70 + L, -18], [70 + L, -30], [70 + L, -43.5], [70 + L, -56], [70 + L, -70], [70 + L, -84], [73.8, -95], [82, -102.6], [92, -105.4], [103, -106.2]]);
const S_LIGHT = sOfX(P_DRIVE, 62.5);
const S_RAILSTOP = sOfZ(P_DRIVE, -37.5);
const S_RAILX = sOfZ(P_DRIVE, -43.5);
const P_LOLA = mkPath([[70 + L, -66], [70 + L, -84], [74, -97], [84, -107], [93, -114], [99.6, -116.6], [LOLA_D.x, LOLA_D.z]]);
const P_CH = mkPath([[70 + L, -60], [70 + L, -82], [75.5, -96], [86, -104], [96, -106.8], [CH_D.x, CH_D.z]]);
const P_CARRY = mkPath([[BR_SET.x, BR_SET.z], [110.4, -95], [111.5, -84], [112.6, -72], [113.4, -62]]);

// ---------------------------------------------------------------- tiempo
function remap(t: number) {
  const r0 = S('n35'), d = vo.n35.d;
  if (t >= r0 && t < r0 + d) {
    const u = t - r0, seg = d / 4;
    if (u < seg) return M.lift0 + 0.6 + u;
    if (u < seg * 2) return M.wash1 - 1.4 + (u - seg);
    if (u < seg * 3) return M.colors0 - 5 + (u - seg * 2);
    return M.plaza0 + 3 + (u - seg * 3);
  }
  return t;
}

// ---------------------------------------------------------------- Bruno
type BP = B2Pose & {ext: number; mud: number};
const TUGS = () => [M.tug1, M.tug2, M.tug3, M.one, M.two, M.three];
const strainK = (t: number) => Math.max(...TUGS().map((g) => pulse(t, g - 0.1, 0.95)), t > M.lift0 - 0.2 && t < M.lift0 + 2.2 ? pulse(t, M.lift0 - 0.2, 2.4) : 0);
function driveS(t: number) {
  const Lp = P_DRIVE.len, v = 7.5;
  const seg = (s0: number, s1: number, t0: number, t1: number) => lerp(s0, s1, easeInOut(prog(t, t0, t1)));
  if (t < M.red + 0.6) return seg(0, S_LIGHT, M.drive0 + 0.6, M.red + 0.6);
  if (t < M.go1) return S_LIGHT;
  if (t < M.rail0 + 0.6) return seg(S_LIGHT, S_RAILSTOP, M.go1, M.rail0 + 0.6);
  if (t < M.go2) return S_RAILSTOP;
  void v; return seg(S_RAILSTOP, Lp, M.go2, M.arrive);
}
export function brunoC2(t: number): BP {
  const p: BP = {x: 20, z: -12.4, yaw: 0, eyeOpen: 1, mouth: 'smile', brow: 0.3, talk: talk(PXB, t), beacon: 0, ext: 0, mud: 0, arm: 0};
  p.eyeOpen = 1 - 0.94 * blinkAt(t, 0);
  const lowBlink = () => { p.eyeOpen = Math.min(p.eyeOpen, 1); };
  void lowBlink;
  // garaje: duerme hasta que oye a Tico
  if (t < M.exit0) {
    if (t < M.garage0) { p.eyeOpen = 0.05; p.mouth = 'smile'; return p; }
    const w = prog(t, M.garage0, M.garage0 + 0.5);
    p.eyeOpen = lerp(0.05, p.eyeOpen, w); p.eyeScale = 1 + 0.3 * w; p.brow = 1; p.mouth = 'o'; p.lift = hop(t, M.garage0 + 0.1, 0.4, 0.5);
    if (t > E('b1')) { p.mouth = 'grin'; p.eyeScale = 1.1; }
    return p;
  }
  if (t < M.drive0) {
    const u = easeInOut(prog(t, M.exit0, M.exit0 + 2.0));
    p.z = lerp(-12.4, -1.2, u); p.wheel = (u * 11.2) / 0.43; p.lift = hop(t, M.exit0 + 2.0, 0.45, 0.6); p.mouth = 'grin'; p.brow = 0.8;
    p.beacon = t > M.exit0 ? 0.5 + 0.5 * Math.sin(t * 14) : 0;
    if (t > S('b2') && t < E('b2')) { p.arm = 12 + 12 * Math.sin(t * 6); p.eyeScale = 1.1; }
    if (t > E('b2') - 1.0 && t < E('b2') + 0.2) p.mouth = 'laugh';
    p.lift = (p.lift ?? 0) + hop(t, E('b2') - 0.5, 0.45, 0.5);
    return p;
  }
  if (t < M.arrive) {
    const s = driveS(t); const q = at(P_DRIVE, s);
    p.x = q.x; p.z = q.z; p.yaw = q.yaw; p.wheel = s / 0.43; p.mouth = 'grin'; p.brow = 0.6;
    p.beacon = 0.5 + 0.5 * Math.sin(t * 14);
    const moving = !(t > M.red + 0.6 && t < M.go1) && !(t > M.rail0 + 0.6 && t < M.go2);
    if (moving) p.wheelBounce = [0, 1, 2, 3].map((i) => Math.max(0, Math.sin(t * 13 + i * 1.7)) * 0.035);
    if (t > M.red && t < M.go1) { p.mouth = 'o'; p.eyeScale = 1.1; p.pitch = 0.05 * damped(t - (M.red + 0.6), 2, 4); }
    if (t > M.go1 - 0.4 && t < M.go1 + 0.6) p.mouth = 'laugh';
    if (t > M.rail0 && t < M.go2) { p.lookX = t < M.lookL ? 0 : t < M.lookR ? -0.9 * easeInOut(prog(t, M.lookL, M.lookL + 0.4)) : lerp(-0.9, 0.9, easeInOut(prog(t, M.lookR, M.lookR + 0.5))); p.pitch = 0.05 * damped(t - (M.rail0 + 0.6), 2, 4); }
    if (t > M.go2) { p.lookX = 0.9 * (1 - prog(t, M.go2, M.go2 + 0.5)); }
    const rj = s - S_RAILX; if (rj > -2.5 && rj < 3.5) { const j = (rj + 2.5) / 6; p.lift = Math.sin(j * Math.PI) * 1.0; p.pitch = (0.5 - j) * 0.25; }
    return p;
  }
  const END = at(P_DRIVE, P_DRIVE.len);
  if (t < M.park0) {
    p.x = END.x; p.z = END.z; p.yaw = END.yaw; p.mouth = 'grin';
    if (t < S('b3')) { p.lookX = -0.4; p.lookY = -0.3; }
    if (t > S('b3') && t < E('b3') + 0.4) { p.eyeScale = 1.25; p.brow = 1; p.lookX = 0.5; p.lookY = -0.5; p.lift = hop(t, S('b3') + 0.2, 0.4, 0.4); }
    if (t > S('n4') && t < E('n4')) { p.mouth = 'o'; p.browTilt = 0.3; p.lookX = 0.6; p.lookY = -0.6; }
    if (t > M.dig1 - 0.5 && t < E('n6')) { p.lookX = 0.7; p.lookY = -0.4; }
    if (t > S('n6') && t < E('n6')) p.mouth = 'laugh';
    if (t > S('b4') && t < E('b4')) { p.brow = 0.9; p.arm = 15 + 15 * Math.sin(t * 7); p.lift = hop(t, S('b4') + 0.3, 0.45, 0.5); }
    return p;
  }
  // maniobra: avanza girando, saltito, marcha atrás y saca el brazo telescópico
  if (t < M.park1) {
    const a = M.park0, b = M.park1, d = b - a;
    const t1 = a + d * 0.28, t2 = t1 + 0.8, t3 = b - 1.3;
    p.mouth = 'grin'; p.brow = 0.6;
    if (t < t1) { const u = easeInOut(prog(t, a, t1)); p.x = lerp(END.x, 108.6, u); p.z = lerp(END.z, -103.6, u); p.yaw = angLerp(END.yaw, 0.35, u); p.wheel = u * 6.5 / 0.43; }
    else if (t < t2) { const u = easeInOut(prog(t, t1, t2)); p.x = lerp(108.6, BR_PULL.x, u); p.z = -103.6; p.yaw = angLerp(0.35, 0, u); p.lift = Math.sin(u * Math.PI) * 0.55; p.wheel = 15; }
    else { const u = easeInOut(prog(t, t2, t3)); p.x = BR_PULL.x; p.z = lerp(-103.6, BR_PULL.z, u); p.yaw = 0; p.wheel = 15 - u * 4.7 / 0.43; p.beacon = 0.5 + 0.5 * Math.sin(t * 16); p.lookX = -0.2; }
    p.ext = EXT * easeInOut(prog(t, t3, b)); p.arm = ARM_PULL * prog(t, t3, b);
    return p;
  }
  // tirando de la campana
  if (t < M.setdown0) {
    p.x = BR_PULL.x; p.z = BR_PULL.z; p.yaw = 0; p.ext = EXT; p.arm = ARM_PULL; p.mouth = 'grin'; p.brow = 0.6;
    const k = strainK(t);
    if (k > 0.01) { p.z += 0.28 * k; p.pitch = -0.06 * k; p.wheel = t * 32; p.eyeOpen = Math.min(p.eyeOpen, 0.45); p.browTilt = -0.6 * k; p.mouth = 'flat'; p.wheelBounce = [0, 1, 2, 3].map((i) => Math.abs(Math.sin(t * 40 + i)) * 0.05 * k); p.bodyRoll = Math.sin(t * 30) * 0.02 * k; }
    if (t > M.slip && t < M.slip + 0.6) { p.z -= 0.25 * pulse(t, M.slip, 0.6); }
    if (t > S('b6') && t < E('t4') + 0.3) { p.mouth = 'flat'; p.browTilt = 0.7; p.lookY = -0.5; p.eyeOpen = Math.min(p.eyeOpen, 0.85); }
    if (t > S('b7') && t < M.quien0) { p.brow = 1; p.eyeScale = 1.2; p.mouth = 'grin'; p.lift = hop(t, S('b7') + 0.3, 0.45, 0.5); }
    if (t > M.honk && t < M.honk + 2.6) { p.beacon = 0.5 + 0.5 * Math.sin(t * 18); p.lift = (p.lift ?? 0) + hop(t, M.honk, 0.3, 0.25) + hop(t, M.honk + 0.4, 0.3, 0.25); }
    for (const [w, k2] of [['lola', 'lolaIn'], ['coco', 'cocoIn'], ['chispa', 'chispaIn']] as const) { void w; if (t > M[k2] && t < M[k2] + 2) p.lookX = -0.6; }
    if (t > S('b8') && t < E('b8')) { p.mouth = 'grin'; p.lift = hop(t, S('b8'), 0.45, 0.5); }
    if (t > S('b9') && t < M.lift0) { p.brow = 0.9; p.mouth = t > M.one - 0.2 ? 'flat' : 'grin'; }
    if (t > M.lift0 + 2.2) { p.mouth = 'laugh'; p.eyeScale = 1.2; p.brow = 1; }
    if (t > M.lift0 + 2.2) p.lift = (p.lift ?? 0) + hop(t, M.lift0 + 2.4, 0.45, 0.6);
    for (const k3 of ['x3', 'l3', 't6']) p.lift = (p.lift ?? 0) + hop(t, S(k3), 0.4, 0.35);
    if (t > S('b11') && t < E('b11') + 0.5) { p.mouth = t > E('b11') - 1.4 ? 'laugh' : 'smile'; p.brow = 0.7; }
    return p;
  }
  // deja la campana en el suelo y se queda al lado
  p.ext = EXT; p.arm = ARM_PULL;
  if (t < M.carry0) {
    const u = easeInOut(prog(t, M.setdown0, M.setdown0 + 2.2));
    p.x = BR_SET.x; p.z = lerp(BR_PULL.z, BR_SET.z, u); p.yaw = 0; p.wheel = (u * 5) / 0.43; p.mouth = 'grin';
    // brazo: recoge tras dejarla, se alarga para tocarla (b12) y para levantarla (lift2a)
    const ret1 = easeInOut(prog(t, M.setdown1 + 0.4, M.setdown1 + 1.4));
    const out2 = easeInOut(prog(t, S('b12') + 0.6, M.dong - 0.3)), ret2 = easeInOut(prog(t, M.dong + 1.2, M.dong + 2.2));
    const out3 = easeInOut(prog(t, S('o2'), M.lift2a));
    p.ext = EXT * Math.max(1 - ret1 + out2 - ret2 + out3, 0);
    p.ext = Math.min(EXT, p.ext);
    p.arm = ARM_PULL - 16 * pulse(t, M.dong - 0.25, 0.5);
    if (t > M.wash0 && t < M.wash1) { p.eyeOpen = Math.min(p.eyeOpen, 0.6); p.mouth = 'laugh'; }
    if (t > S('n21') && t < E('n21') + 0.3) { p.eyeScale = 1.25; p.brow = 1; p.mouth = 'o'; }
    // fiesta: baile sincronizado
    if (t > M.party0 && t < M.party1) {
      p.mouth = 'laugh'; p.brow = 0.9;
      for (let r = 0; r < 2; r++) {
        p.lift = (p.lift ?? 0) + hop(t, M[`up${r}`], 0.5, 1.0);
        const dq = t - M[`down${r}`]; if (dq > 0 && dq < 0.6) p.sy = 1 - 0.3 * Math.sin((dq / 0.6) * Math.PI);
        p.yaw += Math.PI * 2 * easeInOut(prog(t, M[`spin${r}`], M[`spin${r}`] + 0.9));
      }
      if (t > M.free0) { const q = t - M.free0; p.lift = (p.lift ?? 0) + Math.abs(Math.sin(q * 4.2 + 2.1)) * 0.55; p.roll = Math.sin(q * 4.2 + 2.1) * 0.08; p.yaw += Math.sin(q * 1.3 + 2.1) * 0.35; p.arm = ARM_PULL + 10 * Math.sin(q * 5); p.beacon = 0.5 + 0.5 * Math.sin(t * 14); }
    }
    if (t > S('b12') && t < M.dong + 1.0) { p.mouth = t < M.dong ? 'grin' : 'o'; p.eyeScale = t > M.dong ? 1.25 : 1; p.lookY = -0.2; }
    if (t > M.q3rev && t < M.q3rev + 1.2) p.lift = (p.lift ?? 0) + hop(t, M.q3rev, 0.45, 0.6);
    if (t > S('n28') && t < M.carry0) { p.brow = 0.7; p.mouth = 'grin'; p.eyeOpen = Math.min(p.eyeOpen, 0.8); }
    return p;
  }
  // traslado a las vías (montaje) y carga en el vagón de Coco
  if (t < M.train0 + 3) {
    const tr = M.load0 - 4.5;
    if (t < tr) { const u = prog(t, M.carry0, tr); const s = easeInOut(u) * P_CARRY.len; const q = at(P_CARRY, s); p.x = q.x; p.z = q.z; p.yaw = q.yaw; p.wheel = s / 0.43; p.wheelBounce = [0, 1, 2, 3].map((i) => Math.max(0, Math.sin(t * 13 + i * 1.7)) * 0.03); p.beacon = 0.5 + 0.5 * Math.sin(t * 14); p.mouth = 'grin'; p.arm = lerp(ARM_PULL, ARM_HI, prog(t, M.carry0, M.carry0 + 1.5)); return p; }
    const u = easeOut(prog(t, tr, M.load0)); p.x = RAILX; p.z = lerp(BR_RAIL.z - 6, BR_RAIL.z, u); p.yaw = Math.PI; p.arm = ARM_HI; p.wheel = -u * 6 / 0.43; p.beacon = 0.5 + 0.5 * Math.sin(t * 16);
    p.mouth = t > M.loaded ? 'laugh' : 'grin'; p.eyeOpen = t > S('b13') && t < M.loaded ? Math.min(p.eyeOpen, 0.7) : p.eyeOpen; p.lookX = 0;
    if (t > M.loaded) { p.lift = hop(t, M.loaded + 0.2, 0.45, 0.5); p.ext = EXT * (1 - easeInOut(prog(t, M.loaded + 0.8, M.loaded + 2.0))); }
    return p;
  }
  // plaza, granja y avance
  p.ext = 0; p.arm = 0;
  if (t >= M.jump0 && t < M.jump1) {
    // el gran salto: espera, toma impulso, rampa y ¡splash!
    const t0 = M.bjump - 2.4, x0 = 128;
    if (t < t0) { p.x = x0; p.z = JZ - 3; p.yaw = Math.PI / 2; p.mouth = 'grin'; p.lookX = 0.4; if (t > S('b16') && t < E('b16')) { p.lift = hop(t, S('b16') + 0.3, 0.4, 0.5); p.brow = 1; } p.mud = 0; return p; }
    if (t < M.bjump) { const u = easeIn(prog(t, t0, M.bjump)); p.x = lerp(x0, RAMP_X, u); p.z = lerp(JZ - 3, JZ, easeInOut(prog(t, t0, t0 + 1.2))); p.yaw = Math.PI / 2 - 0.15 * Math.sin(prog(t, t0, t0 + 1.2) * Math.PI); p.wheel = p.x / 0.43; p.mouth = 'grin'; p.brow = 0.2; p.browTilt = -0.6; p.beacon = 0.5 + 0.5 * Math.sin(t * 16); const r = p.x - (RAMP_X - 4); if (r > 0) { p.lift = (r / 4) * 0.9; p.pitch = -0.22; } return p; }
    if (t < M.splash) { const u = prog(t, M.bjump, M.splash); p.x = lerp(RAMP_X, PUD_X, u); p.z = JZ; p.yaw = Math.PI / 2; p.lift = 0.9 + Math.sin(u * Math.PI) * 2.2 - 0.9 * u; p.pitch = lerp(-0.22, 0.25, u); p.mouth = 'o'; p.eyeScale = 1.3; p.brow = 1; p.wheel = t * 30; return p; }
    p.x = PUD_X; p.z = JZ; p.yaw = Math.PI / 2; p.mud = 1.45; p.lift = -0.18 + 0.2 * damped(t - M.splash, 2, 5); p.sy = 1 - 0.18 * damped(t - M.splash, 3, 6);
    p.mouth = t > S('b17') - 0.2 ? 'laugh' : 'o'; p.eyeScale = 1.15; p.brow = 0.9;
    if (t > S('b17')) { p.lift = (p.lift ?? 0) + Math.abs(Math.sin((t - S('b17')) * 7)) * 0.12; p.roll = Math.sin((t - S('b17')) * 7) * 0.05; }
    return p;
  }
  const [x, z] = PL.bruno; p.x = x; p.z = z; p.yaw = plYaw('bruno'); p.mouth = 'grin';
  if (t >= M.plaza0 && t < M.plaza1) {
    const arr = easeOut(prog(t, M.plaza0 - 0.5, M.plaza0 + 2.0)); p.x = x + (1 - arr) * 9 * Math.sin(p.yaw + Math.PI); p.z = z + (1 - arr) * 9 * Math.cos(p.yaw + Math.PI); p.wheel = arr * 9 / 0.43;
    if (t > S('n30') + 2.5 && t < E('n30')) { p.lookY = 0.9; p.mouth = 'o'; }
    if (t > S('b14') && t < E('b14')) { p.lookY = 0.9; p.brow = 1; p.eyeScale = 1.2; p.lift = hop(t, S('b14') + 0.3, 0.4, 0.4); }
    if (t > S('l5') && t < E('l5')) { p.mouth = 'flat'; p.browTilt = 0.5; p.lookX = -0.6; }
    if (t > S('b15') && t < E('b15')) { p.mouth = 'grin'; p.brow = 1; p.arm = 18 + 15 * Math.sin(t * 7); }
    p.lift = (p.lift ?? 0) + hop(t, M.cheer, 0.45, 0.8);
    if (t > M.cheer) p.mouth = 'laugh';
  }
  if (t >= M.sp0) { p.lookY = -0.8; p.lookX = -0.5; p.mouth = t > M.mapopen ? 'grin' : 'o'; p.eyeScale = 1.25; p.brow = 1; p.lift = hop(t, S('b18') + 0.2, 0.4, 0.4); }
  return p;
}

// ---------------------------------------------------------------- amigos
const digSwing = (t: number, times: number[]) => {
  for (const td of times) { const q = prog(t, td, td + 0.9); if (q > 0 && q < 1) return 0.35 + 0.65 * Math.cos(2 * Math.PI * q) - 0.1; }
  return null;
};
const DIGT = () => [M.dig1, M.dig2, M.dig3, M.dig4, M.dig5, M.dig2a, M.dig2a + 1.0, M.dig2a + 2.0, M.q1snd + 0.2, M.q1snd + 1.2];
function partyMoves(t: number, p: CharPose, ph: number) {
  if (t < M.party0 || t > M.party1) return;
  for (let r = 0; r < 2; r++) {
    p.y = (p.y ?? 0) + hop(t, M[`up${r}`], 0.5, 1.0);
    const dq = t - M[`down${r}`]; if (dq > 0 && dq < 0.6) p.sy = 1 - 0.3 * Math.sin((dq / 0.6) * Math.PI);
    p.yaw += Math.PI * 2 * easeInOut(prog(t, M[`spin${r}`], M[`spin${r}`] + 0.9));
  }
  if (t > M.free0) { const q = t - M.free0; p.y = (p.y ?? 0) + Math.abs(Math.sin(q * 4.2 + ph)) * 0.55; p.roll = Math.sin(q * 4.2 + ph) * 0.08; p.yaw += Math.sin(q * 1.3 + ph) * 0.35; }
}
function ticoC2(t: number): CharPose {
  const p: CharPose = {x: TICO_D.x, z: TICO_D.z, yaw: TICO_D.yaw, blink: blinkAt(t, 3), talk: talk(PXT, t), arm: 0.3};
  if (t < M.plaza0 - 0.5) {
    if (t < M.garage0 + 0.6) { p.arm = 0.5 + 0.45 * Math.abs(Math.sin(t * 6)); p.y = hop(t, 0.8, 0.4, 0.35) + hop(t, 2.2, 0.4, 0.35); }
    const d = digSwing(t, DIGT()); if (d !== null) p.arm = d;
    if (t > S('t2') && t < E('t2')) p.arm = 0.5 + 0.2 * Math.sin(t * 6);
    if (t > M.lift0 + 2.2 && t < M.lift0 + 6) p.arm = 0.8 + 0.3 * Math.sin(t * 8);
    p.y = (p.y ?? 0) + hop(t, S('t6'), 0.4, 0.4) + hop(t, M.q1rev, 0.5, 0.8);
    partyMoves(t, p, 0.7);
    if (t > M.party0 && t < M.party1) p.arm = 0.5 + 0.4 * Math.sin(t * 5);
    return p;
  }
  if (t >= M.jump0 && t < M.jump1) { const [x, z, y] = FARM.tico; p.x = x; p.z = z; p.yaw = y; p.arm = t > M.splash ? 0.8 + 0.3 * Math.sin(t * 9) : 0.4; p.y = hop(t, M.splash + 0.3, 0.45, 0.6); return p; }
  const [x, z] = PL.tico; p.x = x; p.z = z; p.yaw = plYaw('tico'); p.arm = 0.4;
  if (t >= M.plaza0 && t < M.plaza1) { p.y = hop(t, M.cheer, 0.45, 0.7); if (t > M.cheer) p.arm = 0.7 + 0.3 * Math.sin(t * 8); }
  return p;
}
function lolaC2(t: number): CharPose | null {
  if (t < M.lolaIn - 0.2) return null;
  const p: CharPose = {x: LOLA_D.x, z: LOLA_D.z, yaw: LOLA_D.yaw, blink: blinkAt(t, 1), talk: talk(PXL, t)};
  if (t < M.plaza0 - 0.5) {
    const arr = S('l1') - 0.3;
    if (t < arr) { const u = easeOut(prog(t, M.lolaIn - 0.2, arr)); const q = at(P_LOLA, u * P_LOLA.len); p.x = q.x; p.z = q.z; p.yaw = q.yaw; p.dist = u * P_LOLA.len; p.siren = t; return p; }
    p.yaw = angLerp(at(P_LOLA, P_LOLA.len).yaw, LOLA_D.yaw, easeInOut(prog(t, arr, arr + 0.8))); p.dist = P_LOLA.len;
    p.y = hop(t, S('l1') + 0.2, 0.4, 0.4) + hop(t, S('l3'), 0.4, 0.4) + hop(t, M.q0rev, 0.5, 0.8);
    const spraying = (t > M.spray0 && t < M.spray1) || (t > M.wash0 && t < M.wash1) || (t > M.q0snd && t < M.q0rev + 1.0);
    p.ladder = spraying ? 0.5 : 0;
    if (t > M.wash0 - 1 && t < M.carry0) p.yaw = angLerp(LOLA_D.yaw, yawTo(LOLA_D.x, LOLA_D.z, G[0], G[1]), easeInOut(prog(t, M.wash0 - 1, M.wash0)));
    partyMoves(t, p, 0);
    if (t > M.party0 && t < M.party1) p.siren = t;
    return p;
  }
  if (t >= M.jump0 && t < M.jump1) { const [x, z, y] = FARM.lola; p.x = x; p.z = z; p.yaw = y; p.y = hop(t, M.splash + 0.4, 0.45, 0.6); p.siren = t > M.splash ? t : 0; return p; }
  const [x, z] = PL.lola; p.x = x; p.z = z; p.yaw = plYaw('lola');
  if (t >= M.plaza0 && t < M.plaza1) p.y = hop(t, M.cheer, 0.45, 0.7) + hop(t, S('l5'), 0.4, 0.2);
  return p;
}
function cocoX(t: number) {
  if (t < M.train0 + 1.5) return lerp(215, COCO_STOP, easeOut(prog(t, M.cocoIn - 0.5, S('o1') + 0.2)));
  return lerp(COCO_STOP, STATION_X, easeInOut(prog(t, M.train0 + 1.5, M.train1 - 1.5)));
}
function cocoC2(t: number): CharPose | null {
  if (t < M.cocoIn - 0.6 || t >= M.plaza0) return null;
  const x = cocoX(t);
  const moving = (t > M.cocoIn - 0.5 && t < S('o1') + 0.2) || (t > M.train0 + 1.5 && t < M.train1 - 1.5);
  return {x, z: RAIL_Z, yaw: -Math.PI / 2, y: 0.24, blink: blinkAt(t, 4), talk: talk(PXO, t), dist: -x, puff: moving ? Math.max(0, Math.sin(t * 9)) : 0.2 * Math.max(0, Math.sin(t * 3))};
}
function chispaC2(t: number): CharPose | null {
  if (t < M.chispaIn - 0.2) return null;
  const p: CharPose = {x: CH_D.x, z: CH_D.z, yaw: CH_D.yaw, blink: blinkAt(t, 2), talk: talk(PXX, t)};
  if (t < M.train0) {
    const arr = S('x1') - 0.3;
    if (t < arr) { const u = easeOut(prog(t, M.chispaIn - 0.2, arr)); const q = at(P_CH, u * P_CH.len); p.x = q.x; p.z = q.z; p.yaw = q.yaw; p.dist = u * P_CH.len; return p; }
    p.dist = P_CH.len;
    p.y = hop(t, S('x1') + 0.1, 0.35, 0.5) + hop(t, S('x2'), 0.35, 0.5) + hop(t, S('x2') + 0.6, 0.35, 0.5) + hop(t, S('x3'), 0.4, 0.7) + hop(t, M.q2rev, 0.45, 0.8) + hop(t, M.q2snd + 0.3, 0.3, 0.3) + hop(t, M.q2snd + 0.9, 0.3, 0.3) + hop(t, S('x7') + 0.3, 0.4, 0.6);
    if (t > M.wash0 - 1) p.yaw = angLerp(CH_D.yaw, yawTo(CH_D.x, CH_D.z, G[0], G[1]), easeInOut(prog(t, M.wash0 - 1, M.wash0)));
    partyMoves(t, p, 1.3);
    return p;
  }
  if (t < M.plaza0 - 0.5) { // sigue al tren por la carretera
    const x = cocoX(t) + 3 + Math.sin(t * 0.7) * 1.5; p.x = x; p.z = -70 - L; p.yaw = -Math.PI / 2; p.dist = -x; p.y = hop(t, S('x4'), 0.35, 0.5); return p;
  }
  if (t >= M.jump0 && t < M.jump1) {
    const t0 = M.cjump - 2.2, x0 = 126;
    if (t < t0) { p.x = x0; p.z = JZ + 0.5; p.yaw = Math.PI / 2; p.y = hop(t, S('x5') + 0.2, 0.35, 0.4); return p; }
    if (t < M.cjump) { const u = easeIn(prog(t, t0, M.cjump)); p.x = lerp(x0, RAMP_X, u); p.z = JZ; p.yaw = Math.PI / 2; p.dist = p.x; const r = p.x - (RAMP_X - 4); if (r > 0) { p.y = (r / 4) * 0.9; p.pitch = -0.22; } return p; }
    const lx = PUD_X + 10.5, land = M.cjump + 1.3;
    if (t < land) { const u = prog(t, M.cjump, land); p.x = lerp(RAMP_X, lx, u); p.z = JZ; p.yaw = Math.PI / 2; p.y = 0.9 + Math.sin(u * Math.PI) * 3.2 - 0.9 * u; p.pitch = lerp(-0.22, 0.2, u); p.roll = Math.sin(u * Math.PI * 2) * 0.15; p.dist = p.x; return p; }
    const u = easeOut(prog(t, land, land + 1.4)); p.x = lerp(lx, lx + 5, u); p.z = JZ + u * 3; p.yaw = angLerp(Math.PI / 2, -Math.PI * 0.6, u); p.dist = lx + u * 6; p.y = damped(t - land, 2, 5) * 0.15 + hop(t, M.splash + 0.3, 0.4, 0.6); return p;
  }
  const [x, z] = PL.chispa; p.x = x; p.z = z; p.yaw = plYaw('chispa');
  if (t >= M.plaza0 && t < M.plaza1) { const arr = easeOut(prog(t, M.plaza0 - 0.5, M.plaza0 + 1.8)); p.z = z + (1 - arr) * 10; p.dist = arr * 10; p.y = hop(t, M.cheer, 0.45, 0.8); }
  if (t >= M.sp0) p.y = hop(t, M.mapfall + 0.5, 0.35, 0.4);
  return p;
}

// ---------------------------------------------------------------- campana
type Bell = {x: number; y: number; z: number; rx: number; rz: number; mud: number; hang: boolean; cable: number; hook: V3 | null; shine: number};
function bellC2(t: number, b: BP): Bell {
  const hk = b.ext > 0.05 ? hookOf(b, b.arm ?? 0, b.ext) : null;
  const hb = hk ? hk[1] - 0.3 : 0; // donde acaba el gancho
  const bell: Bell = {x: DIG[0], y: BURY, z: DIG[1], rx: 0, rz: 0, mud: 1, hang: false, cable: 0, hook: hk, shine: 0};
  const swing = (t0: number, a: number, f = 0.55, k = 0.7) => a * damped(t - t0, f, k);
  if (t < M.lift0) {
    const k = strainK(t); bell.y = BURY + 0.08 * k; bell.rz = 0.04 * k * Math.sin(t * 25); bell.rx = 0.03 * k * Math.sin(t * 21);
    if (hk && t > M.park1) { const L0 = hb - (BURY + CROWN); const u = easeInOut(prog(t, M.park1, M.hooked)); bell.cable = lerp(0.35, L0 + 0.08 * k, u); bell.hang = u >= 1; }
    return bell;
  }
  if (t < M.setdown0 + 2.4) { // izada y colgando
    const u = easeInOut(prog(t, M.lift0, M.lift0 + 2.4));
    const L0 = hb - (BURY + CROWN); bell.cable = lerp(L0, 0.3, u); bell.hang = true;
    bell.x = hk![0]; bell.z = hk![2]; bell.y = hb - bell.cable - CROWN;
    bell.rx = swing(M.lift0 + 2.4, 0.14) + swing(M.setdown0, -0.18) + swing(M.setdown0 + 2.2, 0.12);
    bell.rz = swing(M.lift0 + 2.4, 0.06, 0.4);
    return bell;
  }
  if (t < M.setdown1 + 0.4) { // la baja al suelo
    const yb = hb - 0.3 - CROWN; const u = easeInOut(prog(t, M.setdown0 + 2.4, M.setdown1));
    bell.x = hk![0]; bell.z = hk![2]; bell.y = lerp(yb, 0, u); bell.cable = hb - (bell.y + CROWN); bell.hang = true; bell.rx = swing(M.setdown0 + 2.2, 0.12) * (1 - u);
    return bell;
  }
  bell.x = G[0]; bell.z = G[1]; bell.y = 0;
  bell.mud = 1 - easeInOut(prog(t, M.wash0 + 0.3, M.wash1 - 0.5));
  bell.shine = t > M.wash1 - 0.5 ? 1 : 0;
  if (t < M.lift2a) {
    bell.rx = 0.16 * damped(t - M.dong, 0.9, 0.9) + 0.1 * damped(t - M.q3snd, 0.9, 0.9) + 0.07 * damped(t - M.q3rev, 0.9, 1.1);
    if (t > M.party0 && t < M.party1) bell.y = hop(t, M.up0, 0.5, 0.25) + hop(t, M.up1, 0.5, 0.25);
    return bell;
  }
  if (t < M.load0) { // la vuelve a levantar y la lleva colgando
    const hb2 = hb; const u = easeInOut(prog(t, M.lift2a + 0.6, M.lift2a + 2.4)); const d0 = easeInOut(prog(t, M.lift2a - 0.6, M.lift2a + 0.5));
    if (t < M.lift2a + 0.6) { bell.cable = lerp(0.35, hb2 - CROWN, d0); return bell; }
    bell.cable = lerp(hb2 - CROWN, 0.3, u); bell.hang = true; bell.x = hk![0]; bell.z = hk![2]; bell.y = hb2 - bell.cable - CROWN;
    bell.rx = swing(M.lift2a + 2.4, 0.12) + 0.08 * Math.sin(t * 2.4) * prog(t, M.carry0, M.carry0 + 1);
    bell.rz = 0.05 * Math.sin(t * 1.9 + 1);
    return bell;
  }
  if (t < M.loaded + 0.3) { // baja al vagón
    const yb = hb - 0.3 - CROWN; const u = easeInOut(prog(t, M.load0, M.loaded));
    bell.x = hk![0]; bell.z = hk![2]; bell.y = lerp(yb, DECK, u); bell.cable = hb - (bell.y + CROWN); bell.hang = true; bell.rx = 0.05 * Math.sin(t * 2.4) * (1 - u);
    return bell;
  }
  if (t < M.plaza0) { bell.x = cocoX(t) + 4.3; bell.z = RAIL_Z; bell.y = DECK; bell.hang = false; bell.rz = 0.02 * Math.sin(t * 6) * (t > M.train0 + 1.5 && t < M.train1 - 1.5 ? 1 : 0); return bell; }
  bell.x = BELL_P[0]; bell.z = BELL_P[1]; bell.y = 0; bell.hang = false;
  bell.rx = 0.05 * damped(t - M.mapfall, 1.0, 1.2);
  return bell;
}

// ---------------------------------------------------------------- cámara
type Shot = {t0: number; t1: number; f: (u: number, t: number) => Cam};
const follow = (x: number, z: number, yaw: number, back: number, side: number, h: number, ahead = 2, ty = 1.2, fov = 44): Cam => {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  return F([x - fx * back + rx * side, h, z - fz * back + rz * side], [x + fx * ahead, ty, z + fz * ahead], fov);
};
function shots(): Shot[] {
  const sh: Shot[] = [];
  const add = (t0: number, t1: number, f: (u: number, t: number) => Cam) => { if (t1 > t0) sh.push({t0, t1, f}); };
  const B = (t: number) => brunoC2(t);
  // A · gancho
  add(0, M.garage0, (u) => F(mix3([DIG[0] + 0.5, 4.0, DIG[1] + 7.5], [DIG[0] + 0.8, 3.0, DIG[1] + 5.8], easeInOut(u)), mix3([DIG[0] + 2.8, 1.3, DIG[1] - 2.0], [DIG[0] + 3.0, 1.5, DIG[1] - 2.4], u), 46 - 4 * u));
  add(M.garage0, M.title0, (u) => F(mix3([21.0, 1.8, -8.0], [20.8, 1.7, -8.5], u), [20, 1.5, -12.4], 46));
  add(M.title0, M.title1 + 0.6, (u) => F(mix3([60, 55, 70], [30, 30, 45], easeInOut(u)), [0, 4, 0], 44));
  add(M.title1 + 0.6, M.exit0 - 0.4, (u) => F(mix3([10, 14, 26], [8, 8, 18], easeInOut(u)), mix3([0, 8, 0], [0, 6, 0], u), 46));
  add(M.exit0 - 0.4, S('b2'), (u) => F(mix3([20, 1.7, 9.5], [20, 1.6, 8.6], u), [20, 1.6, -4], 42));
  add(S('b2'), M.recap0, (u, t) => { const b = B(t); return F(mix3([21.6, 1.6, b.z + 5.6], [21.2, 1.6, b.z + 5.0], u), [b.x, 1.55, b.z], 38); });
  add(M.recap0, M.drive0, () => F([20, 2, 9], [20, 1.6, -4], 42));
  // D · viaje con semáforo y vías
  const dr = (t: number) => { const b = B(t); return b; };
  add(M.drive0, M.drive0 + 3.2, (u, t) => { const b = dr(t); return F([28, 1.4, 8], [b.x, 1.2, b.z], 42); });
  add(M.drive0 + 3.2, M.light0 - 0.2, (u, t) => { const b = dr(t); return follow(b.x, b.z, b.yaw, -9, 2.5, 1.6, 0, 1.3, 44); });
  add(M.light0 - 0.2, M.green, (u, t) => { const b = dr(t); return F(mix3([LIGHT[0] + 7.5, 2.2, -1.8], [LIGHT[0] + 7.0, 2.3, -1.5], u), [lerp(b.x, LIGHT[0], 0.35), 2.0, lerp(b.z, LIGHT[2], 0.3)], 46); });
  add(M.green, M.go1 + 1.2, (u, t) => { const b = dr(t); return F([LIGHT[0] + 3, 1.3, 9], [b.x, 1.3, b.z], 40); });
  add(M.go1 + 1.2, M.rail0 - 0.2, (u, t) => { const b = dr(t); return F([b.x + 22 - 6 * u, 18 - 4 * u, b.z + 14], [b.x - 2, 0, b.z - 8], 48); });
  add(M.rail0 - 0.2, M.lookL, (u, t) => { const b = dr(t); return F([b.x + 0.3, 1.6, b.z - 6], [b.x, 1.5, b.z], 40); });
  add(M.lookL, M.go2, (u) => F(mix3([79, 1.5, -38.5], [78.5, 1.5, -38.8], u), [71.75, 1.2, -38], 44));
  add(M.go2, M.go2 + 3.0, () => F([79, 1.2, -50], [71.75, 1.4, -43.5], 46));
  add(M.go2 + 3.0, M.arrive - 3.2, (u, t) => { const b = dr(t); return follow(b.x, b.z, b.yaw, 8.5, 3, 3.2, 3, 1.2, 46); });
  add(M.arrive - 3.2, M.arrive, (u, t) => { const b = dr(t); return F([DIG[0] + 6, 3.4, DIG[1] + 10], [b.x, 1.2, b.z], 46); });
  // en las obras
  const two = (t: number, h = 2.4, fov = 46) => { const b = B(t); return F([lerp(b.x, DIG[0], 0.5) - 1, h, DIG[1] + 10.5], [lerp(b.x, TICO_D.x, 0.5), 1.4, lerp(b.z, TICO_D.z, 0.5)], fov); };
  add(M.arrive, S('b3'), (u, t) => two(t));
  add(S('b3'), S('n4'), (u) => F(mix3([DIG[0] - 2.6, 2.4, DIG[1] + 3.2], [DIG[0] - 2.2, 2.0, DIG[1] + 2.6], u), [DIG[0], 0.3, DIG[1]], 40));
  add(S('n4'), S('n5'), (u, t) => { const b = B(t); return F(mix3([b.x - 0.6, 1.5, b.z + 4.8], [b.x - 0.5, 1.5, b.z + 4.3], u), [b.x, 1.5, b.z], 38); });
  add(S('n5'), E('n6'), (u) => F(mix3([TICO_D.x + 2, 3.2, TICO_D.z + 8.5], [TICO_D.x + 1, 3.0, TICO_D.z + 8], u), [lerp(TICO_D.x, DIG[0], 0.5), 1.1, lerp(TICO_D.z, DIG[1], 0.5)], 44));
  add(E('n6'), S('b4'), (u, t) => { const ti = ticoC2(t); return F([ti.x + 3.5, 3.0, ti.z + 6.5], [ti.x, 2.4, ti.z], 40); });
  add(S('b4'), M.park0, (u, t) => { const b = B(t); return F(mix3([b.x - 1.2, 1.6, b.z + 4.6], [b.x - 1.0, 1.6, b.z + 4.2], u), [b.x, 1.5, b.z], 38); });
  add(M.park0, M.park1 - 1.3, (u, t) => { const b = B(t); return F([DIG[0] - 9, 4, DIG[1] + 9], [b.x, 1.2, b.z], 46); });
  add(M.park1 - 1.3, M.hooked, (u, t) => { const b = B(t); const h = hookOf(b, ARM_PULL, EXT); return F(mix3([h[0] + 5, 3.4, h[2] + 2.5], [h[0] + 4.4, 3.0, h[2] + 2.2], u), [h[0], h[1] - 1.2, h[2]], 42); });
  add(M.hooked, M.tug2, (u, t) => { const b = B(t); return F([b.x + 6.5, 1.3, b.z + 3.5], [b.x, 1.3, b.z - 1.5], 44); });
  add(M.tug2, M.slip + 0.6, (u, t) => { const b = B(t); return F(mix3([b.x - 0.4, 1.3, b.z + 4.6], [b.x - 0.3, 1.25, b.z + 3.9], u), [b.x, 1.4, b.z], 38); });
  add(M.slip + 0.6, S('t4'), (u, t) => { const b = B(t); return F(mix3([b.x - 0.6, 1.6, b.z + 4.4], [b.x - 0.4, 1.6, b.z + 4.0], u), [b.x, 1.4, b.z], 36); });
  add(S('t4'), S('b7'), (u, t) => { const ti = ticoC2(t); return F([ti.x - 3, 2.6, ti.z + 6], [ti.x, 2.3, ti.z], 40); });
  add(S('b7'), M.honk, (u, t) => { const b = B(t); return F(mix3([b.x + 1, 1.5, b.z + 4.4], [b.x + 0.8, 1.5, b.z + 4.0], u), [b.x, 1.6, b.z], 38); });
  add(M.honk, M.quien0, (u, t) => { const b = B(t); return F(mix3([b.x + 4, 2, b.z + 9], [b.x + 8, 10, b.z + 18], easeIn(u)), [b.x, 1.8, b.z], 44 + 6 * u); });
  // E · ¿Quién es? (detrás de la tarjeta se ven las obras)
  const quien = [['lola', 'lolaQ', 'lolaIn', 'l1'], ['coco', 'cocoQ', 'cocoIn', 'o1'], ['chispa', 'chispaQ', 'chispaIn', 'x1']] as const;
  add(M.quien0, M.lolaQ, () => F([DIG[0] - 14, 8, DIG[1] + 14], [DIG[0], 1, DIG[1]], 46));
  quien.forEach(([w, q, inn, line], i) => {
    const next = i < 2 ? M[quien[i + 1][1]] : S('b8');
    add(M[q], M[inn], (u) => F(mix3([DIG[0] - 12, 6, DIG[1] + 12], [DIG[0] - 11, 5.5, DIG[1] + 11], u), [DIG[0], 1, DIG[1]], 46));
    if (w === 'lola') {
      add(M[inn], M[inn] + (S(line) - M[inn]) * 0.5, (u, t) => { const l = lolaC2(t)!; return F([83, 1.6, -95.5], [l.x, 1.6, l.z], 46); });
      add(M[inn] + (S(line) - M[inn]) * 0.5, S(line) - 0.2, (u, t) => { const l = lolaC2(t)!; return follow(l.x, l.z, l.yaw, -8, -2, 2.2, 0, 1.6, 44); });
      add(S(line) - 0.2, next, (u, t) => { const l = lolaC2(t)!; return F([l.x + Math.sin(l.yaw) * 7 - 2, 2.4, l.z + Math.cos(l.yaw) * 7 + 1], [l.x, 2.0, l.z], 40); });
    } else if (w === 'coco') {
      add(M[inn], S(line) - 0.3, (u, t) => { const c = cocoC2(t); const x = c ? c.x : 200; return F([x - 7.5, 2.3, RAIL_Z - 6.5], [x + 1, 2.2, RAIL_Z], 44); });
      add(S(line) - 0.3, next, (u) => F(mix3([COCO_STOP - 7, 2.4, RAIL_Z - 5], [COCO_STOP - 6.4, 2.4, RAIL_Z - 4.6], u), [COCO_STOP, 2.3, RAIL_Z], 40));
    } else {
      add(M[inn], S(line) - 0.3, (u, t) => { const c = chispaC2(t)!; return follow(c.x, c.z, c.yaw, -6, 1.5, 1.2, 0, 0.9, 46); });
      add(S(line) - 0.3, next, (u) => F(mix3([CH_D.x - 3.8, 1.2, CH_D.z + 2.2], [CH_D.x - 3.4, 1.2, CH_D.z + 2.0], u), [CH_D.x, 0.9, CH_D.z], 38));
    }
  });
  add(S('b8'), M.spray0, (u) => F(mix3([DIG[0] - 3, 6, DIG[1] + 13], [DIG[0] - 2, 5, DIG[1] + 12], u), [DIG[0] - 2, 1, DIG[1] - 1], 48));
  // F · todos juntos
  add(M.spray0, S('n17'), (u) => F([LOLA_D.x - 6, 3.8, LOLA_D.z + 3], [DIG[0] - 1, 1.5, DIG[1] - 1], 44));
  add(S('n17'), M.spray1, (u) => F(mix3([DIG[0] - 3.2, 2.2, DIG[1] + 2.6], [DIG[0] - 2.8, 1.9, DIG[1] + 2.2], u), [DIG[0], 0.2, DIG[1]], 40));
  add(M.spray1, S('x2'), (u) => F([TICO_D.x + 4, 3.2, TICO_D.z + 6], [DIG[0] + 1.5, 1.2, DIG[1] - 1], 42));
  add(S('x2'), S('n18'), (u) => F(mix3([CH_D.x - 3.6, 1.1, CH_D.z + 2.4], [CH_D.x - 3.2, 1.1, CH_D.z + 2.2], u), [CH_D.x, 0.9, CH_D.z], 38));
  add(S('n18'), M.one - 0.3, (u) => F(mix3([DIG[0] - 12, 5, DIG[1] + 10], [DIG[0] - 10, 4, DIG[1] + 8], u), [DIG[0], 1.2, DIG[1] + 1], 46));
  add(M.one - 0.3, M.lift0, (u, t) => { const b = B(t); return F(mix3([b.x - 0.6, 1.5, b.z + 4.6], [b.x - 0.5, 1.45, b.z + 3.9], u), [b.x, 1.5, b.z], 38); });
  add(M.lift0, M.lift0 + 3.2, (u) => F(mix3([DIG[0] + 4.5, 0.4, DIG[1] + 3.5], [DIG[0] + 4.0, 0.6, DIG[1] + 3.0], u), [DIG[0], 1.4 + 1.2 * u, DIG[1]], 46));
  add(M.lift0 + 3.2, S('x3'), (u, t) => { const b = B(t); return F(mix3([b.x + 9, 3.2, b.z + 4], [b.x + 8, 3.6, b.z + 3], u), [b.x, 2.2, b.z - 2], 46); });
  add(S('x3'), S('b11'), (u) => F([DIG[0] - 13, 4, DIG[1] + 10], [DIG[0] + 1, 1.5, DIG[1]], 48));
  add(S('b11'), S('n20'), (u, t) => { const b = B(t); return F(mix3([b.x - 0.8, 1.6, b.z + 4.6], [b.x - 0.6, 1.6, b.z + 4.0], u), [b.x, 1.5, b.z], 38); });
  add(S('n20'), M.wash0, (u, t) => { const b = B(t); return F([b.x + 7.5, 2.6, b.z - 1], [b.x, 1.6, b.z - 2.5], 46); });
  add(M.wash0, M.wash1 - 1.5, (u) => F(mix3([G[0] - 4.5, 2.4, G[1] + 4.8], [G[0] - 4.0, 2.2, G[1] + 4.2], u), [G[0], 1.0, G[1]], 44));
  add(M.wash1 - 1.5, M.party0, (u) => F(mix3([G[0] - 2.4, 1.2, G[1] + 2.4], [G[0] - 2.0, 1.1, G[1] + 2.0], u), [G[0], 0.9, G[1]], 38));
  // fiesta de la campana
  add(M.party0, M.up0, (u) => F(mix3([G[0] - 10, 6, G[1] + 12], [G[0] - 8, 4.5, G[1] + 10], u), [G[0], 1, G[1] - 2], 50));
  const pd = (a: number) => M.up0 + (M.party1 - M.up0) * a;
  for (let i = 0; i < 9; i++) {
    const a = i / 9, b2 = (i + 1) / 9;
    add(pd(a), pd(b2), (u, t) => {
      if (i % 3 === 0) { const ang = t * 0.35 + i; return F([G[0] + Math.sin(ang) * 15, 4.5, G[1] - 2 + Math.cos(ang) * 15], [G[0], 1.3, G[1] - 2], 48); }
      if (i % 3 === 1) { const w = ['bruno', 'lola', 'chispa', 'tico'][i % 4]; const c = w === 'bruno' ? B(t) : w === 'lola' ? lolaC2(t)! : w === 'chispa' ? chispaC2(t)! : ticoC2(t); return F([c.x - 4, 2, c.z + 5], [c.x, 1.4, c.z], 42); }
      return F([G[0], 16 - 4 * u, G[1] + 10], [G[0], 0.5, G[1] - 2], 50);
    });
  }
  // G · ¿Qué suena?
  add(M.party1, M.dong + 1.6, (u, t) => { const b = B(t); return F(mix3([b.x + 5, 2.2, b.z - 1.5], [b.x + 4.6, 2.2, b.z - 1.8], u), [lerp(b.x, G[0], 0.6), 1.6, lerp(b.z, G[1], 0.6)], 42); });
  add(M.dong + 1.6, M.q0snd, (u) => F(mix3([G[0] - 10, 5, G[1] + 9], [G[0] - 9, 4.6, G[1] + 8], u), [G[0], 1, G[1] - 2], 48));
  const qcam: [V3, V3][] = [[[LOLA_D.x - 5, 3, LOLA_D.z + 4], [G[0] - 1, 1.5, G[1] - 2]], [[TICO_D.x + 4, 3, TICO_D.z + 6], [TICO_D.x - 1, 1.6, TICO_D.z + 1]], [[CH_D.x - 3.4, 1.1, CH_D.z + 2.3], [CH_D.x, 0.9, CH_D.z]], [[G[0] - 2.6, 1.1, G[1] + 2.6], [G[0], 1.0, G[1]]]];
  for (let q = 0; q < 4; q++) {
    add(M[`q${q}snd`] - 2.6, M[`q${q}rev`], (u) => F(mix3([G[0] - 11, 6.5, G[1] + 11], [G[0] - 10, 6, G[1] + 10], u), [G[0], 1, G[1] - 2], 48));
    const nxt = q < 3 ? M[`q${q + 1}snd`] - 2.6 : S('o2');
    add(M[`q${q}rev`], nxt, (u) => F(mix3(qcam[q][0], [qcam[q][0][0] + 0.3, qcam[q][0][1], qcam[q][0][2] - 0.5], u), qcam[q][1], 40));
  }
  // H · al vagón de Coco y al pueblo
  add(S('o2'), M.lift2a, (u) => F(mix3([COCO_STOP - 7, 2.4, RAIL_Z - 5], [COCO_STOP - 6.4, 2.4, RAIL_Z - 4.6], u), [COCO_STOP, 2.3, RAIL_Z], 40));
  add(M.lift2a, M.carry0 + 1.0, (u, t) => { const b = B(t); return F([b.x + 7, 2, b.z - 2], [b.x, 2, b.z - 3], 44); });
  const tr = M.load0 - 4.5, cm = (a: number) => M.carry0 + 1.0 + (tr - M.carry0 - 1.0) * a;
  add(M.carry0 + 1.0, cm(0.35), (u, t) => { const b = B(t); return follow(b.x, b.z, b.yaw, -9, 3, 2.2, 0, 1.6, 44); });
  add(cm(0.35), cm(0.7), (u, t) => { const b = B(t); return F([b.x + 16, 12, b.z + 6], [b.x, 1, b.z - 2], 46); });
  add(cm(0.7), tr, (u, t) => { const b = B(t); return F([b.x - 6, 1.6, b.z + 3], [b.x, 2, b.z - 2], 44); });
  add(tr, M.loaded + 1.4, (u) => F(mix3([RAILX + 7, 2.8, RAIL_Z - 4], [RAILX + 6.5, 2.6, RAIL_Z - 3.6], u), [RAILX, 2.0, RAIL_Z - 1.5], 44));
  add(M.loaded + 1.4, M.train0 + 1.5, () => F([RAILX - 2, 3, RAIL_Z + 9], [RAILX - 2, 1.8, RAIL_Z], 46));
  const ct = (t: number) => cocoX(t);
  add(M.train0 + 1.5, S('x4') - 0.3, (u, t) => { const x = ct(t); return F([x - 12, 3, RAIL_Z + 8], [x + 2, 1.8, RAIL_Z], 44); });
  add(S('x4') - 0.3, M.colors0, (u, t) => { const c = chispaC2(t)!; return F([c.x - 5, 1.5, c.z - 4], [c.x + 1, 1.4, lerp(c.z, RAIL_Z, 0.5)], 46); });
  for (let i = 0; i < 4; i++) {
    add(M[`col${i}`] - 0.3, i < 3 ? M[`col${i + 1}`] - 0.3 : M.train1 - 4, (u, t) => { const it = ITEM(i); void t; return F(mix3([it.x - 1.8, 1.5, it.z - 6.5], [it.x - 1.2, 1.5, it.z - 6.0], u), [it.x, it.y, it.z], 42); });
  }
  add(M.colors0, M.col0 - 0.3, (u, t) => { const x = ct(t); return F([x + 5, 14, RAIL_Z + 16], [x - 4, 1, RAIL_Z], 46); });
  add(M.train1 - 4, M.plaza0, (u, t) => { const x = ct(t); return F([STATION_X - 10, 3, RAIL_Z + 9], [x, 1.8, RAIL_Z], 46); });
  // la plaza y la torre
  add(M.plaza0, S('n30') + 3.0, (u) => F(mix3([12, 3, 20], [9, 4, 16], easeInOut(u)), [0, 4, 0], 46));
  add(S('n30') + 3.0, E('n30'), (u) => F(mix3([0, 7, 9], [0, 9.5, 8], easeInOut(u)), [0, 11 + 2 * u, 0], 42));
  add(E('n30'), S('l5'), (u, t) => { const b = B(t); return F(mix3([b.x + 1.5, 1.4, b.z + 4.5], [b.x + 1.2, 1.4, b.z + 4.0], u), [b.x, 1.8, b.z], 38); });
  add(S('l5'), S('b15'), () => F([PL.lola[0] - 2, 2.4, PL.lola[1] + 7], [PL.lola[0], 2, PL.lola[1]], 42));
  add(S('b15'), M.tracker, (u) => F(mix3([0, 3, 16], [0, 3.4, 14], u), [0, 3, 0], 50));
  add(M.tracker, M.plaza1, (u) => F(mix3([0, 9, 20], [0, 16, 26], u), [0, 8, 0], 48));
  // I · el gran salto
  add(M.jump0, S('n32'), (u, t) => { const c = chispaC2(t)!; return F([c.x + 3.5, 1.2, c.z + 3], [c.x, 0.9, c.z], 40); });
  add(S('n32'), M.cjump - 0.6, (u) => F([RAMP_X - 6, 1.0, JZ + 6], [RAMP_X, 0.8, JZ], 46));
  add(M.cjump - 0.6, M.cjump + 1.4, (u, t) => { const c = chispaC2(t)!; return F([PUD_X, 1.2, JZ + 12], [c.x, c.y ?? 0.8, c.z], 46); });
  add(M.cjump + 1.4, S('b16'), (u, t) => { const c = chispaC2(t)!; return F([c.x - 3, 1.3, c.z + 3.4], [c.x, 0.9, c.z], 40); });
  add(S('b16'), M.bjump - 1.0, (u, t) => { const b = B(t); return F([b.x + 4, 1.4, b.z + 4.4], [b.x, 1.4, b.z], 40); });
  add(M.bjump - 1.0, M.splash + 0.3, (u, t) => { const b = B(t); return F([PUD_X + 2, 1.0, JZ + 11], [b.x, (b.lift ?? 0) + 1.0, b.z], 46); });
  add(M.splash + 0.3, S('b17'), () => F([PUD_X + 7, 2.4, JZ + 4], [PUD_X, 1, JZ], 46));
  add(S('b17'), M.jump1, (u) => F(mix3([PUD_X + 4.8, 1.5, JZ + 1.4], [PUD_X + 4.2, 1.5, JZ + 1.2], u), [PUD_X, 1.3, JZ], 40));
  // J · repaso (las tomas siguen la línea remapeada) y pregunta
  add(S('n36') - 0.3, M.logo0, () => F([10, 6, 18], [0, 4, 0], 46));
  add(M.logo0, M.sp0, () => F([0, 30, 50], [0, 14, -40], 50));
  // avance: el mapa
  add(M.sp0, M.mapfall + 0.8, (u) => F(mix3([1.4, 2.8, 13.0], [1.6, 2.4, 12.2], u), [2.9, 0.7, 5.4], 44));
  add(M.mapfall + 0.8, S('b18'), (u) => F(mix3([3.1, 3.4, 7.6], [3.2, 3.0, 7.4], u), [BELL_P[0] + 0.9, 0.1, BELL_P[1] + 1.6], 42));
  add(S('b18'), 605, (u, t) => { const b = B(t); return F([3.9, 1.6, 3.6], [b.x, 1.5, b.z], 42 - 6 * u); });
  return sh;
}
// planos alternativos para el formato vertical (shorts)
function vshots(): Shot[] {
  const v: Shot[] = [];
  const add = (t0: number, t1: number, f: (u: number, t: number) => Cam) => { if (t1 > t0) v.push({t0, t1, f}); };
  const mid: V3 = [lerp(TICO_D.x, DIG[0], 0.5), 1.3, lerp(TICO_D.z, DIG[1], 0.5)];
  add(S('n4'), S('n5'), (u, t) => { const b = brunoC2(t); const dx = Math.sin(b.yaw), dz = Math.cos(b.yaw); return F([b.x + dx * 5.2 - dz * 0.6, 1.7, b.z + dz * 5.2 + dx * 0.6], [b.x, 1.5, b.z], 40); });
  add(S('n5'), E('n6') + 0.6, (u) => F(mix3([mid[0] + 6.2, 3.4, mid[2] + 8.6], [mid[0] + 5.8, 3.2, mid[2] + 8.0], u), mid, 42));
  return v;
}
let SH: Shot[] | null = null, VSH: Shot[] | null = null;
function camAt2(te: number, t: number, vert = false): Cam {
  SH = SH ?? shots(); VSH = VSH ?? vshots();
  if (vert) { const vs = VSH.find((x) => t >= x.t0 && t < x.t1); if (vs) return vs.f(clamp((t - vs.t0) / Math.max(1e-3, vs.t1 - vs.t0)), t); }
  const tt = t >= S('n35') && t < E('n35') ? te : t; // en el repaso las tomas usan el tiempo remapeado
  const s = [...SH].reverse().find((x) => tt >= x.t0 && tt < x.t1) ?? SH[0];
  const c = s.f(clamp((tt - s.t0) / Math.max(1e-3, s.t1 - s.t0)), tt);
  const punches = [S('t1'), M.garage0, M.green, M.go2, M.hooked, M.slip, M.lolaRev, M.cocoRev, M.chispaRev, M.lift0 + 2.4, M.wash1, M.dong, M.q0rev, M.q1rev, M.q2rev, M.q3rev, M.loaded, M.col0rev, M.col1rev, M.col2rev, M.col3rev, M.cheer, M.splash, M.mapopen];
  let fov = c.fov;
  for (const pt of punches) { const d = t - pt; if (d > 0 && d < 0.4) fov *= 1 - 0.07 * Math.sin((d / 0.4) * Math.PI); }
  const sk = 0.06 * damped(t - M.splash, 8, 6) + 0.05 * damped(t - (M.lift0 + 2.3), 7, 6) + 0.04 * damped(t - M.dong, 9, 7) + strainK(t) * 0.02 * Math.sin(t * 50);
  return {pos: [c.pos[0], c.pos[1] + sk, c.pos[2]], at: c.at, fov};
}

// ---------------------------------------------------------------- objetos del juego de colores (junto a la vía, delante del tren)
const ITEMS = ['coche_rojo', 'autobus', 'taxi', 'arbol_redondo_a'];
const ITEM_CAMS = () => [0, 1, 2, 3].flatMap((i) => { const it = ITEM(i); return [[it.x - 1.5, it.z - 6.2], [it.x, it.z]] as [number, number][]; });
function ITEM(i: number) {
  const x = cocoX(M[`col${i}`] + 1.2) - 1;
  return {x, z: RAIL_Z - 7.5, y: i === 3 ? 2.6 : i === 1 ? 1.8 : 1.0, m: ITEMS[i]};
}

// ---------------------------------------------------------------- luz y cielo
export const VF = (fov: number, vert: boolean) => (vert ? (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * 1.75) * 180) / Math.PI : fov);
const Rig: React.FC<{c: Cam; lib: Lib; vert: boolean}> = ({c, lib, vert}) => {
  const {camera, scene} = useThree();
  camera.position.set(...c.pos); camera.lookAt(...c.at);
  const pc = camera as THREE.PerspectiveCamera; pc.fov = VF(c.fov, vert); pc.near = 0.1; pc.far = 1400; pc.updateProjectionMatrix();
  scene.background = lib.sky; scene.environment = lib.sky;
  (scene as any).backgroundIntensity = 1.0; (scene as any).environmentIntensity = 0.55;
  (scene as any).backgroundRotation = new THREE.Euler(0, 1.2, 0); (scene as any).environmentRotation = new THREE.Euler(0, 1.2, 0);
  scene.fog = new THREE.Fog('#dcecfa', 170, 620);
  applyNight(0);
  return null;
};
const Lights: React.FC<{c: Cam}> = ({c}) => {
  const {gl} = useThree();
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  const l = useMemo(() => { const d = new THREE.DirectionalLight('#fff1dc', 2.9); d.castShadow = true; d.shadow.mapSize.set(4096, 4096); d.shadow.bias = -0.00025; d.shadow.normalBias = 0.035; d.shadow.radius = 3; return d; }, []);
  const dist = Math.hypot(c.pos[0] - c.at[0], c.pos[1] - c.at[1], c.pos[2] - c.at[2]);
  const ext = clamp(dist * 1.1, 30, 150);
  const sc = l.shadow.camera as THREE.OrthographicCamera;
  if (sc.right !== ext) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 420; sc.updateProjectionMatrix(); }
  const step = (2 * ext) / 4096;
  const fx = Math.round((c.at[0] + (c.pos[0] - c.at[0]) * 0.25) / step) * step, fz = Math.round((c.at[2] + (c.pos[2] - c.at[2]) * 0.25) / step) * step;
  l.position.set(fx + 52, 88, fz + 46); l.target.position.set(fx, 0, fz);
  return (<><primitive object={l} /><primitive object={l.target} /><hemisphereLight args={['#d8f0ff', '#8fd16a', 0.55]} /></>);
};

// ---------------------------------------------------------------- piezas 3D
const BellMesh: React.FC<{lib: Lib; b: Bell}> = ({lib, b}) => {
  const a = lib.assets.campana_gigante;
  const mats = useMemo(() => {
    if (!a) return [] as THREE.MeshStandardMaterial[];
    return a.parts.map((p) => { const m = (p.mat as THREE.MeshStandardMaterial).clone(); m.userData.c0 = m.color.clone(); m.userData.r0 = m.roughness; m.userData.m0 = m.metalness; return m; });
  }, [a]);
  if (!a) return null;
  const mud = b.mud, mudC = new THREE.Color('#6b4a2b');
  mats.forEach((m) => { m.color.copy(m.userData.c0).lerp(mudC, mud * 0.85); m.roughness = lerp(m.userData.r0, 0.95, mud); m.metalness = lerp(m.userData.m0, 0.05, mud); m.emissive.set('#ffcc55'); m.emissiveIntensity = b.shine * 0.08; });
  const hangPivot = b.hang;
  return (
    <group position={[b.x, b.y + (hangPivot ? CROWN : 0), b.z]} rotation={[b.rx, 0, b.rz]}>
      <group position={[0, hangPivot ? -CROWN : 0, 0]}>
        {a.parts.map((p, i) => <mesh key={i} geometry={p.geo} material={mats[i]} castShadow receiveShadow />)}
      </group>
    </group>
  );
};
const Cable: React.FC<{a: V3; b: V3}> = ({a, b}) => {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = d.length(); if (len < 0.02) return null;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return (
    <group>
      <mesh position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]} quaternion={q} castShadow><cylinderGeometry args={[0.035, 0.035, len, 8]} /><meshStandardMaterial color="#3a3f4a" roughness={0.5} metalness={0.4} /></mesh>
      <mesh position={b} rotation={[Math.PI / 2, 0, 0]} castShadow><torusGeometry args={[0.12, 0.035, 8, 16]} /><meshStandardMaterial color="#c9d1dc" metalness={0.8} roughness={0.25} /></mesh>
    </group>
  );
};
const Hole: React.FC<{t: number}> = ({t}) => {
  const glow = (t < M.hooked ? 1 : t < M.lift0 ? 0.35 : 0.35 * (1 - prog(t, M.lift0, M.lift0 + 2.5))) * (t < M.garage0 + 2 ? 1 : 0.7);
  const wet = prog(t, M.spray0 + 0.6, M.spray1);
  return (
    <group position={[DIG[0], 0, DIG[1]]}>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[2.6, 40]} /><meshStandardMaterial color={new THREE.Color('#2a1c0e').lerp(new THREE.Color('#1a1008'), wet)} roughness={1 - 0.7 * wet} /></mesh>
      <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.6, 3.7, 40]} /><meshStandardMaterial color={new THREE.Color('#8a6a3c').lerp(new THREE.Color('#5a4024'), wet)} roughness={1 - 0.6 * wet} /></mesh>
      {glow > 0.02 ? Array.from({length: 8}).map((_, i) => { const a = (i / 8) * Math.PI * 2 + t * 0.3; return <mesh key={i} position={[Math.cos(a) * 0.6, 3, Math.sin(a) * 0.6]} rotation={[Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25]}><cylinderGeometry args={[0.05, 0.6, 6, 8, 1, true]} /><meshBasicMaterial color="#ffe27a" transparent opacity={(0.2 + 0.08 * Math.sin(t * 5 + i)) * glow} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} /></mesh>; }) : null}
      {glow > 0.02 ? <pointLight position={[0, 1.2, 0]} color="#ffd36b" intensity={50 * glow} distance={16} decay={2} /> : null}
      {Array.from({length: 7}).map((_, i) => <mesh key={i} position={[Math.cos(i * 0.9 + 2.2) * 4.9, 0.18, Math.sin(i * 0.9 + 2.2) * 4.9]} scale={[1, 0.42, 1]} castShadow receiveShadow><sphereGeometry args={[0.55 + hash(i) * 0.35, 14, 10]} /><meshStandardMaterial color="#9a7444" roughness={1} /></mesh>)}
    </group>
  );
};
// terrones que salen con cada palada
const Dirt: React.FC<{t: number; times: number[]; c: V3; col?: string; big?: number}> = ({t, times, c, col = '#8a6238', big = 1}) => (
  <group>
    {times.map((t0, k) => {
      const d = t - t0; if (d < 0 || d > 1.2) return null;
      return Array.from({length: 10}).map((_, i) => {
        const a = hash(i + k * 13) * Math.PI * 2, v = (2 + hash(i + 3) * 2.5) * big, vy = (3 + hash(i + 7) * 3) * big;
        const y = c[1] + vy * d - 4.9 * d * d; if (y < -0.2) return null;
        return <mesh key={`${k}_${i}`} position={[c[0] + Math.cos(a) * v * d, y, c[2] + Math.sin(a) * v * d]} rotation={[d * 8 + i, d * 6, i]} scale={(0.14 + hash(i + 11) * 0.16) * big} castShadow><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={col} roughness={1} /></mesh>;
      });
    })}
  </group>
);
// chorro de agua de Lola (parábola de gotas)
const Water: React.FC<{t: number; on: boolean; from: V3; to: V3}> = ({t, on, from, to}) => {
  if (!on) return null;
  const n = 46;
  return (
    <group>
      {Array.from({length: n}).map((_, i) => {
        const u = ((t * 1.6 + i / n) % 1);
        const x = lerp(from[0], to[0], u), z = lerp(from[2], to[2], u), y = lerp(from[1], to[1], u) + Math.sin(u * Math.PI) * 1.6;
        const s = 0.12 + 0.1 * Math.sin(i * 1.7) + u * 0.08;
        return <mesh key={i} position={[x + Math.sin(i * 3.1) * 0.08, y, z + Math.cos(i * 2.3) * 0.08]} scale={s}><sphereGeometry args={[1, 10, 8]} /><meshPhysicalMaterial color="#9fdcff" transparent opacity={0.8} roughness={0.05} clearcoat={1} /></mesh>;
      })}
      {Array.from({length: 12}).map((_, i) => { const q = ((t * 2.2 + i / 12) % 1); const a = hash(i) * 6.28; return <mesh key={'s' + i} position={[to[0] + Math.cos(a) * q * 1.6, to[1] + Math.sin(q * Math.PI) * 0.9, to[2] + Math.sin(a) * q * 1.6]} scale={0.1 + 0.08 * (1 - q)}><sphereGeometry args={[1, 8, 6]} /><meshPhysicalMaterial color="#cfeeff" transparent opacity={0.85 * (1 - q)} roughness={0.05} /></mesh>; })}
    </group>
  );
};
// ondas de sonido de la campana
const Rings: React.FC<{t: number; t0: number; c: V3; col?: string}> = ({t, t0, c, col = '#ffe27a'}) => {
  const d = t - t0; if (d < 0 || d > 1.8) return null;
  return <group>{[0, 0.3, 0.6].map((o, i) => { const q = (d - o) / 1.2; if (q < 0 || q > 1) return null; return <mesh key={i} position={c} rotation={[Math.PI / 2, 0, 0]} scale={0.8 + q * 4}><torusGeometry args={[1, 0.04, 8, 48]} /><meshBasicMaterial color={col} transparent opacity={1 - q} toneMapped={false} /></mesh>; })}</group>;
};
const Ramp: React.FC = () => (
  <group position={[RAMP_X - 2, 0, JZ]}>
    <mesh position={[0, 0.42, 0]} rotation={[0, 0, Math.atan2(0.9, 4)]} castShadow receiveShadow><boxGeometry args={[4.3, 0.2, 5.4]} /><meshStandardMaterial color="#b5844a" roughness={0.9} /></mesh>
    <mesh position={[1.6, 0.3, 0]} castShadow receiveShadow><boxGeometry args={[0.8, 0.6, 5.2]} /><meshStandardMaterial color="#8a6238" roughness={1} /></mesh>
    {[-2.9, 2.9].map((z) => <group key={z} position={[2.0, 0, z]}><mesh position={[0, 0.9, 0]} castShadow><cylinderGeometry args={[0.07, 0.07, 1.8, 8]} /><meshStandardMaterial color="#ffffff" /></mesh><mesh position={[0, 1.75, 0]}><boxGeometry args={[0.1, 0.4, 0.9]} /><meshStandardMaterial color={z > 0 ? '#ff3b30' : '#ffd23f'} /></mesh></group>)}
  </group>
);
const Splash: React.FC<{t: number; t0: number; c: V3; big?: number}> = ({t, t0, c, big = 1}) => {
  const d = t - t0; if (d < 0 || d > 1.6) return null;
  return (
    <group>
      {Array.from({length: 34}).map((_, i) => {
        const a = hash(i) * Math.PI * 2, v = (3 + hash(i + 2) * 4) * big, vy = (4 + hash(i + 5) * 5) * big;
        const y = c[1] + vy * d - 6 * d * d; if (y < 0) return null;
        return <mesh key={i} position={[c[0] + Math.cos(a) * v * d, y, c[2] + Math.sin(a) * v * d]} scale={(0.16 + hash(i + 9) * 0.2) * big}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color={i % 4 === 0 ? '#9a7444' : '#6b4a2b'} roughness={0.4} /></mesh>;
      })}
    </group>
  );
};
const TrafficLight: React.FC<{t: number}> = ({t}) => {
  const green = t > M.green, k = t > M.light0 - 3 && t < M.go1 + 4;
  if (!k) return null;
  return (
    <group position={LIGHT} rotation={[0, -Math.PI / 2, 0]}>
      <mesh position={[0, 1.8, 0]} castShadow><cylinderGeometry args={[0.1, 0.12, 3.6, 12]} /><meshStandardMaterial color="#2f3b57" /></mesh>
      <mesh position={[0, 3.9, 0]} castShadow><boxGeometry args={[0.7, 1.9, 0.6]} /><meshStandardMaterial color="#2f3b57" roughness={0.5} /></mesh>
      {[['#ff3b30', 4.45, !green], ['#ffd23f', 3.9, false], ['#39c47a', 3.35, green]].map(([c, y, on], i) => (
        <mesh key={i} position={[0, y as number, 0.31]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.22, 0.22, 0.06, 20]} /><meshStandardMaterial color={on ? (c as string) : '#333844'} emissive={c as string} emissiveIntensity={on ? 2.2 : 0} toneMapped={!on} /></mesh>
      ))}
    </group>
  );
};
const MapRoll: React.FC<{lib: Lib; t: number}> = ({lib, t}) => {
  if (t < M.mapfall) return null;
  const u = prog(t, M.mapfall, M.mapfall + 0.9);
  const x = BELL_P[0] + lerp(0, 0.9, u), z = BELL_P[1] + lerp(0.2, 1.7, u), y = Math.max(0, 0.9 - 4.9 * Math.pow(u * 0.9, 2)) + Math.abs(damped(t - M.mapfall - 0.45, 2.5, 4)) * 0.25;
  return <ScriptCar lib={lib} m="mapa" x={x} z={z} yaw={0.4 + u * 2} y={y} roll={0} />;
};

const Scene2: React.FC<{te: number; lib: Lib}> = ({te, lib}) => {
  const bp = brunoC2(te), tp = ticoC2(te), lp = lolaC2(te), op = cocoC2(te), cp = chispaC2(te);
  const bell = bellC2(te, bp);
  const hk = bell.hook;
  const atDig = te < M.carry0 + 2;
  const lolaNoz: V3 | null = lp ? [lp.x + Math.sin(lp.yaw) * 1.4, 3.4, lp.z + Math.cos(lp.yaw) * 1.4] : null;
  const sprayTo: V3 = te < M.wash0 - 1 ? [DIG[0], 0.3, DIG[1]] : [G[0], 1.2, G[1]];
  const spraying = !!lp && ((te > M.spray0 + 0.4 && te < M.spray1) || (te > M.wash0 + 0.2 && te < M.wash1 - 0.3) || (te > M.q0snd && te < M.q0rev + 0.9));
  const tipT: V3 = [tp.x + Math.sin(tp.yaw) * 3.4, 0.3, tp.z + Math.cos(tp.yaw) * 3.4];
  return (
    <group>
      <BrunoGLB lib={lib} p={bp} />
      <Char lib={lib} m="tico" p={tp} />
      {lp ? <Char lib={lib} m="lola" p={lp} /> : null}
      {cp ? <Char lib={lib} m="chispa" p={cp} /> : null}
      {op ? <group><Char lib={lib} m="coco" p={op} /><Char lib={lib} m="vagon_plano" p={{x: op.x + 4.3, z: RAIL_Z, yaw: -Math.PI / 2, y: 0.24, dist: op.dist}} /><Char lib={lib} m="vagon_b" p={{x: op.x + 8.2, z: RAIL_Z, yaw: -Math.PI / 2, y: 0.24, dist: op.dist}} /></group> : null}
      <BellMesh lib={lib} b={bell} />
      {hk && bell.cable > 0.05 ? <Cable a={[hk[0], hk[1] - 0.25, hk[2]]} b={[hk[0], hk[1] - 0.25 - bell.cable + 0.12, hk[2]]} /> : null}
      {atDig ? <Hole t={te} /> : null}
      <ScriptCar lib={lib} m="torre_reloj" x={0} z={0} yaw={0} />
      {te < M.exit0 + 1 ? <pointLight position={[20, 3.6, -10.0]} color="#ffe2b0" intensity={45} distance={14} decay={2} /> : null}
      {te > M.jump0 - 2 && te < M.jump1 + 1 ? <Ramp /> : null}
      <TrafficLight t={te} />
      {te > M.train0 && te < M.train1 ? [0, 1, 2, 3].map((i) => { const it = ITEM(i); return <ScriptCar key={i} lib={lib} m={it.m} x={it.x} z={it.z} yaw={-Math.PI / 2 + (i === 3 ? 1 : 0)} />; }) : null}
      <MapRoll lib={lib} t={te} />
      {/* efectos */}
      <Water t={te} on={spraying && !!lolaNoz} from={lolaNoz ?? [0, 0, 0]} to={sprayTo} />
      <Dirt t={te} times={DIGT().filter((x) => x < M.party0 || x > M.q1snd - 1)} c={tipT} />
      <Dirt t={te} times={[M.lift0 + 0.3, M.lift0 + 0.9]} c={[DIG[0], 0.4, DIG[1]]} big={1.5} col="#6b4a2b" />
      {TUGS().map((g, i) => <Puffs key={i} t={te} t0={g} c={[BR_PULL.x, 0, BR_PULL.z + 1.6]} r={1.2} n={8} dur={1.0} />)}
      <Sparkles t={te} t0={S('b3') + 0.2} c={[DIG[0], 0.8, DIG[1]]} n={20} tint="#ffe27a" spread={2.5} />
      <Sparkles t={te} t0={M.lift0 + 2.3} c={[DIG[0], 2.0, DIG[1]]} n={30} tint="#ffe27a" spread={4} dur={1.6} />
      <Confetti t={te} t0={M.lift0 + 2.6} c={[DIG[0] - 2, 0, DIG[1] + 2]} />
      <Sparkles t={te} t0={M.wash1 - 0.6} c={[G[0], 1.2, G[1]]} n={30} tint="#fff1a8" spread={3} dur={1.8} />
      <Sparkles t={te} t0={S('n21') + 0.4} c={[G[0], 1.4, G[1]]} n={20} tint="#ffd23f" spread={2.5} />
      {te > M.wash0 && te < M.wash1 ? Array.from({length: 16}).map((_, i) => { const q = ((te * 0.6 + i / 16) % 1); const a = hash(i) * 6.28; return <mesh key={i} position={[G[0] + Math.cos(a) * (0.9 + q), 0.3 + q * 2.6, G[1] + Math.sin(a) * (0.9 + q)]} scale={0.12 + 0.12 * hash(i + 2)}><sphereGeometry args={[1, 12, 10]} /><meshPhysicalMaterial color="#ffffff" transparent opacity={0.8 * (1 - q)} roughness={0.1} clearcoat={1} /></mesh>; }) : null}
      <Confetti t={te} t0={M.party0 + 0.4} c={[G[0], 0, G[1]]} />
      <Confetti t={te} t0={M.free0 + 4} c={[G[0] - 3, 0, G[1] + 2]} />
      <Confetti t={te} t0={M.free0 + 12} c={[G[0] + 2, 0, G[1] - 3]} />
      {[M.dong, M.q3snd, M.q3rev].map((d, i) => <Rings key={i} t={te} t0={d} c={[G[0], 1.0, G[1]]} />)}
      <Puffs t={te} t0={M.loaded} c={[RAILX, DECK, RAIL_Z]} r={1.0} n={10} />
      <Sparkles t={te} t0={M.loaded + 0.1} c={[RAILX, DECK + 1, RAIL_Z]} n={18} tint="#ffe27a" />
      {[0, 1, 2, 3].map((i) => { const it = ITEM(i); return <Sparkles key={i} t={te} t0={M[`col${i}rev`]} c={[it.x, it.y + 0.6, it.z]} n={18} spread={2.5} />; })}
      <Confetti t={te} t0={M.cheer + 0.1} c={[0, 0, 5]} />
      <Sparkles t={te} t0={M.tracker} c={[0, 13, 0]} n={26} tint="#ffd23f" spread={4} dur={1.6} />
      <Splash t={te} t0={M.splash} c={[PUD_X, 0.3, JZ]} big={1.3} />
      <Puffs t={te} t0={M.splash} c={[PUD_X, 0, JZ]} r={2.5} n={12} big={1.2} />
      <Puffs t={te} t0={M.cjump + 1.3} c={[PUD_X + 10.5, 0, JZ]} r={1} n={8} />
      <Puffs t={te} t0={M.green} c={[LIGHT[0] + 3, 0, L]} r={1.2} n={6} />
      <Puffs t={te} t0={M.go2 + 1.6} c={[70 + L, 0, -43.5]} r={1.5} n={10} />
      <Sparkles t={te} t0={M.mapfall + 0.9} c={[BELL_P[0] + 0.9, 0.5, BELL_P[1] + 1.7]} n={14} tint="#fff1a8" spread={1.6} />
      {te > M.cocoIn - 1 && te < M.train1 && op ? Array.from({length: 10}).map((_, i) => { const q = ((te * 0.8 + i * 0.25) % 2.5); return <mesh key={i} position={[op.x + 1.3 + q * 2.2, 3.6 + q * 1.6, RAIL_Z]} scale={0.35 + q * 0.5}><sphereGeometry args={[1, 12, 10]} /><meshStandardMaterial color="#ffffff" transparent opacity={0.85 * (1 - q / 2.5)} roughness={1} /></mesh>; }) : null}
    </group>
  );
};

// ---------------------------------------------------------------- capa 2D
const font = '"Lilita One", sans-serif';
const popk = (t: number, a: number, b: number, inD = 0.25, outD = 0.2) => easeOutBack(prog(t, a, a + inD), 2.4) * (1 - easeInOut(prog(t, b - outD, b)));
const Overlay2: React.FC<{t: number; W: number; vert: boolean}> = ({t, W, vert}) => {
  const u = W / 1920;
  const st = (c: string, px: number) => ({WebkitTextStroke: `${px * u}px ${c}`, paintOrder: 'stroke fill' as any});
  const burst = (k: number, txt: string, col: string, x: number, y: number, size0: number, rot = -6) => { const size = vert ? Math.min(size0, 1250 / (txt.length * 0.6)) : size0; return k > 0.01 ? (
    <div style={{position: 'absolute', left: (vert ? clamp(x, 300, 1620) : x) * u, top: y * u, transform: `translate(-50%,-50%) scale(${k}) rotate(${rot + Math.sin(t * 9) * 2}deg)`, fontFamily: font, fontSize: size * u, color: col, ...st('#ffffff', 22), textShadow: `0 ${10 * u}px 0 rgba(40,20,60,0.35)`, whiteSpace: 'nowrap'}}>{txt}</div>
  ) : null; };
  const name = (k: number, txt: string, col: string) => k > 0.01 ? (
    <div style={{position: 'absolute', left: (vert ? 220 : 70) * u, bottom: (vert ? 420 : 90) * u, transform: `translateX(${(1 - k) * -700 * u}px) rotate(-3deg)`, background: col, borderRadius: 30 * u, padding: `${10 * u}px ${46 * u}px`, fontFamily: font, fontSize: 110 * u, color: '#fff', boxShadow: `0 ${10 * u}px 0 rgba(0,0,0,0.2)`, border: `${8 * u}px solid #fff`}}>{txt}</div>
  ) : null;
  const title = (a: number, b: number, txt: string, sub: string, col: string) => { const k = popk(t, a, b); return k > 0.01 ? (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{transform: `scale(${k}) rotate(${Math.sin(t * 4) * 2}deg)`, textAlign: 'center'}}>
        <div style={{fontFamily: font, fontSize: 70 * u, color: '#fff', ...st('#2b2350', 14)}}>{sub}</div>
        <div style={{fontFamily: font, fontSize: 190 * u, color: col, ...st('#ffffff', 26), textShadow: `0 ${14 * u}px 0 rgba(43,35,80,0.35)`}}>{txt}</div>
      </div>
    </AbsoluteFill>) : null; };
  const LOGO = 'Pueblo Brum', cols = ['#ff8a1f', '#ffd23f', '#3d8bff', '#ff5f7e', '#39c47a', '#c56bff'];
  const logo = (k: number, size: number, top: number) => (
    <div style={{position: 'absolute', top: top * u, width: '100%', textAlign: 'center', fontFamily: font, fontSize: size * u, transform: `scale(${k})`}}>
      {LOGO.split('').map((ch, i) => <span key={i} style={{display: 'inline-block', color: cols[i % 6], ...st('#ffffff', 22), textShadow: `0 ${12 * u}px 0 rgba(43,35,80,0.35)`, transform: `translateY(${Math.sin(t * 5 + i) * 12 * u}px)`, width: ch === ' ' ? 60 * u : undefined}}>{ch}</span>)}
    </div>
  );
  // ¿Quién es? tarjetas con silueta
  const card = (who: string, q: number, rev: number, out: number, col: string, label: string) => {
    const k = popk(t, q, out); if (k < 0.01) return null;
    const shown = t > rev; const flip = easeOutBack(prog(t, rev, rev + 0.35), 2);
    return (
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', background: `rgba(20,24,60,${0.35 * k})`}}>
        <div style={{width: 900 * u, height: 640 * u, borderRadius: 60 * u, background: shown ? col : '#ffd23f', border: `${16 * u}px solid #fff`, transform: `scale(${k}) rotate(${-2 + Math.sin(t * 3) * 1.5}deg)`, boxShadow: `0 ${18 * u}px 0 rgba(0,0,0,0.25)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative'}}>
          <Img src={staticFile(`c2/sil_${who}.png`)} style={{height: 420 * u, filter: shown ? 'none' : 'brightness(0)', transform: `scale(${shown ? 0.9 + 0.1 * flip : 1 + 0.03 * Math.sin(t * 6)})`}} />
          <div style={{fontFamily: font, fontSize: 110 * u, color: '#fff', ...st('#2b2350', 14), marginTop: -10 * u}}>{shown ? label : '¿?'}</div>
          {!shown ? <div style={{position: 'absolute', right: 40 * u, top: 20 * u, fontFamily: font, fontSize: 200 * u, color: '#ff5f9a', ...st('#ffffff', 18), transform: `rotate(${12 + Math.sin(t * 7) * 8}deg)`}}>?</div> : null}
        </div>
      </AbsoluteFill>
    );
  };
  const speaker = (a: number, b: number) => t > a - 0.1 && t < b ? <div style={{position: 'absolute', left: 860 * u, top: 330 * u, width: 200 * u, height: 200 * u, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 120 * u, transform: `scale(${1 + 0.08 * Math.sin(t * 14)})`, boxShadow: `0 0 0 ${(14 + 10 * Math.abs(Math.sin(t * 7))) * u}px rgba(197,107,255,0.45)`}}>🔊</div> : null;
  const recap = t > M.recap0 && t < M.recap1;
  const rd = (M.recap1 - M.recap0) / 3, fps = 60;
  const flash = t > S('n35') && t < E('n35');
  const trk = popk(t, M.tracker, M.plaza1);
  const mp = popk(t, M.mapopen, 610);
  const colW = ['¡ROJO!', '¡AZUL!', '¡AMARILLO!', '¡VERDE!'], colC = ['#ff3b30', '#3d8bff', '#ffd23f', '#39c47a'];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 62%, rgba(30,20,60,0.2) 100%)'}} />
      {/* gancho */}
      {burst(popk(t, S('t1') + 1.6, M.garage0 + 0.2), '¡ES ENORME!', '#ffd23f', 960, 200, 170)}
      {burst(popk(t, 0.3, M.garage0), '?', '#ff5f9a', 1500, 300, 260, 8)}
      {burst(popk(t, S('b1'), E('b1') + 0.4), '¿QUÉ SERÁ?', '#ff8a1f', 960, 210, 150)}
      {/* título */}
      {t > M.title0 && t < M.title1 + 0.4 ? (
        <AbsoluteFill style={{background: `rgba(20,24,60,${0.25 * popk(t, M.title0, M.title1 + 0.4)})`}}>
          {logo(popk(t, M.title0, M.title1 + 0.4), 210, 250)}
          <div style={{position: 'absolute', top: 560 * u, width: '100%', textAlign: 'center', transform: `scale(${popk(t, M.title0 + 0.5, M.title1 + 0.4)})`}}>
            <div style={{fontFamily: font, fontSize: 64 * u, color: '#fff', ...st('#2b2350', 12)}}>CAPÍTULO 2</div>
            <div style={{fontFamily: font, fontSize: 130 * u, color: '#ffd23f', ...st('#ffffff', 20), textShadow: `0 ${12 * u}px 0 rgba(43,35,80,0.35)`}}>¡La campana gigante!</div>
          </div>
        </AbsoluteFill>
      ) : null}
      {name(popk(t, S('b2') + 0.4, E('b2') + 0.6), 'BRUNO', '#ff8a1f')}
      {/* recuerdos */}
      {recap && !vert ? (
        <AbsoluteFill style={{background: '#1c2240'}}>
          {['a', 'b', 'c'].map((c, i) => (
            <Sequence key={c} from={Math.round((M.recap0 + i * rd) * fps)} durationInFrames={Math.round(rd * fps) + 1} layout="none">
              <AbsoluteFill style={{padding: 70 * u}}><OffthreadVideo src={staticFile(`c2/clip_${c}.mp4`)} muted style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: 50 * u, border: `${14 * u}px solid #fff`}} /></AbsoluteFill>
            </Sequence>
          ))}
          <div style={{position: 'absolute', top: 30 * u, left: 90 * u, fontFamily: font, fontSize: 80 * u, color: '#ffd23f', ...st('#2b2350', 12)}}>EN EL CAPÍTULO ANTERIOR...</div>
        </AbsoluteFill>
      ) : null}
      {/* viaje */}
      {burst(popk(t, M.red, M.green), '¡ALTO!', '#ff3b30', 1350, 220, 170, 6)}
      {t > M.red - 0.1 && t < M.go1 + 1.2 ? (
        <div style={{position: 'absolute', left: 120 * u, top: 120 * u, width: 190 * u, padding: 22 * u, background: '#2f3b57', borderRadius: 50 * u, border: `${10 * u}px solid #fff`, transform: `scale(${popk(t, M.red - 0.1, M.go1 + 1.2)}) rotate(-4deg)`, boxShadow: `0 ${12 * u}px 0 rgba(0,0,0,0.25)`}}>
          {['#ff3b30', '#ffd23f', '#39c47a'].map((c, i) => { const on = (i === 0 && t < M.green) || (i === 2 && t >= M.green); return <div key={i} style={{width: 140 * u, height: 140 * u, margin: `${8 * u}px auto`, borderRadius: '50%', background: on ? c : '#4a5470', boxShadow: on ? `0 0 ${40 * u}px ${c}` : 'none'}} />; })}
        </div>
      ) : null}
      {burst(popk(t, S('n49'), S('n49') + 1.6), '¡ADELANTE!', '#39c47a', 960, 220, 170)}
      {burst(popk(t, M.lookL, M.lookR), '👀 ⬅', '#3d8bff', 960, 220, 150, 0)}
      {burst(popk(t, M.lookR, M.go2), '➡ 👀', '#3d8bff', 960, 220, 150, 0)}
      {burst(popk(t, M.go2 + 1.4, M.go2 + 2.8), '¡HOP!', '#ffd23f', 1300, 260, 160, 8)}
      {/* obras */}
      {name(popk(t, S('t2'), E('t2') + 0.6), 'TICO', '#e0a810')}
      {burst(popk(t, S('n4') + 0.9, S('n4') + 2.4), '🍲 ?', '#ff8a1f', 650, 260, 170, -8)}
      {burst(popk(t, S('n4') + 2.6, E('n4') + 0.6), '🎩 ?', '#c56bff', 1270, 260, 170, 8)}
      {title(S('n5') - 0.1, M.dig1 + 0.1, '¡CONTAMOS!', 'paladas', '#e0a810')}
      {[1, 2, 3, 4, 5].map((i) => <React.Fragment key={i}>{burst(popk(t, S(`k${i}`), S(`k${i}`) + 1.1), String(i), ['#ff3b3b', '#3d8bff', '#ffd23f', '#39c47a', '#ff7ad1'][i - 1], 300 + (i - 1) * 330, 230, 230, 0)}</React.Fragment>)}
      {burst(popk(t, S('n6'), E('n6') + 0.3), '¡5 PALADAS!', '#e0a810', 960, 220, 170)}
      {burst(popk(t, M.hooked - 0.4, M.hooked + 1.0), '¡ENGANCHADO!', '#3d8bff', 960, 210, 140)}
      {[M.tug1, M.tug2, M.tug3].map((g, i) => <React.Fragment key={i}>{burst(popk(t, g, g + 0.9), '¡TIRA!', '#ff8a1f', [700, 1220, 960][i], [250, 250, 200][i], 160, [-8, 8, 0][i])}</React.Fragment>)}
      {burst(popk(t, M.slip, M.slip + 1.4), '¡NO SALE!', '#ff3b30', 960, 220, 170)}
      {burst(popk(t, M.honk, M.honk + 1.6), '¡PI, PI!', '#ffd23f', 1350, 230, 170, 8)}
      {/* ¿Quién es? */}
      {title(M.quien0, M.lolaQ + 0.2, '¿QUIÉN ES?', 'juego', '#3d8bff')}
      {card('lola', M.lolaQ + 0.2, M.lolaRev, M.lolaIn + 0.6, '#ff3b30', '¡LOLA!')}
      {card('coco', M.cocoQ + 0.2, M.cocoRev, M.cocoIn + 0.6, '#2fbf5a', '¡COCO!')}
      {card('chispa', M.chispaQ + 0.2, M.chispaRev, M.chispaIn + 0.6, '#3d8bff', '¡CHISPA!')}
      {burst(popk(t, S('l1') + 0.1, S('l1') + 1.6), '¡NII-NOO!', '#ff3b30', 1350, 220, 150, 8)}
      {burst(popk(t, S('o1') + 0.1, S('o1') + 1.6), '¡CHU-CHUUU!', '#39c47a', 1300, 220, 150, 8)}
      {burst(popk(t, M.chispaIn + 0.4, M.chispaIn + 1.6), '¡ZUUUM!', '#3d8bff', 1300, 250, 160, -8)}
      {/* todos juntos */}
      {burst(popk(t, S('l2') + 0.3, S('l2') + 2.2), '¡SPLASH!', '#3daaff', 1300, 230, 170, 8)}
      {burst(popk(t, S('n18') + 0.6, E('n18') + 0.4), '¡TODOS JUNTOS!', '#ff5f9a', 960, 210, 160)}
      {[['1', 'one'], ['2', 'two'], ['3', 'three']].map(([n, k], i) => <React.Fragment key={k}>{burst(popk(t, M[k], M[k] + 1.0), n, ['#ff5f7e', '#ffd23f', '#39c47a'][i], 520 + i * 440, 330, 280, 0)}</React.Fragment>)}
      {burst(popk(t, S('b10'), S('b10') + 1.8), '¡ARRIBAAA!', '#ff8a1f', 960, 200, 200)}
      {burst(popk(t, S('n19') + 1.4, E('n19') + 0.6), '¡UNA CAMPANA GIGANTE!', '#ffd23f', 960, 200, 130)}
      {burst(popk(t, S('b11') + 2.0, E('b11') + 0.8), '¡JUNTOS SÍ PODEMOS!', '#ff5f9a', 960, 200, 120)}
      {burst(popk(t, S('n21') + 0.8, E('n21') + 0.5), '¡DORADA!', '#ffd23f', 960, 210, 190)}
      {title(M.party0 + 1.0, M.up0, '¡FIESTA!', 'de la campana', '#ff5f9a')}
      {[0, 1].map((r) => <React.Fragment key={r}>{burst(popk(t, M[`up${r}`], M[`up${r}`] + 1.0), '¡ARRIBA!', '#39c47a', 960, 220, 160)}{burst(popk(t, M[`down${r}`], M[`down${r}`] + 1.0), '¡ABAJO!', '#3d8bff', 960, 220, 160)}{burst(popk(t, M[`spin${r}`], M[`spin${r}`] + 1.0), '¡UNA VUELTA!', '#ff8a1f', 960, 220, 150)}</React.Fragment>)}
      {/* ¿Qué suena? */}
      {burst(popk(t, M.dong, M.dong + 1.6), '¡DONG!', '#ffd23f', 1300, 230, 200, 8)}
      {title(S('n22') - 0.1, S('n22') + 2.6, '¿QUÉ SUENA?', 'juego', '#c56bff')}
      {[0, 1, 2, 3].map((q) => <React.Fragment key={q}>{speaker(M[`q${q}snd`], M[`q${q}rev`])}{burst(popk(t, M[`q${q}rev`], M[`q${q}rev`] + 2.0), ['¡LA MANGUERA!', '¡LA PALA!', '¡PIP, PIP!', '¡DONG, DONG!'][q], ['#3daaff', '#e0a810', '#3d8bff', '#ffd23f'][q], 960, 200, 160)}</React.Fragment>)}
      {/* al pueblo */}
      {burst(popk(t, S('b13'), M.loaded), '¡CON CUIDADO!', '#3d8bff', 960, 200, 130)}
      {burst(popk(t, M.loaded, M.loaded + 1.4), '¡LISTO!', '#39c47a', 960, 220, 180)}
      {title(S('n39') + 0.4, M.col0 + 0.2, '¡COLORES!', 'juego', '#ff5f9a')}
      {[0, 1, 2, 3].map((i) => <React.Fragment key={i}>{t > M[`col${i}`] + 0.4 && t < M[`col${i}rev`] ? burst(popk(t, M[`col${i}`] + 0.4, M[`col${i}rev`]), '?', '#ffffff', 1450, 280, 240, 8) : null}{burst(popk(t, M[`col${i}rev`], M[`col${i}rev`] + 1.6), colW[i], colC[i], 960, 210, 190)}</React.Fragment>)}
      {/* la torre */}
      {burst(popk(t, S('n30') + 1.0, S('n30') + 4.0), 'LA TORRE DEL RELOJ', '#ff8a1f', 960, 170, 120)}
      {burst(popk(t, S('b14') + 1.6, E('b14') + 0.4), '🔔 ➜ 🗼', '#ffd23f', 960, 210, 160, 0)}
      {burst(popk(t, M.cheer, M.cheer + 1.6), '¡VAMOS!', '#39c47a', 960, 220, 190)}
      {trk > 0.01 ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <div style={{width: 1180 * u, background: '#fff7e0', borderRadius: 40 * u, border: `${14 * u}px solid #ff8a1f`, transform: `scale(${trk}) rotate(-2deg)`, boxShadow: `0 ${16 * u}px 0 rgba(0,0,0,0.25)`, padding: 36 * u}}>
            <div style={{fontFamily: font, fontSize: 70 * u, color: '#ff8a1f', textAlign: 'center', ...st('#ffffff', 8)}}>ARREGLAMOS LA TORRE · 1/30</div>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 18 * u, justifyContent: 'center', marginTop: 20 * u}}>
              {Array.from({length: 30}).map((_, i) => { const s = i === 0 ? easeOutBack(prog(t, M.tracker + 0.8, M.tracker + 1.3), 3) : 0; return <div key={i} style={{width: 112 * u, height: 70 * u, borderRadius: 16 * u, border: `${4 * u}px dashed #e0c9a0`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52 * u}}>{s > 0.01 ? <span style={{transform: `scale(${s}) rotate(${(1 - s) * 90}deg)`}}>🔔</span> : null}</div>; })}
            </div>
          </div>
        </AbsoluteFill>
      ) : null}
      {/* el gran salto */}
      {title(S('n32') - 0.1, S('n32') + 2.2, '¡EL GRAN SALTO!', '', '#ff8a1f')}
      {burst(popk(t, S('x6'), S('x6') + 1.6), '¡YUJUUU!', '#3d8bff', 1300, 230, 170, 8)}
      {burst(popk(t, M.splash, M.splash + 1.8), '¡SPLASH!', '#8a5a34', 960, 220, 230)}
      {burst(popk(t, S('b17') + 0.5, E('b17') + 0.3), '¡JAJAJA!', '#ff8a1f', 1350, 230, 150, 8)}
      {/* repaso, pregunta, logo y avance */}
      {flash ? <AbsoluteFill style={{border: `${26 * u}px solid rgba(255,255,255,0.92)`, borderRadius: 50 * u, boxShadow: `inset 0 0 ${80 * u}px rgba(255,236,170,0.8)`}}><div style={{position: 'absolute', top: 40 * u, left: 60 * u, fontFamily: font, fontSize: 70 * u, color: '#ffd23f', ...st('#2b2350', 10)}}>¡RECUERDA!</div></AbsoluteFill> : null}
      {t > S('n36') - 0.1 && t < M.qend ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', background: `rgba(20,24,60,${0.35 * popk(t, S('n36') - 0.1, M.qend)})`}}>
          <div style={{transform: `scale(${popk(t, S('n36') - 0.1, M.qend)})`, fontFamily: font, fontSize: 120 * u, color: '#fff', textAlign: 'center', ...st('#2b2350', 16)}}>¿Qué amigo<br /><span style={{color: '#ffd23f'}}>te gustó más?</span></div>
        </AbsoluteFill>
      ) : null}
      {t > M.logo0 && t < M.sp0 ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', background: `rgba(20,24,60,${0.55 * popk(t, M.logo0, M.sp0)})`}}>
          {logo(popk(t, M.logo0, M.sp0), 230, 420)}
          <div style={{position: 'absolute', bottom: 40 * u, fontFamily: font, fontSize: 30 * u, color: '#fff', opacity: 0.85}}>Música: Kevin MacLeod (incompetech.com) · licencia CC BY 4.0</div>
        </AbsoluteFill>
      ) : null}
      {t > M.sp0 ? <div style={{position: 'absolute', top: 40 * u, left: 0, width: '100%', textAlign: 'center', fontFamily: font, fontSize: 90 * u, color: '#ffd23f', ...st('#2b2350', 14), transform: `scale(${popk(t, M.sp0, 700)})`}}>PRÓXIMO CAPÍTULO</div> : null}
      {mp > 0.01 ? (
        <AbsoluteFill style={{alignItems: vert ? 'center' : 'flex-start', justifyContent: 'center', paddingLeft: vert ? 0 : 110 * u}}>
          <svg width={900 * u} height={600 * u} viewBox="0 0 900 600" style={{transform: `scale(${mp}) rotate(${-3 + Math.sin(t * 3)}deg)`, filter: 'drop-shadow(0 18px 0 rgba(0,0,0,0.25))'}}>
            <rect x="20" y="20" width="860" height="560" rx="30" fill="#f1deb0" stroke="#c9a467" strokeWidth="10" />
            <path d="M120 470 C 240 400, 300 480, 420 380 S 600 300, 700 170" fill="none" stroke="#8a5a34" strokeWidth="12" strokeDasharray="10 26" strokeLinecap="round" strokeDashoffset={-t * 60} />
            <circle cx="120" cy="470" r="34" fill="#ff8a1f" stroke="#fff" strokeWidth="8" />
            <path d="M330 150 l40 -60 l40 60 z" fill="#39c47a" /><path d="M380 170 l35 -50 l35 50 z" fill="#2fa04a" />
            <path d="M560 470 q40 -40 80 0 q40 40 80 0" fill="none" stroke="#3daaff" strokeWidth="12" strokeLinecap="round" />
            <g transform={`translate(700 170) rotate(${Math.sin(t * 6) * 6}) scale(${1 + 0.08 * Math.sin(t * 8)})`}><path d="M-40 -40 L40 40 M40 -40 L-40 40" stroke="#e02a2a" strokeWidth="22" strokeLinecap="round" /></g>
          </svg>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- composición
const skipPlace = (p: Place) =>
  (p.m === 'maceta' && Math.hypot(p.x, p.z) < 12) ||
  (Math.hypot(p.x - DIG[0], p.z - DIG[1]) < 16) ||
  (Math.hypot(p.x - RAILX, p.z - (RAIL_Z - 4)) < 9) ||
  (p.m !== 'charco_barro' && p.x > 120 && p.x < 190 && Math.abs(p.z - JZ) < 7) ||
  ITEM_CAMS().some(([cx, cz]) => p.m !== 'farola' && Math.hypot(p.x - cx, p.z - cz) < 9) ||
  (p.x > 70 && p.x < 120 && p.z < -50 && (p.m === 'cono' || p.m === 'barrera_obra') && Math.abs(p.x - 110) < 6);
const obstacle2 = (t: number): [number, number] | null => {
  if (t >= M.exit0 && t <= M.arrive + 1) { const b = brunoC2(t); return [b.x, b.z]; }
  if (t >= M.plaza0 - 1 && t <= M.plaza1 + 1) return [PL.bruno[0], PL.bruno[1]];
  if (t >= M.sp0) return [PL.bruno[0], PL.bruno[1]];
  return null;
};
let trafficReady2 = false;
export const Cap2: React.FC<{t0?: number}> = ({t0 = 0}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = IP.t ?? frame / fps + t0;
  const te = remap(t);
  const vert = height > width, OW = vert ? width * 1.25 : width;
  const [ready, setReady] = useState(false);
  const [h] = useState(() => delayRender('fuentes'));
  useEffect(() => { Promise.all([document.fonts.load('150px "Lilita One"'), document.fonts.ready]).then(() => { setReady(true); continueRender(h); }); }, [h]);
  const lib = useLib();
  if (!ready || !lib) return null;
  if (!trafficReady2) { resolve(obstacle2); trafficReady2 = true; }
  const c = camAt2(te, t, vert);
  const garage = easeOut(prog(te, M.exit0 - 1.2, M.exit0 - 0.2)) * (1 - easeInOut(prog(te, M.exit0 + 3.5, M.exit0 + 5)));
  return (
    <AbsoluteFill style={{background: '#a9dcff'}}>
      <ThreeCanvas width={width} height={height} shadows gl={{antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'}} camera={{fov: 40, position: [0, 5, 20]}}>
        <Rig c={c} lib={lib} vert={vert} />
        <Lights c={c} />
        <World lib={lib} t={te} garageOpen={garage} skip={skipPlace} />
        <Scene2 te={te} lib={lib} />
        <Post off={!!IP.nopost} ao={!IP.noao} />
      </ThreeCanvas>
      <div style={{position: 'absolute', left: (width - OW) / 2, top: 0, width: OW, height}}>
        <Overlay2 t={t} W={OW} vert={vert} />
      </div>
    </AbsoluteFill>
  );
};
void easeIn; void E; void hash;
