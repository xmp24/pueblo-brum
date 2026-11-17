// Minuto 2: ¡al rescate de Chispa! (ruta por el pueblo, barro, tirones, pegatina, sirena)
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {AbsoluteFill} from 'remotion';
import {prog, lerp, clamp, easeInOut, easeOut, easeIn, easeOutBack, damped, hash, catmull, V3} from './anim';
import type {B2Pose} from './Bruno2';
import {Char} from './world/World';
import {talkOf, blinkAt, PX} from './talk';
import {Lib} from './world/assets';
import {RAIL_Z, MUD} from './world/layout';
import VO from './vo.json';

const vo = VO as Record<string, {t: number; d: number}>;
const S = (k: string) => vo[k].t;
const E = (k: string) => vo[k].t + vo[k].d;
type Cam = {pos: V3; at: V3; fov: number};
const mix3 = (a: V3, b: V3, u: number): V3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

// ---------------- tiempos clave
export const T2 = S('n12') - 0.45;
const tN13 = S('n13');
export const K2 = {
  start: T2,
  aerial: S('b10') + 0.15,
  shops: tN13,
  rail: tN13 + 1.55,
  farm: tN13 + 3.3,
  arrive: S('x2') - 0.35,
  turn: S('n14') + 0.2,
  hook: S('n14') + 1.3,
  strain: S('b12') - 0.1,
  tugs: [S('c4'), S('c5'), S('c6')],
  pop: S('n16') + 0.35,
  thank: S('x3') - 0.3,
  back: S('x3') + 0.3,
  sticker: S('n17') + vo.n17.d * 0.62,
  party: E('n17') + 0.2,
  siren: S('n18') - 0.2,
};

// ---------------- ruta de Bruno por el pueblo (carril derecho)
const L = 1.75;
const CTRL: [number, number][] = [
  [20, -4.2], [20, -1.6], [22.5, 1.2], [26, L], [40, L], [60, L], [66.5, L], [70.4, -0.4], [70 + L, -4.5],
  [70 + L, -20], [70 + L, -40], [70 + L, -60], [70 + L, -64.5], [73.8, -67.7], [78, -70 + L], [100, -70 + L], [120, -70 + L], [134, -70 + L],
  [137.6, -66.6], [140 - L, -62], [140 - L, -40], [140 - L, -10], [140 - L, 6], [141, 13], [147, 19.5], [153, 21.6], [158.4, 22],
];
function buildPath() {
  const pts: [number, number][] = [];
  for (let i = 0; i < CTRL.length - 1; i++) {
    const p0 = CTRL[Math.max(0, i - 1)], p1 = CTRL[i], p2 = CTRL[i + 1], p3 = CTRL[Math.min(CTRL.length - 1, i + 2)];
    const seg = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.8));
    for (let k = 0; k < seg; k++) {
      const u = k / seg, u2 = u * u, u3 = u2 * u;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  pts.push(CTRL[CTRL.length - 1]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return {pts, cum, len: cum[cum.length - 1]};
}
const PATH = buildPath();
const sOf = (x: number, z: number) => { let b = 0, bd = 1e9; PATH.pts.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; b = i; } }); return PATH.cum[b]; };
const S_RAIL = sOf(70 + L, RAIL_Z), S_TURN1 = sOf(70 + L, -2), S_FARMRD = sOf(140 - L, -40);
function pathAt(s: number) {
  s = clamp(s, 0, PATH.len);
  let i = 1; while (i < PATH.cum.length - 1 && PATH.cum[i] < s) i++;
  const a = PATH.pts[i - 1], b = PATH.pts[i], u = (s - PATH.cum[i - 1]) / Math.max(1e-6, PATH.cum[i] - PATH.cum[i - 1]);
  const look = (d: number) => { const ss = clamp(s + d, 0, PATH.len); let j = 1; while (j < PATH.cum.length - 1 && PATH.cum[j] < ss) j++; return PATH.pts[j]; };
  const f = look(1.6), r = look(-1.6);
  return {x: lerp(a[0], b[0], u), z: lerp(a[1], b[1], u), yaw: Math.atan2(f[0] - r[0], f[1] - r[1])};
}
// tramos de distancia por plano (los cortes esconden los saltos)
const SEGS: [number, number, number, number, (u: number) => number][] = [
  [K2.start, K2.aerial, 0, 16, easeIn],
  [K2.aerial, K2.shops, 16, 50, (u) => u],
  [K2.shops, K2.rail, 50, S_TURN1 - 2, (u) => u],
  [K2.rail, K2.farm, S_RAIL - 15, S_RAIL + 13, (u) => u],
  [K2.farm, K2.arrive, S_FARMRD, PATH.len, easeOut],
];
export function routeS(t: number) {
  for (const [a, b, s0, s1, e] of SEGS) if (t >= a && t < b) return lerp(s0, s1, e(prog(t, a, b)));
  return t < K2.start ? 0 : PATH.len;
}

