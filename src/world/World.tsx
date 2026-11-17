import React, {useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {Lib} from './assets';
import {roads, places, RAIL_Z, SEA_Z, LAKE, Place} from './layout';
import {cars, carPose, resolve, resolved, Car} from './traffic';

const TILE = 70;
const PLAZA_R = 9.5, RING_R = 16;

// ---------------------------------------------------------------- texturas
function canvasTex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void, rep?: [number, number]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rep) t.repeat.set(rep[0], rep[1]);
  return t;
}
let seed = 99; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const grassTex = () => canvasTex(512, 512, (x) => {
  x.fillStyle = '#69b65c'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const g = 140 + rnd() * 60; x.fillStyle = `rgba(${70 + rnd() * 40},${g},${60 + rnd() * 40},${0.25 + rnd() * 0.35})`;
    x.fillRect(rnd() * 512, rnd() * 512, 2 + rnd() * 3, 2 + rnd() * 5);
  }
  for (let i = 0; i < 60; i++) { x.fillStyle = ['#fff6a8', '#ffffff', '#ffb3d0'][i % 3]; x.beginPath(); x.arc(rnd() * 512, rnd() * 512, 2.2, 0, 7); x.fill(); }
}, [180, 180]);
const asphaltTex = () => canvasTex(256, 512, (x) => {
  x.fillStyle = '#4b5163'; x.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 2500; i++) { const v = 60 + rnd() * 40; x.fillStyle = `rgba(${v},${v + 4},${v + 18},0.5)`; x.fillRect(rnd() * 256, rnd() * 512, 2, 2); }
  x.fillStyle = '#ffffff'; x.fillRect(122, 0, 12, 300);              // discontinua central
  x.fillStyle = '#e8e8e8'; x.fillRect(4, 0, 6, 512); x.fillRect(246, 0, 6, 512); // bordes
});
const bayTex = () => canvasTex(128, 512, (x) => {
  x.fillStyle = '#5a6074'; x.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 900; i++) { const v = 70 + rnd() * 40; x.fillStyle = `rgba(${v},${v + 4},${v + 16},0.5)`; x.fillRect(rnd() * 128, rnd() * 512, 2, 2); }
  x.fillStyle = '#f2f2f2'; x.fillRect(0, 0, 128, 8);
});
const walkTex = () => canvasTex(256, 256, (x) => {
  x.fillStyle = '#e3dccf'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#c9c0b0'; x.lineWidth = 4;
  for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke(); x.beginPath(); x.moveTo(i * 64 + (i % 2) * 0, 0); x.lineTo(i * 64, 256); x.stroke(); }
});
const plazaTex = () => canvasTex(1024, 1024, (x) => {
  x.fillStyle = '#efe6d6'; x.fillRect(0, 0, 1024, 1024);
  for (let r = 40; r < 520; r += 42) { x.strokeStyle = r % 84 ? '#d9cbb4' : '#e7b98f'; x.lineWidth = 16; x.beginPath(); x.arc(512, 512, r, 0, 7); x.stroke(); }
  for (let a = 0; a < 32; a++) { x.strokeStyle = '#d9cbb4'; x.lineWidth = 3; x.beginPath(); x.moveTo(512, 512); x.lineTo(512 + Math.cos(a / 5.1) * 520, 512 + Math.sin(a / 5.1) * 520); x.stroke(); }
});
const cropTex = () => canvasTex(256, 256, (x) => {
  x.fillStyle = '#9b7b4f'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#7fcf4f' : '#a6e05a'; x.fillRect(i * 32 + 4, 0, 22, 256); }
});
const sandTex = () => canvasTex(256, 256, (x) => { x.fillStyle = '#f3dfa8'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 2000; i++) { x.fillStyle = `rgba(200,170,110,${rnd() * 0.4})`; x.fillRect(rnd() * 256, rnd() * 256, 2, 2); } }, [60, 2]);

