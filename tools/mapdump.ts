import {roads, places, LAKE, RAIL_Z, SEA_Z} from '../src/world/layout';
import {cars, resolve, carPose} from '../src/world/traffic';
resolve();
const counts: Record<string, number> = {};
for (const p of places) counts[p.m] = (counts[p.m] || 0) + 1;
console.error(JSON.stringify(counts));
console.error('roads', roads.length, 'cars', cars.length, 'tDep max', Math.max(...cars.map((c) => c.tDep)).toFixed(1), 'len avg', (cars.reduce((a, c) => a + c.len, 0) / cars.length).toFixed(0));
// mínima distancia entre coches en movimiento
let md = 1e9, mt = 0;
for (let t = 0; t < 130; t += 0.5) for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
  const a = carPose(cars[i], t), b = carPose(cars[j], t);
  const d = Math.hypot(a.x - b.x, a.z - b.z); if (d < md) { md = d; mt = t; }
}
console.error('min dist', md.toFixed(2), 'at', mt);
console.log(JSON.stringify({roads, places, cars: cars.map((c) => ({pts: c.pts, m: c.m, t: c.tDep})), LAKE, RAIL_Z, SEA_Z}));
