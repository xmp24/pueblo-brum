"""Línea de tiempo del capítulo de 10 min: genera src/vo.json (frases) y src/ep10.json (marcas)."""
import json
D = json.load(open('/home/claude/el5/sel/durs.json'))
D4 = json.load(open('/home/claude/el4/sel/durs.json'))
vo = json.load(open('src/vo.json'))  # minutos 1-2 ya colocados
SRC = {}
for k in list(vo): SRC[k] = f'/home/claude/el4/sel/{ {"c4":"c1","c5":"c2","c6":"c3"}.get(k,k) }.wav'
dur = lambda k: D[k.split('@')[0]] if k.split('@')[0] in D else D4[k.split('@')[0]]
M = {}
T = [115.31]
def say(k, gap=0.3, at=None, src=None):
    t = at if at is not None else T[0] + gap
    base = src or k
    vo[k] = {'t': round(t, 3), 'd': dur(base)}
    SRC[k] = f'/home/claude/el5/sel/{base}.wav'
    T[0] = t + dur(base)
    return t
def mark(name, t): M[name] = round(t, 3); return t
def wait(s): T[0] += s
SL = {}  # holgura extra por tramo (se ajusta para cuadrar 600 s)
def slack(name, base): T[0] += base + SL.get(name, 0)

def build():
    global vo
    for k in list(vo):
        if not (vo[k]['t'] < 116 or vo[k]['t'] > 900): del vo[k]
    M.clear(); T[0] = 115.31
    mark('lolaIn', 113.6)
    say('l1', at=116.0); say('n19', .3); say('l2', .35); say('b14', .3); say('l3', .4); say('b15', .4); say('n20', .3)
    mark('convoy0', T[0] + .2); slack('convoy', 9.0); mark('convoy1', T[0])
    say('n21', .2); mark('wash0', vo['n21']['t'])
    mark('c1in', T[0] + .3); say('n22', .5); mark('c1rev', vo['n22']['t'] + 3.3); wait(2.2); say('n23', 0); say('b16', .3)
    mark('c2in', T[0] + .2); say('n24', 1.9); mark('c2rev', vo['n24']['t'] + 0.5); wait(2.0); say('n25', 0); say('l4', .3)
    mark('c3in', T[0] + .2); say('n26', 1.9); mark('c3rev', vo['n26']['t'] + 0.5); wait(2.0); say('n27', 0); say('b17', .3)
    mark('c4in', T[0] + .2); say('n28', 1.4); mark('c4rev', T[0] + .4); say('n29', .7); say('b18', .3); say('x4', .3)
    say('l7', .4); mark('tour0', T[0] + .1)
    slack('t1', 1.2); mark('stop1', T[0]); say('n43', 0); say('b25', .3)
    slack('t2', 1.2); mark('stop2', T[0]); say('n44', 0); say('x6', .3)
    slack('t3', 1.4); mark('stop3', T[0]); say('n45', 0); say('b26', .3)
    slack('t4', 1.4); mark('stop4', T[0]); say('n46', 0); say('l8', .3); say('b27', .4)
    say('l5', .6); mark('tico0', T[0] + .2); slack('tico', 2.4); say('n30', 0); wait(1.8); mark('ticoRev', T[0]); say('t1', 0); say('n31', .3); say('t2', .3); say('b19', .3)
    say('n32', .4); mark('count0', vo['n32']['t'])
    for i in range(1, 6): say(f'k{i}', .7 if i == 1 else .85)
    say('n33', .5)
    say('n34', .8); mark('coco0', vo['n34']['t']); wait(2.0); mark('cocoRev', T[0]); say('o1', 0); say('n35', .3); say('o2', .3); say('b20', .3)
    mark('quiz0', T[0] + .4); slack('quizT', 2.6); say('n47', 0)
    for q, (a, b, snd) in enumerate([('n48', 'n49', 'siren'), ('n50', 'n51', 'chu'), ('n52', 'n53', 'dig'), ('n54', 'n55', 'brum')]):
        say(a, .7); mark(f'q{q}snd', T[0] + .2); wait(2.6); mark(f'q{q}rev', T[0]); say(b, 0)
    say('b28', .3)
    say('n56', .8); mark('race0', T[0] + .3); say('t5', 1.0); say('n57', .2); mark('go', vo['n57']['t'] + 3.2)
    T[0] = M['go']; say('f5', .8); say('n58', .5); say('l9', .2); say('x7', .2); say('b29', .2); slack('race', 1.8); slack('race2', 1.0)
    say('n59', 0); mark('finish', vo['n59']['t'] + 2.6); say('b30', .4)
    say('n36', .8); mark('party0', T[0] + .1); slack('party', 1.2)
    say('l6', 0); say('t3', .3); say('o3', .3); say('x5', .3); say('b21', .3)
    say('n37', .5); mark('dance0', vo['n37']['t'])
    for r in range(2):
        sfx = '' if r == 0 else '_2'
        say('n37a' + sfx, .6 if r == 0 else 1.2, src='n37a'); mark(f'up{r}', vo['n37a' + sfx]['t'])
        say('n37b' + sfx, .7, src='n37b'); mark(f'down{r}', vo['n37b' + sfx]['t'])
        say('n37c' + sfx, .7, src='n37c'); mark(f'spin{r}', vo['n37c' + sfx]['t'])
    mark('free0', T[0] + .2); slack('dance', 6.0); mark('free1', T[0])
    say('n38', .3); mark('album', vo['n38']['t']); say('b22', .3)
    say('n60', 1.4); mark('night0', vo['n60']['t'] - 1.2); say('f13', .6); slack('home', 1.5); say('b31', 0); say('f14', .4)
    say('n39', .8); mark('recap0', vo['n39']['t']); say('b23', .6); mark('door', T[0] + .2)
    say('n40', .6); mark('qend', T[0] + 1.6); T[0] = M['qend']
    mark('logo0', T[0]); slack('logo', 2.6); mark('sp0', T[0])
    say('n41', .3); say('t4', .3); say('b24', .3); say('n42', .5); mark('end', T[0] + .8)
    return M['end']

