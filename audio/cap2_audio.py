"""Pueblo Brum · Capítulo 2: música Kevin MacLeod por bloques + efectos procedurales limpios + voces. Salida audio/cap2_raw.wav"""
import numpy as np, soundfile as sf, json, subprocess
from scipy.signal import butter, sosfilt, oaconvolve, resample_poly

SR = 48000; DUR = 600.0; N = int(SR * DUR)
MUS = '/home/claude/music'
rng = np.random.default_rng(7)
mus = np.zeros((2, N)); sfx = np.zeros((2, N)); vo = np.zeros((2, N))
def tt(d): return np.arange(int(SR * d)) / SR
def filt(x, kind, f, o=2):
    ny = SR / 2
    if kind == 'band': return sosfilt(butter(o, [f[0] / ny, f[1] / ny], 'band', output='sos'), x)
    return sosfilt(butter(o, f / ny, kind, output='sos'), x)
def add(buf, t0, x, g=1.0, pan=0.0):
    i = int(t0 * SR)
    if i < 0: x = x[..., -i:]; i = 0
    if x.ndim == 2:
        L = min(x.shape[1], N - i)
        if L > 0: buf[:, i:i + L] += x[:, :L] * g
        return
    L = min(len(x), N - i)
    if L <= 0: return
    l, r = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414
    buf[0, i:i + L] += x[:L] * g * l; buf[1, i:i + L] += x[:L] * g * r
_cache = {}
def track(name):
    if name not in _cache:
        tmp = f'/tmp/c2_{abs(hash(name))}.wav'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{MUS}/{name}.mp3', '-ar', str(SR), '-ac', '2', tmp], check=True)
        a, _ = sf.read(tmp); _cache[name] = a.T
    return _cache[name]
def first_loud(a, thr=0.6):
    e = np.sqrt(np.convolve(a.mean(0) ** 2, np.ones(SR // 10) / (SR // 10), 'same'))
    idx = np.where(e > thr * np.percentile(e, 80))[0]
    return idx[0] / SR if len(idx) else 0.0
def section(name, t0, t1, off=None, g=1.0, fin=0.06, fout=0.2):
    a = track(name)
    if off is None: off = first_loud(a)
    need = int((t1 - t0 + fout) * SR); seg = a[:, int(off * SR):]
    while seg.shape[1] < need: seg = np.concatenate([seg, a[:, int(first_loud(a) * SR):]], 1)
    seg = seg[:, :need].copy(); n = seg.shape[1]
    seg *= np.minimum(1, np.arange(n) / (SR * fin)) * np.minimum(1, (n - np.arange(n)) / (SR * fout))
    add(mus, t0, seg * (0.12 / (np.sqrt(np.mean(seg ** 2)) + 1e-9)) * g)

VOT = json.load(open('src/vo2.json')); M = json.load(open('src/cap2.json'))
S = lambda k: VOT[k]['t']; E = lambda k: VOT[k]['t'] + VOT[k]['d']

# ---------------- MÚSICA (cambia en cada momento de la historia) ----------------
section('Investigations', 0, M['title0'], g=0.85)
section('Hyperfun', M['title0'], M['exit0'] + 2.4, g=1.0)
section('Monkeys Spinning Monkeys', M['exit0'] + 2.4, M['recap0'], g=0.95)
section('Life of Riley', M['recap0'], M['recap1'], g=0.8)
section('Cut and Run', M['recap1'], M['rail0'], g=1.0)
section('Sneaky Snitch', M['rail0'], M['go2'], g=0.85)
section('Run Amok', M['go2'], M['arrive'], g=1.0)
section('Quirky Dog', M['arrive'], M['park0'], g=0.85)
section('The Builder', M['park0'], M['tug1'], g=0.95)
section('Spazzmatica Polka', M['tug1'], S('b6'), g=0.8)
section('Wallpaper', S('b6'), S('b7'), g=0.7)
section('Amazing Plan', S('b7'), M['quien0'], g=0.9)
section('Happy Happy Game Show', M['quien0'], M['spray0'], g=0.9)
section('Scheming Weasel faster', M['spray0'], M['lift0'], g=0.85)
section('Heroic Age', M['lift0'], M['setdown0'], g=1.0)
section('Carefree', M['setdown0'], M['party0'], g=0.85)
section('Itty Bitty 8 Bit', M['party0'], M['party1'], g=1.0)
section('Happy Happy Game Show', M['party1'], S('o2'), g=0.85)
section('Amazing Plan', S('o2'), M['train0'], g=0.9)
section('Pixel Peeker Polka - faster', M['train0'], M['train1'], g=1.0)
section('Life of Riley', M['train1'], M['plaza1'], g=0.85)
section('Hyperfun', M['plaza1'], M['jump1'], g=1.0)
section('Wallpaper', M['jump1'], M['logo0'], g=0.75)
section('Heroic Age', M['logo0'], M['sp0'], g=0.95)
section('Investigations', M['sp0'], DUR, g=0.95)

# ---------------- EFECTOS ----------------
def noise(d, lo, hi, g, env_k=0):
    n = filt(rng.standard_normal(int(SR * d)), 'band', (lo, hi)); t = tt(d)
    return n * (np.exp(-t * env_k) if env_k else np.sin(np.pi * t / d)) * g
def thump(f0=90, d=0.5, g=1.0):
    t = tt(d); f = f0 * np.exp(-t * 6) + 35
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) + filt(rng.standard_normal(len(t)), 'low', 900) * np.exp(-t * 20) * 0.4) * g
def whoosh(d=0.5, lo=400, hi=3000, g=0.25):
    n = filt(rng.standard_normal(int(SR * d)), 'band', (lo, hi)); return n * np.sin(np.linspace(0, np.pi, len(n))) ** 2 * g
def boing(d=0.6, f0=260, up=380, g=0.5):
    t = tt(d); f = f0 + up * np.exp(-t * 4) + 25 * np.sin(2 * np.pi * 14 * t)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4) * g
