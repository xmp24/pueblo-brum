// Pueblo Brum · Capítulo 1 completo (10 min). Minutos 0-2 vienen de Ep3 (Part1Scene); aquí el resto.
import React, {useEffect, useMemo, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig, getInputProps} from 'remotion';
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
import {RAIL_Z, MUD} from './world/layout';
import {Part1Scene, brunoAt, camAtT, K, Overlay, popk, brunoObstacle, T3, garageOpenAt} from './Ep3';
import {chispaAt, K2, obstacle2} from './min2';
import {Puffs, Sparkles, Confetti} from './fx';
import {talkOf, blinkAt, PX} from './talk';
import VO from './vo.json';
import MK from './ep10.json';

const vo = VO as Record<string, {t: number; d: number}>;
const M = MK as Record<string, number>;
const S = (k: string) => vo[k].t;
const E = (k: string) => vo[k].t + vo[k].d;
const IP = getInputProps() as {nopost?: boolean; noao?: boolean; t?: number};
type Cam = {pos: V3; at: V3; fov: number};
const mix3 = (a: V3, b: V3, u: number): V3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
const F = (pos: V3, at: V3, fov = 40): Cam => ({pos, at, fov});
const yawTo = (ax: number, az: number, bx: number, bz: number) => Math.atan2(bx - ax, bz - az);
const angLerp = (a: number, b: number, u: number) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * u; };
const hop = (t: number, t0: number, d = 0.45, h = 0.7) => { const q = prog(t, t0, t0 + d); return q > 0 && q < 1 ? Math.sin(q * Math.PI) * h : 0; };

// ---------------------------------------------------------------- rutas
type Path = {pts: [number, number][]; cum: number[]; len: number};
function mkPath(ctrl: [number, number][]): Path {
  const pts: [number, number][] = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.8));
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
function at(p: Path, s: number, off = 0) {
  s = clamp(s, 0, p.len);
  let i = 1; while (i < p.cum.length - 1 && p.cum[i] < s) i++;
  const a = p.pts[i - 1], b = p.pts[i], u = (s - p.cum[i - 1]) / Math.max(1e-6, p.cum[i] - p.cum[i - 1]);
  const look = (d: number) => { const ss = clamp(s + d, 0, p.len); let j = 1; while (j < p.cum.length - 1 && p.cum[j] < ss) j++; return p.pts[j]; };
  const f = look(1.5), r = look(-1.5);
  const yaw = Math.atan2(f[0] - r[0], f[1] - r[1]);
  const x = lerp(a[0], b[0], u), z = lerp(a[1], b[1], u);
  return {x: x - Math.cos(yaw) * off, z: z + Math.sin(yaw) * off, yaw};
}
const L = 1.75;
// granja -> lavadero (por la avenida este, la rotonda y la avenida oeste)
const ringArc = (a0: number, a1: number, n = 14): [number, number][] => Array.from({length: n + 1}, (_, k) => { const a = a0 + (a1 - a0) * (k / n); return [Math.cos(a) * 12.5, Math.sin(a) * 12.5] as [number, number]; });
const CONVOY_COMMON: [number, number][] = [[150.5, 27.8], [146, 20], [142.6, 10], [141.6, 3], [138, -L], [120, -L], [100, -L], [80, -L], [60, -L], [40, -L], [22, -L], ...ringArc(-0.14, -Math.PI + 0.14), [-17, -L]];
const P_BRUNO = mkPath([...CONVOY_COMMON, [-18.6, -2.2], [-20, -3.6], [-20, -4.2]]);
const P_LOLA = mkPath([...CONVOY_COMMON, [-24, -L], [-28.5, -L]]);
const P_CHISPA = mkPath(CONVOY_COMMON);
// carrera: sale de la avenida oeste, da la vuelta por el norte y acaba en la avenida este
const RACE = mkPath([[-52, 0], [-58, 0], [-64, 0], [-70, -6], [-70, -20], [-70, -45], [-70, -64], [-64, -70], [-40, -70], [0, -70], [40, -70], [64, -70], [70, -64], [70, -45], [70, -26], [70, -6], [64, 0], [56, 0], [44, 0], [34, 0]]);
const S_RAIL1 = (() => { let b = 0, bd = 1e9; RACE.pts.forEach((p, i) => { const d = Math.hypot(p[0] + 70, p[1] - RAIL_Z); if (d < bd) { bd = d; b = i; } }); return RACE.cum[b]; })();
const S_RAIL2 = (() => { let b = 0, bd = 1e9; RACE.pts.forEach((p, i) => { const d = Math.hypot(p[0] - 70, p[1] - RAIL_Z); if (d < bd) { bd = d; b = i; } }); return RACE.cum[b]; })();
const PUDDLE: [number, number] = [70, -22];
const S_PUD = (() => { let b = 0, bd = 1e9; RACE.pts.forEach((p, i) => { const d = Math.hypot(p[0] - PUDDLE[0], p[1] - PUDDLE[1]); if (d < bd) { bd = d; b = i; } }); return RACE.cum[b]; })();
const FINISH_X = 40;
// noche: plaza -> garaje
const P_HOME = mkPath([[2.2, -1.0], [6, -6.5], [11, -10.5], ...ringArc(-0.95, -0.14, 6).slice(1), [17, -L], [19.5, -L + 0.3], [20, 1.2], [20, -1.2]]);

// ---------------------------------------------------------------- tiempo: recuerdos y cámara lenta
function remap(t: number) {
  const r0 = M.recap0, d = vo.n39.d;
  if (t >= r0 && t < r0 + d) {
    const u = t - r0;
    if (u < 1.8) return 5.4 + u;               // llegó al pueblo
    if (u < 3.0) return K2.pop - 0.3 + (u - 1.8); // rescató a Chispa
    if (u < 4.8) return M.c2rev - 0.4 + (u - 3.0); // se lavó de colores
    return M.up0 - 0.2 + (u - 4.8);             // conoció a sus amigos
  }
  const f0 = M.finish - 0.9; // cámara lenta en la meta y recuperación suave
  if (t > f0 && t < f0 + 2.2) return f0 + (t - f0) * 0.45;
  if (t >= f0 + 2.2 && t < f0 + 5.2) return f0 + 0.99 + (t - f0 - 2.2) * (1 + 1.21 / 3);
  return t;
}
export const nightK = (t: number) => (t < M.night0 ? 0 : t < M.sp0 ? easeInOut(prog(t, M.night0, M.night0 + 9)) : 0);

