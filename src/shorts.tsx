// Shorts verticales nativos (1080x1920): un tramo de un capítulo + gancho inicial + pregunta final de 3 s.
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import '@fontsource/lilita-one';
import {Ep10} from './ep10';
import {Cap2} from './cap2';
import {prog, easeOutBack, easeInOut} from './anim';

export type ShortSpec = {id: string; ep: 1 | 2; t0: number; dur: number; hook: string; hook2?: string; ask: string; col: string};
export const ASK_D = 3.2;

const font = '"Lilita One", sans-serif';
const stroke = (c: string, px: number) => ({WebkitTextStroke: `${px}px ${c}`, paintOrder: 'stroke fill' as any});

const ShortOverlay: React.FC<{s: ShortSpec; t: number}> = ({s, t}) => {
  // gancho: entra con rebote y se va hacia arriba a los 2.4 s
  const hk = easeOutBack(prog(t, 0.05, 0.4), 2.2) * (1 - easeInOut(prog(t, 2.3, 2.7)));
  const ta = s.dur; // inicio de la pregunta
  const ak = easeOutBack(prog(t, ta, ta + 0.35), 2.2);
  const dim = prog(t, ta - 0.1, ta + 0.4);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {hk > 0.01 ? (
        <div style={{position: 'absolute', top: 250, width: '100%', textAlign: 'center', transform: `scale(${hk}) rotate(${-3 + Math.sin(t * 6) * 2}deg)`}}>
          <div style={{display: 'inline-block', fontFamily: font, fontSize: 132, lineHeight: 1.0, color: s.col, ...stroke('#ffffff', 26), textShadow: '0 14px 0 rgba(40,20,60,0.35)', padding: '0 30px'}}>{s.hook}</div>
          {s.hook2 ? <div style={{fontFamily: font, fontSize: 78, color: '#fff', ...stroke('#2b2350', 16), marginTop: 10}}>{s.hook2}</div> : null}
        </div>
      ) : null}
      {dim > 0 ? (
        <AbsoluteFill style={{background: `rgba(20,24,60,${0.5 * dim})`, alignItems: 'center', justifyContent: 'center'}}>
          <div style={{transform: `scale(${ak}) rotate(${Math.sin(t * 4) * 2}deg)`, textAlign: 'center', padding: '0 60px'}}>
            <div style={{fontFamily: font, fontSize: 120, lineHeight: 1.1, color: '#fff', ...stroke('#2b2350', 22), textShadow: '0 12px 0 rgba(0,0,0,0.25)'}}>{s.ask}</div>
            <div style={{marginTop: 40, fontFamily: font, fontSize: 70, color: '#ffd23f', ...stroke('#2b2350', 14)}}>¡Pueblo Brum!</div>
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

export const Short: React.FC<{s: ShortSpec}> = ({s}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  return (
    <AbsoluteFill style={{background: '#a9dcff'}}>
      {s.ep === 1 ? <Ep10 t0={s.t0} /> : <Cap2 t0={s.t0} />}
      <ShortOverlay s={s} t={t} />
    </AbsoluteFill>
  );
};

export const SHORTS: ShortSpec[] = [
  {id: 'ShortC1Regalo', ep: 1, t0: 0.0, dur: 44.0, hook: '¿QUÉ HAY DENTRO?', hook2: '🎁', ask: '¿Qué te gustaría encontrar en un regalo?', col: '#ff5f9a'},
  {id: 'ShortC1Colores', ep: 1, t0: 175.3, dur: 50.5, hook: '¡CAMBIA DE COLOR!', ask: '¿Qué color te gustó más?', col: '#3d8bff'},
  {id: 'ShortC1Suena', ep: 1, t0: 365.2, dur: 39.5, hook: '¿QUÉ SUENA?', hook2: '¡Adivina!', ask: '¿Adivinaste todos los sonidos?', col: '#c56bff'},
  {id: 'ShortC1Carrera', ep: 1, t0: 413.0, dur: 55.0, hook: '¡LA GRAN CARRERA!', ask: '¿Quién es tu favorito?', col: '#ff3b30'},
  {id: 'ShortC2Enorme', ep: 2, t0: 93.6, dur: 28.4, hook: '¿QUÉ HAY BAJO TIERRA?', hook2: '✨', ask: '¿Qué crees que era?', col: '#ffd23f'},
  {id: 'ShortC2Arriba', ep: 2, t0: 265.8, dur: 34.4, hook: '¡UNO, DOS, TRES...!', ask: '¿Te gusta ayudar a tus amigos?', col: '#ff8a1f'},
  {id: 'ShortC2Suena', ep: 2, t0: 364.4, dur: 39.6, hook: '¿QUÉ SUENA?', hook2: '¡Adivina!', ask: '¿Adivinaste todos los sonidos?', col: '#c56bff'},
  {id: 'ShortC2Salto', ep: 2, t0: 543.0, dur: 29.8, hook: '¡EL GRAN SALTO!', ask: '¿Tú también saltarías en el charco?', col: '#8a5a34'},
];