def ding(f=1568, d=1.4, g=0.3):
    t = tt(d); return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.01 * t)) * np.exp(-t * 3) * g
def blip(f0=600, f1=1200, d=0.2, g=0.2):
    t = tt(d); return np.sin(2 * np.pi * np.cumsum(np.linspace(f0, f1, len(t))) / SR) * np.exp(-t * 10) * g
def honk(t0, n=2, f=(523, 784), g=0.28):
    for k in range(n):
        t = tt(0.15); x = np.sign(np.sin(2 * np.pi * f[0] * t)) * 0.5 + np.sin(2 * np.pi * f[1] * t) * 0.4
        add(sfx, t0 + k * 0.19, filt(x, 'low', 3000) * np.minimum(1, t / 0.01) * np.minimum(1, (0.15 - t) / 0.03) * g)
def gliss(t0, up=True, g=0.12):
    for i in range(14):
        f = 523 * 2 ** ((i if up else 13 - i) / 7); t = tt(0.8)
        add(sfx, t0 + i * 0.03, np.sin(2 * np.pi * f * t) * np.exp(-t * 5) * g, pan=-0.5 + i * 0.07)
def engine(t0, d, base=72, g=0.24):
    t = tt(d); fe = base + 30 * np.minimum(1, t / 0.8) + 8 * np.sin(2 * np.pi * 0.9 * t)
    ph = 2 * np.pi * np.cumsum(fe) / SR
    x = np.sign(np.sin(ph)) * 0.25 + np.sin(2 * ph) * 0.2
    add(sfx, t0, filt(x, 'low', 1100) * g * np.minimum(1, t / 0.1) * np.minimum(1, (d - t) / 0.4))
def siren(t0, d, g=0.12):
    t = tt(d); f = np.where((t % 1.0) < 0.5, 960, 770)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    add(sfx, t0, filt(x, 'band', (500, 2500)) * g * np.minimum(1, t / 0.4) * np.minimum(1, (d - t) / 0.5), pan=-0.3)