// ---------------------------------------------------------------- estado de los personajes (t >= T3)
const COLORS = {c1: '#3d8bff', c2: '#ff3b30', c3: '#ffd23f'};
const PLAZA = {lola: [-7, -2, 0.35], chispa: [-2.8, 0.5, 0.15], bruno: [2.2, -1.0, -0.1], tico: [7.5, -2.5, -0.45]} as Record<string, [number, number, number]>;
// paradas de la visita guiada
const STOPS = [
  {x0: 30, z0: L, x1: 40, z1: L, yaw: Math.PI / 2},    // panadería (38,12)
  {x0: -L, z0: 30, x1: -L, z1: 40, yaw: 0},            // heladería (12,38)
  {x0: -70 + L, z0: 40, x1: -70 + L, z1: 28, yaw: Math.PI}, // parque
  {x0: -30, z0: 174 + L, x1: -18, z1: 174 + L, yaw: Math.PI / 2}, // puerto
];
const PLACES: [number, number][] = [[38, 12], [12, 38], [-112, 34], [-10, 205]];
const STOP_T = () => [M.stop1, M.stop2, M.stop3, M.stop4];
const stopIdx = (t: number) => { const st = STOP_T(); let k = -1; for (let i = 0; i < 4; i++) if (t >= st[i] - 2.4) k = i; return k; };
const stopEnd = (k: number) => (k < 3 ? [M.stop2, M.stop3, M.stop4][k] - 2.4 - travelDur(k + 1) : S('l5'));
const travelDur = (k: number) => Math.min(6, (STOP_T()[k] - 2.4) - (k === 0 ? M.tour0 : STOP_T()[k - 1] + 3.5));
const gapStart = (k: number) => STOP_T()[k] - 2.4 - travelDur(k);
function convoyAt(t: number, who: 'bruno' | 'lola' | 'chispa') {
  const P = who === 'bruno' ? P_BRUNO : who === 'lola' ? P_LOLA : P_CHISPA;
  const off = who === 'lola' ? 11 : who === 'chispa' ? -9 : 0;
  // distancia del convoy: montaje con saltos escondidos en los cortes
  const c0 = M.convoy0, c1 = M.convoy1, Lb = P_BRUNO.len;
  const segs: [number, number, number, number][] = [
    [0, 0.12, 0, 26], [0.12, 0.26, 26, 50], [0.26, 0.42, 50, 84], [0.42, 0.62, 84, 126], [0.62, 0.8, 126, 150], [0.8, 0.92, 150, Lb - 16], [0.92, 1, Lb - 16, Lb]];
  const u = prog(t, c0, c1);
  let s = 0;
  for (const [a, b, s0, s1] of segs) if (u >= a && u <= b) s = lerp(s0, s1, b === 1 ? easeOut(prog(u, a, b)) : prog(u, a, b));
  const q = at(P, Math.min(P.len, s + off));
  return {...q, s};
}
function lolaAt(t: number): CharPose {
  const p: CharPose = {x: 0, z: 0, yaw: 0, blink: blinkAt(t, 1), talk: talkOf(PX.lola, t)};
  if (t < M.convoy0) {
    const A = mkPath([[138.25, -40], [138.25, -5], [140, 8], [145, 19], [150.5, 27.8]]);
    const u = easeOut(prog(t, M.lolaIn, M.lolaIn + 4.4));
    const q = at(A, u * A.len);
    Object.assign(p, q, {dist: u * A.len, siren: t < S('n19') + 1 ? t : 0});
    if (u >= 1) p.yaw = yawTo(150.5, 27.8, 157, 22);
    p.pitch = 0.08 * damped(t - (M.lolaIn + 4.4), 2, 4);
    p.ladder = t > S('l2') && t < E('l2') ? 0.25 * Math.sin(prog(t, S('l2'), E('l2')) * Math.PI) : 0;
    p.y = hop(t, S('l1') + 0.2, 0.4, 0.3) + hop(t, S('l3') + 0.4, 0.35, 0.3);
    return p;
  }
  if (t < M.wash0) { const q = convoyAt(t, 'lola'); return {...p, x: q.x, z: q.z, yaw: q.yaw, dist: q.s, siren: t}; }
  if (t < M.tour0) { p.x = -28.5; p.z = -L; p.yaw = yawTo(-28.5, -L, -20, -3); p.y = hop(t, S('l4'), 0.4, 0.5); p.dist = P_LOLA.len; return p; }
  if (t < S('l5')) return tourPose(t, 'lola', p);
  if (t < M.quiz0) return ticoScenePose(t, 'lola', p);
  return plazaRace(t, 'lola', p);
}
function tourPose(t: number, who: 'bruno' | 'lola' | 'chispa', p: any) {
  let k = 0; for (let i = 0; i < 4; i++) if (t >= gapStart(i)) k = i;
  const st = STOPS[k], t0 = STOP_T()[k] - 2.4, t1 = stopEnd(k);
  const ord = who === 'lola' ? 9 : who === 'bruno' ? 0 : -8;
  const dx = Math.sin(st.yaw), dz = Math.cos(st.yaw);
  let sx: number, sz: number;
  if (t < t0) { const v = prog(t, gapStart(k), t0); sx = st.x0 - dx * 46 * (1 - v); sz = st.z0 - dz * 46 * (1 - v); p.dist = v * 46 + k * 70; }
  else { const u = prog(t, t0, t1); sx = lerp(st.x0, st.x1, u); sz = lerp(st.z0, st.z1, u); p.dist = 46 + u * 10 + k * 70; }
  p.x = sx + dx * ord; p.z = sz + dz * ord; p.yaw = st.yaw;
  return p;
}
const TICO_STAGE = {lola: [-L, 75.5, Math.PI], bruno: [-L, 83, Math.PI], chispa: [-L, 90, Math.PI]} as Record<string, [number, number, number]>;
function ticoScenePose(t: number, who: 'bruno' | 'lola' | 'chispa', p: any) {
  const [x, z, yaw] = TICO_STAGE[who];
  const u = easeOut(prog(t, S('l5') + 0.3, M.tico0 + 2));
  p.x = x; p.z = z + (1 - u) * 22; p.yaw = yaw; p.dist = u * 22;
  return p;
}
// plaza (quiz, fiesta) y carrera
function plazaRace(t: number, who: string, p: any) {
  const inRace = t >= M.race0 && t < S('n36') + 1.2;
  if (inRace) {
    const lane = who === 'lola' ? -3.1 : who === 'bruno' ? 0 : 3.1;
    const s = raceS(t, who);
    const q = at(RACE, s, lane);
    p.x = q.x; p.z = q.z; p.yaw = q.yaw; p.dist = s;
    const r1 = s - S_RAIL1, r2 = s - S_RAIL2;
    for (const r of [r1, r2]) if (r > -2 && r < 5) { const j = (r + 2) / 7; p.y = (p.y ?? 0) + Math.sin(j * Math.PI) * 1.3; p.pitch = (0.5 - j) * 0.28; }
    if (who !== 'bruno' && t > M.finish + 1.5) { p.y = (p.y ?? 0) + hop(t, M.finish + 1.6, 0.45, 0.6); }
    return p;
  }
  const [x, z, yaw] = PLAZA[who] ?? [0, 0, 0];
  const arrive = t < M.race0 ? M.quiz0 : S('n36') + 1.2;
  const u = easeOut(prog(t, arrive, arrive + 3.2));
  p.x = x - Math.sin(yaw) * (1 - u) * 14; p.z = z - Math.cos(yaw) * (1 - u) * 14; p.yaw = yaw; p.dist = u * 14;
  p.y = 0.16 * u + (1 - u) * 0;
  // reacciones del juego ¿Qué suena?
  const qw: Record<string, number> = {lola: 0, tico: 2, bruno: 3};
  if (qw[who] !== undefined) { const r = M[`q${qw[who]}rev`]; p.y += hop(t, r, 0.5, 0.9); if (t > r && t < r + 1.6) (p as any).star = 1; }
  // fiesta: baile sincronizado
  for (let r = 0; r < 2; r++) {
    p.y += hop(t, M[`up${r}`], 0.5, 1.0);
    const dq = t - M[`down${r}`]; if (dq > 0 && dq < 0.6) p.sy = 1 - 0.3 * Math.sin((dq / 0.6) * Math.PI);
    p.yaw += Math.PI * 2 * easeInOut(prog(t, M[`spin${r}`], M[`spin${r}`] + 0.9));
  }
  for (let i = 0; i < 3; i++) p.y += hop(t, M.f10 + 0.9 + i * 0.5, 0.42, 0.8);
  p.yaw += Math.PI * 2 * easeInOut(prog(t, M.f11 + 0.5, M.f11 + 1.5));
  if (t > M.free0 && t < M.free1) {
    const q = t - M.free0, ph = {lola: 0, chispa: 1.3, bruno: 2.1, tico: 0.7}[who] ?? 0;
    p.y += Math.abs(Math.sin(q * 4.2 + ph)) * 0.55; p.roll = Math.sin(q * 4.2 + ph) * 0.08; p.yaw += Math.sin(q * 1.3 + ph) * 0.35;
  }
  return p;
}
// carrera: distancia de cada corredor; cambios de líder según la narración y empate en la meta
function raceS(t: number, who: string) {
  const g = M.go, fin = M.finish, Lr = RACE.len;
  if (t < g) return 0;
  const u = clamp((t - g) / (fin - g));
  const base = Lr * (u < 0.06 ? 0.5 * (u / 0.06) * u : u - 0.03) / 0.97;
  const lead = (a: number, b: number, k: number) => Math.sin(clamp(prog(t, a, b)) * Math.PI) * k;
  const n58 = S('n58');
  let d = 0;
  if (who === 'lola') d = lead(g, n58 + 2.2, 9) - lead(n58 + 1.0, n58 + 4.5, 4);
  if (who === 'chispa') d = lead(n58 + 0.6, n58 + 4.4, 8);
  if (who === 'bruno') d = lead(n58 + 2.6, fin - 6, 10) - lead(g, n58 + 1.5, 3);
  d *= 1 - prog(t, fin - 5, fin - 0.8);
  return clamp(base + d, 0, Lr);
}
function chispaAt10(t: number): CharPose {
  const p: CharPose = {x: 0, z: 0, yaw: 0, blink: blinkAt(t, 2), talk: talkOf(PX.chispa, t)};
  if (t < M.convoy0) { const c = chispaAt(t); Object.assign(p, {x: c.x, z: c.z, y: Math.max(0, c.y), yaw: angLerp(c.yaw, yawTo(c.x, c.z, 150.5, 27.8), easeInOut(prog(t, S('l1'), S('l1') + 0.8)))}); p.y = (p.y ?? 0) + hop(t, S('b14') + 2.4, 0.4, 0.4); return p; }
  if (t < M.wash0) { const q = convoyAt(t, 'chispa'); return {...p, x: q.x, z: q.z, yaw: q.yaw, dist: q.s}; }
  if (t < M.tour0) { const q = at(P_CHISPA, P_BRUNO.len - 9); p.x = q.x; p.z = q.z; p.yaw = angLerp(q.yaw, yawTo(q.x, q.z, -20, -3), easeInOut(prog(t, M.wash0, M.wash0 + 1.5))); p.y = hop(t, S('x4'), 0.4, 0.5); return p; }
  if (t < S('l5')) return tourPose(t, 'chispa', p);
  if (t < M.quiz0) return ticoScenePose(t, 'chispa', p);
  return plazaRace(t, 'chispa', p);
}
function ticoAt(t: number): CharPose {
  const p: CharPose = {x: 0, z: 0, yaw: Math.PI / 2, blink: blinkAt(t, 3), talk: talkOf(PX.tico, t)};
  if (t < M.quiz0) {
    const u = easeOut(prog(t, M.tico0, M.ticoRev + 0.4));
    p.x = lerp(-44, -9, u); p.z = 70 + L; p.yaw = Math.PI / 2; p.dist = u * 35;
    p.arm = t > M.ticoRev ? 0.35 + 0.25 * Math.sin(Math.max(0, t - M.ticoRev) * 5) * Math.exp(-Math.max(0, t - M.ticoRev - 2) * 0.6) : 0.1;
    if (t > S('b19') + 0.5 && t < E('b19') + 0.6) p.arm = 0.6 + 0.4 * Math.sin((t - S('b19')) * 8);
    p.y = hop(t, S('t1') + 0.6, 0.4, 0.3);
    return p;
  }
  if (t >= M.race0 && t < S('n36') + 1.2) { // juez de salida con bandera
    p.x = -55; p.z = 8.5; p.yaw = Math.PI; p.arm = t < M.go ? 0.9 : 0.9 - 1.3 * easeOutBack(prog(t, M.go, M.go + 0.4), 2);
    if (t > M.finish - 4) { p.x = FINISH_X - 2; p.z = -9; p.yaw = 0; p.arm = 0.6 + 0.5 * Math.sin(t * 9); }
    return p;
  }
  plazaRace(t, 'tico', p);
  p.arm = (p.arm ?? 0.3) + (t > M.free0 && t < M.free1 ? 0.4 * Math.sin((t - M.free0) * 4) : 0.3);
  return p;
}
function cocoAt(t: number) {
  const p: CharPose = {x: -200, z: RAIL_Z, yaw: Math.PI / 2, y: 0.24, blink: blinkAt(t, 4), talk: talkOf(PX.coco, t)};
  if (t < M.coco0 - 2) return null;
  // llega por el oeste y para en la estación
  let x: number;
  if (t < M.cocoRev) x = lerp(-170, -82, prog(t, M.coco0 - 2, M.cocoRev));
  else x = lerp(-82, 3, easeOut(prog(t, M.cocoRev, E('o2'))));
  p.x = x; p.dist = x; p.puff = Math.max(0, Math.sin(t * 9)) * (t < E('o2') ? 1 : 0.3);
  return p;
}
export function bruno10(t: number): B2Pose {
  const p: B2Pose = {x: 0, z: 0, yaw: 0, eyeOpen: 1, mouth: 'smile', brow: 0.3, talk: talkOf(PX.bruno, t), beacon: 0};
  (p as any).mud = 0;
  const bl = blinkAt(t, 0); p.eyeOpen = 1 - 0.94 * bl;
  if (t < M.convoy0) {
    p.x = 157; p.z = 22; p.y = 0;
    p.yaw = angLerp(Math.PI / 2 + 0.7, yawTo(157, 22, 150.5, 27.8), easeInOut(prog(t, S('l1') - 0.3, S('l1') + 0.4)));
    (p as any).mud = 1;
    p.mouth = 'grin'; p.brow = 0.8;
    if (t > S('b14') && t < E('b14')) { p.lift = hop(t, S('b14') + 2.5, 0.5, 1.0); p.eyeScale = 1.2; p.brow = 1; p.arm = 20; }
    if (t > S('l3') + 0.6 && t < E('b15')) { p.mouth = 'o'; p.lookY = -0.7; p.browTilt = 0.6; p.eyeScale = 1.1; }
    if (t > S('b15') + 1) { p.mouth = 'flat'; p.browTilt = 0.7; p.lookY = 0; }
    if (t > S('n20')) { p.mouth = 'grin'; p.brow = 1; p.lift = hop(t, S('n20') + 1.2, 0.4, 0.5); }
    return p;
  }
  if (t < M.wash0 + 1.0) {
    const q = convoyAt(t, 'bruno');
    p.x = q.x; p.z = q.z; p.yaw = q.yaw; p.wheel = q.s / 0.43; (p as any).mud = 1; p.mouth = 'grin'; p.brow = 0.8; p.beacon = 0.5 + 0.5 * Math.sin(t * 14);
    p.hookSway = Math.sin(t * 6) * 0.3; p.wheelBounce = [0, 1, 2, 3].map((i) => Math.max(0, Math.sin(t * 13 + i * 1.7)) * 0.04);
    return p;
  }
  if (t < M.tour0) { washPose(t, p); return p; }
  if (t < S('l5')) { const q: any = tourPose(t, 'bruno', {}); p.x = q.x; p.z = q.z; p.yaw = q.yaw; p.wheel = q.dist / 0.43; p.lookX = 0.7 * Math.sin(prog(t, STOP_T()[Math.max(0, stopIdx(t))] - 1, STOP_T()[Math.max(0, stopIdx(t))] + 1.5) * Math.PI); p.mouth = 'grin'; return p; }
  if (t < M.quiz0) {
    const q: any = ticoScenePose(t, 'bruno', {}); p.x = q.x; p.z = q.z; p.yaw = q.yaw; p.wheel = q.dist / 0.43;
    if (t > M.tico0 && t < M.ticoRev) { p.mouth = 'o'; p.eyeScale = 1.15; p.lookX = -0.6; }
    if (t > S('k1') - 0.5 && t < E('n33')) { p.lookY = 0.8; p.lookX = -0.5; p.mouth = 'grin'; }
    if (t > S('b19') && t < E('b19')) { p.arm = 25 + 10 * Math.sin(t * 8); }
    if (t > S('n34') && t < E('b20')) { p.lookX = 0; p.lookY = 0.6; p.mouth = 'o'; }
    return p;
  }
  if (t >= M.race0 && t < S('n36') + 1.2) {
    const q: any = plazaRace(t, 'bruno', {}); p.x = q.x; p.z = q.z; p.yaw = q.yaw; p.wheel = q.dist / 0.43; p.lift = q.y ?? 0; p.pitch = q.pitch ?? 0;
    p.brow = 0.2; p.browTilt = -0.6; p.mouth = 'grin'; p.beacon = t > M.go ? 0.5 + 0.5 * Math.sin(t * 16) : 0;
    if (t > M.go) p.wheelBounce = [0, 1, 2, 3].map((i) => Math.max(0, Math.sin(t * 13 + i * 1.7)) * 0.04);
    if (t > M.finish) { p.brow = 1; p.browTilt = 0; p.eyeScale = 1.15; p.lift = (p.lift ?? 0) + hop(t, M.finish + 1.6, 0.45, 0.7); }
    return p;
  }
  if (t < M.night0 + 3) {
    const q: any = plazaRace(t, 'bruno', {}); p.x = q.x; p.z = q.z; p.yaw = q.yaw; p.wheel = q.dist / 0.43; p.lift = q.y ?? 0; p.roll = q.roll; p.sy = q.sy;
    p.mouth = 'grin'; p.brow = 0.8;
    if (t > S('n47') && t < M.race0) { p.lookY = 0.3; }
    if (t > M.free0 && t < M.free1) { p.arm = 20 + 15 * Math.sin((t - M.free0) * 5); p.beacon = 0.5 + 0.5 * Math.sin(t * 14); }
    if (t > S('b22') && t < E('b22')) { p.eyeScale = 1.2; p.brow = 1; }
    return p;
  }
  // noche: vuelve al garaje, se despide y entra marcha atrás
  const u = prog(t, M.night0 + 3, S('b23') - 0.4);
  const q = at(P_HOME, easeInOut(u) * P_HOME.len);
  p.x = q.x; p.z = q.z; p.yaw = q.yaw; p.wheel = easeInOut(u) * P_HOME.len / 0.43;
  if (u >= 1) { p.yaw = 0; p.x = 20; p.z = -1.2; }
  p.mouth = 'smile'; p.brow = 0.2; p.eyeOpen = Math.min(p.eyeOpen, 0.75);
  if (t > S('b23') - 0.4) { p.yaw = angLerp(Math.PI, 0, easeInOut(prog(t, S('b23') - 1.2, S('b23') - 0.2))); p.arm = 25 + 12 * Math.sin(t * 7); p.mouth = 'grin'; p.eyeOpen = Math.max(p.eyeOpen, 0.9); }
  if (t > M.door - 0.6) { const r = easeInOut(prog(t, M.door - 0.6, M.door + 1.6)); p.z = lerp(-1.2, -10.5, r); p.wheel = -r * 22; p.arm = 0; }
  if (t > M.sp0) { // spoiler: día, junto a Tico en las obras
    p.x = 104; p.z = -112; p.yaw = Math.PI * 0.75; p.mouth = 'o'; p.eyeScale = 1.3; p.brow = 1; p.eyeOpen = 1; p.lookY = -0.6; p.arm = 0;
  }
  return p;
}
function washPose(t: number, p: B2Pose) {
  const A: [number, number] = [-20, -2.4], B: [number, number] = [-20, -6.4];
  const cycles: [number, number, string | undefined][] = [[M.c1in, M.c1rev, COLORS.c1], [M.c2in, M.c2rev, COLORS.c2], [M.c3in, M.c3rev, COLORS.c3], [M.c4in, M.c4rev, undefined]];
  p.x = A[0]; p.z = A[1]; p.yaw = 0; (p as any).mud = 1; p.mouth = 'grin'; p.brow = 0.6;
  // aproximación desde el convoy: media vuelta con saltito para entrar marcha atrás
  if (t < M.c1in) { const q = at(P_BRUNO, P_BRUNO.len); p.x = q.x; const v = prog(t, M.wash0 + 1, M.wash0 + 2.0); p.z = lerp(-4.2, A[1], easeInOut(v)); p.yaw = angLerp(Math.PI, 0, easeInOut(v)); p.lift = Math.sin(v * Math.PI) * 0.5; }
  let paint: string | undefined; let mud = 1;
  for (const [cin, rev, col] of cycles) {
    if (t >= cin) {
      const goIn = easeInOut(prog(t, cin, rev - 0.5)), goOut = easeInOut(prog(t, rev - 0.35, rev + 0.8));
      p.z = lerp(A[1], B[1], goIn) + (B[1] - A[1]) * -goOut;
      p.wheel = (goIn - goOut) * 10;
      if (t > rev - 0.25) { paint = col; mud = 0; }
      if (t > cin && t < rev + 0.2) { p.mouth = 'o'; p.eyeOpen = 0.3; }
    }
  }
  (p as any).paint = paint; (p as any).mud = mud;
  // poses de presumir el color
  for (const rev of [M.c1rev, M.c2rev, M.c3rev, M.c4rev]) {
    const d = t - (rev + 0.8);
    if (d > 0 && d < 1.2) { p.yaw = Math.PI * 2 * easeInOut(clamp(d / 1.0)); p.lift = Math.sin(clamp(d / 1.0) * Math.PI) * 0.5; p.mouth = 'grin'; p.eyeScale = 1.15; }
  }
  if (t > S('b17') && t < E('b17')) { p.mouth = t < S('b17') + 1.8 ? 'grin' : 'flat'; p.browTilt = 0.5; }
  if (t > M.c4rev) { p.glow = Math.exp(-(t - M.c4rev) * 1.5) * 0.7; p.beacon = 0.5 + 0.5 * Math.sin(t * 14); }
  if (t > S('b18')) { p.lift = (p.lift ?? 0) + hop(t, S('b18') + 0.4, 0.45, 0.6); p.brow = 1; }
}

