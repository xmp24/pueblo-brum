import VO from './vo.json';
import {hash} from './anim';
const vo = VO as Record<string, {t: number; d: number}>;
const cache: Record<string, [number, number][]> = {};
// envolvente de habla para un personaje: prefijos de las claves de vo.json
export function talkOf(prefix: RegExp, t: number) {
  const key = prefix.source;
  if (!cache[key]) cache[key] = Object.keys(vo).filter((k) => prefix.test(k)).map((k) => [vo[k].t, vo[k].t + vo[k].d]);
  for (const [a, b] of cache[key]) if (t >= a && t <= b) {
    const env = Math.min(1, (t - a) / 0.05) * Math.min(1, (b - t) / 0.06);
    return env * (0.3 + 0.7 * Math.abs(Math.sin(t * Math.PI * 4.6)) * (0.5 + 0.5 * hash(Math.floor(t * 9))));
  }
  return 0;
}
export const speaking = (prefix: RegExp, t: number) => talkOf(prefix, t) > 0;
// parpadeo periódico (0..1)
export function blinkAt(t: number, seed = 0) {
  const per = 3.1 + seed * 0.37;
  const ph = (t + seed * 1.7) % per;
  return ph < 0.14 ? Math.sin((ph / 0.14) * Math.PI) : 0;
}
export const PX = {bruno: /^b\d/, chispa: /^x\d/, lola: /^l\d/, tico: /^t\d/, coco: /^o\d/};
