"""Capítulo 2 · La campana gigante: genera src/vo2.json (frases), src/cap2.json (marcas) y audio/vo_sel2.json (archivos)."""
import json
D = json.load(open('/home/claude/el6/sel/durs.json'))
D5 = json.load(open('/home/claude/el5/sel/durs.json'))
vo, SRC, M = {}, {}, {}
T = [0.0]
SL = {}  # holgura por tramo para cuadrar 600 s


def say(k, gap=0.3, at=None, src=None, d5=False):
    base = src or k
    d = D5[base] if d5 else D[base]
    t = at if at is not None else T[0] + gap
    vo[k] = {'t': round(t, 3), 'd': d}
    SRC[k] = f'/home/claude/{"el5" if d5 else "el6"}/sel/{base}.wav'
    T[0] = t + d
    return t


def mark(n, t=None):
    M[n] = round(T[0] if t is None else t, 3); return M[n]


def wait(s): T[0] += s
def slack(n, base): T[0] += base + SL.get(n, 0)


def build():
    vo.clear(); SRC.clear(); M.clear(); T[0] = 0.0
    # A · gancho en las obras + Bruno en el garaje
    mark('hook0', 0.0); say('t1', at=0.7); wait(0.6)
    mark('garage0'); wait(0.5); say('b1', 0); wait(0.5)
    mark('title0'); slack('title', 3.4); mark('title1')
    # B · buenos días + saludo
    say('n1', 0.2); mark('exit0', T[0] + 0.3); slack('exit', 2.2); say('b2', 0.1); wait(0.6)
    # C · recuerdos del capítulo 1
    mark('recap0'); say('n2', 0.1); wait(0.4); mark('recap1')
    # D · viaje a las obras
    say('n3', 0.1); mark('drive0', vo['n3']['t'] - 0.4); slack('drive', 3.0); mark('light0')
    say('n48', 0.1); mark('red', vo['n48']['t']); wait(1.0); mark('green', T[0] + 0.1); say('n49', 0.2); mark('go1', vo['n49']['t'] + 0.3)
    slack('drive2', 3.0); mark('rail0'); say('n50', 0.1); mark('lookL', vo['n50']['t'] + 1.5); mark('lookR', vo['n50']['t'] + 2.8)
    say('n51', 0.3); mark('go2', vo['n51']['t'] + 0.6); slack('drive3', 4.0); mark('arrive')
    say('t2', 0.3); say('b3', 0.3); say('n4', 0.4); slack('guess', 1.0)
    say('n5', 0.2); wait(0.3)
    for i in range(1, 6):
        say(f'k{i}', 0.85 if i > 1 else 0.6, src=f'k{i}', d5=True); mark(f'dig{i}', vo[f'k{i}']['t'] - 0.45)
    say('n6', 0.6); say('t3', 0.4); say('b4', 0.3)
    mark('park0', T[0] + 0.2); slack('park', 4.2); mark('park1')
    say('n7', 0.1); mark('hooked', vo['n7']['t'] + 2.0); wait(0.3)
    say('b5', 0.2); mark('tug1', vo['b5']['t'] + 1.0)
    say('n8', 0.3); mark('tug2', vo['n8']['t'] + 0.2); mark('tug3', vo['n8']['t'] + 1.6); mark('slip', vo['n8']['t'] + 3.0)
    say('b6', 0.5); say('t4', 0.4); say('b7', 0.3); mark('honk', vo['b7']['t'] + vo['b7']['d'] - 0.9)
    say('n9', 0.3); wait(0.4)
    # E · ¿Quién es?
    mark('quien0'); say('n10', 0.2); wait(0.6)
    for who, clue, rev, line in (('lola', 'n11', 'n12', 'l1'), ('coco', 'n13', 'n14', 'o1'), ('chispa', 'n15', 'n16', 'x1')):
        mark(f'{who}Q', T[0] + 0.1); say(clue, 0.2); mark(f'{who}Wait'); slack('think', 2.6); say(rev, 0)
        mark(f'{who}Rev', vo[rev]['t']); mark(f'{who}In', T[0] + 0.3); slack('arr_' + who, 4.4); say(line, 0.1); wait(0.4)
    say('b8', 0.3); wait(0.3)
    # F · ¡todos juntos!
    mark('spray0', T[0] + 0.2); say('l2', 0.3); say('n17', 0.4); mark('spray1', T[0] + 0.4); wait(0.6)
    say('t5', 0.3); mark('dig2a', vo['t5']['t'] + 1.0); slack('dig2', 2.6)
    say('x2', 0.2); say('n18', 0.4); say('b9', 0.3)
    mark('one', vo['b9']['t'] + 2.75); mark('two', vo['b9']['t'] + 3.9); mark('three', vo['b9']['t'] + 5.1)
    say('b10', 0.1); mark('lift0', vo['b10']['t'] + 0.2); slack('lift', 2.6); mark('lift1')
    say('n19', 0.2); say('x3', 0.3); say('l3', 0.2); say('t6', 0.2); wait(0.3)
    say('b11', 0.3); wait(0.6)
    say('n20', 0.3); mark('setdown0', vo['n20']['t'] + 0.3); mark('setdown1', vo['n20']['t'] + 3.6); wait(0.3)
    say('l4', 0.3); mark('wash0', vo['l4']['t'] + 0.3); slack('wash', 3.2); mark('wash1')
    say('n21', 0.2); wait(0.3)
    # fiesta de la campana (frases de baile del capítulo 1)
    say('x7', 0.3); mark('party0', vo['x7']['t']); say('n37p', 0.4, src='n37', d5=True); mark('dance0', vo['n37p']['t'])
    for r, sfx in enumerate(('', '_2')):
        say('n37a' + sfx, 0.6 if r == 0 else 1.1, src='n37a', d5=True); mark(f'up{r}', vo['n37a' + sfx]['t'])
        say('n37b' + sfx, 0.7, src='n37b', d5=True); mark(f'down{r}', vo['n37b' + sfx]['t'])
        say('n37c' + sfx, 0.7, src='n37c', d5=True); mark(f'spin{r}', vo['n37c' + sfx]['t'])
    mark('free0', T[0] + 0.6); slack('party', 5.0); mark('party1')
    # G · ¿Qué suena?
    say('b12', 0.3); mark('dong', T[0] + 0.5); slack('dongwait', 2.4)
    mark('suena0'); say('n22', 0.2); wait(0.5)
    for q, rev in enumerate(('n24', 'n25', 'n26', 'n27')):
        say(f'n23_{q}', 0.3, src='n23'); mark(f'q{q}snd', T[0] + 0.3); slack('snd', 2.3); say(rev, 0.1); mark(f'q{q}rev', vo[rev]['t']); slack('qshow', 1.6)
    # H · al pueblo
    say('o2', 0.3); say('n28', 0.4); mark('lift2a', vo['n28']['t'] + 0.2); mark('carry0', vo['n28']['t'] + 3.2)
    slack('carry', 2.5); mark('load0'); say('b13', 0.2); mark('loaded', T[0] - 0.4); wait(0.5)
    mark('train0'); say('n29', 0.3); slack('train', 2.0); say('x4', 0.2); wait(0.5)
    say('n39', 0.3); mark('colors0', vo['n39']['t'])
    for i, (qq, rr) in enumerate((('n40', 'n41'), ('n42', 'n43'), ('n44', 'n45'), ('n46', 'n47'))):
        mark(f'col{i}', T[0] + 0.3); say(qq, 0.5); slack('colthink', 1.7); say(rr, 0); mark(f'col{i}rev', vo[rr]['t']); wait(0.8)
    slack('train2', 2.0); mark('train1')
    mark('plaza0'); say('n30', 0.3); wait(0.4); say('b14', 0.3); say('l5', 0.3); say('b15', 0.3); mark('cheer', vo['b15']['t'] + vo['b15']['d'] - 0.4)
    say('n31', 0.6); mark('tracker', vo['n31']['t'] + 1.2); slack('tracker', 2.6); mark('plaza1')
    # I · el gran salto (granja)
    mark('jump0'); say('x5', 0.3); say('n32', 0.3); say('n33', 0.2)
    mark('cjump', vo['n33']['t'] + 2.0); say('x6', 0.1); slack('cland', 1.6)
    say('b16', 0.3); say('n34', 0.4); mark('bjump', vo['n34']['t'] + 2.0); mark('splash', vo['n34']['t'] + 3.2); wait(0.6)
    say('b17', 0.3); slack('laugh', 1.8); mark('jump1')
    # J · repaso y pregunta
    mark('rep0'); say('n35', 0.2); mark('rep1', T[0] + 0.3); say('n36', 0.3); mark('qend', T[0] + 1.4)
    # logo y avance
    mark('logo0', T[0] + 1.4); mark('sp0', T[0] + 4.9); T[0] = M['sp0']
    say('n37', 0.3); mark('mapfall', vo['n37']['t'] + 1.6); say('b18', 0.5); mark('mapopen', vo['b18']['t'] + 0.3); say('n38', 0.5)
    mark('end', 600.0)
    return T[0]


