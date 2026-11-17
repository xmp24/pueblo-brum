"""Bruno la grúa — modelo detallado. Coordenadas de diseño en sistema three.js (x lado, y arriba, z adelante)."""
import sys, math
sys.path.insert(0, '/home/claude/pueblo-brum/blender')
from lib import *

def P(x, y, z):  # three -> blender
    return (x, -z, y)
def S(x, y, z):
    return (x, z, y)
RX = lambda a: (a, 0, 0)

reset()
OR = mat('naranja', '#ff8a1f', 0.28, coat=0.8)
OR2 = mat('naranja_osc', '#e2700f', 0.35, coat=0.6)
YE = mat('amarillo', '#ffcf3a', 0.3, coat=0.8)
DK = mat('chasis', '#2f3b57', 0.45, coat=0.4)
GL = mat('cristal', '#bfe8ff', 0.04, coat=1.0, emit='#cfeeff', emit_k=0.15)
CH = mat('cromo', '#d9e1ec', 0.12, metal=0.9)
GR = mat('gris', '#5b6680', 0.4, metal=0.3)
TI = mat('neumatico', '#24242c', 0.85)
TI2 = mat('neumatico2', '#1a1a20', 0.9)
WH = mat('blanco', '#ffffff', 0.12, coat=1.0)
IR = mat('iris', '#4a2c16', 0.2, coat=1.0)
PU = mat('pupila', '#0b0a10', 0.15, coat=1.0)
BR = mat('ceja', '#5a2a0c', 0.5)
MO = mat('boca', '#4a1208', 0.5)
TO = mat('lengua', '#ff6f86', 0.45)
LI = mat('labio', '#5a1e0e', 0.4)
CK = mat('mejilla', '#ff8f9e', 0.6)
LA = mat('faro', '#fff2a8', 0.1, emit='#ffd84a', emit_k=2.0)
BE = mat('baliza', '#ffb52e', 0.15, emit='#ff9a00', emit_k=0.6)
RL = mat('piloto', '#ff3b3b', 0.2, emit='#ff2020', emit_k=1.0)

root = empty('Bruno')
body = []
body.append(rbox('chasis', S(1.62, 0.36, 3.1), P(0, 0.62, 0), 0.13, DK))
body.append(rbox('cabina', S(1.62, 1.32, 1.32), P(0, 1.43, 0.75), 0.3, OR))
body.append(rbox('techo_borde', S(1.5, 0.08, 1.18), P(0, 2.08, 0.75), 0.04, OR2))
# puertas con hendidura y manilla
for s in (1, -1):
    body.append(rbox(f'puerta{s}', S(0.05, 0.95, 0.92), P(s * 0.80, 1.31, 0.78), 0.1, OR2))
    body.append(rbox(f'manilla{s}', S(0.05, 0.05, 0.2), P(s * 0.835, 1.5, 0.55), 0.02, CH))
    body.append(cyl(f'brazo_espejo{s}', 0.025, 0.32, P(s * 0.95, 1.76, 1.24), GR, rot=(0, math.pi / 2, 0)))
    body.append(rbox(f'espejo{s}', S(0.09, 0.28, 0.22), P(s * 1.11, 1.83, 1.24), 0.05, CH))
    body.append(rbox(f'faldon{s}', S(0.42, 0.32, 0.05), P(s * 0.85, 0.42, -1.52), 0.03, TI))
    body.append(rbox(f'escalon{s}', S(0.18, 0.06, 0.5), P(s * 0.86, 0.66, 0.78), 0.02, CH))
body.append(rbox('caja', S(1.6, 0.52, 1.55), P(0, 1.04, -0.72), 0.18, OR))
body.append(rbox('franja', S(1.64, 0.1, 1.5), P(0, 0.99, -0.72), 0.04, YE))
for z in (-0.2, -0.72, -1.24):
    for s in (1, -1):
        body.append(cyl(f'remache{z}{s}', 0.03, 0.03, P(s * 0.81, 1.18, z), CH, verts=12, rot=(0, math.pi / 2, 0)))
body.append(rbox('parachoques', S(1.84, 0.3, 0.34), P(0, 0.72, 1.47), 0.13, CH))
body.append(rbox('parachoques_t', S(1.7, 0.24, 0.26), P(0, 0.66, -1.55), 0.1, CH))
body.append(rbox('rejilla', S(0.92, 0.2, 0.05), P(0, 0.72, 1.65), 0.05, GR))
for i in range(5):
    body.append(rbox(f'lama{i}', S(0.04, 0.16, 0.03), P(-0.32 + i * 0.16, 0.72, 1.675), 0.01, DK))
