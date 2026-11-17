"""Modelos de Pueblo Brum: vehículos, edificios, mobiliario urbano y árboles.
Cada recurso es una raíz (empty) con su nombre, centrada en el origen y apoyada en el suelo.
Uso: python3 models.py vehiculos|edificios|props|arboles"""
import sys, math, random
sys.path.insert(0, '/home/claude/pueblo-brum/blender')
from lib import *

def P(x, y, z): return (x, -z, y)
def S(x, y, z): return (x, z, y)
OUT = '/home/claude/pueblo-brum/public/models/'
what = sys.argv[1]
reset()
GL = mat('cristal', '#bfe8ff', 0.04, coat=1.0, emit='#cfeeff', emit_k=0.12)
CH = mat('cromo', '#d9e1ec', 0.12, metal=0.9)
GR = mat('gris', '#5b6680', 0.4, metal=0.3)
TI = mat('neumatico', '#24242c', 0.85)
WH = mat('blanco', '#ffffff', 0.15, coat=0.8)
PU = mat('pupila', '#0b0a10', 0.15, coat=1.0)
LA = mat('faro', '#fff2a8', 0.1, emit='#ffd84a', emit_k=1.5)
RL = mat('piloto', '#ff3b3b', 0.2, emit='#ff2020', emit_k=0.8)
DKG = mat('oscuro', '#2f3b57', 0.5)

def paint(c): return mat('pintura' + c, c, 0.28, coat=0.8)

def wheel(name, x, z, r, w, parent, rim='#d9e1ec'):
    e = empty(name, P(x, r, z), parent)
    cyl(name + '_n', r, w, (0, 0, 0), TI, parent=e, verts=36, rot=(0, math.pi / 2, 0), bevel=r * 0.15)
    sg = 1 if x > 0 else -1
    cyl(name + '_ll', r * 0.6, 0.04, (sg * w / 2, 0, 0), mat('llanta' + rim, rim, 0.25, metal=0.6), parent=e, verts=24, rot=(0, math.pi / 2, 0), bevel=0.01)
    cyl(name + '_b', r * 0.2, 0.05, (sg * (w / 2 + 0.02), 0, 0), CH, parent=e, verts=12, rot=(0, math.pi / 2, 0))
    return e

def car_eyes(parent, y, z, sep=0.22, r=0.15):
    for s in (1, -1):
        sphere('ojo', r, P(s * sep, y, z), WH, parent=parent, scale=(1, 0.45, 1.1), seg=20, rings=12)
        sphere('pup', r * 0.5, P(s * sep, y, z + 0.06), PU, parent=parent, scale=(1, 0.45, 1), seg=14, rings=8)
        sphere('bri', r * 0.16, P(s * sep + 0.04, y + 0.05, z + 0.09), mat('brillo', '#ffffff', 0, emit='#ffffff', emit_k=1.5), parent=parent, seg=8, rings=6)

