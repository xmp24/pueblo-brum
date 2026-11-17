// Tráfico sin apariciones: cada coche está aparcado -> conduce -> vuelve a aparcar.
import {route, NODES, V2, roads, district, RAIL_Z, ROAD_W} from './layout';

export type Car = {m: string; tDep: number; pts: V2[]; cum: number[]; len: number; vmax: number; parkA: V2; yawA: number};
let seed = 777;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const LANE = ROAD_W / 4;      // centro del carril derecho
const BAY = ROAD_W / 2 + 1.3; // bahía de aparcamiento
const right = (d: V2): V2 => [-d[1], d[0]];
const norm = (d: V2): V2 => { const l = Math.hypot(d[0], d[1]) || 1; return [d[0] / l, d[1] / l]; };

function smoothPath(nodes: V2[], startOff: number, endOff: number): V2[] {
  // nodos -> polilínea desplazada al carril derecho, esquinas redondeadas, rotonda en la plaza
  const out: V2[] = [];
  const n = nodes.length;
  const dir = (i: number) => norm([nodes[i + 1][0] - nodes[i][0], nodes[i + 1][1] - nodes[i][1]]);
  // punto de salida: bahía a mitad del primer tramo -> carril
  const d0 = dir(0), r0 = right(d0);
  const L0 = Math.hypot(nodes[1][0] - nodes[0][0], nodes[1][1] - nodes[0][1]);
  const s0 = L0 * startOff;
  const add = (p: V2) => { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05) out.push(p); };
  const at = (a: V2, d: V2, s: number, off: number): V2 => [a[0] + d[0] * s + right(d)[0] * off, a[1] + d[1] * s + right(d)[1] * off];
  for (let k = 0; k <= 12; k++) { // incorporación en S
    const u = k / 12, e = u * u * (3 - 2 * u);
    add(at(nodes[0], d0, s0 + u * 12, BAY + (LANE - BAY) * e));
  }
  void r0;
  for (let i = 1; i < n - 1; i++) {
    const da = dir(i - 1), db = dir(i), c = nodes[i];
    const isPlaza = Math.hypot(c[0], c[1]) < 1;
    const cross = da[0] * db[1] - da[1] * db[0], dot = da[0] * db[0] + da[1] * db[1];
    if (isPlaza) { // rotonda: rodear por la derecha a radio 12.5
      const R = 12.5;
      const a0 = Math.atan2(-da[1], -da[0]), a1 = Math.atan2(db[1], db[0]);
      const A0 = a0 - 0.35; let A1 = a1 + 0.35;
      while (A1 > A0) A1 -= Math.PI * 2; // sentido de circulación por la derecha (antihorario en el mapa)
      for (let k = 0; k <= 24; k++) { const a = A0 + (A1 - A0) * (k / 24); add([Math.cos(a) * R, Math.sin(a) * R]); }
      continue;
    }
    if (Math.abs(cross) < 1e-3 && dot > 0) continue; // recto
    const rad = cross > 0 ? 4.5 : 7.5; // giro a la derecha más cerrado que a la izquierda
    const ra = right(da), rb = right(db);
    // esquina del carril desplazado
    const pa: V2 = [c[0] + ra[0] * LANE, c[1] + ra[1] * LANE], pb: V2 = [c[0] + rb[0] * LANE, c[1] + rb[1] * LANE];
    // intersección de las dos líneas
    const den = da[0] * db[1] - da[1] * db[0];
    const t = ((pb[0] - pa[0]) * db[1] - (pb[1] - pa[1]) * db[0]) / den;
    const X: V2 = [pa[0] + da[0] * t, pa[1] + da[1] * t];
    const A: V2 = [X[0] - da[0] * rad, X[1] - da[1] * rad], B: V2 = [X[0] + db[0] * rad, X[1] + db[1] * rad];
    for (let k = 0; k <= 10; k++) {
      const u = k / 10;
      add([(1 - u) * (1 - u) * A[0] + 2 * u * (1 - u) * X[0] + u * u * B[0], (1 - u) * (1 - u) * A[1] + 2 * u * (1 - u) * X[1] + u * u * B[1]]);
    }
  }
  const dl = dir(n - 2), last = nodes[n - 2];
  const Ll = Math.hypot(nodes[n - 1][0] - last[0], nodes[n - 1][1] - last[1]);
  const sl = Ll * endOff;
  for (let k = 0; k <= 12; k++) { // aparcar en S
    const u = k / 12, e = u * u * (3 - 2 * u);
    add(at(last, dl, sl - 12 + u * 12, LANE + (BAY - LANE) * e));
  }
  return out;
}