def place(k, t):
    d = dur(k)
    for _ in range(40):
        bad = [vo[o] for o in vo if o != k and vo[o]['t'] < 900 and not (t + d + 0.15 <= vo[o]['t'] or t >= vo[o]['t'] + vo[o]['d'] + 0.15)]
        if not bad: break
        t = max(b['t'] + b['d'] for b in bad) + 0.2
    vo[k] = {'t': round(t, 3), 'd': d}; SRC[k] = f'/home/claude/el5/sel/{k}.wav'
def extras():
    c0, c1 = M['convoy0'], M['convoy1']; cd = lambda a: c0 + (c1 - c0) * a
    place('f3', cd(0.12) + 0.5); place('f1', cd(0.42) + 0.5); place('f2', cd(0.56) + 0.2); place('f4', cd(0.72) + 0.4)
    g, fin = M['go'], M['finish']; rd = lambda a: g + (fin - g) * a
    place('f6', rd(0.45)); place('f7', rd(0.78)); place('f8', rd(0.88))
    f0, f1 = M['free0'], M['free1']; fd = lambda a: f0 + (f1 - f0) * a
    place('f9', fd(0.03)); place('f10', fd(0.28)); place('f11', fd(0.5)); place('f12', fd(0.75))
    for k in ['f10', 'f11']: M[k] = vo[k]['t']
base = build()
need = 600.0 - base
print('base', round(base, 2), 'falta', round(need, 2))
# reparto de la holgura por tramos de acción (pesos)
W = {'convoy': 2.5, 'tico': 0.8, 'quizT': 0.5, 'race': 2.0, 'race2': 0.6, 'dance': 2.2, 'home': 1.5, 'logo': 0.1, 't1': 0.9, 't2': 0.9, 't3': 0.9, 't4': 0.9, 'party': 0.6}
tw = sum(W.values())
for k, w in W.items(): SL[k] = need * w / tw
end = build()
extras()
print('final', end)
json.dump(vo, open('src/vo.json', 'w'), indent=1)
json.dump(M, open('src/ep10.json', 'w'), indent=1)
json.dump(SRC, open('audio/vo_sel10.json', 'w'), indent=1)
ks = sorted([k for k in vo if vo[k]['t'] < 900], key=lambda k: vo[k]['t'])
for a, b in zip(ks, ks[1:]):
    if vo[a]['t'] + vo[a]['d'] > vo[b]['t'] + 0.02: print('SOLAPE', a, b)
print(json.dumps(M))