// ---------------------------------------------------------------- geometría de calles
function strip(ax: number, az: number, bx: number, bz: number, off0: number, off1: number, y: number, uLen: number) {
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
  const g = new THREE.BufferGeometry();
  const P = (s: number, o: number) => [ax + ux * s + nx * o, y, az + uz * s + nz * o];
  const v = [...P(0, off0), ...P(0, off1), ...P(L, off1), ...P(L, off0)];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, L / uLen, 0, L / uLen], 2));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  return g;
}
function curbBox(ax: number, az: number, bx: number, bz: number, o0: number, o1: number, h: number) {
  const L = Math.hypot(bx - ax, bz - az);
  const g = new THREE.BoxGeometry(o1 - o0, h, L);
  const ang = Math.atan2(bx - ax, bz - az);
  const mx = (ax + bx) / 2, mz = (az + bz) / 2, oc = (o0 + o1) / 2;
  const nx = -(bz - az) / L, nz = (bx - ax) / L;
  g.applyMatrix4(new THREE.Matrix4().makeRotationY(ang));
  g.translate(mx + nx * oc, h / 2, mz + nz * oc);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (o1 - o0) / 2, uv.getY(i) * L / 2);
  return g;
}

function useStreets() {
  return useMemo(() => {
    const asph: THREE.BufferGeometry[] = [], bays: THREE.BufferGeometry[] = [], walks: THREE.BufferGeometry[] = [], cross: THREE.BufferGeometry[] = [];
    const isCenter = (p: number[]) => Math.hypot(p[0], p[1]) < 1;
    const ends = new Set<string>();
    for (const r of roads) for (const p of [r.a, r.b]) ends.add(p.join(','));
    for (const r of roads) {
      let [ax, az] = r.a, [bx, bz] = r.b;
      const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
      // recortar en la rotonda y en los cruces
      const cutA = isCenter(r.a) || (Math.abs(ax) < 1 && Math.abs(az + 8) < 1) ? RING_R : r.w / 2 + 2.6 + 2.2;
      const cutB = isCenter(r.b) ? RING_R : r.w / 2 + 2.6 + 2.2;
      const sA = isCenter(r.a) || (Math.abs(ax) < 1 && Math.abs(az + 8) < 1) ? RING_R - 0.5 : 0, sB = isCenter(r.b) ? RING_R - 0.5 : 0;
      asph.push(strip(ax + ux * sA, az + uz * sA, bx - ux * sB, bz - uz * sB, -r.w / 2, r.w / 2, 0.03, 9));
      const a2 = [ax + ux * cutA, az + uz * cutA], b2 = [bx - ux * cutB, bz - uz * cutB];
      for (const s of [1, -1]) {
        bays.push(strip(a2[0], a2[1], b2[0], b2[1], s * r.w / 2, s * (r.w / 2 + 2.6), 0.025, 6));
        const o0 = s > 0 ? r.w / 2 + 2.6 : -(r.w / 2 + 4.8), o1 = s > 0 ? r.w / 2 + 4.8 : -(r.w / 2 + 2.6);
        walks.push(curbBox(a2[0], a2[1], b2[0], b2[1], o0, o1, 0.16));
      }
      void ends; [ax, az, bx, bz] = [ax, az, bx, bz];
    }
    // cuadrados de cruce
    const seen = new Set<string>();
    for (const r of roads) for (const p of [r.a, r.b]) {
      const k = p.join(','); if (seen.has(k) || isCenter(p) || (Math.abs(p[0]) < 1 && Math.abs(p[1] + 8) < 1) || (Math.abs(p[0]) < 1 && Math.abs(p[1] + 27) < 1)) continue; seen.add(k);
      const w = 7 + 2 * 4.8;
      const g = new THREE.PlaneGeometry(w, w); g.rotateX(-Math.PI / 2); g.translate(p[0], 0.035, p[1]); cross.push(g);
    }
    return {asph: mergeGeometries(asph), bays: mergeGeometries(bays), walks: mergeGeometries(walks), cross: mergeGeometries(cross)};
  }, []);
}

// ---------------------------------------------------------------- instancias estáticas por manzana
type Inst = {key: string; part: {geo: THREE.BufferGeometry; mat: THREE.Material}; mats: THREE.Matrix4[]};
function useInstances(lib: Lib) {
  return useMemo(() => {
    const groups = new Map<string, Inst>();
    const tmp = new THREE.Object3D();
    const add = (p: Place) => {
      const a = lib.assets[p.m];
      if (!a) return;
      tmp.position.set(p.x, 0, p.z); tmp.rotation.set(0, p.ry, 0); tmp.scale.setScalar(p.s ?? 1); tmp.updateMatrix();
      const tile = `${Math.floor(p.x / TILE)},${Math.floor(p.z / TILE)}`;
      const all = [...a.parts.map((pt, i) => ({pt, k: `${p.m}|${i}`, m: tmp.matrix}))];
      for (const [kind, list] of Object.entries(a.sub)) list.forEach((s, j) => s.parts.forEach((pt, i) => all.push({pt, k: `${p.m}|${kind}${j}|${i}`, m: tmp.matrix.clone().multiply(s.m)})));
      for (const {pt, k, m} of all) {
        const kk = `${k}@${tile}`;
        if (!groups.has(kk)) groups.set(kk, {key: kk, part: pt, mats: []});
        groups.get(kk)!.mats.push(m.clone());
      }
    };
    places.filter((p) => p.m !== 'garaje').forEach(add);
    return [...groups.values()].map((g) => {
      const im = new THREE.InstancedMesh(g.part.geo, g.part.mat, g.mats.length);
      g.mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
      return im;
    });
  }, [lib]);
}