const MODELS = ['coche_rojo', 'coche_verde', 'coche_morado', 'taxi', 'furgoneta', 'cartero', 'helados', 'autobus', 'pickup', 'coche_rosa', 'coche_azul'];
export const cars: Car[] = [];
const usable = NODES.filter((p) => district(p[0], p[1]) !== 'colinas' && p[1] > -150);
const NC = 46;
for (let i = 0; cars.length < NC && i < 600; i++) {
  const a = usable[Math.floor(rnd() * usable.length)], b = usable[Math.floor(rnd() * usable.length)];
  if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 120) continue;
  const nodes = route(a, b);
  if (nodes.length < 3) continue;
  // que empiece/acabe con medio tramo para aparcar: usar el nodo vecino real como extremo
  const pts = smoothPath(nodes, 0.3 + rnd() * 0.3, 0.45 + rnd() * 0.4);
  if (pts.some((p) => Math.abs(p[1] - RAIL_Z) < 0.1 && false)) continue;
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  const e = pts[pts.length - 1];
  if (cars.some((c) => [c.pts[0], c.pts[c.pts.length - 1]].some((q) => Math.hypot(q[0] - pts[0][0], q[1] - pts[0][1]) < 8 || Math.hypot(q[0] - e[0], q[1] - e[1]) < 8))) continue;
  const m = MODELS[cars.length % MODELS.length];
  const d0 = norm([pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]]);
  cars.push({m, tDep: rnd() * 75, pts, cum, len: cum[cum.length - 1], vmax: m === 'autobus' ? 7 : 8 + rnd() * 3, parkA: pts[0], yawA: Math.atan2(d0[0], d0[1])});
}

// perfil de velocidad: acelera a 2.5 m/s², crucero, frena
export function distAt(c: Car, t: number) {
  const a = 2.5, v = c.vmax, ta = v / a, da = 0.5 * a * ta * ta;
  const T = t - c.tDep;
  if (T <= 0) return 0;
  if (c.len < 2 * da) { const tm = Math.sqrt(c.len / a); return T < tm ? 0.5 * a * T * T : Math.min(c.len, c.len - 0.5 * a * Math.max(0, 2 * tm - T) ** 2); }
  const tc = (c.len - 2 * da) / v;
  if (T < ta) return 0.5 * a * T * T;
  if (T < ta + tc) return da + v * (T - ta);
  const Td = T - ta - tc;
  if (Td < ta) return c.len - 0.5 * a * (ta - Td) ** 2;
  return c.len;
}
export function carPose(c: Car, t: number) {
  const s = distAt(c, t);
  let k = 1;
  while (k < c.cum.length - 1 && c.cum[k] < s) k++;
  const s0 = c.cum[k - 1], s1 = c.cum[k], u = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
  const p = c.pts[k - 1], q = c.pts[k];
  // rumbo suavizado mirando un poco por delante
  const look = Math.min(c.len, s + 1.5);
  let j = 1; while (j < c.cum.length - 1 && c.cum[j] < look) j++;
  const back = Math.max(0, s - 1.5); let i = 1; while (i < c.cum.length - 1 && c.cum[i] < back) i++;
  const A = c.pts[i - 1], B = c.pts[j];
  const yaw = s >= c.len - 0.01 || Math.hypot(B[0] - A[0], B[1] - A[1]) < 0.1 ? endYaw(c) : Math.atan2(B[0] - A[0], B[1] - A[1]);
  return {x: p[0] + (q[0] - p[0]) * u, z: p[1] + (q[1] - p[1]) * u, yaw: s <= 0 ? c.yawA : yaw, dist: s};
}
function endYaw(c: Car) { const n = c.pts.length; return Math.atan2(c.pts[n - 1][0] - c.pts[n - 2][0], c.pts[n - 1][1] - c.pts[n - 2][1]); }

// evitar choques: retrasa salidas hasta que nadie se acerque a < 4.5 m (también contra coches aparcados)
export let resolved = false;
export function resolve(obstacle?: (t: number) => V2 | null) {
  resolved = true;
  for (let pass = 0; pass < 40; pass++) {
    let changed = false;
    for (let i = 0; i < cars.length; i++) {
      let bad = false;
      for (let t = cars[i].tDep; t < cars[i].tDep + cars[i].len / 5 + 12 && !bad; t += 0.25) {
        const a = carPose(cars[i], t);
        if (a.dist <= 0 || a.dist >= cars[i].len) continue;
        for (let j = 0; j < cars.length && !bad; j++) {
          if (j === i) continue;
          const b = carPose(cars[j], t);
          const dx = b.x - a.x, dz = b.z - a.z, fx = Math.sin(a.yaw), fz = Math.cos(a.yaw);
          const lon = dx * fx + dz * fz, lat = -dx * fz + dz * fx;
          if (Math.abs(lon) < 5.5 && Math.abs(lat) < 2.4) bad = true;
        }
        const o = obstacle?.(t);
        if (o && Math.hypot(a.x - o[0], a.z - o[1]) < 6) bad = true;
      }
      if (bad) { cars[i].tDep += 2 + rnd() * 3; changed = true; }
    }
    if (!changed) break;
  }
}
void roads;