for s in (1, -1):
    body.append(sphere(f'faro{s}', 0.13, P(s * 0.69, 0.74, 1.62), LA, scale=(1, 0.5, 0.85)))
    body.append(torus(f'aro_faro{s}', 0.13, 0.025, P(s * 0.69, 0.74, 1.64), CH, rot=(math.pi / 2, 0, 0)))
    body.append(rbox(f'piloto{s}', S(0.18, 0.12, 0.04), P(s * 0.62, 0.7, -1.69), 0.03, RL))
# guardabarros
for (x, z) in [(0.86, 0.95), (-0.86, 0.95), (0.86, -0.95), (-0.86, -0.95)]:
    body.append(torus(f'guarda{x}{z}', 0.52, 0.1, P(x, 0.45, z), OR, arc=180, rot=(math.pi / 2, 0, -math.pi / 2 if x > 0 else math.pi / 2)))
# escape, baliza base, torreta
body.append(cyl('escape', 0.07, 0.85, P(0.64, 1.92, 0.08), CH))
body.append(cyl('escape_tapa', 0.085, 0.05, P(0.64, 2.36, 0.08), GR))
body.append(cyl('baliza_base', 0.16, 0.2, P(0, 2.19, 0.75), GR, rad2=0.13))
body.append(cyl('torreta', 0.33, 0.26, P(0, 1.41, -0.55), GR, rad2=0.28, bevel=0.03))
# mejillas
for s in (1, -1):
    body.append(sphere(f'mejilla{s}', 0.5, P(s * 0.62, 1.1, 1.41), CK, scale=(0.27, 0.06, 0.17)))
# 'B' en relieve en las puertas
for sgn in (1, -1):
    body.append(cyl(f'disco_b{sgn}', 0.24, 0.03, P(sgn * 0.835, 1.15, 0.78), YE, verts=40, rot=(0, math.pi / 2, 0), bevel=0.01))
    bpy.ops.object.text_add(location=P(sgn * 0.855, 1.15, 0.78))
    tx = bpy.context.object; tx.data.body = 'B'; tx.data.extrude = 0.02; tx.data.size = 0.34; tx.data.align_x = 'CENTER'; tx.data.align_y = 'CENTER'
    tx.rotation_euler = (math.pi / 2, 0, math.pi / 2 if sgn > 0 else -math.pi / 2)
    bpy.ops.object.convert(target='MESH'); tx.data.materials.clear(); tx.data.materials.append(mat('letra', '#ffffff', 0.3, coat=0.6))
    body.append(tx)
b = join(body, 'cuerpo'); b.parent = root

glass = [rbox('parabrisas', S(1.36, 0.66, 0.08), P(0, 1.7, 1.4), 0.07, GL)]
for s in (1, -1):
    glass.append(rbox(f'vent{s}', S(0.06, 0.5, 0.78), P(s * 0.815, 1.74, 0.8), 0.04, GL))
g = join(glass, 'cristales'); g.parent = root

bz = sphere('baliza', 0.14, P(0, 2.28, 0.75), BE, scale=(1, 1, 0.75)); bz.parent = root

# ruedas (pivote en el centro)
for nm, (x, z) in {'ruedaFL': (0.85, 0.95), 'ruedaFR': (-0.85, 0.95), 'ruedaRL': (0.85, -0.95), 'ruedaRR': (-0.85, -0.95)}.items():
    e = empty(nm, P(x, 0.43, z), root)
    t = cyl(nm + '_neu', 0.43, 0.36, (0, 0, 0), TI, parent=e, verts=48, rot=(0, math.pi / 2, 0), bevel=0.06)
    for k, o in enumerate((-0.11, 0, 0.11)):
        torus(f'{nm}_dib{k}', 0.43, 0.03, (o, 0, 0), TI2, parent=e, seg=48, rseg=6, rot=(0, math.pi / 2, 0))
    sg = 1 if x > 0 else -1
    cyl(nm + '_llanta', 0.26, 0.05, (sg * 0.17, 0, 0), YE, parent=e, verts=32, rot=(0, math.pi / 2, 0), bevel=0.02)
    cyl(nm + '_buje', 0.09, 0.06, (sg * 0.2, 0, 0), CH, parent=e, verts=20, rot=(0, math.pi / 2, 0), bevel=0.02)
    for i in range(5):
        a = i / 5 * 2 * math.pi
        cyl(f'{nm}_tuerca{i}', 0.03, 0.04, (sg * 0.2, math.cos(a) * 0.16, math.sin(a) * 0.16), CH, parent=e, verts=6, rot=(0, math.pi / 2, 0))