// ---------------------------------------------------------------- cámara
type Shot = {t0: number; t1: number; f: (u: number, t: number) => Cam};
const BP = (t: number) => bruno10(t);
function shots(): Shot[] {
  const sh: Shot[] = [];
  const add = (t0: number, t1: number, f: (u: number, t: number) => Cam) => sh.push({t0, t1, f});
  const lo = (t: number) => lolaAt(t), ch = (t: number) => chispaAt10(t), ti = (t: number) => ticoAt(t);
  // B · llega Lola
  add(T3, S('l1') + 1.3, (u, t) => { const l = lo(t); return F([154, 2.6, 34], [l.x, 1.6, l.z], 46); });
  add(S('l1') + 1.3, S('n19'), (u, t) => { const l = lo(t); return F(mix3([147, 1.6, 33], [147.6, 1.7, 32.4], u), [l.x, 1.8, l.z], 40); });
  add(S('n19'), S('l2'), (u) => F(mix3([155.2, 1.6, 23.6], [154.4, 1.9, 24.2], easeOut(u)), [150.5, 2.1, 27.8], 44));
  add(S('l2'), S('b14'), (u) => F(mix3([159.4, 2.6, 31.4], [158.9, 2.5, 30.8], u), [153.8, 1.7, 24.9], 44));
  add(S('b14'), S('l3'), (u) => F(mix3([152.4, 1.7, 25.2], [152.9, 1.7, 24.8], u), [157, 1.7, 22], 38));
  add(S('l3'), S('l3') + 1.2, (u) => F([153.8, 1.9, 23.4], [150.5, 2.0, 27.8], 38));
  add(S('l3') + 1.2, S('b15'), (u) => F(mix3([153.3, 1.5, 24.6], [153.8, 1.45, 24.0], u), [157, 1.4, 22], 32));
  add(S('b15'), S('n20'), (u) => F(mix3([152.9, 1.7, 25.0], [153.2, 1.7, 24.7], u), [157, 1.6, 22], 36));
  add(S('n20'), M.convoy0, (u) => F(mix3([150, 4.5, 37], [149, 5, 39], u), [156, 1.2, 24], 46));
  // C · convoy (montaje)
  const c0 = M.convoy0, c1 = M.convoy1, cd = (a: number) => c0 + (c1 - c0) * a;
  add(c0, cd(0.12), (u, t) => { const b = BP(t); return F([136, 2.2, 14], [b.x, 1.2, b.z], 42); });
  add(cd(0.12), cd(0.26), (u) => F(mix3([166, 1.8, 84], [166.5, 1.9, 84.6], u), [169, 1.3, 95], 42)); // tractor
  add(cd(0.26), cd(0.42), (u, t) => { const b = BP(t); return F([b.x + 22 - 6 * u, 20, b.z + 18], [b.x - 8, 0, b.z], 50); });
  add(cd(0.42), cd(0.56), (u) => F(mix3([-42, 1.8, 64], [-38, 1.9, 63], u), [-30, 1.6, 74], 42)); // autobús
  add(cd(0.56), cd(0.66), (u, t) => { const c = ch(t); const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), sx = -Math.cos(c.yaw), sz = Math.sin(c.yaw); return F([c.x + sx * 4.0 + fx * 0.6, 1.0, c.z + sz * 4.0 + fz * 0.6], [c.x + fx * 0.2, 0.55, c.z + fz * 0.2], 44); }); // ruedas de Chispa
  add(cd(0.66), cd(0.8), (u, t) => { const b = BP(t); return F([b.x - 18, 34 - 6 * u, b.z + 30], [b.x - 30, 0, b.z - 10], 48); });
  add(cd(0.8), cd(0.92), (u, t) => { const b = BP(t); return F([0, 5 + 3 * u, 22], [b.x, 1, b.z], 46); });
  add(cd(0.92), c1, (u, t) => { const b = BP(t); return F([-13, 2.6, 8], [b.x, 1.3, b.z], 42); });
  // D · lavadero de colores
  add(M.convoy1, M.c1in, (u) => F(mix3([-20, 14, 24], [-20, 3.2, 9], easeInOut(u)), [-20, 3, -8], 46));
  const washCycle = (cin: number, rev: number, next: number) => {
    add(cin, rev - 0.3, (u) => F(mix3([-11.5, 2.4, 2.5], [-12.2, 2.3, 1.6], u), [-20, 1.6, -6], 42));
    add(rev - 0.3, next, (u) => F(mix3([-20, 1.5, 5.2], [-20, 1.6, 4.6], u), [-20, 1.5, -2.4], 40));
  };
  washCycle(M.c1in, M.c1rev, S('l4') > M.c2in ? M.c2in : M.c2in);
  washCycle(M.c2in, M.c2rev, S('l4'));
  add(S('l4'), M.c3in, (u) => F(mix3([-24.5, 1.9, 2.2], [-24.8, 1.9, 1.8], u), [-28.5, 2.0, -L], 38));
  washCycle(M.c3in, M.c3rev, M.c4in);
  washCycle(M.c4in, M.c4rev, S('x4'));
  add(S('x4'), S('l7'), (u) => F(mix3([-8.5, 1.3, 1.6], [-8.8, 1.3, 1.3], u), [-11.5, 0.9, -L], 38));
  add(S('l7'), M.tour0, (u) => F([-24, 2, 4], [-28.5, 1.8, -L], 40));
  // T · visita guiada (viaje aéreo entre paradas)
  for (let k = 0; k < 4; k++) add(gapStart(k), STOP_T()[k] - 2.4, (u, t) => { const b = BP(t); return F([b.x - 16 + 4 * u, 22 - 4 * u, b.z + 20], [b.x + Math.sin(STOPS[k].yaw) * 10, 0, b.z + Math.cos(STOPS[k].yaw) * 10], 50); });
  const est = [[[31, 4, 5], [36, 3, 11]], [[18, 2.4, 28], [12, 4.0, 38]], [[-58, 9, 22], [-112, 0, 34]], [[-10, 4, 165], [-10, 1, 200]]] as [V3, V3][];
  STOP_T().forEach((ts, k) => {
    const t0 = ts - 2.4, t1 = stopEnd(k);
    add(t0, ts + 0.6, (u) => F(mix3(est[k][0], [est[k][0][0] + 0.6, est[k][0][1], est[k][0][2] - 1.2], u), est[k][1], 46));
    add(ts + 0.6, t1, (u, t) => { const b = BP(t); const pl = PLACES[k]; const y = STOPS[k].yaw; const fx = Math.sin(y), fz = Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y); const sg = Math.sign((pl[0] - b.x) * rx + (pl[1] - b.z) * rz) || 1; return F([b.x - sg * rx * 3.3 + fx * 4.2, 1.7, b.z - sg * rz * 3.3 + fz * 4.2], [b.x + sg * rx * 1.2, 1.5, b.z + sg * rz * 1.2], 46); });
  });
  // E · Tico
  add(S('l5'), M.tico0 + 2, (u, t) => { const b = BP(t); return F([b.x + 5, 2.6, b.z + 9], [b.x, 1.4, b.z - 6], 44); });
  add(M.tico0 + 2, M.ticoRev, (u, t) => { const k = ti(t); return F(mix3([-6, 3.2, 84], [-6.5, 3.0, 83], u), [k.x + 2, 2.2, k.z], 44); });
  add(M.ticoRev, S('n31'), (u, t) => { const k = ti(t); return F(mix3([k.x + 7, 2.2, k.z + 6], [k.x + 6, 2.4, k.z + 5], u), [k.x, 2.4, k.z], 40); });
  add(S('n31'), S('t2'), (u, t) => { const k = ti(t); return F(mix3([k.x + 5.5, 2.9, k.z + 2.5], [k.x + 4.8, 3.0, k.z + 2.2], easeOut(u)), [k.x, 2.8, k.z], 38); });
  add(S('t2'), S('b19'), (u, t) => { const k = ti(t); return F([k.x + 6, 3.5, k.z + 9], [k.x + 3, 3.5, k.z], 42); });
  add(S('b19'), S('n32'), (u) => F(mix3([1.6, 1.6, 79.2], [1.8, 1.6, 78.8], u), [-L, 1.6, 83], 38));
  add(S('n32'), E('n33') + 0.4, (u, t) => { const k = ti(t); return F(mix3([k.x + 10, 3.6, k.z + 5], [k.x + 9.4, 3.9, k.z + 4.6], u), [k.x + 2.6, 4.6, k.z - 0.4], 46); });
  // G · Coco
  add(E('n33') + 0.4, M.cocoRev - 0.4, (u) => F(mix3([-64, 1.5, RAIL_Z + 5.5], [-64.5, 1.6, RAIL_Z + 5], u), [-110, 2, RAIL_Z], 42));
  add(M.cocoRev - 0.4, S('n35'), (u, t) => { const c = cocoAt(t); return F([-66, 1.7, RAIL_Z + 6], [c ? c.x : -80, 2, RAIL_Z], 46); });
  add(S('n35'), S('o2'), (u, t) => { const c = cocoAt(t); const x = c ? c.x : 0; return F([x + 8, 2.2, RAIL_Z + 5.5], [x, 2.3, RAIL_Z], 40); });
  add(S('o2'), S('b20'), (u) => F(mix3([10, 2.4, RAIL_Z + 4.5], [9.4, 2.4, RAIL_Z + 4.2], u), [3, 2.2, RAIL_Z], 40));
  add(S('b20'), S('b20') + 1.4, (u) => F([1.8, 1.4, 79.0], [-L, 2.2, 83], 38));
  add(S('b20') + 1.4, M.quiz0, (u) => F(mix3([0, 3, -4], [0, 4, -6], u), [0, 10, -40], 50)); // corazones de humo sobre la estación
  // Q · ¿Qué suena? (plaza)
  add(M.quiz0, S('n47'), (u) => F(mix3([30, 40, 50], [8, 6, 20], easeInOut(u)), [0, 1, 0], 46));
  add(S('n47'), S('n48'), (u) => F(mix3([0, 3.2, 15], [0, 2.8, 13], u), [0, 1.4, -1], 44));
  const qs = [['lola', 'n48', 'n49'], ['coco', 'n50', 'n51'], ['tico', 'n52', 'n53'], ['bruno', 'n54', 'n55']];
  qs.forEach(([who, a, b], q) => {
    add(S(a), M[`q${q}rev`], (u) => F(mix3([0, 2.6, 13], [0, 2.4, 11.5], u), [0, 1.5, -1], 44));
    const nxt = q < 3 ? S(qs[q + 1][1]) : E('b28');
    if (who === 'coco') add(M[`q${q}rev`], nxt, (u) => F(mix3([10, 2.4, RAIL_Z + 4.5], [9.6, 2.5, RAIL_Z + 4.2], u), [3, 2.4, RAIL_Z], 38));
    else { const [x, z] = PLAZA[who]; add(M[`q${q}rev`], nxt, (u) => F(mix3([x * 0.7, 1.8, z + 5.6], [x * 0.7, 1.9, z + 5.0], u), [x, who === 'tico' ? 2.4 : 1.6, z], 40)); }
  });
  // R · carrera
  add(E('b28'), M.race0, (u) => F(mix3([-20, 6, 18], [-34, 10, 22], u), [-50, 1, 0], 50));
  add(M.race0, S('t5'), (u) => F(mix3([-45, 2.4, 9], [-44, 2.3, 8], u), [-53, 1.3, 0], 46));
  add(S('t5'), S('n57'), (u) => F(mix3([-51.5, 3.2, 12.5], [-51.8, 3.4, 12.0], u), [-55, 3.2, 8.5], 40));
  add(S('n57'), M.go + 0.3, (u) => F(mix3([-59, 1.0, 0], [-58.5, 1.0, 0], u), [-52, 1.2, 0], 46));
  const rc = (t: number, back = 9, h = 3.5, side = 4) => { const s = Math.max(raceS(t, 'bruno'), raceS(t, 'lola'), raceS(t, 'chispa')) - 3; const q = at(RACE, s); const c = Math.sin(q.yaw), d = Math.cos(q.yaw); return F([q.x - c * back + d * side, h, q.z - d * back - c * side], [q.x + c * 4, 1.2, q.z + d * 4], 48); };
  const g = M.go, fin = M.finish, rd = (a: number) => g + (fin - g) * a;
  add(M.go + 0.3, rd(0.12), (u, t) => rc(t, 10, 2.2, 5));
  add(rd(0.12), rd(0.14), (u, t) => rc(t, -9, 1.6, -3)); // de frente
  add(rd(0.14), rd(0.26), (u) => F([-62, 1.7, RAIL_Z + 6], [-70, 1.4, RAIL_Z], 46)); // salto en la vía
  add(rd(0.26), rd(0.36), (u, t) => rc(t, -9, 1.6, -3));
  add(rd(0.36), rd(0.52), (u, t) => rc(t, 14, 16, 0)); // dron sobre la estación
  add(rd(0.52), rd(0.68), (u, t) => rc(t, 6, 1.4, 4.5));
  add(rd(0.68), rd(0.78), (u) => F([76, 1.8, RAIL_Z + 7], [70, 1.3, RAIL_Z], 46));
  add(rd(0.78), rd(0.86), (u) => F([77, 1.3, PUDDLE[1] + 4], [70, 0.8, PUDDLE[1]], 46)); // charco
  add(rd(0.86), fin - 0.9, (u, t) => rc(t, -12, 1.8, 0)); // recta final de frente
  add(fin - 0.9, E('n59'), (u) => F(mix3([FINISH_X + 2, 1.6, 9], [FINISH_X + 1, 1.8, 8.5], u), [FINISH_X - 2, 1.4, 0], 40)); // meta lateral
  add(E('n59'), S('n36'), (u) => F(mix3([FINISH_X + 8, 2.0, 2], [FINISH_X + 7.5, 2.0, 1.6], u), [FINISH_X - 2, 1.5, 0], 40));
  // H · fiesta
  add(S('n36'), M.party0 + 1.2, (u) => F(mix3([20, 30, 40], [6, 7, 18], easeInOut(u)), [0, 1, 0], 48));
  const who = [['l6', 'lola'], ['t3', 'tico'], ['o3', 'coco'], ['x5', 'chispa'], ['b21', 'bruno']];
  who.forEach(([k, w], i) => {
    const t1 = i < 4 ? S(who[i + 1][0]) : S('n37');
    if (w === 'coco') add(S(k) - 0.2, t1, () => F([10, 2.4, RAIL_Z + 4.5], [3, 2.4, RAIL_Z], 38));
    else { const [x, z] = PLAZA[w]; add(i === 0 ? M.party0 + 1.2 : S(k) - 0.2, t1, (u) => F(mix3([x * 0.7, 1.8, z + 5.4], [x * 0.7, 1.85, z + 4.9], u), [x, w === 'tico' ? 2.4 : 1.6, z], 40)); }
  });
  add(S('n37'), M.free0, (u, t) => F([Math.sin(t * 0.25) * 4, 3.4, 16], [0, 1.8, -1], 46));
  const fd = (a: number) => M.free0 + (M.free1 - M.free0) * a;
  for (let i = 0; i < 10; i++) {
    const a = i / 10, b = (i + 1) / 10;
    add(fd(a), fd(b), (u, t) => {
      if (i % 3 === 0) { const ang = t * 0.4 + i; return F([Math.sin(ang) * 14, 3 + Math.sin(t) * 0.5, Math.cos(ang) * 14], [0, 1.5, -1], 46); }
      if (i % 3 === 1) { const w2 = ['lola', 'chispa', 'bruno', 'tico'][i % 4]; const [x, z] = PLAZA[w2]; return F([x * 0.6, 1.6, z + 5.2], [x, 1.7, z], 40); }
      return F([0, 14 - 4 * u, 12], [0, 0.8, -1], 50);
    });
  }
  add(M.free1, S('b22') + 0.2, (u) => F(mix3([2.2, 1.7, 4.6], [2.2, 1.7, 4.2], u), [2.2, 1.6, -1], 40));
  add(S('b22') + 0.2, M.night0, (u) => F([2.2, 2, 5], [2.2, 1.8, -1], 40));
  // N · noche
  add(M.night0, M.night0 + 5, (u) => F(mix3([0, 6, 22], [0, 30, 50], easeInOut(u)), mix3([0, 2, 0], [0, 12, -40], easeInOut(u)), 50));
  add(M.night0 + 5, S('b23') - 1.2, (u, t) => { const b = BP(t); return F([b.x + 6, 2.6, b.z + 8], [b.x, 1.2, b.z], 44); });
  add(S('b23') - 1.2, M.door - 0.6, (u) => F(mix3([20, 1.7, 5.4], [20, 1.7, 4.8], u), [20, 1.6, -1.2], 38));
  add(M.door - 0.6, M.logo0, (u) => F(mix3([20, 2.2, 9], [20, 3.4, 13], easeInOut(u)), [20, 3, -8], 42));
  add(M.logo0, M.sp0, () => F([20, 8, 30], [20, 14, -60], 50));
  // S · avance del próximo capítulo
  add(M.sp0, S('t4'), (u) => F(mix3([96, 3, -100], [99, 2.2, -103], u), [110, 0.5, -112], 44));
  add(S('t4'), S('b24'), (u) => F(mix3([105, 2.6, -102], [106, 2.8, -103.5], u), [112, 2.6, -112], 40));
  add(S('b24'), S('n42'), (u) => F(mix3([101, 1.7, -108.5], [101.6, 1.7, -109.2], u), [104, 1.6, -112], 34));
  add(S('n42'), 605, (u) => F(mix3([108, 6, -106], [110, 2.2, -110], easeIn(u)), [110, -1, -112], 40 - 12 * u));
  return sh;
}
let SHOTS10: Shot[] | null = null;
function cam10(t: number): Cam {
  if (t < T3) return camAtT(t);
  SHOTS10 = SHOTS10 ?? shots();
  const s = [...SHOTS10].reverse().find((x) => t >= x.t0 && t < x.t1) ?? SHOTS10[0];
  const c = s.f(clamp((t - s.t0) / Math.max(1e-3, s.t1 - s.t0)), t);
  const punches = [S('n19'), M.c1rev, M.c2rev, M.c3rev, M.c4rev, M.ticoRev, M.cocoRev, M.q0rev, M.q1rev, M.q2rev, M.q3rev, M.go, M.finish, M.album];
  let fov = c.fov;
  for (const pt of punches) { const d = t - pt; if (d > 0 && d < 0.4) fov *= 1 - 0.07 * Math.sin((d / 0.4) * Math.PI); }
  const sh = 0.05 * damped(t - M.go, 8, 7) + 0.03 * damped(t - (M.lolaIn + 4.4), 8, 7);
  return {pos: [c.pos[0], c.pos[1] + sh, c.pos[2]], at: c.at, fov};
}