def whistle(t0, d=1.0, g=0.16):
    t = tt(d); x = np.sin(2 * np.pi * 880 * t) + np.sin(2 * np.pi * 1108 * t) + 0.3 * filt(rng.standard_normal(len(t)), 'band', (700, 1600))
    add(sfx, t0, x * np.minimum(1, t / 0.05) * np.minimum(1, (d - t) / 0.15) * g)
def chuchu(t0, d, g=0.2, rate=3.2):
    for k in range(int(d * rate)): add(sfx, t0 + k / rate, noise(0.22, 300, 3000, g * (0.6 + 0.4 * (k % 2)), 14))
def clap(t0, n=3, gap=0.42, g=0.35):
    for k in range(n):
        for j in range(6): add(sfx, t0 + k * gap + j * 0.004, noise(0.08, 900, 5000, g / 2, 45), pan=rng.uniform(-0.5, 0.5))
def cheer(t0, d=2.5, g=0.1):
    x = noise(d, 400, 3500, g); tq = tt(d)
    for f in (320, 410, 520): x = x + np.sin(2 * np.pi * (f + 40 * np.sin(2 * np.pi * 3 * tq)) * tq) * 0.012 * np.sin(np.pi * tq / d)
    add(sfx, t0, x)
def drumroll(t0, d, g=0.13):
    for k in range(int(d * 18)): add(sfx, t0 + k / 18, noise(0.05, 150, 1200, g * (0.5 + 0.5 * k / (d * 18)), 40))
def rumble(t0, d, g=0.25):
    t = tt(d); x = filt(rng.standard_normal(len(t)), 'low', 160) * (0.6 + 0.4 * np.sin(2 * np.pi * 2.3 * t))
    add(sfx, t0, x * np.sin(np.pi * t / d) * g)
def shimmer(t0, d=2.5, g=0.07):
    t = tt(d); x = sum(np.sin(2 * np.pi * f * t * (1 + 0.3 * t / d)) for f in (1047, 1319, 1568, 2093)) * np.sin(np.pi * t / d)
    add(sfx, t0, x * g)
def bell(t0, g=0.32, f0=196.0):
    # campana grande: parciales inarmónicos que se apagan despacio (sin saturar)
    d = 4.5; t = tt(d); x = np.zeros(len(t))
    for r, a, k in ((0.5, 0.5, 0.6), (1.0, 1.0, 0.9), (1.19, 0.6, 1.3), (1.5, 0.45, 1.6), (2.0, 0.5, 1.9), (2.52, 0.3, 2.6), (3.0, 0.2, 3.2)):
        x += a * np.sin(2 * np.pi * f0 * r * t + r) * np.exp(-t * k)
    x *= np.minimum(1, t / 0.004); x += noise(d, 1500, 6000, 0.0)[:len(t)]
    add(sfx, t0, x / 3.5 * g, pan=-0.1); add(sfx, t0, thump(110, 0.25, 0.25))
def water(t0, d, g=0.12):
    t = tt(d); x = filt(rng.standard_normal(len(t)), 'band', (900, 6500)) * (0.75 + 0.25 * np.sin(2 * np.pi * 7 * t))
    add(sfx, t0, x * np.minimum(1, t / 0.15) * np.minimum(1, (d - t) / 0.3) * g)
    for k in range(int(d * 6)): add(sfx, t0 + k / 6 + rng.uniform(0, 0.1), blip(500 + rng.uniform(0, 600), 1400, 0.06, 0.04), pan=rng.uniform(-0.5, 0.5))
def dig(t0, g=0.3):
    add(sfx, t0 + 0.35, noise(0.35, 300, 2400, g * 0.6, 8)); add(sfx, t0 + 0.4, thump(80, 0.3, g * 1.2))
def beeps(t0, d, g=0.09):
    for k in range(int(d / 0.6)): t = tt(0.22); add(sfx, t0 + k * 0.6, np.sin(2 * np.pi * 1050 * t) * np.minimum(1, t / 0.01) * np.minimum(1, (0.22 - t) / 0.02) * g)