// ---------------- Chispa
export function chispaAt(t: number) {
  const base = {x: MUD.x, z: MUD.z, yaw: -Math.PI / 2, y: -0.3, roll: 0, pitch: 0, dist: 0};
  if (t < K2.pop) {
    base.roll = Math.sin(t * 7) * 0.05 * (t > S('x2') && t < E('x2') ? 1.6 : 0.6);
    for (const tg of [K2.hook + 0.4, K2.strain + 0.3, K2.strain + 1.3, ...K2.tugs]) {
      const d = t - tg; if (d > 0 && d < 0.6) { const k = Math.sin((d / 0.6) * Math.PI); base.x -= 0.35 * k; base.pitch = -0.08 * k; base.y += 0.08 * k; }
    }
    return base;
  }
  const d = t - K2.pop;
  const u = clamp(d / 0.95);
  base.x = lerp(MUD.x, 162.2, easeOut(u)); base.y = -0.3 * (1 - clamp(d / 0.25)) + Math.sin(u * Math.PI) * 1.9 + 0.12 * Math.abs(Math.sin(Math.max(0, d - 0.95) * 9)) * Math.exp(-Math.max(0, d - 0.95) * 3);
  base.pitch = -0.35 * Math.sin(u * Math.PI); base.dist = (base.x - MUD.x) * -1;
  if (t > K2.party) { const q = t - K2.party; base.y += Math.abs(Math.sin(q * 6.5)) * 0.45; base.roll = Math.sin(q * 6.5) * 0.08; base.yaw = -Math.PI / 2 + Math.sin(q * 2.2) * 0.35; }
  if (t > K2.siren + 0.6) base.yaw = lerp(base.yaw, -Math.PI / 2 - 0.6, easeOut(prog(t, K2.siren + 0.6, K2.siren + 1.2)));
  return base;
}

