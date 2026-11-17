import React, {useMemo, useEffect} from 'react';
import * as THREE from 'three';
import {useFrame, useThree} from '@react-three/fiber';
import {EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect, HueSaturationEffect, BrightnessContrastEffect} from 'postprocessing';
// @ts-ignore
import {N8AOPostPass} from 'n8ao';

export const Post: React.FC<{ao?: boolean; bloom?: number; off?: boolean}> = ({ao = true, bloom = 0.35, off = false}) => {
  const {gl, scene, camera, size} = useThree();
  const comp = useMemo(() => {
    gl.toneMapping = THREE.NoToneMapping;
    const c = new EffectComposer(gl, {frameBufferType: THREE.HalfFloatType, multisampling: 0});
    c.addPass(new RenderPass(scene, camera));
    if (ao) {
      const n8 = new N8AOPostPass(scene, camera, size.width, size.height);
      n8.configuration.aoRadius = 1.6; n8.configuration.distanceFalloff = 0.6; n8.configuration.intensity = 2.2;
      n8.configuration.halfRes = true; n8.configuration.aoSamples = 12; n8.configuration.denoiseSamples = 6; n8.configuration.denoiseRadius = 10;
      n8.configuration.color = new THREE.Color('#2b2250');
      n8.setQualityMode?.('Medium');
      c.addPass(n8);
    }
    const bl = new BloomEffect({intensity: bloom, luminanceThreshold: 0.92, luminanceSmoothing: 0.25, mipmapBlur: true, radius: 0.6});
    const tm = new ToneMappingEffect({mode: ToneMappingMode.NEUTRAL});
    const hs = new HueSaturationEffect({saturation: 0.08});
    const bc = new BrightnessContrastEffect({contrast: 0.06, brightness: 0.0});
    const vg = new VignetteEffect({offset: 0.38, darkness: 0.38});
    c.addPass(new EffectPass(camera, bl, tm, hs, bc, vg));
    c.addPass(new EffectPass(camera, new SMAAEffect()));
    return c;
  }, [gl, scene, camera, ao, bloom]);
  useEffect(() => { comp.setSize(size.width, size.height); }, [comp, size]);
  useFrame(() => { if (off) gl.render(scene, camera); else comp.render(); }, 1);
  return null;
};
