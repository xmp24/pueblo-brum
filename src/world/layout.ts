// Pueblo Brum: plano completo (determinista). Coordenadas three.js: x derecha, z hacia cámara, y arriba.
// El centro conserva las posiciones del primer minuto (plaza en 0,0; garaje 20,-12; lavadero -20,-12; estación 0,-32; bomberos 22,14).

export type V2 = [number, number];
export type Place = {m: string; x: number; z: number; ry: number; s?: number};
export type Road = {a: V2; b: V2; w: number};

let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

export const LINES = [-200, -140, -70, 0, 70, 140, 200];
export const LINES_Z = [-140, -70, 0, 70, 140, 174];
export const RAIL_Z = -43.5;
export const SEA_Z = 186;
export const LAKE = {x: -112, z: 34, rx: 26, rz: 19};
export const MUD = {x: 168, z: 22};
export const ROAD_W = 7;

// ---------------- carreteras (segmentos entre nodos de la rejilla)
export const roads: Road[] = [];
const nodes = new Map<string, V2>();
const adj = new Map<string, string[]>();
const key = (p: V2) => `${p[0]},${p[1]}`;
function link(a: V2, b: V2, w = ROAD_W) {
  roads.push({a, b, w});
  for (const p of [a, b]) { nodes.set(key(p), p); if (!adj.has(key(p))) adj.set(key(p), []); }
  adj.get(key(a))!.push(key(b)); adj.get(key(b))!.push(key(a));
}
const skip = (a: V2, b: V2) => {
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
  if (mz < -150) return true;                                  // al norte del todo sólo colinas
  if (a[0] === 0 && b[0] === 0 && mz < 0 && mz > -70) return true; // la avenida norte acaba en la estación
  if (Math.abs(mx) < 1 && Math.abs(mz) < 1) return true;
  return false;
};
for (const x of LINES) for (let i = 0; i < LINES_Z.length - 1; i++) {
  const a: V2 = [x, LINES_Z[i]], b: V2 = [x, LINES_Z[i + 1]];
  if (!skip(a, b)) link(a, b);
}
for (const z of LINES_Z) for (let i = 0; i < LINES.length - 1; i++) {
  const a: V2 = [LINES[i], z], b: V2 = [LINES[i + 1], z];
  if (!skip(a, b)) link(a, b);
}
// tramo de la avenida norte hasta la estación (sin nodo intermedio de cruce en la plaza)
roads.push({a: [0, -8], b: [0, -27], w: ROAD_W});

// ---------------- edificios y atrezo
export const places: Place[] = [];
const P = (m: string, x: number, z: number, ry = 0, s?: number) => places.push({m, x, z, ry, s});
const nearRoad = (x: number, z: number, m: number) =>
  roads.some((r) => {
    const [ax, az] = r.a, [bx, bz] = r.b;
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    return Math.hypot(x - (ax + u * dx), z - (az + u * dz)) < m + r.w / 2;
  });
const taken: [number, number, number][] = [];
const free = (x: number, z: number, r: number) => !taken.some(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) < r + tr);
const take = (x: number, z: number, r: number) => taken.push([x, z, r]);

// centro (posiciones del primer minuto)
P('garaje', 20, -12, 0); take(20, -12, 7);
P('lavadero', -20, -12, 0); take(-20, -12, 7);
P('estacion', 0, -32, 0); take(0, -32, 9);
P('bomberos', 22, 14, Math.PI); take(22, 14, 8);
take(0, 0, 9);
P('fuente', -80, 22, 0); take(-80, 22, 4);
P('ayuntamiento', -30, 36, Math.PI / 2); take(-30, 36, 10);
const core: [string, number, number, number][] = [
  ['casa_a', -10, 24, Math.PI], ['casa_b', 10, 24, Math.PI], ['casa_c', -16, 20, Math.PI], ['casa_d', -33, -16, Math.PI / 2],
  ['casa_e', -46, 14, Math.PI / 2], ['casa_f', 37, -15, -Math.PI / 2], ['casa_g', 12, -24, 0], ['casa_h', -12, -24, 0],
  ['tienda_pan', 38, 12, -Math.PI / 2], ['tienda_helados', 12, 38, Math.PI], ['tienda_juguetes', -14, 38, Math.PI],
  ['tienda_frutas', 52, -14, 0], ['tienda_libros', -52, -14, 0],
];
for (const [m, x, z, ry] of core) { P(m, x, z, ry); take(x, z, 5.5); }