// ---------------- Bruno en el minuto 2
const HOOK_X = 163.6;
export function bruno2(t: number, p: B2Pose) {
  if (t < K2.start) return p;
  p.y = 0; p.lift = 0; p.sx = p.sy = p.sz = 1; p.pitch = 0; p.roll = 0; p.cross = 0; p.glow = 0;
  p.mouth = 'grin'; p.brow = 0.6; p.browTilt = -0.3; p.eyeScale = 1.05; p.lookX = 0; p.lookY = 0; p.arm = 0;
  p.beacon = 0.5 + 0.5 * Math.sin(t * 16);
  if (t < K2.arrive) {
    const s = routeS(t), q = pathAt(s);
    p.x = q.x; p.z = q.z; p.yaw = q.yaw; p.wheel = s / 0.43;
    p.wheelBounce = [0, 1, 2, 3].map((i) => Math.max(0, Math.sin(t * 13 + i * 1.7)) * 0.04);
    p.hookSway = Math.sin(t * 6) * 0.35; p.lift = Math.abs(Math.sin(t * 15)) * 0.03;
    if (t < K2.start + 0.5) p.pitch = -0.06 * Math.sin(prog(t, K2.start, K2.start + 0.5) * Math.PI);
    const dr = s - S_RAIL; // salto en el paso a nivel
    if (t >= K2.rail && t < K2.farm && dr > -2.5 && dr < 4.5) { const j = (dr + 2.5) / 7; p.lift += Math.sin(j * Math.PI) * 1.4; p.pitch = (0.5 - j) * 0.3; p.mouth = 'o'; p.eyeScale = 1.3; p.brow = 1; }
    if (t >= K2.rail && t < K2.farm) p.sy = 1 - 0.2 * damped(dr - 4.5 > 0 ? (dr - 4.5) / 14 : -1, 3, 5);
    if (t > K2.farm + 0.8) { p.lookX = 0.6; }
    return p;
  }
  // llegada a la granja: frena mirando a Chispa
  p.x = 158.4; p.z = 22; p.yaw = Math.PI / 2; p.wheel = PATH.len / 0.43;
  p.pitch = 0.09 * damped(t - K2.arrive, 2, 4);
  p.hookSway = 0.5 * damped(t - K2.arrive, 1.4, 1.8);
  if (t < S('b11')) { p.mouth = 'o'; p.brow = 1; p.browTilt = 0.5; p.eyeScale = 1.2; }
  if (t > S('b11') - 0.1) { p.brow = 0.3; p.browTilt = -0.6; p.mouth = 'smile'; }
  // maniobra: media vuelta con saltito y marcha atrás hasta Chispa
  if (t > K2.turn) {
    const u = easeInOut(prog(t, K2.turn, K2.turn + 0.7));
    p.yaw = Math.PI / 2 + Math.PI * easeOutBack(prog(t, K2.turn, K2.turn + 0.7), 1.6);
    p.lift = Math.sin(clamp(prog(t, K2.turn, K2.turn + 0.7)) * Math.PI) * 0.6;
    const r = easeInOut(prog(t, K2.turn + 0.7, K2.hook));
    p.x = lerp(158.4, HOOK_X, r) + (u < 1 ? 0 : 0);
    p.wheel = PATH.len / 0.43 - r * 12;
    p.arm = -22 * easeOut(prog(t, K2.hook - 0.5, K2.hook));
    p.lookX = 0.8; p.mouth = 'grin';
  }
  // tirones
  if (t > K2.strain) {
    p.arm = -22; p.mouth = t < K2.pop ? 'flat' : 'grin'; p.brow = 0.2; p.browTilt = -0.8; p.eyeScale = 0.95;
    const tugK = (tt: number) => { const d = t - tt; return d > 0 && d < 0.6 ? Math.sin((d / 0.6) * Math.PI) : 0; };
    const strain = [K2.strain + 0.3, K2.strain + 1.3, ...K2.tugs].reduce((a, tt) => a + tugK(tt), 0);
    const shake = t < K2.pop ? Math.sin(t * 46) * 0.012 : 0;
    p.x = HOOK_X - strain * 0.4; p.pitch = -0.07 * strain + shake; p.roll = shake * 0.6;
    p.wheel = PATH.len / 0.43 + (t < K2.pop ? (t - K2.strain) * 40 : 0);
    p.sy = 1 - 0.05 * strain; p.sx = p.sz = 1 + 0.03 * strain;
    if (t > S('n15') && t < S('c4')) { p.lookX = 0; p.lookY = 0.2; p.mouth = 'o'; p.brow = 1; p.browTilt = 0.4; }
    if (strain > 0.3) { p.eyeOpen = Math.min(p.eyeOpen, 0.35); p.mouth = 'flat'; }
  }
  // ¡sale!
  if (t > K2.pop) {
    const d = t - K2.pop;
    const u = easeOut(clamp(d / 0.9));
    p.x = lerp(HOOK_X, 157, u); p.pitch = -0.12 * Math.sin(clamp(d / 0.9) * Math.PI);
    p.wheel = PATH.len / 0.43 + (K2.pop - K2.strain) * 40 + (HOOK_X - p.x) / 0.43;
    p.mouth = 'grin'; p.brow = 1; p.browTilt = 0; p.eyeScale = 1.25 - 0.2 * clamp(d / 1.2); p.eyeOpen = 1;
    p.arm = lerp(-22, 0, clamp(d / 1.5));
  }
  // se da la vuelta para mirar a Chispa
  if (t > K2.back) {
    const v = prog(t, K2.back, K2.back + 0.75);
    p.yaw = -Math.PI / 2 + Math.PI * easeOutBack(v, 1.6); p.lift = Math.sin(clamp(v) * Math.PI) * 0.5; p.x = 157 - 0.5 * easeInOut(v);
    p.mouth = 'grin';
  }
  if (t > S('n17')) { p.brow = 1; p.eyeScale = 1.1; }
  if (t > K2.sticker) { p.glow = Math.exp(-(t - K2.sticker) * 2) * 0.6; p.lift = (p.lift ?? 0) + Math.sin(clamp((t - K2.sticker) / 0.4) * Math.PI) * 0.4; }
  if (t > K2.party) { const q = t - K2.party; p.lift = (p.lift ?? 0) + Math.abs(Math.sin(q * 6.5 + 1.5)) * 0.35; p.arm = 25 + 15 * Math.sin(q * 6); p.hookSway = Math.sin(q * 6) * 0.6; p.roll = Math.sin(q * 6.5) * 0.05; }
  if (t > K2.siren) {
    const v = easeOut(prog(t, K2.siren + 0.5, K2.siren + 1.1));
    p.lift = 0; p.arm = 0; p.roll = 0; p.lookX = -0.9 * v; p.mouth = 'o'; p.brow = 1; p.browTilt = 0.5; p.eyeScale = 1.25;
    p.yaw = lerp(Math.PI / 2, Math.PI / 2 + 0.7, v);
  }
  // parpadeos
  for (let b = K2.start + 1.3; b < 121; b += 2.9 + hash(Math.floor(b)) * 1.6) { const d = t - b; if (d >= 0 && d < 0.14) p.eyeOpen = Math.min(p.eyeOpen, 1 - 0.94 * Math.sin((d / 0.14) * Math.PI)); }
  return p;
}