// ---------------------------------------------------------------- luz, cielo y noche
export const VFOV = (fov: number, vert: boolean) => (vert ? (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * 1.75) * 180) / Math.PI : fov);
const Rig: React.FC<{te: number; lib: Lib; vert?: boolean}> = ({te, lib, vert = false}) => {
  const {camera, scene} = useThree();
  const c = cam10(te);
  camera.position.set(...c.pos); camera.lookAt(...c.at);
  const pc = camera as THREE.PerspectiveCamera; pc.fov = VFOV(c.fov, vert); pc.near = 0.1; pc.far = 1400; pc.updateProjectionMatrix();
  const nk = nightK(te), dawn = 1 - prog(te, 0, 5);
  scene.background = lib.sky; scene.environment = lib.sky;
  (scene as any).backgroundIntensity = (1.0 - dawn * 0.25) * (1 - 0.88 * nk); (scene as any).environmentIntensity = 0.55 * (1 - 0.65 * nk);
  (scene as any).backgroundRotation = new THREE.Euler(0, 1.2, 0); (scene as any).environmentRotation = new THREE.Euler(0, 1.2, 0);
  scene.fog = new THREE.Fog(new THREE.Color('#dcecfa').lerp(new THREE.Color('#1b2340'), nk), 170, 620);
  applyNight(nk);
  return null;
};
const Lights: React.FC<{te: number}> = ({te}) => {
  const {gl} = useThree();
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  const l = useMemo(() => { const d = new THREE.DirectionalLight('#fff1dc', 2.6); d.castShadow = true; d.shadow.mapSize.set(4096, 4096); d.shadow.bias = -0.00025; d.shadow.normalBias = 0.035; d.shadow.radius = 3; return d; }, []);
  const c = cam10(te);
  const dist = Math.hypot(c.pos[0] - c.at[0], c.pos[1] - c.at[1], c.pos[2] - c.at[2]);
  const ext = clamp(dist * 1.1, 36, 150);
  const sc = l.shadow.camera as THREE.OrthographicCamera;
  if (sc.right !== ext) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 420; sc.updateProjectionMatrix(); }
  const step = (2 * ext) / 4096;
  const fx = Math.round((c.at[0] + (c.pos[0] - c.at[0]) * 0.25) / step) * step, fz = Math.round((c.at[2] + (c.pos[2] - c.at[2]) * 0.25) / step) * step;
  const nk = nightK(te), dawn = 1 - prog(te, 0, 5);
  l.position.set(fx + 52 - dawn * 14 - nk * 30, 88 - dawn * 26 - nk * 30, fz + 46); l.target.position.set(fx, 0, fz);
  l.color.set('#fff1dc').lerp(new THREE.Color('#ffc58a'), dawn * 0.6).lerp(new THREE.Color('#8fa8ff'), nk);
  l.intensity = (3.0 - dawn * 0.6) * (1 - 0.82 * nk);
  return (<><primitive object={l} /><primitive object={l.target} /><hemisphereLight args={[new THREE.Color('#d8f0ff').lerp(new THREE.Color('#33407a'), nk), new THREE.Color('#8fd16a').lerp(new THREE.Color('#1c2433'), nk), 0.55 * (1 - 0.5 * nk)]} /></>);
};
const NightSky: React.FC<{k: number}> = ({k}) => {
  const stars = useMemo(() => {
    const g = new THREE.BufferGeometry(); const n = 900, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const th = hash(i) * Math.PI * 2, ph = 0.08 + hash(i + 7) * 1.2, r = 900; a[i * 3] = Math.cos(th) * Math.cos(ph) * r; a[i * 3 + 1] = Math.sin(ph) * r; a[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * r; }
    g.setAttribute('position', new THREE.BufferAttribute(a, 3)); return g;
  }, []);
  if (k < 0.02) return null;
  return (
    <group>
      <points geometry={stars}><pointsMaterial color="#ffffff" size={3.2} sizeAttenuation={false} transparent opacity={k} toneMapped={false} fog={false} /></points>
      <mesh position={[-160, 260, -700]}><sphereGeometry args={[34, 32, 20]} /><meshBasicMaterial color="#fff4c8" transparent opacity={k} toneMapped={false} fog={false} /></mesh>
    </group>
  );
};

