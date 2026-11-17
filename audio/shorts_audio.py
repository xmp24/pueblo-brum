"""Audio de los shorts: tramo del capítulo + pregunta final de ~3 s (voz) con la música bajando. Normaliza a -14 LUFS."""
import numpy as np, soundfile as sf, subprocess, json
SR = 48000
SH = [('ShortC1Regalo', 'ep10', 0.0, 44.0, 'q1'), ('ShortC1Colores', 'ep10', 175.3, 50.5, 'q2'), ('ShortC1Suena', 'ep10', 365.2, 39.5, 'q3'), ('ShortC1Carrera', 'ep10', 413.0, 55.0, 'q4'),
      ('ShortC2Enorme', 'cap2', 93.6, 28.4, 'q5'), ('ShortC2Arriba', 'cap2', 265.8, 34.4, 'q6'), ('ShortC2Suena', 'cap2', 364.4, 39.6, 'q3'), ('ShortC2Salto', 'cap2', 543.0, 29.8, 'q7')]
ASK = 3.2
src = {k: sf.read(f'audio/{k}.wav')[0] for k in ('ep10', 'cap2')}
for sid, ep, t0, dur, q in SH:
    a = src[ep]; n = int((dur + ASK) * SR); seg = a[int(t0 * SR): int(t0 * SR) + n].copy()
    if len(seg) < n: seg = np.concatenate([seg, np.zeros((n - len(seg), 2))])
    t = np.arange(n) / SR
    g = np.where(t < dur, 1.0, np.maximum(0.25, 1 - (t - dur) / 0.4 * 0.75)); g *= np.minimum(1, (n - np.arange(n)) / (SR * 0.25)); g *= np.minimum(1, np.arange(n) / (SR * 0.03))
    seg *= g[:, None]
    v, sr = sf.read(f'/home/claude/el6/sel/{q}.wav')
    if v.ndim > 1: v = v.mean(1)
    v = v / (np.max(np.abs(v)) + 1e-9) * 0.9
    i = int((dur + 0.35) * SR); L = min(len(v), n - i); seg[i:i + L] += v[:L, None] * 0.85
    sf.write('/tmp/sh.wav', seg.astype(np.float32), SR)
    J = subprocess.run(['ffmpeg', '-hide_banner', '-i', '/tmp/sh.wav', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    d = json.loads(J[J.rindex('{'):J.rindex('}') + 1])
    af = f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={d['input_i']}:measured_TP={d['input_tp']}:measured_LRA={d['input_lra']}:measured_thresh={d['input_thresh']}:offset={d['target_offset']}:linear=true"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', '/tmp/sh.wav', '-af', af, '-ar', '48000', f'audio/short_{sid}.wav'], check=True)
    print(sid, round(dur + ASK, 2))