// punto del gancho en el mundo (para el cable)
export function hookWorld(p: B2Pose): V3 {
  const a = ((p.arm ?? 0) * Math.PI) / 180;
  const ly = 1.55 + 0.86 * Math.cos(a) + 1.23 * Math.sin(a), lz = -0.55 + 0.86 * Math.sin(a) - 1.23 * Math.cos(a);
  const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  return [p.x + lz * s, (p.y ?? 0) + (p.lift ?? 0) + ly - 0.75, p.z + lz * c];
}

// ---------------- planos
const F = (pos: V3, at: V3, fov: number) => ({pos, at, fov});
export function shots2(brunoAt: (t: number) => B2Pose): {t0: number; t1: number; f: (u: number, t: number) => Cam}[] {
  const B = (t: number) => brunoAt(t);
  const C = (t: number) => chispaAt(t);
  return [
    {t0: K2.start, t1: K2.aerial, f: (u, t) => { const b = B(t); return F([27.5, 1.3, 7.5], [b.x, 1.3, b.z], 40 - 6 * u); }},
    {t0: K2.aerial, t1: K2.shops, f: (u, t) => { const b = B(t); return F([b.x - 22 + 6 * u, 24 - 4 * u, b.z + 26], [b.x + 14, 0, b.z - 6], 50); }},
    {t0: K2.shops, t1: K2.rail, f: (u, t) => { const b = B(t); return F([b.x + 3, 1.25, b.z + 6.2], [b.x + 1, 1.7, b.z - 8], 46); }},
    {t0: K2.rail, t1: K2.farm, f: (u) => F([79.5 - u * 1.5, 1.8, RAIL_Z + 4.5], [71.5, 1.6, RAIL_Z - 1], 44)},
    {t0: K2.farm, t1: K2.arrive, f: (u) => F(mix3([118, 30, 48], [140, 11, 40], easeInOut(u)), mix3([150, 0, 0], [161, 1, 20], easeInOut(u)), 48)},
    {t0: K2.arrive, t1: S('b11') - 0.1, f: (u, t) => { const c = C(t); return F(mix3([162.3, 1.25, 25.6], [162.9, 1.2, 25.0], u), [c.x, 0.75, c.z], 38); }},
    {t0: S('b11') - 0.1, t1: K2.turn, f: (u) => F(mix3([162.6, 1.75, 24.8], [162.2, 1.75, 24.4], u), [158.4, 1.55, 22], 38)},
    {t0: K2.turn, t1: K2.strain, f: (u) => F(mix3([161, 3.4, 33], [162, 3.0, 31], u), [163, 1.0, 22], 40)},
    {t0: K2.strain, t1: S('n15'), f: (u) => F(mix3([158.6, 0.9, 24.6], [158.9, 0.95, 24.2], u), [162.5, 1.4, 22], 40)},
    {t0: S('n15'), t1: K2.tugs[0] - 0.15, f: (u) => F(mix3([164.5, 2.6, 30.5], [164.5, 2.3, 28.5], easeInOut(u)), [164.5, 1.1, 22], 40)},
    {t0: K2.tugs[0] - 0.15, t1: K2.pop - 0.35, f: (u) => F(mix3([164.5, 2.3, 28.5], [164.8, 1.8, 26.6], u), [165, 1.0, 22], 40)},
    {t0: K2.pop - 0.35, t1: K2.thank, f: (u) => F(mix3([167.5, 1.3, 30], [166, 1.8, 31], easeOut(u)), [161.5, 1.2, 22], 42)},
    {t0: K2.thank, t1: S('b13') - 0.1, f: (u, t) => { const c = C(t); return F(mix3([157.8, 1.3, 25.2], [158.1, 1.3, 24.8], u), [c.x, 0.85 + c.y * 0.5, c.z], 38); }},
    {t0: S('b13') - 0.1, t1: S('n17'), f: (u) => F(mix3([159.6, 1.7, 25.4], [159.4, 1.7, 25.0], u), [156.4, 1.55, 22], 36)},
    {t0: S('n17'), t1: K2.party, f: (u) => F(mix3([156.4, 1.6, 27.8], [156.3, 1.5, 26.4], easeInOut(u)), [156.4, 1.35, 22], 38)},
    {t0: K2.party, t1: K2.siren, f: (u) => { const a = 1.2 + u * 1.3; return F([159.5 + Math.cos(a) * 9.5, 2.6 + u * 1.5, 22 + Math.sin(a) * 9.5], [159.5, 1.2, 22], 44); }},
    {t0: K2.siren, t1: 125, f: (u) => F(mix3([164.5, 2.3, 31], [166, 2.8, 32.5], easeOut(u)), mix3([159.5, 1.3, 22], [118, 6, 8], easeInOut(prog(u, 0.12, 0.5))), 44 - 10 * easeInOut(prog(u, 0.12, 0.6)))},
  ];
}
export const punches2 = () => [K2.start + 0.4, K2.pop, K2.sticker, ...K2.tugs, K2.siren + 0.6];
export const shake2 = (t: number) => 0.05 * damped(t - K2.pop, 8, 7) + K2.tugs.reduce((a, tg) => a + 0.03 * damped(t - tg, 9, 8), 0) + 0.04 * damped(t - (K2.rail + 1.1), 8, 8);
export const obstacle2 = (t: number): [number, number] | null => (t >= K2.start - 0.5 && t < K2.arrive + 0.5 ? (() => { const q = pathAt(routeS(t)); return [q.x, q.z] as [number, number]; })() : null);