def whir(t0, d=1.3, g=0.08):
    t = tt(d); f = 180 + 260 * t / d; x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.3 + np.sin(4 * np.pi * np.cumsum(f) / SR) * 0.3
    add(sfx, t0, filt(x, 'band', (150, 2500)) * np.sin(np.pi * t / d) * g)
def clank(t0, g=0.2):
    add(sfx, t0, ding(2637, 0.4, g)); add(sfx, t0, ding(1975, 0.5, g * 0.6)); add(sfx, t0, noise(0.08, 2000, 8000, g * 0.8, 40))
def mud(t0, g=0.35, d=0.45):
    t = tt(d); n = filt(rng.standard_normal(len(t)), 'band', (120, 700)) * (0.6 + 0.4 * np.sin(2 * np.pi * 23 * t)) * np.exp(-t * 7)
    add(sfx, t0, n * g); add(sfx, t0 + 0.05, boing(0.25, 120, 140, 0.16))
def brake(t0, g=0.12):
    t = tt(0.7); add(sfx, t0, filt(rng.standard_normal(len(t)), 'band', (2200, 4500)) * np.exp(-t * 3) * g)
def wahwah(t0, g=0.13):
    for k, (f, d) in enumerate(((392, 0.35), (370, 0.35), (349, 0.35), (330, 0.9))):
        t = tt(d); fv = f * (1 + 0.012 * np.sin(2 * np.pi * 6 * t)) * (1 - (0.06 * t / d if k == 3 else 0))
        x = np.sign(np.sin(2 * np.pi * np.cumsum(fv) / SR)) * 0.4 + np.sin(2 * np.pi * np.cumsum(fv) / SR) * 0.6
        add(sfx, t0 + k * 0.38, filt(x, 'low', 1400) * np.minimum(1, t / 0.03) * np.minimum(1, (d - t) / 0.08) * g)

# A · gancho y garaje
rumble(0.0, 3.5, 0.3); shimmer(0.4, 4.0, 0.06)
add(sfx, M['garage0'], boing(0.5, 300, 500, 0.3)); add(sfx, M['garage0'] + 0.05, ding(1568, 0.8, 0.12))
add(sfx, M['title0'], whoosh(0.7, 500, 5000, 0.28)); add(sfx, M['title0'] + 0.3, ding(1568, 1.4, 0.22)); gliss(M['title0'] + 0.3, True, 0.12)
add(sfx, M['exit0'] - 1.2, noise(1.2, 300, 2500, 0.12) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 28 * tt(1.2)))))
engine(M['exit0'], 2.2, 70, 0.22); honk(M['exit0'] + 2.0, 2); add(sfx, M['exit0'] + 2.05, boing(0.4, 300, 400, 0.2))
add(sfx, E('b2') - 0.5, boing(0.4, 350, 450, 0.18))
for k in range(3): add(sfx, M['recap0'] + 0.2 + k * (M['recap1'] - M['recap0']) / 3, whoosh(0.5, 800, 6000, 0.18))
# D · viaje
engine(M['drive0'], M['red'] + 0.6 - M['drive0'], 76, 0.22); brake(M['red'] + 0.2)
add(sfx, M['red'] + 0.1, ding(392, 0.9, 0.14)); add(sfx, M['green'], ding(1319, 1.0, 0.2)); gliss(M['green'], True, 0.1)
engine(M['go1'], M['rail0'] + 0.6 - M['go1'], 76, 0.22); brake(M['rail0'] + 0.3, 0.1)
add(sfx, M['lookL'], whoosh(0.4, 900, 4000, 0.15)); add(sfx, M['lookR'], whoosh(0.4, 900, 4000, 0.15))
add(sfx, M['go2'], ding(1568, 0.8, 0.16)); engine(M['go2'], M['arrive'] - M['go2'], 80, 0.22)
add(sfx, M['go2'] + 1.0, boing(0.5, 300, 320, 0.22)); add(sfx, M['go2'] + 1.9, thump(90, 0.4, 0.7))
for a in (0.2, 0.45, 0.7): add(sfx, M['go2'] + (M['arrive'] - M['go2']) * a, whoosh(0.45, 600, 5000, 0.18))
brake(M['arrive'] - 0.6)
# obras
shimmer(S('b3'), 2.4, 0.07)
for i in range(1, 6): dig(M[f'dig{i}']); add(sfx, S(f'k{i}'), ding([1047, 1175, 1319, 1397, 1568][i - 1], 0.9, 0.2))
clap(S('n6') + 0.2, 3, 0.25, 0.25)
d0 = M['park0']; d = M['park1'] - d0
engine(d0, d * 0.28 + 0.8, 70, 0.2); add(sfx, d0 + d * 0.28, boing(0.5, 300, 420, 0.2)); add(sfx, d0 + d * 0.28 + 0.75, thump(110, 0.3, 0.5))
beeps(d0 + d * 0.28 + 0.8, M['park1'] - 1.3 - (d0 + d * 0.28 + 0.8)); whir(M['park1'] - 1.3, 1.3)
whir(M['park1'], M['hooked'] - M['park1'], 0.05); clank(M['hooked'])
for g0 in (M['tug1'], M['tug2'], M['tug3'], M['one'], M['two'], M['three']):
    engine(g0 - 0.1, 1.0, 105, 0.24); mud(g0 + 0.2, 0.25); add(sfx, g0, noise(0.9, 2500, 6000, 0.06))