// ---------------------------------------------------------------- piezas 3D
const Foam: React.FC<{t: number}> = ({t}) => {
  const cyc = [[M.c1in, M.c1rev], [M.c2in, M.c2rev], [M.c3in, M.c3rev], [M.c4in, M.c4rev]];
  let k = 0;
  for (const [a, b] of cyc) k = Math.max(k, Math.sin(clamp(prog(t, a + 0.4, b + 0.45)) * Math.PI));
  const spin = cyc.some(([a, b]) => t > a && t < b + 0.8);
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[-20 + s * 1.6, 1.7, -8.1]} rotation={[0, spin ? t * 9 * s : 0, 0]}>
          {Array.from({length: 8}).map((_, i) => <mesh key={i} rotation={[0, (i / 8) * Math.PI * 2, 0]} position={[Math.cos((i / 8) * Math.PI * 2) * 0.6, 0, Math.sin((i / 8) * Math.PI * 2) * 0.6]}><boxGeometry args={[0.08, 3.0, 0.28]} /><meshStandardMaterial color={['#ff5f9a', '#3d8bff', '#ffd23f', '#39c47a'][i % 4]} roughness={0.8} /></mesh>)}
        </group>
      ))}
      {k > 0.02 ? Array.from({length: 42}).map((_, i) => {
        const a = hash(i) * Math.PI * 2, r = 0.6 + hash(i + 3) * 2.2, y = 0.3 + hash(i + 5) * 2.8;
        const w = Math.sin(t * 3 + i) * 0.15;
        return <mesh key={i} position={[-20 + Math.cos(a) * r * 0.9 + w, y, -6.6 + Math.sin(a) * r * 0.7]} scale={k * (0.35 + hash(i + 9) * 0.5)}><sphereGeometry args={[1, 14, 10]} /><meshPhysicalMaterial color="#ffffff" roughness={0.15} clearcoat={1} transparent opacity={0.9} /></mesh>;
      }) : null}
    </group>
  );
};
const Balloons: React.FC<{lib: Lib; t: number; tico: CharPose}> = ({lib, t, tico}) => {
  const cols = ['globo_rojo', 'globo_azul', 'globo_amarillo', 'globo_verde', 'globo_rosa'];
  const counts = [1, 2, 3, 4, 5].map((i) => S(`k${i}`));
  if (t < M.tico0 - 1) return null;
  const party = t > M.party0 - 1;
  return (
    <group>
      {cols.map((m, i) => {
        let x, y, z;
        if (!party) {
          const a = tico.arm ?? 0;
          const c = Math.cos(tico.yaw), s = Math.sin(tico.yaw);
          const ly = 2.0 + 0.45 * Math.cos(a) + 3.45 * Math.sin(a), lz = 0.9 + 3.45 * Math.cos(a) - 0.45 * Math.sin(a);
          x = tico.x + 0.95 * c + lz * s + (i - 2) * 0.55; y = ly + 0.1 + Math.abs(i - 2) * -0.15; z = tico.z - 0.95 * s + lz * c + Math.sin(i) * 0.3;
        } else { const ang = (i / 5) * Math.PI * 2 + 0.3; x = Math.cos(ang) * 8.8; z = Math.sin(ang) * 8.8; y = 4.6; }
        const k = t > counts[i] ? 1 + 0.35 * Math.exp(-(t - counts[i]) * 4) * Math.sin((t - counts[i]) * 20) : 1;
        const bob = Math.sin(t * 1.7 + i) * 0.12;
        return <group key={m} position={[x, y + bob, z]} scale={k}>{lib.assets[m]?.parts.map((p, j) => <mesh key={j} geometry={p.geo} material={p.mat} castShadow />)}</group>;
      })}
    </group>
  );
};
const Hearts: React.FC<{t: number; t0: number; c: V3}> = ({t, t0, c}) => {
  const g = useMemo(() => { const s = new THREE.Shape(); s.moveTo(0, -0.6); s.bezierCurveTo(-1.1, 0.1, -0.6, 0.9, 0, 0.4); s.bezierCurveTo(0.6, 0.9, 1.1, 0.1, 0, -0.6); return new THREE.ExtrudeGeometry(s, {depth: 0.25, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3}); }, []);
  const d = t - t0;
  if (d < 0 || d > 9) return null;
  return (
    <group>
      {Array.from({length: 7}).map((_, i) => {
        const q = d - i * 0.6; if (q < 0 || q > 5) return null;
        return <mesh key={i} geometry={g} position={[c[0] + Math.sin(q * 1.5 + i) * 0.8, c[1] + q * 2.2, c[2]]} scale={0.6 + q * 0.5} rotation={[0, Math.sin(q + i) * 0.4, Math.sin(q * 2) * 0.15]}><meshPhysicalMaterial color={i % 2 ? '#ff7aa2' : '#ffffff'} roughness={0.4} transparent opacity={1 - q / 5} /></mesh>;
      })}
    </group>
  );
};
const Steam: React.FC<{t: number; c: CharPose | null}> = ({t, c}) => {
  if (!c) return null;
  const cx = c.x + Math.sin(c.yaw) * -1.3, cz = c.z + Math.cos(c.yaw) * -1.3;
  return (
    <group>
      {Array.from({length: 10}).map((_, i) => {
        const q = ((t * 0.8 + i * 0.25) % 2.5);
        return <mesh key={i} position={[cx - q * 2.2 * Math.sin(c.yaw), 3.6 + q * 1.6, cz - q * 2.2 * Math.cos(c.yaw)]} scale={0.35 + q * 0.5}><sphereGeometry args={[1, 12, 10]} /><meshStandardMaterial color="#ffffff" transparent opacity={0.85 * (1 - q / 2.5)} roughness={1} /></mesh>;
      })}
    </group>
  );
};
const Barrier: React.FC<{x: number; t: number}> = ({x, t}) => {
  const down = t > M.coco0 - 1 && t < M.cocoRev + 3.5 ? 1 : 0;
  const a = down ? easeOut(prog(t, M.coco0 - 1, M.coco0)) : 1 - easeOut(prog(t, M.cocoRev + 3.5, M.cocoRev + 4.5));
  const k = t > M.coco0 - 1 && t < M.cocoRev + 4.5 ? a : 0;
  return (
    <group>
      {[[-1, RAIL_Z + 4.2], [1, RAIL_Z - 4.2]].map(([s, z], i) => (
        <group key={i} position={[x + s * 5.2, 0, z]}>
          <mesh position={[0, 0.7, 0]} castShadow><cylinderGeometry args={[0.14, 0.18, 1.4, 12]} /><meshStandardMaterial color="#2f3b57" /></mesh>
          <mesh position={[0, 1.35, 0.15]}><sphereGeometry args={[0.16, 12, 10]} /><meshBasicMaterial color={k > 0.5 && Math.sin(t * 10) > 0 ? '#ff2020' : '#5a1010'} toneMapped={false} /></mesh>
          <group position={[0, 1.15, 0]} rotation={[0, 0, -s * (Math.PI / 2) * (1 - k)]}>
            {Array.from({length: 6}).map((_, j) => <mesh key={j} position={[-s * (0.4 + j * 0.8), 0, 0]} castShadow><boxGeometry args={[0.8, 0.16, 0.1]} /><meshStandardMaterial color={j % 2 ? '#ff3b30' : '#ffffff'} /></mesh>)}
          </group>
        </group>
      ))}
    </group>
  );
};
const FinishLine: React.FC = () => {
  const tex = useMemo(() => { const c = document.createElement('canvas'); c.width = 512; c.height = 64; const x = c.getContext('2d')!; for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 16, j * 16, 16, 16); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }, []);
  return (
    <group position={[FINISH_X, 0, 0]}>
      {[-6.5, 6.5].map((z) => <mesh key={z} position={[0, 2.6, z]} castShadow><cylinderGeometry args={[0.15, 0.15, 5.2, 12]} /><meshStandardMaterial color="#ffffff" /></mesh>)}
      <mesh position={[0, 4.9, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[13, 1.1]} /><meshStandardMaterial map={tex} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}><planeGeometry args={[13, 0.9]} /><meshStandardMaterial map={tex} /></mesh>
    </group>
  );
};
const Flag: React.FC<{tico: CharPose; t: number}> = ({tico, t}) => {
  const a = tico.arm ?? 0;
  const c = Math.cos(tico.yaw), s = Math.sin(tico.yaw);
  const ly = 2.0 + 0.45 * Math.cos(a) + 3.45 * Math.sin(a), lz = 0.9 + 3.45 * Math.cos(a) - 0.45 * Math.sin(a);
  const x = tico.x + 0.95 * c + lz * s, z = tico.z - 0.95 * s + lz * c;
  return (
    <group position={[x, ly + 0.2, z]}>
      <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.04, 0.04, 1.8, 8]} /><meshStandardMaterial color="#5a3a1e" /></mesh>
      <mesh position={[0.55, 1.5, 0]} rotation={[0, Math.sin(t * 6) * 0.3, 0]}><planeGeometry args={[1.1, 0.7]} /><meshStandardMaterial color="#ff3b30" side={THREE.DoubleSide} /></mesh>
    </group>
  );
};
const Dig: React.FC<{t: number}> = ({t}) => (
  <group position={[110, 0, -112]}>
    <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[2.6, 40]} /><meshBasicMaterial color="#1a1208" /></mesh>
    <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.6, 3.6, 40]} /><meshStandardMaterial color="#8a6a3c" roughness={1} /></mesh>
    {Array.from({length: 8}).map((_, i) => { const a = (i / 8) * Math.PI * 2 + t * 0.3; return <mesh key={i} position={[Math.cos(a) * 0.6, 3, Math.sin(a) * 0.6]} rotation={[Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25]}><cylinderGeometry args={[0.05, 0.6, 6, 8, 1, true]} /><meshBasicMaterial color="#ffe27a" transparent opacity={0.35 + 0.15 * Math.sin(t * 5 + i)} toneMapped={false} side={THREE.DoubleSide} /></mesh>; })}
    <pointLight position={[0, 1.2, 0]} color="#ffd36b" intensity={60} distance={18} decay={2} />
    {Array.from({length: 7}).map((_, i) => <mesh key={i} position={[Math.cos(i * 1.9) * 4.5, 0.4, Math.sin(i * 1.9) * 4.5]} scale={[1, 0.55, 1]}><sphereGeometry args={[0.9 + hash(i) * 0.5, 14, 10]} /><meshStandardMaterial color="#9a7444" roughness={1} /></mesh>)}
  </group>
);