// ---------------- piezas 3D
const MudSplash: React.FC<{t: number; t0: number; c: V3; n?: number}> = ({t, t0, c, n = 14}) => {
  const d = t - t0;
  if (d < 0 || d > 1.2) return null;
  return (
    <group>
      {Array.from({length: n}).map((_, i) => {
        const a = hash(i + t0) * Math.PI * 2, sp = 2.2 + hash(i * 3 + t0) * 3, up = 3 + hash(i * 7 + t0) * 3;
        const x = c[0] + Math.cos(a) * sp * d, z = c[2] + Math.sin(a) * sp * d, y = c[1] + up * d - 9.8 * d * d * 0.5;
        if (y < 0) return null;
        const r = 0.09 + hash(i * 11 + t0) * 0.12;
        return <mesh key={i} position={[x, y, z]} scale={[1, 0.8, 1]}><sphereGeometry args={[r, 10, 8]} /><meshPhysicalMaterial color="#6b4a2b" roughness={0.2} clearcoat={0.8} /></mesh>;
      })}
    </group>
  );
};
function starGeo() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 0.17 : 0.36; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  return new THREE.ExtrudeGeometry(s, {depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.03, bevelSegments: 3});
}
export const Min2Scene: React.FC<{lib: Lib; t: number; bp: B2Pose}> = ({lib, t, bp}) => {
  const star = useMemo(() => starGeo(), []);
  if (t < K2.start - 6) return null;
  const c = chispaAt(t);
  const hook = hookWorld(bp);
  const cableOn = t > K2.hook && t < K2.thank;
  const front: V3 = [c.x - 1.35, 0.55 + c.y, c.z];
  const mid: V3 = [(hook[0] + front[0]) / 2, (hook[1] + front[1]) / 2, (hook[2] + front[2]) / 2];
  const len = Math.hypot(hook[0] - front[0], hook[1] - front[1], hook[2] - front[2]);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(hook[0] - front[0], hook[1] - front[1], hook[2] - front[2]).normalize());
  const st = t > K2.sticker ? easeOutBack(clamp((t - K2.sticker) / 0.45), 3) : 0;
  return (
    <group>
      <Char lib={lib} m="chispa" p={{x: c.x, z: c.z, y: c.y, yaw: c.yaw, roll: c.roll, pitch: c.pitch, dist: c.dist + (t > K2.strain && t < K2.pop ? (t - K2.strain) * 6 : 0), blink: blinkAt(t, 2), talk: talkOf(PX.chispa, t)}} />
      {cableOn ? <mesh position={mid} quaternion={q}><cylinderGeometry args={[0.035, 0.035, len, 8]} /><meshStandardMaterial color="#2f3b57" roughness={0.5} metalness={0.4} /></mesh> : null}
      {[K2.strain + 0.3, K2.strain + 1.3, ...K2.tugs].map((tg, i) => <MudSplash key={i} t={t} t0={tg} c={[MUD.x - 0.6, 0.1, MUD.z + (i % 2 ? 0.9 : -0.9)]} n={10} />)}
      <MudSplash t={t} t0={K2.pop} c={[MUD.x, 0.1, MUD.z]} n={28} />
      {st > 0.01 ? (
        <group position={[bp.x, (bp.y ?? 0) + (bp.lift ?? 0), bp.z]} rotation={[0, bp.yaw, 0]}>
          <group position={[-0.87, 1.5, -0.1]} rotation={[0, -Math.PI / 2, Math.sin(t * 3) * 0.05]} scale={st}>
            <mesh geometry={star}><meshPhysicalMaterial color="#ffd23f" metalness={0.3} roughness={0.25} clearcoat={1} emissive="#ffb000" emissiveIntensity={0.25 + 0.6 * Math.exp(-(t - K2.sticker) * 2)} /></mesh>
          </group>
        </group>
      ) : null}
      {t > K2.siren + 0.4 ? <pointLight position={[117.5, 12, 7]} color={Math.sin(t * 14) > 0 ? '#ff3030' : '#3d8bff'} intensity={4000} distance={90} decay={2} /> : null}
    </group>
  );
};