add(sfx, M['slip'], boing(0.6, 400, -200, 0.22)); wahwah(S('b6') + 0.2)
honk(M['honk'], 2, (440, 660), 0.3)
# ¿Quién es?
add(sfx, S('n10'), ding(1568, 1.0, 0.2)); gliss(S('n10'), True, 0.1)
for w, line in (('lola', 'l1'), ('coco', 'o1'), ('chispa', 'x1')):
    drumroll(M[f'{w}Wait'], M[f'{w}Rev'] - M[f'{w}Wait'] - 0.1)
    add(sfx, M[f'{w}Rev'], ding(2093, 1.2, 0.24)); gliss(M[f'{w}Rev'], True, 0.1); clap(M[f'{w}Rev'] + 0.1, 3, 0.22, 0.22)
siren(M['lolaIn'], S('l1') - M['lolaIn'] + 0.4, 0.13); engine(M['lolaIn'], S('l1') - M['lolaIn'], 60, 0.16); brake(S('l1') - 0.5)
chuchu(M['cocoIn'] - 0.5, S('o1') - M['cocoIn'] + 0.8, 0.2); whistle(S('o1') - 0.6, 0.9, 0.16)
add(sfx, M['chispaIn'], whoosh(1.0, 800, 6000, 0.32)); engine(M['chispaIn'], S('x1') - M['chispaIn'], 120, 0.14); brake(S('x1') - 0.4, 0.12)
# todos juntos
water(M['spray0'] + 0.4, M['spray1'] - M['spray0'] - 0.4)
for k in range(3): dig(M['dig2a'] + k * 1.0, 0.25)
for k, n in enumerate(('one', 'two', 'three')): add(sfx, M[n], thump(80 + k * 30, 0.4, 0.8)); add(sfx, M[n], ding([523, 659, 784][k], 0.6, 0.18))
rumble(M['lift0'] - 0.2, 2.6, 0.45); mud(M['lift0'] + 0.3, 0.5, 0.6); mud(M['lift0'] + 0.9, 0.4)
add(sfx, M['lift0'] + 2.3, thump(160, 0.4, 0.8)); gliss(M['lift0'] + 2.3, True, 0.14); shimmer(M['lift0'] + 2.3, 3.0, 0.08); cheer(M['lift0'] + 2.4, 3.0, 0.14); clap(M['lift0'] + 2.6, 5, 0.22, 0.3)
add(sfx, M['setdown1'], thump(70, 0.5, 0.7)); clank(M['setdown1'] + 0.05, 0.12)
water(M['wash0'] + 0.2, M['wash1'] - M['wash0'] - 0.5, 0.11)
for k in range(10): add(sfx, M['wash0'] + 0.5 + k * 0.9, blip(400 + 80 * k, 900, 0.08, 0.05), pan=rng.uniform(-0.6, 0.6))
shimmer(M['wash1'] - 0.6, 2.6, 0.09); add(sfx, M['wash1'] - 0.5, ding(2637, 1.6, 0.2))
# fiesta
cheer(M['party0'] + 0.3, 2.0, 0.12)
for r in range(2):
    add(sfx, M[f'up{r}'], boing(0.4, 300, 500, 0.2)); add(sfx, M[f'down{r}'], thump(110, 0.3, 0.45)); add(sfx, M[f'spin{r}'], whoosh(0.9, 600, 4000, 0.2))