def vehicle(name, kind, color):
    root = empty(name)
    C = paint(color)
    if kind in ('sedan', 'taxi', 'hatch'):
        L = 3.4 if kind != 'hatch' else 2.9
        rbox('cuerpo', S(1.62, 0.62, L), P(0, 0.62, 0), 0.25, C, parent=root)
        rbox('cabina', S(1.42, 0.6, L * 0.48), P(0, 1.18, -0.1 if kind != 'hatch' else -0.2), 0.28, C, parent=root)
        rbox('parabrisas', S(1.2, 0.46, 0.06), P(0, 1.2, L * 0.24 - 0.12 + (0 if kind != 'hatch' else -0.08)), 0.05, GL, parent=root)
        for s in (1, -1):
            rbox('vent', S(0.05, 0.42, L * 0.36), P(s * 0.71, 1.2, -0.1), 0.05, GL, parent=root)
        car_eyes(root, 1.22, L * 0.24 - 0.06)
        if kind == 'taxi':
            rbox('cartel', S(0.6, 0.22, 0.3), P(0, 1.6, -0.1), 0.06, mat('taxi_cartel', '#fff7d6', 0.3, emit='#ffe9a0', emit_k=0.5), parent=root)
            rbox('franja', S(1.64, 0.12, L * 0.9), P(0, 0.72, 0), 0.04, mat('cuadros', '#222222', 0.4), parent=root)
        rr = 0.36; wz = L * 0.32
    elif kind in ('van', 'mail', 'icecream'):
        L = 4.2
        rbox('cuerpo', S(1.8, 1.7, L), P(0, 1.28, -0.1), 0.25, C, parent=root)
        rbox('morro', S(1.78, 0.75, 0.9), P(0, 0.75, L / 2 + 0.25), 0.25, C, parent=root)
        rbox('parabrisas', S(1.5, 0.7, 0.06), P(0, 1.65, L / 2 - 0.07), 0.06, GL, parent=root)
        car_eyes(root, 1.68, L / 2 - 0.02, 0.32, 0.19)
        for s in (1, -1):
            rbox('vent', S(0.05, 0.5, 0.7), P(s * 0.9, 1.7, L / 2 - 0.55), 0.05, GL, parent=root)
        if kind == 'mail':
            for s in (1, -1):
                rbox('franja', S(0.04, 0.22, L * 0.8), P(s * 0.91, 1.1, -0.2), 0.04, mat('azul_correo', '#1f5fd1', 0.3), parent=root)
                cyl('logo', 0.3, 0.03, P(s * 0.92, 1.55, -0.7), mat('amarillo', '#ffcf3a', 0.3, coat=0.6), parent=root, rot=(0, math.pi / 2, 0))
        if kind == 'icecream':
            for s in (1, -1):
                rbox('ventanilla', S(0.05, 0.6, 1.4), P(s * 0.91, 1.5, -0.6), 0.04, mat('mostrador', '#fff7e0', 0.4), parent=root)
            for i in range(6):
                rbox('toldo', S(1.95, 0.06, 0.24), P(0, 2.2, -1.6 + i * 0.25), 0.02, mat('toldo' + str(i % 2), '#ff7aa2' if i % 2 else '#ffffff', 0.5), parent=root)
            cyl('cono', 0.28, 0.7, P(0, 2.55, -0.4), mat('galleta', '#e8b06a', 0.6), parent=root, rad2=0.02, rot=(math.pi, 0, 0))
            sphere('bola', 0.34, P(0, 3.0, -0.4), mat('fresa', '#ff9fc4', 0.45, coat=0.5), parent=root)
            sphere('bola2', 0.22, P(0, 3.3, -0.4), mat('vainilla', '#fff3c9', 0.45, coat=0.5), parent=root)
        rr = 0.42; wz = L * 0.33
    elif kind == 'bus':
        L = 8.5
        rbox('cuerpo', S(2.3, 2.3, L), P(0, 1.65, 0), 0.35, C, parent=root)
        rbox('franja', S(2.32, 0.18, L - 0.4), P(0, 1.0, 0), 0.06, mat('blanco_bus', '#ffffff', 0.3, coat=0.5), parent=root)
        rbox('parabrisas', S(2.0, 0.95, 0.06), P(0, 2.05, L / 2 - 0.02), 0.08, GL, parent=root)
        for s in (1, -1):
            for i in range(6):
                rbox('vent', S(0.05, 0.75, 1.0), P(s * 1.15, 2.1, -L / 2 + 1.0 + i * 1.2), 0.08, GL, parent=root)
        rbox('cartel', S(1.4, 0.3, 0.05), P(0, 2.65, L / 2 + 0.01), 0.04, mat('cartel_bus', '#1c2433', 0.4, emit='#ffb000', emit_k=0.8), parent=root)
        car_eyes(root, 2.1, L / 2 + 0.03, 0.45, 0.25)
        rr = 0.5; wz = L * 0.33
    elif kind == 'pickup':
        L = 4.0
        rbox('cuerpo', S(1.8, 0.7, L), P(0, 0.75, 0), 0.22, C, parent=root)
        rbox('cabina', S(1.7, 0.9, 1.5), P(0, 1.5, 0.45), 0.25, C, parent=root)
        rbox('parabrisas', S(1.45, 0.6, 0.06), P(0, 1.6, 1.21), 0.05, GL, parent=root)
        for s in (1, -1):
            rbox('borde', S(0.1, 0.35, 1.7), P(s * 0.85, 1.25, -1.05), 0.04, C, parent=root)
        rbox('trasera', S(1.7, 0.35, 0.1), P(0, 1.25, -1.95), 0.04, C, parent=root)
        car_eyes(root, 1.62, 1.25, 0.3, 0.17)
        rr = 0.42; wz = L * 0.32
    elif kind == 'tractor':
        root2 = root
        rbox('motor', S(1.0, 0.9, 1.8), P(0, 1.15, 0.7), 0.2, C, parent=root)
        rbox('cabina', S(1.3, 1.5, 1.2), P(0, 1.85, -0.5), 0.15, C, parent=root)
        rbox('techo', S(1.5, 0.12, 1.4), P(0, 2.65, -0.5), 0.05, WH, parent=root)
        for s in (1, -1):
            rbox('vent', S(0.05, 0.9, 0.9), P(s * 0.66, 2.0, -0.5), 0.05, GL, parent=root)
        cyl('escape', 0.06, 0.9, P(0.3, 2.0, 1.2), CH, parent=root)
        rbox('parabrisas', S(1.1, 0.8, 0.05), P(0, 2.0, 0.11), 0.05, GL, parent=root)
        car_eyes(root, 1.25, 1.62, 0.22, 0.15)
        wheel('ruedaRL', 0.85, -0.6, 0.8, 0.5, root, '#ffcf3a'); wheel('ruedaRR', -0.85, -0.6, 0.8, 0.5, root, '#ffcf3a')
        wheel('ruedaFL', 0.6, 1.2, 0.45, 0.3, root, '#ffcf3a'); wheel('ruedaFR', -0.6, 1.2, 0.45, 0.3, root, '#ffcf3a')
        return root
    elif kind == 'chispa':  # personaje: cochecito azul redondito
        L = 2.6
        rbox('cuerpo', S(1.5, 0.75, L), P(0, 0.72, 0), 0.36, C, parent=root)
        rbox('cabina', S(1.3, 0.75, 1.4), P(0, 1.35, -0.15), 0.4, C, parent=root)
        rbox('parabrisas', S(1.12, 0.55, 0.06), P(0, 1.38, 0.58), 0.08, GL, parent=root)
        rbox('parachoques', S(1.56, 0.22, 0.25), P(0, 0.5, L / 2), 0.1, CH, parent=root)
        for s in (1, -1):
            sphere('faro', 0.1, P(s * 0.5, 0.72, L / 2 + 0.02), LA, parent=root, scale=(1, 0.5, 0.85))
        face(root, 1.4, 0.62, sep=0.26, r=0.19, smile_y=0.86, smile_z=L / 2 - 0.02)
        for s in (1, -1):
            rbox('pestana', S(0.16, 0.035, 0.035), P(s * 0.4, 1.68, 0.64), 0.012, PU, parent=root, rot=(0, s * 0.45, 0))
        rr = 0.36; wz = L * 0.3
    for s in (1, -1):
        sphere('faro', 0.11, P(s * 0.55, 0.7, (L / 2 if kind not in ('van', 'mail', 'icecream') else L / 2 + 0.7) + 0.01), LA, parent=root, scale=(1, 0.5, 0.8))
        rbox('piloto', S(0.2, 0.12, 0.04), P(s * 0.6, 0.75, -L / 2 - (0.1 if kind in ('van', 'mail', 'icecream') else 0)), 0.03, RL, parent=root)
    w = 0.26 if kind != 'bus' else 0.36
    hw = {'bus': 1.05, 'van': 0.82, 'mail': 0.82, 'icecream': 0.82, 'pickup': 0.82}.get(kind, 0.72)
    for nm, (x, z) in {'ruedaFL': (hw, wz), 'ruedaFR': (-hw, wz), 'ruedaRL': (hw, -wz), 'ruedaRR': (-hw, -wz)}.items():
        wheel(nm, x, z, rr, w, root)
    return root

# ---------------------------------------------------------------- edificios
def window(parent, x, y, z, facing, w=0.85, h=0.95, frame='#ffffff', shutter=None):
    """facing: 'z+' 'z-' 'x+' 'x-' ; (x,y,z) centro sobre la pared."""
    rot = {'z+': 0, 'z-': math.pi, 'x+': math.pi / 2, 'x-': -math.pi / 2}[facing]
    e = empty('ventana', P(x, y, z), parent); e.rotation_euler = (0, 0, -rot)
    F = mat('marco' + frame, frame, 0.35, coat=0.4)
    rbox('marco', S(w + 0.14, h + 0.14, 0.1), (0, 0, 0), 0.04, F, parent=e)
    rbox('vidrio', S(w, h, 0.06), P(0, 0, 0.03), 0.02, GL, parent=e)
    rbox('cruz_v', S(0.05, h, 0.08), P(0, 0, 0.04), 0.01, F, parent=e)
    rbox('cruz_h', S(w, 0.05, 0.08), P(0, 0, 0.04), 0.01, F, parent=e)
    rbox('alfeizar', S(w + 0.26, 0.08, 0.2), P(0, -h / 2 - 0.08, 0.06), 0.03, F, parent=e)
    if shutter:
        S_ = mat('postigo' + shutter, shutter, 0.4)
        for s in (1, -1):
            rbox('postigo', S(0.32, h + 0.1, 0.05), P(s * (w / 2 + 0.25), 0, 0.02), 0.02, S_, parent=e)
    return e

def door(parent, x, z, facing, color='#8a5a3a', w=1.0, h=1.9):
    rot = {'z+': 0, 'z-': math.pi, 'x+': math.pi / 2, 'x-': -math.pi / 2}[facing]
    e = empty('puerta', P(x, 0, z), parent); e.rotation_euler = (0, 0, -rot)
    rbox('marco', S(w + 0.2, h + 0.12, 0.12), P(0, h / 2 + 0.05, 0), 0.04, WH, parent=e)
    rbox('hoja', S(w, h, 0.1), P(0, h / 2 + 0.02, 0.03), 0.06, mat('puerta' + color, color, 0.4, coat=0.5), parent=e)
    for i in range(2):
        rbox('panel', S(w * 0.7, h * 0.32, 0.03), P(0, h * (0.3 + i * 0.4), 0.09), 0.03, mat('puerta' + color, color, 0.4, coat=0.5), parent=e)
    sphere('pomo', 0.05, P(w * 0.35, h * 0.5, 0.12), CH, parent=e)
    rbox('escalon', S(w + 0.5, 0.15, 0.5), P(0, 0.075, 0.3), 0.03, mat('piedra', '#cfc6b8', 0.8), parent=e)
    return e