const Scene10: React.FC<{te: number; lib: Lib}> = ({te, lib}) => {
  if (te < M.lolaIn - 0.1) return null;
  const bp = bruno10(te), lp = lolaAt(te), cp = chispaAt10(te), tp = ticoAt(te), op = cocoAt(te);
  const showTico = te > M.tico0 - 1 && te < M.night0 + 4 || te > M.sp0;
  const spoil = te > M.sp0;
  const tico2: CharPose = spoil ? {x: 110, z: -116, yaw: 0, arm: 0.2 + 0.5 * Math.abs(Math.sin(te * 2.2)), blink: blinkAt(te, 3), talk: talkOf(PX.tico, te)} : tp;
  const garage = te > M.door ? 1 - easeInOut(prog(te, M.door + 1.0, M.door + 2.4)) : 1;
  const nk = nightK(te);
  return (
    <group>
      {!spoil && te < M.night0 + 3 ? <Char lib={lib} m="lola" p={lp} /> : null}
      {!spoil && te >= T3 && te < M.night0 + 3 ? <Char lib={lib} m="chispa" p={cp} /> : null}
      {showTico ? <Char lib={lib} m="tico" p={tico2} /> : null}
      {op && !spoil ? (
        <group>
          <Char lib={lib} m="coco" p={op} />
          <Char lib={lib} m="vagon_a" p={{x: op.x - 4.3, z: RAIL_Z, yaw: Math.PI / 2, y: 0.24, dist: op.x}} />
          <Char lib={lib} m="vagon_b" p={{x: op.x - 8.2, z: RAIL_Z, yaw: Math.PI / 2, y: 0.24, dist: op.x}} />
          <Steam t={te} c={op} />
        </group>
      ) : null}
      <Hearts t={te} t0={S('b20') + 0.8} c={[3, 4.5, RAIL_Z]} />
      {te >= T3 ? <BrunoGLB lib={lib} p={bp} /> : null}
      {te > M.wash0 - 2 && te < M.tour0 + 2 ? <Foam t={te} /> : null}
      <Balloons lib={lib} t={te} tico={tp} />
      <Barrier x={-70} t={te} />
      {te > M.race0 - 3 && te < S('n36') + 1.5 ? <><FinishLine /><ScriptCar lib={lib} m="charco_barro" x={PUDDLE[0]} z={PUDDLE[1]} yaw={0} /></> : null}
      {te > M.race0 - 1 && te < M.finish - 3.5 ? <Flag tico={tp} t={te} /> : null}
      {te > M.convoy0 && te < M.convoy1 ? <ScriptCar lib={lib} m="tractor" x={lerp(160, 177, prog(te, M.convoy0 + (M.convoy1 - M.convoy0) * 0.1, M.convoy0 + (M.convoy1 - M.convoy0) * 0.28))} z={95} yaw={Math.PI / 2} dist={te * 2.2} y={Math.abs(Math.sin(te * 9)) * 0.04} /> : null}
      {te > M.convoy0 && te < M.convoy1 ? <ScriptCar lib={lib} m="autobus" x={lerp(-6, -30, easeOut(prog(te, M.convoy0 + (M.convoy1 - M.convoy0) * 0.4, M.convoy0 + (M.convoy1 - M.convoy0) * 0.56)))} z={70 - L} yaw={-Math.PI / 2} dist={-te * 6} /> : null}
      {spoil ? <><Dig t={te} /><Puffs t={te} t0={M.sp0 + 0.5} c={[110, 0, -112]} r={3} n={14} big={1.4} dur={2} /></> : null}
      <NightSky k={nk} />
      {nk > 0.05 ? <pointLight position={[20, 2.4, -7]} color="#ffc47a" intensity={40 * nk * garage} distance={14} decay={2} /> : null}
      {/* efectos por momento */}
      <Puffs t={te} t0={M.lolaIn + 4.2} c={[150.5, 0, 27.8]} r={1.6} n={12} big={1.2} />
      {[M.c1rev, M.c2rev, M.c3rev, M.c4rev].map((r, i) => <Sparkles key={i} t={te} t0={r + 0.5} c={[-20, 1.8, -2.4]} n={22} tint={['#9ecbff', '#ffb3ad', '#fff09a', '#ffc28a'][i]} spread={3} />)}
      {te > M.tico0 && te < M.ticoRev + 0.8 ? Array.from({length: 18}).map((_, i) => { const q = (te * 0.9 + i / 18) % 1; const a = hash(i) * 6.28; const k = (1 - q) * (te < M.ticoRev ? 1 : 1 - (te - M.ticoRev) / 0.8); return <mesh key={i} position={[tp.x + Math.cos(a) * (1.5 + q * 3), 0.6 + q * 3.2 + hash(i + 3) * 1.5, tp.z + Math.sin(a) * (1.5 + q * 3)]} scale={(1.4 + q * 1.6) * k}><sphereGeometry args={[1, 12, 10]} /><meshStandardMaterial color="#e8d6b4" transparent opacity={0.85 * k} roughness={1} /></mesh>; }) : null}
      <Sparkles t={te} t0={M.ticoRev} c={[-9, 2.4, 71.75]} n={24} tint="#ffe14d" spread={4} />
      <Confetti t={te} t0={E('n33') - 1.6} c={[-9, 0, 72]} />
      {[0, 1, 2, 3].map((q) => { const w = ['lola', 'coco', 'tico', 'bruno'][q]; const c: V3 = w === 'coco' ? [3, 3, RAIL_Z] : [PLAZA[w][0], 2.5, PLAZA[w][1]]; return <Sparkles key={q} t={te} t0={M[`q${q}rev`]} c={c} n={20} spread={3} />; })}
      <Puffs t={te} t0={M.go} c={[-52, 0, 0]} r={3} n={16} big={1.2} />
      <Puffs t={te} t0={(() => { const t0 = M.go + (M.finish - M.go) * 0.78; return t0; })()} c={[PUDDLE[0], 0, PUDDLE[1]]} r={2} n={12} />
      <Confetti t={te} t0={M.finish + 0.2} c={[FINISH_X, 0, 0]} />
      <Confetti t={te} t0={M.party0 + 0.6} />
      <Confetti t={te} t0={M.free0 + 6} />
      <Confetti t={te} t0={M.free0 + 16} />
      <Sparkles t={te} t0={M.album} c={[2.2, 2.4, -1]} n={26} tint="#ffd23f" spread={3.4} />
    </group>
  );
};