for k in ('drive2', 'drive3', 'party', 'colthink', 'title', 'exit', 'drive', 'guess', 'park', 'think', 'dig2', 'lift', 'wash', 'dongwait', 'snd', 'qshow', 'carry', 'train', 'train2', 'tracker', 'cland', 'laugh'):
    SL[k] = 0.0
end = build()
need = 600 - 2.2 - end
# reparto de la holgura (más en viajes y llegadas, ritmo rápido en el resto)
W = {'drive': 0.06, 'drive2': 0.05, 'drive3': 0.07, 'carry': 0.12, 'train': 0.10, 'train2': 0.06, 'party': 0.12, 'arr_lola': 0.035, 'arr_coco': 0.035, 'arr_chispa': 0.035,
     'park': 0.05, 'lift': 0.05, 'wash': 0.06, 'tracker': 0.04, 'laugh': 0.03, 'exit': 0.03}
tot = sum(W.values())
for k, w in W.items(): SL[k] = SL.get(k, 0) + need * w / tot
end = build()
print('fin voz', round(end, 2), 'holgura', round(need, 1))
json.dump(vo, open('src/vo2.json', 'w'), indent=0)
json.dump(M, open('src/cap2.json', 'w'), indent=0)
json.dump(SRC, open('audio/vo_sel2.json', 'w'), indent=0)
print({k: v for k, v in M.items()})
