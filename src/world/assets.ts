// Carga de los GLB de Blender y fusión por material (para instanciar barato).
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/examples/jsm/loaders/RGBELoader.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {staticFile, delayRender, continueRender} from 'remotion';
import {useEffect, useState} from 'react';

export type Part = {geo: THREE.BufferGeometry; mat: THREE.Material};
export type Asset = {name: string; parts: Part[]; sub: Record<string, {parts: Part[]; m: THREE.Matrix4}[]>; node: THREE.Object3D};
export type Lib = {assets: Record<string, Asset>; bruno: THREE.Object3D; sky: THREE.Texture};

const FILES = ['edificios', 'vehiculos', 'props', 'arboles', 'personajes', 'cap2'];
const SPLIT = /^(rueda[A-Z]{2}|puerta_enrollable|ojosA|bocaA|escalera|pala|sirena[RB]|chimenea)/; // subárboles animables que se separan

const matCache = new Map<string, THREE.Material>();
function fixMat(m: THREE.Material, hasColor: boolean) {
  const k = m.name + (hasColor ? '+c' : '');
  if (matCache.has(k)) return matCache.get(k)!;
  const n = (m as THREE.MeshStandardMaterial).clone();
  n.vertexColors = hasColor;
  (n as THREE.MeshStandardMaterial).envMapIntensity = 0.85;
  matCache.set(k, n);
  const sm = n as THREE.MeshStandardMaterial;
  sm.userData.e0 = sm.emissiveIntensity; sm.userData.ec0 = sm.emissive?.clone();
  return n;
}
// día (0) -> noche (1): farolas, ventanas y luces interiores
export function applyNight(k: number) {
  for (const m of matCache.values()) {
    const sm = m as THREE.MeshStandardMaterial;
    if (/^farol|^luz_taller/.test(sm.name)) sm.emissiveIntensity = sm.userData.e0 * (/^farol/.test(sm.name) ? 0.06 + 1.2 * k : 0.25 + 0.75 * k);
    else if (/^cristal/.test(sm.name)) { sm.emissive.copy(sm.userData.ec0).lerp(new THREE.Color('#ffc36b'), k); sm.emissiveIntensity = sm.userData.e0 + k * 1.4; }
    else if (/^faro$|^faro\+/.test(sm.name)) sm.emissiveIntensity = sm.userData.e0 * (0.6 + 1.2 * k);
  }
}

function mergeNode(root: THREE.Object3D, skipSplit: boolean): Part[] {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const groups = new Map<string, {mat: THREE.Material; geos: THREE.BufferGeometry[]}>();
  const visit = (o: THREE.Object3D) => {
    if (o !== root && skipSplit && SPLIT.test(o.name)) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      const src = mesh.geometry;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', src.getAttribute('position').clone());
      if (src.getAttribute('normal')) g.setAttribute('normal', src.getAttribute('normal').clone());
      const col = src.getAttribute('color');
      const n = g.getAttribute('position').count;
      if (col) {
        const c = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { c[i * 3] = col.getX(i); c[i * 3 + 1] = col.getY(i); c[i * 3 + 2] = col.getZ(i); }
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      } else g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
      g.setIndex(src.index ? src.index.clone() : null);
      if (!g.index) { const idx = []; for (let i = 0; i < n; i++) idx.push(i); g.setIndex(idx); }
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const m = mats[0];
      const k = m.name || m.uuid;
      if (!groups.has(k)) groups.set(k, {mat: fixMat(m, true), geos: []});
      groups.get(k)!.geos.push(g);
    }
    o.children.forEach(visit);
  };
  visit(root);
  const out: Part[] = [];
  for (const {mat, geos} of groups.values()) {
    const geo = mergeGeometries(geos, false)!;
    geo.computeBoundingSphere();
    out.push({geo, mat});
  }
  return out;
}

let promise: Promise<Lib> | null = null;
export function loadLib(): Promise<Lib> {
  if (promise) return promise;
  const loader = new GLTFLoader();
  const get = (f: string) => loader.loadAsync(staticFile(`models/${f}.glb`));
  promise = (async () => {
    const assets: Record<string, Asset> = {};
    for (const f of FILES) {
      const g = await get(f);
      for (const root of [...g.scene.children]) {
        const sub: Asset['sub'] = {};
        root.updateMatrixWorld(true);
        const inv = root.matrixWorld.clone().invert();
        root.traverse((o) => {
          if (o !== root && SPLIT.test(o.name) && !(o.parent && SPLIT.test(o.parent.name))) {
            const kind = o.name.replace(/\.?\d+$/, '').replace(/^(rueda).*/, '$1');
            (sub[kind] = sub[kind] || []).push({parts: mergeNode(o, false), m: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)});
          }
        });
        assets[root.name] = {name: root.name, parts: mergeNode(root, true), sub, node: root};
      }
    }
    const b = await get('bruno');
    b.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; const mm = m.material as THREE.MeshStandardMaterial; mm.vertexColors = !!m.geometry.getAttribute('color'); mm.envMapIntensity = 0.9; }
    });
    const sky = await new RGBELoader().loadAsync(staticFile('hdri/sky.hdr'));
    sky.mapping = THREE.EquirectangularReflectionMapping;
    return {assets, bruno: b.scene, sky};
  })();
  return promise;
}

export function useLib(): Lib | null {
  const [lib, setLib] = useState<Lib | null>(null);
  const [h] = useState(() => delayRender('cargando modelos', {timeoutInMilliseconds: 300000}));
  useEffect(() => {
    loadLib().then((l) => { setLib(l); continueRender(h); }).catch((e) => { console.error(e); throw e; });
  }, [h]);
  return lib;
}