// ---------------------------------------------------------------- tráfico instanciado
function useTraffic(lib: Lib) {
  return useMemo(() => {
    if (!resolved) resolve();
    const byModel = new Map<string, Car[]>();
    for (const c of cars) { if (!byModel.has(c.m)) byModel.set(c.m, []); byModel.get(c.m)!.push(c); }
    const out: {body: THREE.InstancedMesh[]; wheels: {im: THREE.InstancedMesh; m: THREE.Matrix4; r: number}[]; list: Car[]}[] = [];
    for (const [m, list] of byModel) {
      const a = lib.assets[m]; if (!a) continue;
      const body = a.parts.map((p) => { const im = new THREE.InstancedMesh(p.geo, p.mat, list.length); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; return im; });
      const wheels: {im: THREE.InstancedMesh; m: THREE.Matrix4; r: number}[] = [];
      (a.sub.rueda || []).forEach((w) => {
        const pos = new THREE.Vector3().setFromMatrixPosition(w.m);
        w.parts.forEach((p) => { const im = new THREE.InstancedMesh(p.geo, p.mat, list.length); im.castShadow = true; im.frustumCulled = false; wheels.push({im, m: w.m, r: Math.max(0.3, pos.y)}); });
      });
      out.push({body, wheels, list});
    }
    return out;
  }, [lib]);
}
const _o = new THREE.Object3D(), _m = new THREE.Matrix4(), _r = new THREE.Matrix4();
function updateTraffic(tr: ReturnType<typeof useTraffic>, t: number) {
  for (const g of tr) {
    g.list.forEach((c, i) => {
      const p = carPose(c, t);
      const moving = p.dist > 0 && p.dist < c.len;
      _o.position.set(p.x, moving ? Math.abs(Math.sin(p.dist * 1.7)) * 0.025 : 0, p.z); _o.rotation.set(0, p.yaw, 0); _o.scale.setScalar(1); _o.updateMatrix();
      g.body.forEach((im) => im.setMatrixAt(i, _o.matrix));
      g.wheels.forEach((w) => { _r.makeRotationX(p.dist / w.r); _m.copy(_o.matrix).multiply(w.m).multiply(_r); w.im.setMatrixAt(i, _m); });
    });
    g.body.forEach((im) => (im.instanceMatrix.needsUpdate = true));
    g.wheels.forEach((w) => (w.im.instanceMatrix.needsUpdate = true));
  }
}

// ---------------------------------------------------------------- garaje animable
const Garage: React.FC<{lib: Lib; open: number}> = ({lib, open}) => {
  const a = lib.assets.garaje;
  const door = a.sub.puerta_enrollable?.[0];
  return (
    <group position={[20, 0, -12]}>
      {a.parts.map((p, i) => <mesh key={i} geometry={p.geo} material={p.mat} castShadow receiveShadow />)}
      {door ? (
        <group matrixAutoUpdate={false} matrix={door.m}>
          <group position={[0, 0, 0]} scale={[1, Math.max(0.04, 1 - open), 1]}>
            {door.parts.map((p, i) => <mesh key={i} geometry={p.geo} material={p.mat} castShadow />)}
          </group>
        </group>
      ) : null}
    </group>
  );
};