def house(name, w, d, floors, wall, roof, trim='#ffffff', shutter=None, porch=False, seed=0):
    rnd = random.Random(seed)
    root = empty(name)
    H = 2.8 * floors
    W = mat('pared' + wall, wall, 0.7)
    rbox('zocalo', S(w + 0.12, 0.45, d + 0.12), P(0, 0.225, 0), 0.05, mat('zocalo', '#b9b0a3', 0.85), parent=root)
    rbox('muros', S(w, H, d), P(0, H / 2, 0), 0.12, W, parent=root)
    for f in range(1, floors):
        rbox('imposta', S(w + 0.1, 0.12, d + 0.1), P(0, 2.8 * f, 0), 0.04, mat('trim' + trim, trim, 0.4), parent=root)
    R = mat('tejado' + roof, roof, 0.55)
    prism_roof('tejado', w, d, 1.4 + w * 0.08, P(0, H, 0), R, parent=root)
    rbox('chimenea', S(0.5, 1.4, 0.5), P(w * 0.25, H + 1.0, -d * 0.15), 0.05, mat('ladrillo', '#c9705c', 0.8), parent=root)
    rbox('chim_top', S(0.62, 0.12, 0.62), P(w * 0.25, H + 1.75, -d * 0.15), 0.03, mat('zocalo', '#b9b0a3', 0.85), parent=root)
    door(root, 0, d / 2 + 0.01, 'z+', rnd.choice(['#8a5a3a', '#3d8bff', '#ff5f7e', '#39c47a', '#ffcf3a']))
    nwx = max(1, int((w - 1.0) // 1.8))
    for f in range(floors):
        y = 1.55 + 2.8 * f
        xs = [(-w / 2 + (i + 0.5) * w / nwx) for i in range(nwx)]
        for x in xs:
            if f == 0 and abs(x) < 0.9:
                continue
            window(root, x, y, d / 2 + 0.02, 'z+', shutter=shutter)
            window(root, x, y, -d / 2 - 0.02, 'z-', shutter=shutter)
        nz = max(1, int((d - 0.8) // 2.0))
        for i in range(nz):
            z = -d / 2 + (i + 0.5) * d / nz
            window(root, w / 2 + 0.02, y, z, 'x+', shutter=shutter)
            window(root, -w / 2 - 0.02, y, z, 'x-', shutter=shutter)
        if f == 0:
            for x in xs:
                if abs(x) < 0.9: continue
                rbox('jardinera', S(1.0, 0.28, 0.3), P(x, 0.95, d / 2 + 0.25), 0.04, mat('jardinera', '#9a6a3c', 0.7), parent=root)
                for k in range(4):
                    sphere('flor', 0.11, P(x - 0.33 + k * 0.22, 1.17, d / 2 + 0.25), mat('flor' + str(k), ['#ff5f7e', '#ffd23f', '#ff9df5', '#ffffff'][k], 0.5), parent=root, seg=8, rings=6)
    if porch:
        rbox('porche_suelo', S(w * 0.6, 0.2, 1.6), P(0, 0.1, d / 2 + 0.8), 0.04, mat('madera', '#c79a6a', 0.7), parent=root)
        for s in (1, -1):
            cyl('columna', 0.08, 2.5, P(s * w * 0.27, 1.35, d / 2 + 1.45), WH, parent=root, verts=16)
        rbox('porche_techo', S(w * 0.66, 0.15, 1.8), P(0, 2.65, d / 2 + 0.85), 0.04, R, parent=root)
    return root

def shop(name, w, d, wall, awn, seed=0):
    root = empty(name)
    H = 5.8
    rbox('muros', S(w, H, d), P(0, H / 2, 0), 0.12, mat('pared' + wall, wall, 0.7), parent=root)
    rbox('cornisa', S(w + 0.3, 0.35, d + 0.3), P(0, H, 0), 0.06, WH, parent=root)
    rbox('escaparate', S(w * 0.7, 1.8, 0.08), P(-w * 0.1, 1.6, d / 2 + 0.03), 0.04, GL, parent=root)
    rbox('marco_esc', S(w * 0.74, 1.95, 0.06), P(-w * 0.1, 1.6, d / 2 + 0.01), 0.03, WH, parent=root)
    door(root, w * 0.36, d / 2 + 0.01, 'z+', '#3a4a6a', 0.9, 2.1)
    for i in range(int(w // 0.5)):
        rbox('toldo', S(0.5, 0.06, 1.3), P(-w / 2 + 0.25 + i * 0.5, 3.0, d / 2 + 0.6), 0.02, mat('toldo' + awn + str(i % 2), awn if i % 2 else '#ffffff', 0.5), parent=root, rot=(math.radians(-18), 0, 0))
    rbox('letrero', S(w * 0.8, 0.9, 0.12), P(0, 4.0, d / 2 + 0.08), 0.06, WH, parent=root)  # three pega aquí el texto
    for x in (-w / 4, w / 4):
        window(root, x, 4.9 - 0.3, d / 2 + 0.02, 'z+', 0.8, 0.7)
        window(root, x, 1.8, -d / 2 - 0.02, 'z-')
        window(root, x, 4.6, -d / 2 - 0.02, 'z-')
    for z in (-d / 4, d / 4):
        window(root, w / 2 + 0.02, 1.8, z, 'x+'); window(root, -w / 2 - 0.02, 1.8, z, 'x-')
        window(root, w / 2 + 0.02, 4.6, z, 'x+'); window(root, -w / 2 - 0.02, 4.6, z, 'x-')
    return root

def big(name, w, d, h, wall, trim, doors=1, door_w=4.2, door_h=3.6, roofkind='flat'):
    root = empty(name)
    rbox('muros', S(w, h, d), P(0, h / 2, 0), 0.25, mat('pared' + wall, wall, 0.6), parent=root)
    rbox('cornisa', S(w + 0.35, 0.45, d + 0.35), P(0, h, 0), 0.12, mat('trim' + trim, trim, 0.4), parent=root)
    rbox('zocalo', S(w + 0.1, 0.5, d + 0.1), P(0, 0.25, 0), 0.06, mat('zocalo', '#b9b0a3', 0.85), parent=root)
    xs = [(-w / 2 + (i + 0.5) * w / doors) for i in range(doors)]
    for i, x in enumerate(xs):
        rbox('marco_puerta', S(door_w + 0.4, door_h + 0.3, 0.2), P(x, door_h / 2 + 0.1, d / 2 + 0.05), 0.08, mat('trim' + trim, trim, 0.4), parent=root)
    rbox('letrero', S(w * 0.7, 1.3, 0.25), P(0, h - 1.0, d / 2 + 0.15), 0.15, WH, parent=root)
    for side in ('x+', 'x-'):
        for z in [(-d / 2 + (i + 0.5) * d / 3) for i in range(3)]:
            window(root, (w / 2 + 0.02) * (1 if side == 'x+' else -1), h * 0.5, z, side, 1.0, 1.2)
    for x in [(-w / 2 + (i + 0.5) * w / 4) for i in range(4)]:
        window(root, x, h * 0.5, -d / 2 - 0.02, 'z-', 1.0, 1.2)
    return root, xs

def garage_interior(root, x0, w, d, h, door_w, door_h):
    """Habitación real detrás de la puerta: suelo, paredes, estantería, neumáticos, elevador y lámpara."""
    I = empty('interior', P(x0, 0, 0), root)
    rbox('suelo_int', S(door_w + 0.6, 0.05, d - 0.6), P(0, 0.03, 0), 0.0, mat('suelo_taller', '#9aa3b2', 0.6), parent=I)
    rbox('pared_fondo', S(door_w + 0.6, door_h + 0.4, 0.1), P(0, door_h / 2, -d / 2 + 0.4), 0.0, mat('pared_taller', '#47608f', 0.7), parent=I)
    for s in (1, -1):
        rbox('pared_lat', S(0.1, door_h + 0.4, d - 0.6), P(s * (door_w / 2 + 0.3), door_h / 2, 0), 0.0, mat('pared_taller', '#47608f', 0.7), parent=I)
    rbox('techo_int', S(door_w + 0.6, 0.1, d - 0.6), P(0, door_h + 0.35, 0), 0.0, mat('techo_taller', '#2e3c5c', 0.8), parent=I)
    rbox('tablero', S(2.2, 1.1, 0.06), P(-0.6, 2.0, -d / 2 + 0.47), 0.03, mat('tablero', '#c9a26b', 0.7), parent=I)
    for i in range(6):
        cyl('herr', 0.04, 0.6 + (i % 2) * 0.15, P(-1.4 + i * 0.32, 2.0, -d / 2 + 0.53), GR, parent=I, verts=8)
    for k in range(3):
        cyl('neum', 0.42, 0.28, P(door_w / 2 - 0.5, 0.15 + k * 0.29, -d / 2 + 1.0), TI, parent=I, bevel=0.06)
    for s in (1, -1):
        rbox('elevador', S(0.18, 1.6, 0.18), P(s * 1.1, 0.8, -0.6), 0.04, mat('amarillo', '#ffcf3a', 0.3, coat=0.6), parent=I)
    rbox('elev_brazo', S(2.4, 0.12, 0.3), P(0, 0.9, -0.6), 0.04, mat('amarillo', '#ffcf3a', 0.3, coat=0.6), parent=I)
    rbox('lampara', S(1.4, 0.08, 0.3), P(0, door_h + 0.25, -0.2), 0.03, mat('luz_taller', '#fff6d6', 0.2, emit='#ffe3a6', emit_k=6.0), parent=I)
    return I

def edificios():
    house('casa_a', 7, 6, 1, '#ffc2d4', '#ff6f91', shutter='#ff6f91', seed=1)
    house('casa_b', 8, 6.5, 2, '#c9b6ff', '#7b61ff', seed=2)
    house('casa_c', 6.5, 6, 1, '#bff0d4', '#3fbf86', shutter='#3fbf86', porch=True, seed=3)
    house('casa_d', 9, 7, 2, '#ffe0b3', '#ff8a5c', shutter='#ff8a5c', seed=4)
    house('casa_e', 7, 6, 2, '#d4f2ff', '#4aa8ff', porch=True, seed=5)
    house('casa_f', 6, 5.5, 1, '#fff1a8', '#ffb400', shutter='#ffb400', seed=6)
    house('casa_g', 10, 7, 3, '#ffd1dc', '#c75b7a', seed=7)
    house('casa_h', 7.5, 6.5, 2, '#e6d4ff', '#9b6bff', shutter='#9b6bff', seed=8)
    for i, (n, wall, awn) in enumerate([('tienda_pan', '#ffe7c2', '#ff8a1f'), ('tienda_helados', '#ffd6ea', '#ff5f9a'), ('tienda_juguetes', '#d6ecff', '#3d8bff'), ('tienda_frutas', '#e2ffd6', '#39c47a'), ('tienda_libros', '#f3e6ff', '#9b6bff')]):
        shop(n, 7, 7, wall, awn, seed=i)
    # garaje de Bruno con interior real y puerta enrollable aparte
    r, xs = big('garaje', 10, 8, 6.2, '#3d8bff', '#ffffff')
    garage_interior(r, xs[0], 10, 8, 6.2, 4.2, 3.6)
    pz = empty('puerta_enrollable', P(xs[0], 3.65, 4.12), r)  # pivote arriba
    for i in range(10):
        rbox('lama', S(4.2, 0.34, 0.08), P(0, -0.18 - i * 0.36, 0), 0.03, mat('lama' + str(i % 2), '#e3efff' if i % 2 else '#c4dcff', 0.4, coat=0.4), parent=pz)
    r, xs = big('lavadero', 10, 8, 5.6, '#7fe3ff', '#ffffff')
    for s in (1, -1):
        cyl('rodillo', 0.55, 3.2, P(xs[0] + s * 1.6, 1.7, 3.9), mat('rodillo' + str(s), '#ff5f9a' if s > 0 else '#3d8bff', 0.8), parent=r)
    for i in range(5):
        sphere('burbuja', 0.6 + i * 0.12, P(-3 + i * 1.5, 6.4 + (i % 2) * 0.6, 0.5), mat('burbuja', '#e9fbff', 0.02, coat=1.0, emit='#e9fbff', emit_k=0.2), parent=r)
    r, xs = big('estacion', 14, 9, 6.6, '#39c47a', '#fff7e0', doors=2, door_w=3.0)
    cyl('reloj', 1.6, 0.5, P(0, 8.4, 0), mat('reloj_marco', '#fff7e0', 0.4), parent=r, rot=(math.pi / 2, 0, 0), bevel=0.05)
    rbox('torre_reloj', S(3.0, 1.6, 3.0), P(0, 7.4, 0), 0.15, mat('pared#39c47a', '#39c47a', 0.6), parent=r)
    rbox('anden', S(30, 0.9, 4), P(0, 0.45, -7), 0.1, mat('anden', '#d8cfc0', 0.8), parent=r)
    rbox('marquesina', S(24, 0.25, 4.6), P(0, 4.2, -7), 0.08, mat('trim#fff7e0', '#fff7e0', 0.4), parent=r)
    for x in range(-10, 11, 5):
        cyl('poste', 0.12, 3.4, P(x, 2.5, -8.5), GR, parent=r, verts=12)
    r, xs = big('bomberos', 12, 9, 6.0, '#ff4b4b', '#ffffff', doors=3, door_w=3.0, door_h=3.4)
    rbox('torre', S(2.2, 4.0, 2.2), P(4.2, 7.5, -1.5), 0.12, mat('pared#ff4b4b', '#ff4b4b', 0.6), parent=r)
    sphere('sirena', 0.5, P(4.2, 9.9, -1.5), mat('sirena', '#ffd23f', 0.2, emit='#ff9a00', emit_k=1.0), parent=r)
    for x in xs:
        for i in range(8):
            rbox('lama_b', S(3.0, 0.38, 0.08), P(x, 3.2 - i * 0.4, 4.58), 0.03, mat('lamab' + str(i % 2), '#ffffff' if i % 2 else '#ffd6d6', 0.4), parent=r)
    r, xs = big('ayuntamiento', 16, 10, 8.0, '#fff1d6', '#c9a26b', doors=1, door_w=3.0, door_h=3.6)
    for x in range(-6, 7, 3):
        cyl('columna', 0.35, 6.0, P(x, 3.0, 5.6), WH, parent=r, verts=24)
    prism_roof('fronton', 16, 3.0, 2.4, P(0, 8.0, 4.5), mat('tejado_ayto', '#e07a5f', 0.5), parent=r)
    cyl('cupula_base', 2.2, 2.0, P(0, 9.5, -1), mat('pared#fff1d6', '#fff1d6', 0.6), parent=r, verts=32)
    sphere('cupula', 2.2, P(0, 10.5, -1), mat('cupula', '#4aa8ff', 0.3, coat=0.6), parent=r, scale=(1, 1, 0.8))
    # granja
    g = empty('granero')
    rbox('muros', S(9, 5.0, 12), P(0, 2.5, 0), 0.12, mat('granero', '#d6403a', 0.6), parent=g)
    prism_roof('tejado', 12, 9, 3.2, P(0, 5.0, 0), mat('tejado_granero', '#6b4a3a', 0.6), parent=g)
    for z in (6.02, -6.02):
        rbox('portalon', S(3.6, 3.6, 0.1), P(0, 1.8, z), 0.05, mat('granero_osc', '#a8302b', 0.6), parent=g)
        for k in (1, -1):
            rbox('cruz', S(0.12, 4.9, 0.12), P(0, 1.8, z + 0.05 * (1 if z > 0 else -1)), 0.02, WH, parent=g, rot=(0, -k * math.atan(3.6 / 3.6) * (1 if z > 0 else -1), 0))
        rbox('marco_p', S(3.9, 3.9, 0.08), P(0, 1.85, z), 0.03, WH, parent=g)
    s = empty('silo')
    cyl('silo_c', 2.0, 9.0, P(0, 4.5, 0), mat('silo', '#d9e1ec', 0.3, metal=0.5), parent=s, verts=40)
    sphere('silo_t', 2.0, P(0, 9.0, 0), mat('silo_techo', '#d6403a', 0.4), parent=s, scale=(1, 1, 0.6))
    for k in range(5):
        torus('aro', 2.02, 0.05, P(0, 1.5 + k * 1.8, 0), GR, parent=s, rot=(0, 0, 0))

# ---------------------------------------------------------------- props
def props():
    e = empty('farola')
    cyl('poste', 0.08, 4.2, P(0, 2.1, 0), DKG, parent=e, verts=16, rad2=0.06)
    cyl('base', 0.18, 0.4, P(0, 0.2, 0), DKG, parent=e, verts=16)
    rbox('brazo', S(0.08, 0.08, 0.9), P(0, 4.15, 0.35), 0.03, DKG, parent=e)
    sphere('farol', 0.28, P(0, 3.95, 0.75), mat('farol', '#fff6c8', 0.1, emit='#ffe08a', emit_k=2.5), parent=e, scale=(1, 1, 0.9))
    cyl('sombrero', 0.34, 0.12, P(0, 4.22, 0.75), DKG, parent=e, rad2=0.12)
    e = empty('banco')
    for i in range(3):
        rbox('tabla', S(1.8, 0.06, 0.14), P(0, 0.48, -0.18 + i * 0.18), 0.02, mat('madera', '#c79a6a', 0.7), parent=e)
    for i in range(2):
        rbox('resp', S(1.8, 0.14, 0.06), P(0, 0.7 + i * 0.2, -0.3), 0.02, mat('madera', '#c79a6a', 0.7), parent=e)
    for s in (1, -1):
        rbox('pata', S(0.07, 0.85, 0.5), P(s * 0.75, 0.42, -0.08), 0.02, DKG, parent=e)
    e = empty('papelera')
    cyl('cubo', 0.25, 0.75, P(0, 0.4, 0), mat('papelera', '#39c47a', 0.5, coat=0.4), parent=e, verts=24, bevel=0.03)
    cyl('tapa', 0.27, 0.06, P(0, 0.8, 0), GR, parent=e, verts=24)
    e = empty('buzon')
    rbox('cuerpo', S(0.5, 0.7, 0.4), P(0, 1.05, 0), 0.15, mat('buzon', '#ffcf3a', 0.35, coat=0.6), parent=e)
    cyl('pie', 0.05, 0.75, P(0, 0.38, 0), GR, parent=e)
    e = empty('hidrante')
    cyl('cuerpo', 0.16, 0.6, P(0, 0.3, 0), mat('hidrante', '#ff4b4b', 0.35, coat=0.6), parent=e, verts=20)
    sphere('tapa', 0.17, P(0, 0.62, 0), mat('hidrante', '#ff4b4b', 0.35, coat=0.6), parent=e, scale=(1, 1, 0.7))
    for s in (1, -1):
        cyl('boca', 0.07, 0.14, P(s * 0.18, 0.4, 0), CH, parent=e, rot=(0, math.pi / 2, 0), verts=12)
    e = empty('semaforo')
    cyl('poste', 0.07, 3.2, P(0, 1.6, 0), DKG, parent=e, verts=12)
    rbox('caja', S(0.36, 1.0, 0.3), P(0, 3.4, 0.05), 0.08, DKG, parent=e)
    for i, c in enumerate(['#ff3b3b', '#ffd23f', '#39c47a']):
        sphere('luz' + str(i), 0.11, P(0, 3.72 - i * 0.32, 0.2), mat('sem' + c, c, 0.2, emit=c, emit_k=0.3 if i else 2.0), parent=e, scale=(1, 0.5, 1))
    e = empty('valla')
    for i in range(5):
        rbox('tabla', S(0.14, 1.0, 0.06), P(-1.0 + i * 0.5, 0.5, 0), 0.03, WH, parent=e)
    for y in (0.35, 0.75):
        rbox('trav', S(2.3, 0.1, 0.05), P(0, y, -0.05), 0.02, WH, parent=e)
    e = empty('arbusto')
    for (x, y, z, r) in [(0, 0.5, 0, 0.7), (0.5, 0.4, 0.2, 0.5), (-0.5, 0.42, -0.1, 0.52), (0.1, 0.8, -0.2, 0.45)]:
        sphere('bola', r, P(x, y, z), mat('arbusto', '#4fb85a', 0.8), parent=e, seg=20, rings=12)
    e = empty('maceta')
    cyl('maceta', 0.32, 0.5, P(0, 0.25, 0), mat('barro', '#d0764e', 0.7), parent=e, rad2=0.26, verts=20, bevel=0.03)
    for k in range(5):
        sphere('flor', 0.12, P(math.cos(k) * 0.15, 0.62 + (k % 2) * 0.08, math.sin(k) * 0.15), mat('flor' + str(k % 3), ['#ff5f7e', '#ffd23f', '#ff9df5'][k % 3], 0.5), parent=e, seg=10, rings=8)
    e = empty('fuente')
    cyl('pila', 3.0, 0.7, P(0, 0.35, 0), mat('piedra_c', '#e8e0d2', 0.6), parent=e, verts=48, bevel=0.1)
    cyl('agua', 2.75, 0.1, P(0, 0.62, 0), mat('agua_f', '#6fc8ff', 0.05, coat=1.0, emit='#7fd0ff', emit_k=0.3), parent=e, verts=48)
    cyl('pie', 0.35, 1.6, P(0, 1.3, 0), mat('piedra_c', '#e8e0d2', 0.6), parent=e, verts=24)
    cyl('taza', 1.1, 0.3, P(0, 2.1, 0), mat('piedra_c', '#e8e0d2', 0.6), parent=e, verts=36, bevel=0.06, rad2=1.3)
    e = empty('parada_bus')
    rbox('techo', S(3.2, 0.12, 1.4), P(0, 2.5, 0), 0.04, mat('parada', '#3d8bff', 0.4, coat=0.4), parent=e)
    rbox('fondo', S(3.0, 1.9, 0.06), P(0, 1.4, -0.6), 0.03, GL, parent=e)
    for s in (1, -1):
        cyl('poste', 0.06, 2.5, P(s * 1.5, 1.25, -0.6), GR, parent=e, verts=12)
    rbox('banco', S(2.4, 0.08, 0.4), P(0, 0.5, -0.35), 0.03, mat('madera', '#c79a6a', 0.7), parent=e)
    e = empty('poste_banderines')
    cyl('poste', 0.09, 6.0, P(0, 3.0, 0), WH, parent=e, verts=16)
    sphere('bola', 0.16, P(0, 6.05, 0), mat('amarillo', '#ffcf3a', 0.3, coat=0.6), parent=e)
    e = empty('cono')
    cyl('cono', 0.22, 0.6, P(0, 0.33, 0), mat('cono', '#ff7a1a', 0.4), parent=e, rad2=0.03, verts=20)
    torus('banda', 0.13, 0.03, P(0, 0.4, 0), WH, parent=e)
    rbox('base', S(0.5, 0.05, 0.5), P(0, 0.025, 0), 0.02, mat('cono', '#ff7a1a', 0.4), parent=e)
    e = empty('barrera_obra')
    for s in (1, -1):
        rbox('pata', S(0.08, 1.0, 0.5), P(s * 0.9, 0.5, 0), 0.02, WH, parent=e)
    for i in range(4):
        rbox('franja', S(0.45, 0.25, 0.06), P(-0.68 + i * 0.45, 0.85, 0.05), 0.02, mat('fr' + str(i % 2), '#ff4b4b' if i % 2 else '#ffffff', 0.4), parent=e)
    e = empty('barco')
    rbox('casco', S(2.4, 1.0, 5.5), P(0, 0.4, 0), 0.5, mat('casco', '#ffffff', 0.3, coat=0.6), parent=e)
    rbox('franja', S(2.45, 0.2, 5.4), P(0, 0.2, 0), 0.1, mat('casco_r', '#ff4b4b', 0.3, coat=0.6), parent=e)
    rbox('cabina', S(1.6, 1.2, 1.8), P(0, 1.4, -0.6), 0.25, mat('cabina_b', '#3d8bff', 0.3, coat=0.6), parent=e)
    car_eyes(e, 1.5, 0.33, 0.3, 0.18)
    e = empty('charco_barro')
    cyl('barro', 3.2, 0.12, P(0, 0.04, 0), mat('barro_m', '#6b4a2b', 0.15, coat=0.8), parent=e, verts=40)
    for k in range(8):
        a = k / 8 * 2 * math.pi
        sphere('borde', 0.6, P(math.cos(a) * 3.0, 0.02, math.sin(a) * 2.6), mat('barro_m', '#6b4a2b', 0.15, coat=0.8), parent=e, scale=(1.3, 1.0, 0.18))
    e = empty('pegatina_marco')

def arboles():
    def tree(name, kind, col, seed):
        rnd = random.Random(seed)
        e = empty(name)
        T = mat('tronco', '#8a5a34', 0.85)
        if kind == 'redondo':
            cyl('tronco', 0.25, 2.2, P(0, 1.1, 0), T, parent=e, verts=12, rad2=0.18)
            for i in range(7):
                a = rnd.random() * 6.28; r = 0.9 + rnd.random() * 0.6
                sphere('copa', r, P(math.cos(a) * 0.7, 2.8 + rnd.random() * 1.2, math.sin(a) * 0.7), mat('copa' + col, col, 0.75), parent=e, seg=20, rings=14)
            sphere('copa_c', 1.4, P(0, 3.4, 0), mat('copa' + col, col, 0.75), parent=e, seg=24, rings=16)
        elif kind == 'pino':
            cyl('tronco', 0.22, 1.6, P(0, 0.8, 0), T, parent=e, verts=12)
            for i in range(4):
                cyl('capa', 1.6 - i * 0.32, 1.6, P(0, 1.8 + i * 0.95, 0), mat('copa' + col, col, 0.75), parent=e, rad2=0.05, verts=16)
        elif kind == 'alamo':
            cyl('tronco', 0.18, 2.0, P(0, 1.0, 0), T, parent=e, verts=12)
            sphere('copa', 1.0, P(0, 4.0, 0), mat('copa' + col, col, 0.75), parent=e, scale=(1, 1, 2.6), seg=20, rings=16)
        elif kind == 'flor':
            cyl('tronco', 0.22, 2.0, P(0, 1.0, 0), T, parent=e, verts=12, rad2=0.16)
            for i in range(6):
                a = rnd.random() * 6.28
                sphere('copa', 0.8 + rnd.random() * 0.4, P(math.cos(a) * 0.8, 2.7 + rnd.random() * 0.8, math.sin(a) * 0.8), mat('copa' + col, col, 0.7), parent=e, seg=20, rings=14)
        return e
    tree('arbol_redondo_a', 'redondo', '#4fbf5a', 1); tree('arbol_redondo_b', 'redondo', '#63c95f', 2); tree('arbol_redondo_c', 'redondo', '#3fae6a', 3)
    tree('arbol_pino_a', 'pino', '#2f9e5a', 4); tree('arbol_pino_b', 'pino', '#3aa865', 5)
    tree('arbol_alamo', 'alamo', '#7bd36b', 6)
    tree('arbol_flor_rosa', 'flor', '#ffa6c9', 7); tree('arbol_flor_blanco', 'flor', '#fff0f5', 8)

def vehiculos():
    for nm, k, c in [('coche_rojo', 'sedan', '#ff4b4b'), ('coche_verde', 'hatch', '#39c47a'), ('coche_morado', 'sedan', '#c56bff'), ('taxi', 'taxi', '#ffd23f'),
                     ('furgoneta', 'van', '#ffffff'), ('cartero', 'mail', '#ffcf3a'), ('helados', 'icecream', '#ffe3ef'), ('autobus', 'bus', '#3d8bff'),
                     ('pickup', 'pickup', '#7fe3ff'), ('tractor', 'tractor', '#39c47a'), ('coche_rosa', 'hatch', '#ff9fc4'), ('coche_azul', 'sedan', '#4aa8ff'),
                     ('chispa', 'chispa', '#3d8bff')]:
        vehicle(nm, k, c)

# ---------------------------------------------------------------- personajes
def face(root, y, z, sep=0.3, r=0.2, smile_y=None, panel=None, smile_z=None):
    """Cara estándar: panel-parabrisas (opcional), ojos animables (ojosA), sonrisa fija y boca abierta (bocaA)."""
    if panel:
        rbox('panel', S(panel[0], panel[1], 0.08), P(0, y, z - 0.03), 0.07, mat('panelcara', '#dff3ff', 0.12, coat=1.0), parent=root)
    oj = empty('ojosA', P(0, y, z + 0.02), root)
    for s in (1, -1):
        sphere('ojo', r, P(s * sep, 0, 0), WH, parent=oj, scale=(1, 0.42, 1.15), seg=28, rings=16)
        sphere('iris', r * 0.62, P(s * sep, -0.01, r * 0.36), mat('iris', '#5a3a1e', 0.2, coat=1.0), parent=oj, scale=(1, 0.3, 1.05), seg=22, rings=12)
        sphere('pup', r * 0.36, P(s * sep, -0.01, r * 0.42), PU, parent=oj, scale=(1, 0.3, 1.05), seg=16, rings=10)
        sphere('bri', r * 0.14, P(s * sep + r * 0.2, r * 0.25, r * 0.47), mat('brillo', '#ffffff', 0, emit='#ffffff', emit_k=1.5), parent=oj, seg=8, rings=6)
        rbox('ceja', S(r * 1.1, 0.07, 0.07), P(s * sep, r * 1.35, 0.02), 0.03, mat('ceja', '#5a2e14', 0.5), parent=oj, rot=(0, s * 0.2, 0))
    sy = smile_y if smile_y is not None else y - r * 1.9
    z0 = z; z = smile_z if smile_z is not None else z
    torus('sonrisa', r * 0.9, r * 0.17, P(0, sy + r * 0.45, z + 0.02), mat('labio', '#5a1e0e', 0.4), parent=root, arc=180, rot=(-math.pi / 2, 0, math.pi))
    bo = empty('bocaA', P(0, sy, z + 0.03), root)
    sphere('hueco', r * 0.75, (0, 0, 0), mat('boca_osc', '#3a0d12', 0.6), parent=bo, scale=(1.1, 0.2, 0.75), seg=20, rings=10)
    sphere('lengua', r * 0.45, P(0, -r * 0.3, 0.02), mat('lengua', '#ff6f7e', 0.4), parent=bo, scale=(1.1, 0.25, 0.6), seg=14, rings=8)
    z = z0
    for s in (1, -1):
        sphere('mejilla', r * 0.8, P(s * (sep + r * 1.1), sy + r * 0.5, (smile_z if smile_z is not None else z) + 0.0), mat('mejilla', '#ff8f9e', 0.6), parent=root, scale=(0.5, 0.08, 0.32), seg=14, rings=8)

def lola():
    root = empty('lola'); C = paint('#ff3b30'); L = 5.6
    rbox('chasis', S(2.0, 0.5, L), P(0, 0.75, 0), 0.15, DKG, parent=root)
    rbox('cabina', S(2.0, 1.75, 1.7), P(0, 1.85, L / 2 - 0.95), 0.32, C, parent=root)
    rbox('caja', S(2.0, 1.25, L - 1.9), P(0, 1.6, -0.85), 0.2, C, parent=root)
    for side in (1, -1):
        rbox('franja', S(0.04, 0.16, L - 0.3), P(side * 1.01, 1.25, 0), 0.03, mat('franja_bl', '#ffffff', 0.3), parent=root)
        for i in range(3):
            rbox('persiana', S(0.04, 0.85, 0.95), P(side * 1.01, 1.75, -2.4 + i * 1.05), 0.05, mat('persiana', '#e8edf5', 0.3, metal=0.4), parent=root)
            for k in range(5): rbox('lama', S(0.05, 0.03, 0.9), P(side * 1.03, 1.42 + k * 0.17, -2.4 + i * 1.05), 0.01, GR, parent=root)
    rbox('parachoques', S(2.15, 0.35, 0.3), P(0, 0.75, L / 2 + 0.05), 0.12, CH, parent=root)
    rbox('rejilla', S(1.3, 0.35, 0.06), P(0, 1.15, L / 2 + 0.02), 0.04, CH, parent=root)
    for s in (1, -1):
        sphere('faro', 0.16, P(s * 0.72, 1.15, L / 2 + 0.02), LA, parent=root, scale=(1, 0.5, 1))
    face(root, 2.25, L / 2 - 0.08, sep=0.42, r=0.26, panel=(1.8, 1.05))
    # barra de sirenas
    rbox('barra', S(1.4, 0.16, 0.36), P(0, 2.82, L / 2 - 0.9), 0.06, DKG, parent=root)
    for nm, x, c in (('sirenaR', 0.4, '#ff2020'), ('sirenaB', -0.4, '#2f6bff')):
        e = empty(nm, P(x, 2.98, L / 2 - 0.9), root)
        rbox(nm + '_c', S(0.55, 0.22, 0.32), (0, 0, 0), 0.1, mat('sir' + c, c, 0.1, coat=1.0, emit=c, emit_k=2.5), parent=e)
    # escalera (pivote atrás)
    esc = empty('escalera', P(0, 2.3, -L / 2 + 0.4), root)
    for s in (1, -1):
        rbox('larguero', S(0.08, 0.1, 4.2), P(s * 0.38, 0.05, 2.1), 0.03, mat('escalera', '#d9e1ec', 0.25, metal=0.7), parent=esc)
    for i in range(12):
        cyl('pelda', 0.03, 0.76, P(0, 0.05, 0.25 + i * 0.33), mat('escalera', '#d9e1ec', 0.25, metal=0.7), parent=esc, rot=(0, math.pi / 2, 0), verts=8)
    cyl('base_esc', 0.3, 0.25, P(0, 2.2, -L / 2 + 0.4), GR, parent=root, verts=20)
    cyl('manguera', 0.42, 0.5, P(0, 1.9, -L / 2 - 0.05), mat('manguera', '#f2c94c', 0.5), parent=root, rot=(math.pi / 2, 0, 0), verts=24)
    for nm, (x, z) in {'ruedaFL': (0.95, L / 2 - 1.1), 'ruedaFR': (-0.95, L / 2 - 1.1), 'ruedaRL': (0.95, -L / 2 + 1.2), 'ruedaRR': (-0.95, -L / 2 + 1.2)}.items():
        wheel(nm, x, z, 0.5, 0.36, root)

def tico():
    root = empty('tico'); Y = paint('#ffc21a')
    for s in (1, -1):
        rbox('oruga', S(0.7, 0.7, 3.4), P(s * 1.05, 0.38, 0), 0.32, mat('oruga', '#3a3d48', 0.7), parent=root)
        for i in range(10): rbox('taco', S(0.74, 0.06, 0.12), P(s * 1.05, 0.73, -1.5 + i * 0.33), 0.02, mat('taco', '#24262e', 0.8), parent=root)
        for i in range(4): cyl('rodillo', 0.2, 0.74, P(s * 1.05, 0.38, -1.1 + i * 0.73), GR, parent=root, rot=(0, math.pi / 2, 0), verts=16)
    rbox('plataforma', S(2.4, 0.3, 2.6), P(0, 0.9, 0), 0.1, DKG, parent=root)
    rbox('cuerpo', S(2.3, 1.1, 2.4), P(0, 1.6, -0.35), 0.3, Y, parent=root)
    rbox('cabina', S(1.4, 1.5, 1.45), P(-0.35, 2.75, 0.3), 0.28, Y, parent=root)
    rbox('techo', S(1.55, 0.14, 1.6), P(-0.35, 3.55, 0.3), 0.06, DKG, parent=root)
    rbox('contrapeso', S(2.2, 0.8, 0.6), P(0, 1.7, -1.6), 0.25, mat('contrapeso', '#3a3d48', 0.5), parent=root)
    cyl('escape', 0.08, 0.9, P(0.7, 2.6, -1.1), CH, parent=root, verts=12)
    face(root, 2.9, 1.04, sep=0.3, r=0.2, panel=(1.2, 0.85))
    rbox('rayas', S(2.32, 0.18, 2.42), P(0, 1.2, -0.35), 0.04, mat('rayas', '#3a3d48', 0.5), parent=root)
    # brazo: pluma + balancín + cazo (pivote delante a la derecha)
    pa = empty('pala', P(0.95, 2.0, 0.9), root)
    rbox('pluma', S(0.32, 0.38, 2.6), P(0, 0.9, 1.1), 0.12, Y, parent=pa, rot=(math.radians(35), 0, 0))
    rbox('balancin', S(0.28, 0.32, 1.8), P(0, 1.2, 2.9), 0.1, Y, parent=pa, rot=(math.radians(-50), 0, 0))
    cyl('piston', 0.07, 1.4, P(0, 1.1, 1.0), CH, parent=pa, rot=(math.radians(-55), 0, 0), verts=10)
    rbox('cazo', S(0.9, 0.55, 0.6), P(0, 0.45, 3.45), 0.14, mat('cazo', '#5b6680', 0.4, metal=0.5), parent=pa)
    for i in range(4): rbox('diente', S(0.1, 0.18, 0.1), P(-0.33 + i * 0.22, 0.12, 3.6), 0.03, CH, parent=pa)

def coco():
    root = empty('coco'); G = paint('#2fbf5a'); L = 4.4
    rbox('chasis', S(1.8, 0.4, L), P(0, 0.75, 0), 0.12, DKG, parent=root)
    cyl('caldera', 0.82, 2.4, P(0, 1.75, -0.3), G, parent=root, rot=(math.pi / 2, 0, 0), verts=40, bevel=0.1)
    for i in range(3): torus('aro', 0.84, 0.05, P(0, 1.75, -1.2 + i * 0.9), mat('aro', '#ffd23f', 0.3, metal=0.5), parent=root, rot=(math.pi / 2, 0, 0))
    rbox('cabina', S(1.8, 2.2, 1.5), P(0, 2.0, L / 2 - 0.75), 0.3, G, parent=root)
    rbox('techo', S(2.05, 0.18, 1.8), P(0, 3.15, L / 2 - 0.75), 0.08, mat('techo_coco', '#c0392b', 0.4), parent=root)
    face(root, 2.15, L / 2 + 0.01, sep=0.38, r=0.24, panel=(1.55, 1.0))
    e = empty('chimenea', P(0, 2.55, -1.3), root)
    cyl('chim', 0.24, 0.9, P(0, 0.45, 0), DKG, parent=e, rad2=0.38, verts=24)
    cyl('chim_top', 0.42, 0.14, P(0, 0.95, 0), mat('aro', '#ffd23f', 0.3, metal=0.5), parent=e, verts=24)
    cyl('campana', 0.22, 0.4, P(0, 2.75, -0.1), mat('aro', '#ffd23f', 0.3, metal=0.5), parent=root, verts=20)
    rbox('quitapiedras', S(1.7, 0.5, 0.5), P(0, 0.45, L / 2 + 0.25), 0.1, mat('rojo_q', '#ff3b30', 0.4), parent=root, rot=(math.radians(-25), 0, 0))
    sphere('faro', 0.2, P(0, 1.35, L / 2 + 0.08), LA, parent=root, scale=(1, 0.5, 1))
    for nm, (x, z, r) in {'ruedaFL': (0.72, L / 2 - 0.8, 0.45), 'ruedaFR': (-0.72, L / 2 - 0.8, 0.45), 'ruedaRL': (0.72, -L / 2 + 0.8, 0.55), 'ruedaRR': (-0.72, -L / 2 + 0.8, 0.55)}.items():
        wheel(nm, x, z, r, 0.2, root, '#ff3b30')
    for k, (nm, col) in enumerate((('vagon_a', '#ffd23f'), ('vagon_b', '#3d8bff'))):
        v = empty(nm)
        rbox('base', S(1.8, 0.35, 3.4), P(0, 0.7, 0), 0.1, DKG, parent=v)
        rbox('caja', S(1.8, 1.2, 3.2), P(0, 1.45, 0), 0.22, paint(col), parent=v)
        rbox('borde', S(1.86, 0.14, 3.26), P(0, 2.08, 0), 0.05, WH, parent=v)
        for i in range(3):
            rbox('regalo', S(0.7, 0.6, 0.7), P(-0.3 + (i % 2) * 0.55, 2.35, -1.0 + i * 0.95), 0.08, paint(['#ff5f9a', '#39c47a', '#c56bff'][i]), parent=v)
            rbox('lazo', S(0.72, 0.62, 0.12), P(-0.3 + (i % 2) * 0.55, 2.36, -1.0 + i * 0.95), 0.03, mat('lazo', '#fff1a8', 0.3), parent=v)
        for nm2, (x, z) in {'ruedaFL': (0.72, 1.0), 'ruedaFR': (-0.72, 1.0), 'ruedaRL': (0.72, -1.0), 'ruedaRR': (-0.72, -1.0)}.items():
            wheel(nm2, x, z, 0.38, 0.18, v, '#ff3b30')

def globos():
    for nm, c in (('globo_rojo', '#ff3b3b'), ('globo_azul', '#3d8bff'), ('globo_amarillo', '#ffd23f'), ('globo_verde', '#39c47a'), ('globo_rosa', '#ff7ad1')):
        e = empty(nm)
        sphere('globo', 0.42, P(0, 2.2, 0), mat('gl' + c, c, 0.12, coat=1.0), parent=e, scale=(1, 1, 1.18), seg=28, rings=18)
        cyl('nudo', 0.06, 0.12, P(0, 1.68, 0), mat('gl' + c, c, 0.12, coat=1.0), parent=e, rad2=0.02, verts=10)
        cyl('hilo', 0.008, 1.65, P(0, 0.82, 0), mat('hilo', '#ffffff', 0.5), parent=e, verts=6)
        sphere('brillo_g', 0.08, P(0.15, 2.45, 0.32), mat('brillo', '#ffffff', 0, emit='#ffffff', emit_k=1.5), parent=e, seg=8, rings=6)

def personajes():
    lola(); tico(); coco(); globos()

{'personajes': personajes, 'vehiculos': vehiculos, 'edificios': edificios, 'props': props, 'arboles': arboles}[what]()
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
def bake_roots(samples=16, lo=0.45):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples
    sc.render.bake.target = 'VERTEX_COLORS'
    roots = [o for o in sc.objects if o.parent is None]
    for i, r in enumerate(roots):
        r.location.x += 1000 * (i + 1)
    rbox('__ground', (6000 * 10, 400, 0.2), (0, 0, -0.1), r=0)
    bpy.context.view_layer.update()
    for i, r in enumerate(roots):
        ms = [c for c in r.children_recursive if c.type == 'MESH']
        if not ms: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in ms:
            me = o.data
            for a in list(me.color_attributes): me.color_attributes.remove(a)
            me.color_attributes.active_color = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
            o.select_set(True)
        bpy.context.view_layer.objects.active = ms[0]
        try:
            bpy.ops.object.bake(type='AO')
        except Exception as e:
            print('bake fallo', r.name, e); continue
        for o in ms:
            for d in o.data.color_attributes['Col'].data:
                k = lo + (1 - lo) * d.color[0]; d.color = (k, k, k, 1)
        print('ao', r.name, len(ms), flush=True)
    bpy.data.objects.remove(sc.objects['__ground'], do_unlink=True)
    for i, r in enumerate(roots):
        r.location.x -= 1000 * (i + 1)

if '--ao' in sys.argv:
    bake_roots()
export(OUT + what + '.glb')
print('OK', what, len(meshes))