// parcelas a lo largo de cada calle
const houses = ['casa_a', 'casa_b', 'casa_c', 'casa_d', 'casa_e', 'casa_f', 'casa_g', 'casa_h'];
const shops = ['tienda_pan', 'tienda_helados', 'tienda_juguetes', 'tienda_frutas', 'tienda_libros'];
const district = (x: number, z: number) => {
  if (Math.abs(x) < 68 && Math.abs(z) < 68) return 'centro';
  if (z < RAIL_Z - 6) return x > 0 ? 'obras' : 'colinas';
  if (x > 142) return 'granja';
  if (x < -142 || (x < -72 && x > -138 && z > 2 && z < 68)) return 'parque';
  if (z > 142) return 'puerto';
  return 'residencial';
};
export {district};
for (const r of roads) {
  const [ax, az] = r.a, [bx, bz] = r.b;
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
  for (const side of [1, -1]) {
    const nx = -uz * side, nz = ux * side; // normal hacia la parcela
    for (let s = 12; s < L - 12; s += 15) {
      const x = ax + ux * s + nx * 12.5, z = az + uz * s + nz * 12.5;
      const d = district(x, z);
      const ry = Math.atan2(-nx, -nz); // la fachada (+z local) mira a la calle
      if ((d === 'residencial' || (d === 'puerto' && z < 160) || d === 'centro') && free(x, z, 6.4) && !nearRoad(x, z, 5.5) && Math.abs(z - RAIL_Z) > 9) {
        const m = d === 'centro' || (Math.abs(ax) < 1 || Math.abs(az) < 1) && rnd() < 0.35 ? pick(shops) : pick(houses);
        P(m, x, z, ry); take(x, z, 6.4);
        // árbol o arbusto entre parcelas
        const tx = x + ux * 7.5, tz = z + uz * 7.5 + 0;
        if (free(tx, tz, 1.5) && !nearRoad(tx, tz, 2)) { P(rnd() < 0.6 ? pick(['arbol_redondo_a', 'arbol_redondo_b', 'arbol_flor_rosa']) : 'arbusto', tx, tz, rnd() * 6); take(tx, tz, 1.5); }
      }
    }
    // farolas y mobiliario en la acera
    for (let s = 6; s < L - 6; s += 22) {
      const x = ax + ux * s + nx * (r.w / 2 + 2.7), z = az + uz * s + nz * (r.w / 2 + 2.7);
      if (district(x, z) === 'parque' && Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz) < 1.15) continue;
      if (Math.abs(z - RAIL_Z) < 4 || z > SEA_Z - 2) continue;
      if (Math.hypot(x, z) < 11) continue;
      P('farola', x, z, Math.atan2(-nx, -nz) + Math.PI);
      const k = Math.floor(rnd() * 6);
      const ox = x + ux * 4, oz = z + uz * 4;
      if (k === 0) P('banco', ox, oz, Math.atan2(-nx, -nz) + Math.PI);
      else if (k === 1) P('papelera', ox, oz, 0);
      else if (k === 2) P('hidrante', ox, oz, 0);
      else if (k === 3 && district(x, z) !== 'granja') P('buzon', ox, oz, Math.atan2(-nx, -nz) + Math.PI);
    }
  }
}
// semáforos en cruces de avenidas
for (const [k, p] of nodes) {
  if ((adj.get(k) || []).length >= 3 && (p[0] === 0 || p[1] === 0) && district(p[0], p[1]) !== 'granja')
    P('semaforo', p[0] + 5, p[1] + 5, Math.PI * 0.75);
}
// parque con lago y árboles
for (let i = 0; i < 70; i++) {
  const x = -200 + rnd() * 130, z = 2 + rnd() * 140;
  if (district(x, z) !== 'parque' || nearRoad(x, z, 3) || Math.hypot((x - LAKE.x) / (LAKE.rx + 4), (z - LAKE.z) / (LAKE.rz + 4)) < 1) continue;
  if (!free(x, z, 2.4)) continue;
  P(pick(['arbol_redondo_a', 'arbol_redondo_b', 'arbol_redondo_c', 'arbol_alamo', 'arbol_flor_rosa', 'arbol_flor_blanco']), x, z, rnd() * 6, 0.9 + rnd() * 0.5); take(x, z, 2.4);
}
for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; P('banco', LAKE.x + Math.cos(a) * (LAKE.rx + 4), LAKE.z + Math.sin(a) * (LAKE.rz + 4), -a - Math.PI / 2); }
// colinas del norte: pinos
for (let i = 0; i < 160; i++) {
  const x = -210 + rnd() * 420, z = -215 + rnd() * 160;
  const d = district(x, z);
  if ((d !== 'colinas' && !(d === 'obras' && z < -150)) || nearRoad(x, z, 3) || Math.abs(z - RAIL_Z) < 8 || !free(x, z, 2.8)) continue;
  P(pick(['arbol_pino_a', 'arbol_pino_b', 'arbol_pino_a', 'arbol_alamo']), x, z, rnd() * 6, 0.9 + rnd() * 0.6); take(x, z, 2.8);
}
// obras
for (let i = 0; i < 40; i++) {
  const x = 10 + rnd() * 190, z = -140 + rnd() * 85;
  if (district(x, z) !== 'obras' || nearRoad(x, z, 2) || !free(x, z, 1.2)) continue;
  P(rnd() < 0.6 ? 'cono' : 'barrera_obra', x, z, rnd() * 6); take(x, z, 1.2);
}
// granja
P('granero', 178, -30, -Math.PI / 2); take(178, -30, 11);
P('silo', 186, -10, 0); take(186, -10, 3);
P('charco_barro', MUD.x, MUD.z, 0); take(MUD.x, MUD.z, 5);
P('tractor', 172, -12, Math.PI * 0.6); take(172, -12, 3);
for (let i = 0; i < 14; i++) P('valla', 150 + i * 2.4, 4, 0);
for (let i = 0; i < 14; i++) P('valla', 150 + i * 2.4, 60, 0);
// puerto
for (let i = 0; i < 6; i++) P('barco', -150 + i * 55, SEA_Z + 14 + (i % 2) * 6, (i % 2 ? 0.3 : -0.25));
for (let i = 0; i < 4; i++) P('parada_bus', -100 + i * 70, 76, Math.PI);
// banderines alrededor de la plaza
for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i / 8) * Math.PI * 2; P('poste_banderines', Math.cos(a) * 8.8, Math.sin(a) * 8.8, 0); }
// macetas del centro
for (const [x, z] of [[-6.4, -5.6], [6.4, -5.6], [-6.4, 5.6], [6.4, 5.6]]) P('maceta', x, z, 0);

// ---------------- grafo para el tráfico
export function route(from: V2, to: V2): V2[] {
  const s = key(from), g = key(to);
  const prev = new Map<string, string>([[s, '']]);
  const q = [s];
  while (q.length) {
    const c = q.shift()!;
    if (c === g) break;
    for (const n of adj.get(c) || []) if (!prev.has(n)) { prev.set(n, c); q.push(n); }
  }
  const out: V2[] = [];
  for (let c = g; c; c = prev.get(c)!) out.unshift(nodes.get(c)!);
  return out;
}
export const NODES = [...nodes.values()];
export {rnd};