// ---------------------------------------------------------------- carteles con texto
const SIGNS: Record<string, {txt: string; bg: string; fg: string; w: number; h: number; y: number; z: number}> = {
  garaje: {txt: 'GARAJE BRUNO', bg: '#1f5fd1', fg: '#ffffff', w: 7.0, h: 1.3, y: 5.2, z: 4.29},
  lavadero: {txt: 'LAVADERO', bg: '#16a6d9', fg: '#ffffff', w: 7.0, h: 1.3, y: 4.6, z: 4.29},
  estacion: {txt: 'ESTACIÓN', bg: '#1f8a55', fg: '#fff7e0', w: 9.8, h: 1.3, y: 5.6, z: 4.79},
  bomberos: {txt: 'BOMBEROS', bg: '#c9182b', fg: '#ffffff', w: 8.4, h: 1.3, y: 5.0, z: 4.79},
  ayuntamiento: {txt: 'AYUNTAMIENTO', bg: '#a8743f', fg: '#fff7e0', w: 11.2, h: 1.3, y: 7.0, z: 5.29},
  tienda_pan: {txt: 'PANADERÍA', bg: '#ff8a1f', fg: '#ffffff', w: 5.6, h: 0.9, y: 4.0, z: 3.65},
  tienda_helados: {txt: 'HELADOS', bg: '#ff5f9a', fg: '#ffffff', w: 5.6, h: 0.9, y: 4.0, z: 3.65},
  tienda_juguetes: {txt: 'JUGUETES', bg: '#3d8bff', fg: '#ffffff', w: 5.6, h: 0.9, y: 4.0, z: 3.65},
  tienda_frutas: {txt: 'FRUTERÍA', bg: '#39c47a', fg: '#ffffff', w: 5.6, h: 0.9, y: 4.0, z: 3.65},
  tienda_libros: {txt: 'LIBROS', bg: '#9b6bff', fg: '#ffffff', w: 5.6, h: 0.9, y: 4.0, z: 3.65},
};
function signTex(s: (typeof SIGNS)[string]) {
  const W = 1024, H = Math.round((1024 * s.h) / s.w);
  return canvasTex(W, H, (x) => {
    x.fillStyle = s.bg; const r = H * 0.28;
    x.beginPath(); x.roundRect(6, 6, W - 12, H - 12, r); x.fill();
    x.lineWidth = H * 0.07; x.strokeStyle = '#ffffff'; x.stroke();
    const fs = Math.min(H * 0.72, (W * 1.5) / s.txt.length);
    x.font = `${fs}px "Lilita One", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = fs * 0.16; x.strokeStyle = 'rgba(0,0,0,0.25)'; x.strokeText(s.txt, W / 2, H / 2 + fs * 0.06);
    x.fillStyle = s.fg; x.fillText(s.txt, W / 2, H / 2 + fs * 0.04);
  });
}
function useSigns() {
  return useMemo(() => Object.entries(SIGNS).map(([m, s]) => {
    const ps = places.filter((p) => p.m === m);
    const mat = new THREE.MeshStandardMaterial({map: signTex(s), roughness: 0.45, emissive: '#ffffff', emissiveIntensity: 0});
    const geo = new THREE.PlaneGeometry(s.w, s.h); geo.translate(0, s.y, s.z);
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, ps.length));
    ps.forEach((p, i) => { _o.position.set(p.x, 0, p.z); _o.rotation.set(0, p.ry, 0); _o.scale.setScalar(p.s ?? 1); _o.updateMatrix(); im.setMatrixAt(i, _o.matrix); });
    if (m === 'garaje') { _o.position.set(20, 0, -12); _o.rotation.set(0, 0, 0); _o.updateMatrix(); im.setMatrixAt(0, _o.matrix); }
    im.computeBoundingSphere();
    return im;
  }), []);
}

// ---------------------------------------------------------------- mundo
export const World: React.FC<{lib: Lib; t: number; garageOpen: number; traffic?: boolean}> = ({lib, t, garageOpen, traffic = true}) => {
  const st = useStreets();
  const inst = useInstances(lib);
  const tr = useTraffic(lib);
  const signs = useSigns();
  const tex = useMemo(() => ({grass: grassTex(), asph: asphaltTex(), bay: bayTex(), walk: walkTex(), plaza: plazaTex(), crop: cropTex(), sand: sandTex()}), []);
  const rail = useMemo(() => {
    const n = Math.floor(470 / 0.75);
    const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.14, 0.32), new THREE.MeshStandardMaterial({color: '#7a5636', roughness: 0.9}), n);
    for (let i = 0; i < n; i++) { _o.position.set(-235 + i * 0.75, 0.2, RAIL_Z); _o.rotation.set(0, Math.PI / 2, 0); _o.updateMatrix(); sl.setMatrixAt(i, _o.matrix); }
    sl.receiveShadow = true; sl.castShadow = true;
    return sl;
  }, []);
  const hills = useMemo(() => Array.from({length: 26}, (_, i) => {
    const a = (i / 26) * Math.PI * 2 + 0.13, r = 330 + ((i * 37) % 90);
    return {x: Math.cos(a) * r, z: Math.sin(a) * r, s: 60 + ((i * 53) % 50), h: 0.35 + ((i * 17) % 10) / 30, c: ['#6cbf5e', '#5fb35a', '#7ccf6a', '#8fd877'][i % 4]};
  }).filter((h) => h.z < SEA_Z + 40), []);
  if (traffic) updateTraffic(tr, t);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[1400, 1400]} /><meshStandardMaterial map={tex.grass} roughness={0.95} /></mesh>
      <mesh geometry={st.asph} receiveShadow><meshStandardMaterial map={tex.asph} roughness={0.85} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={st.cross} receiveShadow><meshStandardMaterial color="#4b5163" roughness={0.85} /></mesh>
      <mesh geometry={st.bays} receiveShadow><meshStandardMaterial map={tex.bay} roughness={0.85} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={st.walks} receiveShadow castShadow><meshStandardMaterial map={tex.walk} roughness={0.8} /></mesh>
      {/* plaza-rotonda */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.032, 0]} receiveShadow><ringGeometry args={[PLAZA_R, RING_R, 96]} /><meshStandardMaterial color="#4b5163" roughness={0.85} /></mesh>
      <mesh position={[0, 0.08, 0]} receiveShadow><cylinderGeometry args={[PLAZA_R, PLAZA_R + 0.1, 0.16, 96]} /><meshStandardMaterial map={tex.plaza} roughness={0.75} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.036, 0]}><ringGeometry args={[RING_R - 0.25, RING_R, 96]} /><meshStandardMaterial color="#f2f2f2" /></mesh>
      {/* vía del tren */}
      <mesh position={[0, 0.06, RAIL_Z]} receiveShadow><boxGeometry args={[470, 0.12, 3.6]} /><meshStandardMaterial color="#a39a8c" roughness={1} /></mesh>
      <primitive object={rail} />
      {[-0.72, 0.72].map((o) => <mesh key={o} position={[0, 0.34, RAIL_Z + o]} castShadow><boxGeometry args={[470, 0.14, 0.1]} /><meshStandardMaterial color="#c9d1dc" metalness={0.85} roughness={0.25} /></mesh>)}
      {/* mar, playa y lago */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, SEA_Z - 5]} receiveShadow><planeGeometry args={[1400, 12]} /><meshStandardMaterial map={tex.sand} roughness={1} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, SEA_Z + 300]}><planeGeometry args={[1400, 600]} /><meshPhysicalMaterial color="#2f9fe4" roughness={0.12} clearcoat={1} envMapIntensity={1.3} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[LAKE.x, 0.06, LAKE.z]} scale={[LAKE.rx, LAKE.rz, 1]}><circleGeometry args={[1, 64]} /><meshPhysicalMaterial color="#3aaaf0" roughness={0.08} clearcoat={1} envMapIntensity={1.3} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[LAKE.x, 0.04, LAKE.z]} scale={[LAKE.rx + 1.6, LAKE.rz + 1.6, 1]}><circleGeometry args={[1, 64]} /><meshStandardMaterial map={tex.sand} roughness={1} /></mesh>
      {/* campos de la granja */}
      {[[172, 100, 48, 70], [172, -105, 48, 60]].map(([x, z, w, d], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.04, z]} receiveShadow><planeGeometry args={[w, d]} /><meshStandardMaterial map={tex.crop} roughness={0.95} /></mesh>
      ))}
      {/* colinas */}
      {hills.map((h, i) => <mesh key={i} position={[h.x, -h.s * 0.55, h.z]} scale={[1, h.h * 1.6, 1]}><sphereGeometry args={[h.s, 32, 20]} /><meshStandardMaterial color={h.c} roughness={0.95} /></mesh>)}
      {inst.map((im, i) => <primitive key={i} object={im} />)}
      <Garage lib={lib} open={garageOpen} />
      {signs.map((im, i) => <primitive key={`s${i}`} object={im} />)}
      {traffic ? tr.flatMap((g, i) => [...g.body.map((im, j) => <primitive key={`b${i}_${j}`} object={im} />), ...g.wheels.map((w, j) => <primitive key={`w${i}_${j}`} object={w.im} />)]) : null}
    </group>
  );
};

// coche guionizado (fuera del sistema de tráfico): pinta un modelo en una pose dada
export const ScriptCar: React.FC<{lib: Lib; m: string; x: number; z: number; yaw: number; dist?: number; y?: number; roll?: number; pitch?: number; children?: React.ReactNode}> = ({lib, m, x, z, yaw, dist = 0, y = 0, roll = 0, pitch = 0, children}) => {
  const a = lib.assets[m];
  if (!a) return null;
  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]}>
      <group rotation={[pitch, 0, roll]}>
        {a.parts.map((p, i) => <mesh key={i} geometry={p.geo} material={p.mat} castShadow receiveShadow />)}
        {(a.sub.rueda || []).map((w, j) => {
          const r = Math.max(0.3, new THREE.Vector3().setFromMatrixPosition(w.m).y);
          return (
            <group key={j} matrixAutoUpdate={false} matrix={w.m}>
              <group rotation={[dist / r, 0, 0]}>{w.parts.map((p, i) => <mesh key={i} geometry={p.geo} material={p.mat} castShadow />)}</group>
            </group>
          );
        })}
        {children}
      </group>
    </group>
  );
};

// personaje genérico (Lola, Tico, Coco, vagones): parpadeo, boca, escalera, pala, sirenas, chimenea y ruedas
export type CharPose = {x: number; z: number; yaw: number; y?: number; roll?: number; pitch?: number; dist?: number; s?: number; sy?: number;
  blink?: number; talk?: number; ladder?: number; arm?: number; siren?: number; puff?: number; tint?: string};
export const Char: React.FC<{lib: Lib; m: string; p: CharPose; children?: React.ReactNode}> = ({lib, m, p, children}) => {
  const a = lib.assets[m];
  if (!a) return null;
  const sub = (k: string, f: (j: number) => {rot?: [number, number, number]; scale?: [number, number, number]; vis?: boolean; pos?: [number, number, number]}) =>
    (a.sub[k] || []).map((w, j) => {
      const o = f(j);
      if (o.vis === false) return null;
      return (
        <group key={k + j} matrixAutoUpdate={false} matrix={w.m}>
          <group rotation={o.rot ?? [0, 0, 0]} scale={o.scale ?? [1, 1, 1]} position={o.pos ?? [0, 0, 0]}>{w.parts.map((pt, i) => <mesh key={i} geometry={pt.geo} material={pt.mat} castShadow />)}</group>
        </group>
      );
    });
  const tk = Math.max(0, Math.min(1, p.talk ?? 0)), bl = Math.max(0.06, 1 - (p.blink ?? 0));
  const wheelR = (j: number) => { const w = a.sub.rueda[j]; return Math.max(0.3, new THREE.Vector3().setFromMatrixPosition(w.m).y); };
  return (
    <group position={[p.x, p.y ?? 0, p.z]} rotation={[0, p.yaw, 0]} scale={[p.s ?? 1, (p.s ?? 1) * (p.sy ?? 1), p.s ?? 1]}>
      <group rotation={[p.pitch ?? 0, 0, p.roll ?? 0]}>
        {a.parts.map((pt, i) => <mesh key={i} geometry={pt.geo} material={pt.mat} castShadow receiveShadow />)}
        {sub('ojosA', () => ({scale: [1, bl, 1]}))}
        {sub('bocaA', () => ({scale: [1, 0.15 + tk * 1.1, 1], vis: tk > 0.05}))}
        {sub('escalera', () => ({rot: [-(p.ladder ?? 0) * 0.7, 0, 0]}))}
        {sub('pala', () => ({rot: [-(p.arm ?? 0), 0, 0]}))}
        {sub('sirenaR', () => ({vis: (p.siren ?? 0) > 0 ? Math.sin((p.siren ?? 0) * 14) > 0 : true, scale: (p.siren ?? 0) > 0 ? [1.15, 1.15, 1.15] : [1, 1, 1]}))}
        {sub('sirenaB', () => ({vis: (p.siren ?? 0) > 0 ? Math.sin((p.siren ?? 0) * 14) <= 0 : true, scale: (p.siren ?? 0) > 0 ? [1.15, 1.15, 1.15] : [1, 1, 1]}))}
        {sub('chimenea', () => ({scale: [1 + (p.puff ?? 0) * 0.15, 1 - (p.puff ?? 0) * 0.12, 1 + (p.puff ?? 0) * 0.15]}))}
        {sub('rueda', (j) => ({rot: [(p.dist ?? 0) / wheelR(j), 0, 0]}))}
        {children}
      </group>
    </group>
  );
};