for k in range(int((M['party1'] - M['free0']) / 2.3)): add(sfx, M['free0'] + k * 2.3, blip(700 + (k % 4) * 150, 1500, 0.12, 0.07), pan=rng.uniform(-0.7, 0.7))
# ¿Qué suena?
whir(M['dong'] - 1.4, 1.0, 0.05); bell(M['dong'])
add(sfx, S('n22'), ding(1568, 1.0, 0.2)); gliss(S('n22'), True, 0.1)
water(M['q0snd'], 1.9, 0.16)
for k in range(2): dig(M['q1snd'] + k * 0.9, 0.35)
honk(M['q2snd'] + 0.2, 2, (880, 1175), 0.22); honk(M['q2snd'] + 1.0, 2, (880, 1175), 0.22)
bell(M['q3snd'], 0.3)
for q in range(4): add(sfx, M[f'q{q}rev'], ding(2093, 1.2, 0.2)); gliss(M[f'q{q}rev'], True, 0.1); clap(M[f'q{q}rev'] + 0.2, 3, 0.22, 0.2)
bell(M['q3rev'] + 0.2, 0.22)
# al vagón y al pueblo
whir(M['lift2a'] - 0.6, 1.2, 0.06); clank(M['lift2a'] + 0.5); rumble(M['lift2a'] + 0.6, 1.8, 0.25)
engine(M['carry0'], M['load0'] - 4.5 - M['carry0'], 72, 0.2); beeps(M['load0'] - 4.5, 4.3)
add(sfx, M['loaded'] - 0.1, thump(80, 0.5, 0.8)); clank(M['loaded']); add(sfx, M['loaded'] + 0.1, ding(1568, 1.2, 0.2)); gliss(M['loaded'] + 0.1, True, 0.1)
whistle(M['train0'] + 0.8, 1.1, 0.17); chuchu(M['train0'] + 1.5, M['train1'] - M['train0'] - 3.0, 0.16, 3.0)
for k in range(12): add(sfx, M['train0'] + 2 + k * 2.2, ding(1760, 0.3, 0.05), pan=-0.4)
add(sfx, S('n39') + 0.4, ding(1568, 1.0, 0.2)); gliss(S('n39') + 0.4, True, 0.1)
for i in range(4): drumroll(M[f'col{i}'] + 1.6, M[f'col{i}rev'] - M[f'col{i}'] - 1.7, 0.1); add(sfx, M[f'col{i}rev'], ding([1047, 1319, 1568, 2093][i], 1.0, 0.22)); clap(M[f'col{i}rev'] + 0.1, 2, 0.22, 0.2)
whistle(M['train1'] - 1.8, 1.0, 0.15)
# plaza
add(sfx, M['plaza0'], whoosh(0.6, 500, 4000, 0.22)); engine(M['plaza0'] - 0.4, 2.4, 66, 0.16); brake(M['plaza0'] + 1.6, 0.08)
shimmer(S('n30') + 3.0, 4.0, 0.05)
cheer(M['cheer'], 2.6, 0.14); clap(M['cheer'] + 0.2, 4, 0.22, 0.3)
add(sfx, M['tracker'] + 0.9, noise(0.25, 2000, 8000, 0.18, 12)); add(sfx, M['tracker'] + 1.0, ding(2637, 1.8, 0.24)); gliss(M['tracker'] + 0.9, True, 0.12)
# el gran salto
add(sfx, S('n32'), ding(1319, 1.0, 0.2)); horn_t = S('n32') + 0.3
engine(M['cjump'] - 2.2, 2.4, 110, 0.18); add(sfx, M['cjump'], boing(0.5, 350, 400, 0.24)); add(sfx, M['cjump'], whoosh(1.2, 600, 5000, 0.25)); add(sfx, M['cjump'] + 1.3, thump(120, 0.35, 0.6))
engine(M['bjump'] - 2.4, 2.6, 80, 0.26); add(sfx, M['bjump'], boing(0.6, 250, 350, 0.24)); add(sfx, M['bjump'], whoosh(1.2, 400, 4000, 0.28))
add(sfx, M['splash'], thump(60, 0.8, 1.0)); mud(M['splash'], 0.7, 0.8); add(sfx, M['splash'], noise(1.2, 150, 2500, 0.3, 4))
for k in range(8): add(sfx, M['splash'] + 0.3 + k * 0.12, blip(300 + rng.uniform(0, 300), 120, 0.1, 0.08), pan=rng.uniform(-0.6, 0.6))
cheer(M['splash'] + 0.4, 2.2, 0.1)
# repaso, logo y avance
for k in range(4): add(sfx, S('n35') + k * VOT['n35']['d'] / 4, whoosh(0.5, 800, 6000, 0.16)); add(sfx, S('n35') + k * VOT['n35']['d'] / 4, ding(2093, 0.8, 0.08))
add(sfx, M['logo0'], ding(1568, 1.4, 0.22)); gliss(M['logo0'], True, 0.14)
rumble(M['sp0'], 3.0, 0.25)
add(sfx, M['mapfall'], whoosh(0.5, 900, 5000, 0.15)); add(sfx, M['mapfall'] + 0.5, thump(200, 0.2, 0.35)); shimmer(M['mapfall'] + 0.8, 2.5, 0.06)
add(sfx, M['mapopen'], noise(0.5, 1500, 7000, 0.12)); add(sfx, M['mapopen'] + 0.3, ding(1047, 2.0, 0.22)); gliss(M['mapopen'] + 0.3, True, 0.1)