// ---------------- capa 2D del minuto 2
export const Overlay2: React.FC<{t: number; W: number; burst: (k: number, txt: string, col: string, x: number, y: number, size: number, rot?: number) => React.ReactNode; popk: (t: number, a: number, b: number) => number}> = ({t, W, burst, popk}) => {
  if (t < K2.start) return null;
  const u = W / 1920;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {burst(popk(t, K2.start + 0.2, K2.start + 1.5), '¡AL RESCATE!', '#ff4b4b', 960, 190, 160, -6)}
      {burst(popk(t, K2.rail + 0.75, K2.rail + 1.6), '¡HOP!', '#ffd23f', 1250, 260, 170, 8)}
      {burst(popk(t, K2.strain + 0.1, K2.strain + 1.6), '¡ÑÑÑÑ!', '#ff8a1f', 1300, 230, 150, 6)}
      {K2.tugs.map((tg, i) => <React.Fragment key={i}>{burst(popk(t, tg, tg + 0.95), String(i + 1), ['#ff5f7e', '#3d8bff', '#39c47a'][i], 330 + i * 230, 250, 240 + i * 30, 0)}</React.Fragment>)}
      {burst(popk(t, S('n16'), K2.pop + 1.2), '¡TIRAAA!', '#ffd23f', 960, 200, 210, -4)}
      {burst(popk(t, K2.pop, K2.pop + 1.0), '¡PLOP!', '#8a5a34', 1350, 820, 150, 10)}
      {burst(popk(t, K2.sticker, K2.sticker + 2.0), '★ ¡PEGATINA! ★', '#ffd23f', 960, 180, 150, -3)}
      {t > K2.siren + 0.6 ? (
        <div style={{position: 'absolute', left: 1250 * u, top: 110 * u, width: 230 * u, height: 230 * u, borderRadius: '50%', background: '#fff', transform: `scale(${popk(t, K2.siren + 0.7, 200)}) rotate(${Math.sin(t * 6) * 8}deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Lilita One", sans-serif', fontSize: 190 * u, color: '#ff4b4b', WebkitTextStroke: `${10 * u}px #7a1010`, paintOrder: 'stroke fill' as any, boxShadow: `0 ${10 * u}px 0 rgba(0,0,0,0.15)`}}>?</div>
      ) : null}
      {t > K2.siren + 0.4 ? (() => { const k = Math.min(1, (t - K2.siren - 0.4) / 0.6); const red = Math.sin(t * 14) > 0;
        return <AbsoluteFill style={{background: `radial-gradient(ellipse at ${red ? '0%' : '8%'} 40%, ${red ? 'rgba(255,40,40,0.55)' : 'rgba(60,140,255,0.5)'} 0%, rgba(0,0,0,0) 42%)`, opacity: k}} />; })() : null}
      {burst(popk(t, K2.siren + 0.5, K2.siren + 3.0), '¡NII-NOO!', '#ff3030', 620, 260, 130, -8)}
    </AbsoluteFill>
  );
};
void catmull; void easeIn;