# brazo de grúa (pivote en lo alto de la torreta; rota en X)
arm = empty('brazo', P(0, 1.55, -0.55), root)
rbox('brazo_viga', S(0.26, 0.26, 1.6), P(0, 0, -0.75), 0.09, YE, parent=arm)
for i in range(4):
    rbox(f'brazo_rombo{i}', S(0.27, 0.12, 0.12), P(0, 0, -0.25 - i * 0.35), 0.03, mat('amarillo_osc', '#e0a810', 0.35), parent=arm)
cyl('polea', 0.1, 0.3, P(0, 0, -1.55), GR, parent=arm, rot=(0, math.pi / 2, 0), bevel=0.02)
hook = empty('gancho', P(0, 1.55 + 1.5 * math.sin(math.radians(35)), -0.55 - 1.5 * math.cos(math.radians(35))), root)
cyl('cable', 0.02, 0.7, P(0, -0.35, 0), mat('cable', '#3d4352', 0.6), parent=hook, verts=8)
torus('gancho_g', 0.12, 0.04, P(0, -0.82, 0), CH, parent=hook, arc=260, rot=(0, math.pi / 2, math.radians(140)))
cyl('gancho_tope', 0.05, 0.1, P(0, -0.66, 0), GR, parent=hook, verts=12)

# ojos (pivote en el centro de cada ojo)
for nm, s in (('ojoL', 1), ('ojoR', -1)):
    e = empty(nm, P(s * 0.34, 1.7, 1.47), root)
    sphere(nm + '_blanco', 0.28, (0, 0, 0), WH, parent=e, scale=(1, 0.5, 1.12))
    ir = empty(nm + '_mirada', P(0, 0, 0.1), e)
    sphere(nm + '_iris', 0.15, (0, 0, 0), IR, parent=ir, scale=(1, 0.45, 1))
    sphere(nm + '_pupila', 0.09, P(0, 0, 0.03), PU, parent=ir, scale=(1, 0.45, 1))
    sphere(nm + '_brillo', 0.05, P(0.055, 0.06, 0.07), mat('brillo', '#ffffff', 0.0, emit='#ffffff', emit_k=1.5), parent=ir)
    sphere(nm + '_brillo2', 0.025, P(-0.05, -0.05, 0.07), mat('brillo', '#ffffff', 0.0, emit='#ffffff', emit_k=1.5), parent=ir)
    torus(nm + '_cerrado', 0.17, 0.038, P(0, 0.02, 0.06), BR, arc=180, rot=(math.pi / 2, 0, math.pi))
    # ceja con forma (curva)
    cb = empty(nm.replace('ojo', 'ceja'), P(s * 0.34, 2.06, 1.53), root)
    torus(nm + '_ceja_g', 0.36, 0.06, P(0, -0.31, 0), BR, parent=cb, arc=70, seg=18, rseg=10, rot=(math.pi / 2, 0, math.radians(55)))

# bocas (cada forma es un objeto; three muestra una)
mo = empty('boca', P(0, 1.08, 1.43), root)
torus('boca_sonrisa', 0.22, 0.05, (0, 0, 0), LI, parent=mo, arc=180, rot=(math.pi / 2, 0, math.pi))
ab = empty('boca_abierta', (0, 0, 0), mo)
sphere('boca_hueco', 0.5, P(0, -0.02, 0), MO, parent=ab, scale=(0.25, 0.04, 0.17))
sphere('boca_lengua', 0.5, P(0, -0.1, 0.01), TO, parent=ab, scale=(0.12, 0.03, 0.05))
sphere('boca_dientes', 0.5, P(0, 0.07, 0.01), WH, parent=ab, scale=(0.16, 0.025, 0.03))
torus('boca_o', 0.1, 0.045, (0, 0, 0), LI, parent=mo, rot=(math.pi / 2, 0, 0))
torus('boca_plana', 0.4, 0.045, P(0, -0.36, 0), LI, parent=mo, arc=36, seg=10, rot=(math.pi / 2, 0, math.radians(72)))

meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if '--noao' not in sys.argv:
    bake_ao([o for o in meshes if o.name in ('cuerpo',)], samples=64)
export('/home/claude/pueblo-brum/public/models/bruno.glb')
print('OK bruno', len(meshes))
