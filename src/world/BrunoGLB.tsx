// Bruno de Blender con la misma interfaz de pose que Bruno2 (B2Pose).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Lib} from './assets';
import type {B2Pose} from '../Bruno2';

const ARM_TIP = new THREE.Vector3(0, 0.86, -1.23);

function build(src: THREE.Object3D) {
  const root = src.clone(true);
  const find = (n: string) => root.getObjectByName(n)!;
  const bruno = find('Bruno');
  // ojos cerrados huérfanos -> dentro de su ojo
  for (const s of ['L', 'R']) {
    const c = root.getObjectByName(`ojo${s}_cerrado`); const o = find(`ojo${s}`);
    if (c && o && c.parent !== o) { o.add(c); }
  }
  // materiales propios para poder brillar
  const glowMats: THREE.MeshStandardMaterial[] = [];
  find('cuerpo').traverse((m) => {
    const mesh = m as THREE.Mesh; if (!mesh.isMesh) return;
    mesh.material = (mesh.material as THREE.MeshStandardMaterial).clone();
    const mm = mesh.material as THREE.MeshStandardMaterial;
    if (/naranja|pintura|cuerpo|Bruno/i.test(mm.name) || mm.color.r > 0.8 && mm.color.g < 0.6) glowMats.push(mm);
  });
  const baliza = find('baliza') as THREE.Mesh;
  const balMats: THREE.MeshStandardMaterial[] = [];
  baliza.traverse((m) => { const mesh = m as THREE.Mesh; if (mesh.isMesh) { mesh.material = (mesh.material as THREE.MeshStandardMaterial).clone(); balMats.push(mesh.material as THREE.MeshStandardMaterial); } });
  // parte superior (todo menos ruedas) para el balanceo
  const upper = new THREE.Group(); upper.name = 'upper';
  for (const c of [...bruno.children]) if (!/^rueda/.test(c.name)) upper.add(c);
  bruno.add(upper);
  const n = {
    root, upper, brazo: find('brazo'), gancho: find('gancho'),
    ojo: [find('ojoL'), find('ojoR')], mir: [find('ojoL_mirada'), find('ojoR_mirada')],
    cer: [root.getObjectByName('ojoL_cerrado'), root.getObjectByName('ojoR_cerrado')],
    ceja: [find('cejaL'), find('cejaR')],
    boca: {smile: root.getObjectByName('boca_sonrisa'), open: find('boca_abierta'), o: root.getObjectByName('boca_o'), flat: root.getObjectByName('boca_plana')},
    ruedas: ['ruedaFL', 'ruedaFR', 'ruedaRL', 'ruedaRR'].map(find),
    glowMats, balMats,
    rest: {} as Record<string, THREE.Vector3>,
  };
  for (const k of ['brazo', 'gancho']) n.rest[k] = (n as any)[k].position.clone();
  root.traverse((o) => { o.userData.s0 = o.scale.clone(); });
  n.ojo.forEach((o, i) => (n.rest['ojo' + i] = o.position.clone()));
  n.mir.forEach((o, i) => (n.rest['mir' + i] = o.position.clone()));
  n.ceja.forEach((o, i) => (n.rest['ceja' + i] = o.position.clone()));
  n.ruedas.forEach((o, i) => (n.rest['r' + i] = o.position.clone()));
  root.traverse((m) => { const mesh = m as THREE.Mesh; if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
  return n;
}
const _v = new THREE.Vector3();

export const BrunoGLB: React.FC<{lib: Lib; p: B2Pose}> = ({lib, p}) => {
  const n = useMemo(() => build(lib.bruno), [lib]);
  // --- pose
  const arm = ((p.arm ?? 0) * Math.PI) / 180;
  n.brazo.rotation.set(arm, 0, 0);
  _v.copy(ARM_TIP).applyAxisAngle(new THREE.Vector3(1, 0, 0), arm).add(n.rest.brazo);
  n.gancho.position.copy(_v);
  n.gancho.rotation.set(p.hookSway ?? 0, 0, (p.hookSway ?? 0) * 0.6);
  const eo = Math.max(0.05, Math.min(1, p.eyeOpen));
  const closed = eo < 0.16;
  const es = p.eyeScale ?? 1;
  const lx = p.lookX ?? 0, ly = p.lookY ?? 0, cross = p.cross ?? 0;
  n.ojo.forEach((o, i) => {
    o.scale.copy(o.userData.s0).multiplyScalar(es);
    for (const c of o.children) if (!/cerrado/.test(c.name)) { c.visible = !closed; c.scale.copy(c.userData.s0); c.scale.y *= closed ? 1 : eo; }
    const cc = n.cer[i]; if (cc) cc.visible = closed;
    const sg = i === 0 ? 1 : -1;
    n.mir[i].position.set(n.rest['mir' + i].x + lx * 0.07 - sg * cross * 0.06, n.rest['mir' + i].y + ly * 0.07, n.rest['mir' + i].z);
  });
  const brow = p.brow ?? 0, bt = p.browTilt ?? 0;
  n.ceja.forEach((c, i) => {
    const sg = i === 0 ? 1 : -1;
    c.position.set(n.rest['ceja' + i].x, n.rest['ceja' + i].y + brow * 0.09 - (closed ? 0.03 : 0), n.rest['ceja' + i].z);
    c.rotation.set(0, 0, sg * bt * 0.45);
  });
  const mouth = p.mouth ?? 'smile', tk = Math.max(0, Math.min(1, p.talk ?? 0));
  const open = mouth === 'open' || tk > 0.12;
  if (n.boca.smile) { n.boca.smile.visible = !open && (mouth === 'smile' || mouth === 'grin'); n.boca.smile.scale.copy(n.boca.smile.userData.s0).multiplyScalar(mouth === 'grin' ? 1.25 : 1); }
  n.boca.open.visible = open; n.boca.open.scale.copy(n.boca.open.userData.s0); n.boca.open.scale.y *= mouth === 'open' ? 1 : 0.35 + tk * 0.75;
  if (n.boca.o) n.boca.o.visible = !open && mouth === 'o';
  if (n.boca.flat) n.boca.flat.visible = !open && mouth === 'flat';
  const wb = p.wheelBounce ?? [0, 0, 0, 0];
  n.ruedas.forEach((r, i) => { r.rotation.set(p.wheel ?? 0, 0, 0); r.position.set(n.rest['r' + i].x, n.rest['r' + i].y + (wb[i] ?? 0), n.rest['r' + i].z); });
  n.upper.rotation.set(0, 0, p.bodyRoll ?? 0);
  const glow = p.glow ?? 0;
  n.glowMats.forEach((m) => { m.emissive.set('#ff9a2a'); m.emissiveIntensity = glow * 0.9; });
  const bea = p.beacon ?? 0;
  n.balMats.forEach((m) => { m.emissive.set('#ffb000'); m.emissiveIntensity = 0.2 + bea * 3; });
  return (
    <group position={[p.x, (p.y ?? 0) + (p.lift ?? 0), p.z]} rotation={[0, p.yaw, 0]}>
      <group rotation={[p.pitch ?? 0, 0, p.roll ?? 0]} scale={[p.sx ?? 1, p.sy ?? 1, p.sz ?? 1]}>
        <primitive object={n.root} />
      </group>
    </group>
  );
};