// ---------------------------------------------------------------- capa 2D
const Overlay10: React.FC<{t: number; W: number}> = ({t, W}) => {
  if (t < T3) return null;
  const u = W / 1920, font = '"Lilita One", sans-serif';
  const st = (c: string, px: number) => ({WebkitTextStroke: `${px * u}px ${c}`, paintOrder: 'stroke fill' as any});
  const burst = (k: number, txt: string, col: string, x: number, y: number, size: number, rot = -6) => k > 0.01 ? (
    <div style={{position: 'absolute', left: x * u, top: y * u, transform: `translate(-50%,-50%) scale(${k}) rotate(${rot + Math.sin(t * 9) * 2}deg)`, fontFamily: font, fontSize: size * u, color: col, ...st('#ffffff', 22), textShadow: `0 ${10 * u}px 0 rgba(40,20,60,0.35)`, whiteSpace: 'nowrap'}}>{txt}</div>
  ) : null;
  const name = (k: number, txt: string, col: string) => k > 0.01 ? (
    <div style={{position: 'absolute', left: 70 * u, bottom: 90 * u, transform: `translateX(${(1 - k) * -700 * u}px) rotate(-3deg)`, background: col, borderRadius: 30 * u, padding: `${10 * u}px ${46 * u}px`, fontFamily: font, fontSize: 110 * u, color: '#fff', ...st('#00000044', 0), boxShadow: `0 ${10 * u}px 0 rgba(0,0,0,0.2)`, border: `${8 * u}px solid #fff`}}>{txt}</div>
  ) : null;
  const title = (a: number, b: number, txt: string, sub: string, col: string) => { const k = popk(t, a, b); return k > 0.01 ? (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{transform: `scale(${k}) rotate(${Math.sin(t * 4) * 2}deg)`, textAlign: 'center'}}>
        <div style={{fontFamily: font, fontSize: 70 * u, color: '#fff', ...st('#2b2350', 14)}}>{sub}</div>
        <div style={{fontFamily: font, fontSize: 190 * u, color: col, ...st('#ffffff', 26), textShadow: `0 ${14 * u}px 0 rgba(43,35,80,0.35)`}}>{txt}</div>
      </div>
    </AbsoluteFill>) : null; };
  const chips = (a: number, b: number, sel: number) => { const k = popk(t, a, b); if (k < 0.01) return null; const cols = ['#3d8bff', '#ff3b30', '#ffd23f', '#ff8a1f']; return (
    <div style={{position: 'absolute', bottom: 70 * u, width: '100%', display: 'flex', justifyContent: 'center', gap: 40 * u}}>
      {cols.map((c, i) => <div key={i} style={{width: 120 * u, height: 120 * u, borderRadius: '50%', background: c, border: `${10 * u}px solid #fff`, transform: `scale(${k * (t > b - 1.2 && i === sel ? 1.35 : 1)}) translateY(${Math.sin(t * 6 + i) * 8 * u}px)`, boxShadow: `0 ${8 * u}px 0 rgba(0,0,0,0.2)`}} />)}
    </div>); };
  const flash = t > M.recap0 && t < M.recap0 + vo.n39.d;
  const qa = (q: number, txt: string, col: string) => burst(popk(t, M[`q${q}rev`], M[`q${q}rev`] + 2.0), txt, col, 960, 200, 170);
  const albumK = popk(t, M.album, E('b22') + 0.6);
  const nights = nightK(t);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 62%, rgba(30,20,60,0.2) 100%)'}} />
      {name(popk(t, S('n19'), E('n19') + 1.2), 'LOLA', '#ff3b30')}
      {burst(popk(t, S('l1') + 0.2, S('l1') + 1.6), '¡NII-NOO!', '#ff3b30', 1350, 220, 140, 8)}
      {burst(popk(t, S('l3') + 1.0, S('l3') + 2.6), '¡BARRO!', '#8a5a34', 1300, 210, 150, 6)}
      {[0, 1, 2, 3].map((i) => <React.Fragment key={'r' + i}>{burst(popk(t, S('f2') + 2.5 + i * 0.4, S('f2') + 4.6), String(i + 1), ['#ff3b3b', '#3d8bff', '#ffd23f', '#39c47a'][i], 520 + i * 290, 330, 190, 0)}</React.Fragment>)}
      {title(S('n21') - 0.2, M.c1in + 0.6, 'LAVADERO', 'de colores', '#3d8bff')}
      {chips(E('n22') - 0.4, S('n23') + 0.4, 0)}
      {chips(E('n24') - 0.2, S('n25') + 0.4, 1)}
      {chips(E('n26') - 0.2, S('n27') + 0.4, 2)}
      {burst(popk(t, S('n23'), S('n23') + 1.8), '¡AZUL!', '#3d8bff', 960, 200, 190)}
      {burst(popk(t, S('n25'), S('n25') + 1.8), '¡ROJO!', '#ff3b30', 960, 200, 190)}
      {burst(popk(t, S('n27'), S('n27') + 1.8), '¡AMARILLO!', '#ffd23f', 960, 200, 190)}
      {burst(popk(t, S('n29'), S('n29') + 1.8), '¡NARANJA!', '#ff8a1f', 960, 200, 190)}
      {[0, 1, 2, 3].map((k) => <React.Fragment key={k}>{burst(popk(t, STOP_T()[k], STOP_T()[k] + 2.4), ['¡PANADERÍA!', '¡HELADERÍA!', '¡EL PARQUE!', '¡EL PUERTO!'][k], ['#ff8a1f', '#ff5f9a', '#39c47a', '#3d8bff'][k], 960, 170, 140)}</React.Fragment>)}
      {t > M.tico0 + 2 && t < M.ticoRev ? burst(popk(t, M.tico0 + 2.2, M.ticoRev), '?', '#ffd23f', 1500, 250, 260, 6) : null}
      {name(popk(t, S('n31'), E('n31') + 1.2), 'TICO', '#e0a810')}
      {title(S('n32') - 0.1, S('k1') - 0.1, '¡CONTAMOS!', 'globos', '#ff5f9a')}
      {[1, 2, 3, 4, 5].map((i) => <React.Fragment key={i}>{burst(popk(t, S(`k${i}`), S(`k${i}`) + 1.1), String(i), ['#ff3b3b', '#3d8bff', '#ffd23f', '#39c47a', '#ff7ad1'][i - 1], 300 + (i - 1) * 330, 230, 230, 0)}</React.Fragment>)}
      {t > M.coco0 + 1 && t < M.cocoRev ? burst(popk(t, M.coco0 + 1.2, M.cocoRev), '?', '#39c47a', 1450, 250, 260, -6) : null}
      {burst(popk(t, M.cocoRev, M.cocoRev + 1.5), '¡CHU-CHUUU!', '#39c47a', 1250, 230, 140, 8)}
      {name(popk(t, S('n35'), E('n35') + 1.2), 'COCO', '#2fbf5a')}
      {title(S('n47') - 0.2, S('n47') + 3.2, '¿QUÉ SUENA?', 'juego', '#c56bff')}
      {[0, 1, 2, 3].map((q) => t > M[`q${q}snd`] - 0.1 && t < M[`q${q}rev`] ? <div key={q} style={{position: 'absolute', left: 860 * u, top: 330 * u, width: 200 * u, height: 200 * u, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 120 * u, transform: `scale(${1 + 0.08 * Math.sin(t * 14)})`, boxShadow: `0 0 0 ${(14 + 10 * Math.abs(Math.sin(t * 7))) * u}px rgba(197,107,255,0.45)`}}>🔊</div> : null)}
      {qa(0, '¡LOLA!', '#ff3b30')}{qa(1, '¡COCO!', '#2fbf5a')}{qa(2, '¡TICO!', '#e0a810')}{qa(3, '¡BRUNO!', '#ff8a1f')}
      {title(S('n56') - 0.1, E('n56') + 0.6, '¡LA CARRERA!', '¡llegó la hora de...', '#ff3b30')}
      {['3', '2', '1', '¡YA!'].map((n, i) => <React.Fragment key={i}>{burst(popk(t, S('n57') + i * 1.07, S('n57') + i * 1.07 + 0.95), n, ['#ff5f7e', '#ffd23f', '#39c47a', '#3d8bff'][i], 960, 420, i === 3 ? 260 : 300, 0)}</React.Fragment>)}
      {burst(popk(t, M.finish + 0.4, M.finish + 2.6), '¡EMPATE!', '#ffd23f', 960, 200, 200)}
      {albumK > 0.01 ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <div style={{width: 1100 * u, height: 640 * u, background: '#fff7e0', borderRadius: 40 * u, border: `${14 * u}px solid #ff8a1f`, transform: `scale(${albumK}) rotate(-2deg)`, boxShadow: `0 ${16 * u}px 0 rgba(0,0,0,0.25)`, display: 'flex', flexWrap: 'wrap', padding: 40 * u, gap: 22 * u, alignContent: 'flex-start'}}>
            <div style={{width: '100%', fontFamily: font, fontSize: 70 * u, color: '#ff8a1f', textAlign: 'center', ...st('#ffffff', 8)}}>MI ÁLBUM · 1/30</div>
            {Array.from({length: 30}).map((_, i) => {
              const s = i === 0 ? easeOutBack(prog(t, M.album + 1.0, M.album + 1.5), 3) : 0;
              return <div key={i} style={{width: 120 * u, height: 70 * u, borderRadius: 16 * u, border: `${4 * u}px dashed #e0c9a0`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64 * u}}>{s > 0.01 ? <span style={{transform: `scale(${s}) rotate(${(1 - s) * 90}deg)`, color: '#ffd23f', ...st('#c98a00', 3)}}>★</span> : null}</div>;
            })}
          </div>
        </AbsoluteFill>
      ) : null}
      {flash ? <AbsoluteFill style={{border: `${26 * u}px solid rgba(255,255,255,0.92)`, borderRadius: 50 * u, boxShadow: `inset 0 0 ${80 * u}px rgba(255,236,170,0.8)`}}><div style={{position: 'absolute', top: 40 * u, left: 60 * u, fontFamily: font, fontSize: 70 * u, color: '#ffd23f', ...st('#2b2350', 10)}}>¡RECUERDA!</div></AbsoluteFill> : null}
      {t > S('n40') - 0.1 && t < M.qend ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', background: `rgba(20,24,60,${0.35 * popk(t, S('n40') - 0.1, M.qend)})`}}>
          <div style={{transform: `scale(${popk(t, S('n40') - 0.1, M.qend)})`, fontFamily: font, fontSize: 120 * u, color: '#fff', textAlign: 'center', ...st('#2b2350', 16)}}>¿Cuál fue tu parte<br /><span style={{color: '#ffd23f'}}>favorita?</span></div>
        </AbsoluteFill>
      ) : null}
      {t > M.logo0 && t < M.sp0 ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', background: `rgba(20,24,60,${0.55 * popk(t, M.logo0, M.sp0)})`}}>
          <div style={{fontFamily: font, fontSize: 230 * u, transform: `scale(${popk(t, M.logo0, M.sp0)})`}}>
            {'Pueblo Brum'.split('').map((ch, i) => <span key={i} style={{display: 'inline-block', color: ['#ff8a1f', '#ffd23f', '#3d8bff', '#ff5f7e', '#39c47a', '#c56bff'][i % 6], ...st('#ffffff', 22), transform: `translateY(${Math.sin(t * 5 + i) * 14 * u}px)`, width: ch === ' ' ? 60 * u : undefined}}>{ch}</span>)}
          </div>
          <div style={{position: 'absolute', bottom: 40 * u, fontFamily: font, fontSize: 30 * u, color: '#fff', opacity: 0.85}}>Música: Kevin MacLeod (incompetech.com) · licencia CC BY 4.0</div>
        </AbsoluteFill>
      ) : null}
      {t > M.sp0 ? <div style={{position: 'absolute', top: 40 * u, left: 0, width: '100%', textAlign: 'center', fontFamily: font, fontSize: 90 * u, color: '#ffd23f', ...st('#2b2350', 14), transform: `scale(${popk(t, M.sp0, 700)})`}}>PRÓXIMO CAPÍTULO</div> : null}
      {nights > 0.02 && t < M.sp0 ? <AbsoluteFill style={{background: `rgba(10,16,48,${0.18 * nights})`}} /> : null}
    </AbsoluteFill>
  );
};