# ---------------- VOZ ----------------
sel = json.load(open('audio/vo_sel2.json'))
duck = np.zeros(N)
for k, f in sel.items():
    if k not in VOT: continue
    a, sr = sf.read(f)
    if a.ndim > 1: a = a.mean(1)
    a = resample_poly(a, SR, sr) if sr != SR else a
    nz = np.where(np.abs(a) > 0.01)[0]; a = a[max(0, nz[0] - 200):nz[-1] + 800]
    a = a / (np.max(np.abs(a)) + 1e-9) * 0.9
    a = a + 0.2 * filt(a, 'high', 3500)
    t0 = S(k); add(vo, t0, a, 1.0)
    i0, i1 = int((t0 - 0.1) * SR), int((t0 + len(a) / SR + 0.15) * SR)
    duck[max(0, i0):min(N, i1)] = 1
duck = np.convolve(duck, np.ones(SR // 10) / (SR // 10), 'same')
ir_t = tt(1.2)
ir = np.stack([rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 4) for _ in range(2)]) * 0.035; ir[:, :int(SR * 0.01)] = 0
for c in range(2):
    sfx[c] += oaconvolve(sfx[c], ir[c])[:N] * 0.4
    vo[c] += oaconvolve(vo[c], ir[c])[:N] * 0.08
mix = mus * (1.0 * (1 - 0.45 * duck)) + sfx * 0.8 + vo * 1.15
mix *= 0.97 / np.max(np.abs(mix))
mix *= np.minimum(1, np.arange(N) / (SR * 0.01)) * np.minimum(1, (N - np.arange(N)) / (SR * 0.3))
sf.write('audio/cap2_raw.wav', mix.T.astype(np.float32), SR)
print('ok rms', 20 * np.log10(np.sqrt(np.mean(mix ** 2))))
