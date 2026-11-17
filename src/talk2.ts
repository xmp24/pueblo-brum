import {hash} from './anim';
// Habla y parpadeo para cualquier línea de tiempo de voces (vo2.json, etc.)
export function makeTalk(vo: Record<string, {t: number; d: number}>) {
  const cache: Record<string, [number, number][]> = {};
  return (prefix: RegExp, t: number) => {
    const key = prefix.source;
    if (!cache[key]) cache[key] = Object.keys(vo).filter((k) => prefix.test(k)).map((k) => [vo[k].t, vo[k].t + vo[k].d]);
    for (const [a, b] of cache[key]) if (t >= a && t <= b) {
      const env = Math.min(1, (t - a) / 0.05) * Math.min(1, (b - t) / 0.06);
      return env * (0.3 + 0.7 * Math.abs(Math.sin(t * Math.PI * 4.6)) * (0.5 + 0.5 * hash(Math.floor(t * 9))));
    }
    return 0;
  };
}