let trafficReady = false;
const obstacle10 = (t: number): [number, number] | null => {
  const a = brunoObstacle(t); if (a) return a;
  const b = obstacle2(t); if (b) return b;
  if (t >= M.convoy0 && t <= M.wash0) { const q = convoyAt(t, 'bruno'); return [q.x, q.z]; }
  if (t >= M.go && t <= M.finish) { const q = at(RACE, raceS(t, 'bruno')); return [q.x, q.z]; }
  if (t >= M.night0 && t <= M.door) { const b2 = bruno10(t); return [b2.x, b2.z]; }
  return null;
};

export const Ep10: React.FC<{t0?: number}> = ({t0 = 0}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = IP.t ?? frame / fps + t0;
  const vert = height > width, OW = vert ? width * 1.25 : width;
  const te = remap(t);
  const [ready, setReady] = useState(false);
  const [h] = useState(() => delayRender('fuentes'));
  useEffect(() => { Promise.all([document.fonts.load('150px "Lilita One"'), document.fonts.ready]).then(() => { setReady(true); continueRender(h); }); }, [h]);
  const lib = useLib();
  if (!ready || !lib) return null;
  if (!trafficReady) { resolve(obstacle10); trafficReady = true; }
  return (
    <AbsoluteFill style={{background: '#a9dcff'}}>
      <ThreeCanvas width={width} height={height} shadows gl={{antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'}} camera={{fov: 40, position: [0, 5, 20]}}>
        <Rig te={te} lib={lib} vert={vert} />
        <Lights te={te} />
        <World lib={lib} t={te} garageOpen={garageOpenAt(te) * (te > M.door + 1 ? 1 - easeInOut(prog(te, M.door + 1.0, M.door + 2.4)) : 1)} />
        <Part1Scene t={Math.min(te, 900)} lib={lib} />
        <Scene10 te={te} lib={lib} />
        <Post off={!!IP.nopost} ao={!IP.noao} />
      </ThreeCanvas>
      <div style={{position: 'absolute', left: (width - OW) / 2, top: 0, width: OW, height}}>
        {te < T3 ? <Overlay t={te} W={OW} /> : null}
        <Overlay10 t={t} W={OW} />
      </div>
    </AbsoluteFill>
  );
};
void K; void MUD; void Puffs; void hash;
