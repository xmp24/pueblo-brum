"""Librería de modelado de Pueblo Brum (Blender 5.x, bpy).
Formas con biseles reales, materiales de plástico juguete, AO horneado a color de vértice y exportación GLB."""
import bpy, bmesh, math
from mathutils import Vector, Matrix

MATS = {}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'


def hexc(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    # sRGB -> lineal
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1.0,)


def mat(name, color, rough=0.4, metal=0.0, coat=0.0, emit=None, emit_k=0.0, alpha=1.0, transmission=0.0):
    key = (name, color, rough, metal, coat, emit, emit_k, alpha)
    if key in MATS:
        return MATS[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = hexc(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = 0.15
    if emit:
        b.inputs['Emission Color'].default_value = hexc(emit)
        b.inputs['Emission Strength'].default_value = emit_k
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else None
    if transmission:
        b.inputs['Transmission Weight'].default_value = transmission
    MATS[key] = m
    return m


def _link(ob, parent=None):
    bpy.context.scene.collection.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    return ob


def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    return _link(e, parent)


def _finish(ob, m, smooth=True, angle=40):
    if m is not None:
        ob.data.materials.append(m)
    if smooth:
        for p in ob.data.polygons:
            p.use_smooth = True
        try:
            mod = ob.modifiers.new('ws', 'WEIGHTED_NORMAL')
            mod.keep_sharp = True
        except Exception:
            pass
    return ob


def apply_mods(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    bpy.data.meshes.remove(old)


SEG_HI = False


def rbox(name, size, loc=(0, 0, 0), r=0.1, m=None, parent=None, seg=None, rot=(0, 0, 0)):
    """Caja redondeada con bisel real. size=(x,y,z) en metros (Z arriba)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    bm.to_mesh(me); bm.free()
    ob = _link(bpy.data.objects.new(name, me), parent)
    ob.location = loc; ob.rotation_euler = rot
    if seg is None:
        seg = 5 if SEG_HI else (1 if r <= 0.035 else 2 if r <= 0.07 else 3 if r <= 0.16 else 4)
    if r > 0:
        bv = ob.modifiers.new('bv', 'BEVEL')
        bv.width = min(r, min(size) * 0.49); bv.segments = seg; bv.limit_method = 'NONE'
        apply_mods(ob)
    return _finish(ob, m)


def cyl(name, rad, depth, loc=(0, 0, 0), m=None, parent=None, verts=40, rot=(0, 0, 0), bevel=0.0, rad2=None):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts, radius1=rad, radius2=rad if rad2 is None else rad2, depth=depth)
    bm.to_mesh(me); bm.free()
    ob = _link(bpy.data.objects.new(name, me), parent)
    ob.location = loc; ob.rotation_euler = rot
    if bevel > 0:
        bv = ob.modifiers.new('bv', 'BEVEL'); bv.width = bevel; bv.segments = 4; bv.limit_method = 'ANGLE'
        apply_mods(ob)
    return _finish(ob, m)


def sphere(name, rad, loc=(0, 0, 0), m=None, parent=None, scale=(1, 1, 1), seg=32, rings=16):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=rad)
    bm.to_mesh(me); bm.free()
    ob = _link(bpy.data.objects.new(name, me), parent)
    ob.location = loc; ob.scale = scale
    return _finish(ob, m)


def torus(name, R, r, loc=(0, 0, 0), m=None, parent=None, arc=360, seg=40, rseg=12, rot=(0, 0, 0)):
    """Toro (o arco de toro) en el plano XY."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    n = seg + (0 if arc >= 360 else 1)
    rings = []
    for i in range(n):
        a = math.radians(arc) * i / seg
        c = Vector((math.cos(a) * R, math.sin(a) * R, 0))
        d = Vector((math.cos(a), math.sin(a), 0))
        ring = []
        for j in range(rseg):
            b = 2 * math.pi * j / rseg
            ring.append(bm.verts.new(c + d * (r * math.cos(b)) + Vector((0, 0, r * math.sin(b)))))
        rings.append(ring)
    for i in range(len(rings) - (0 if arc >= 360 else 1)):
        a, b = rings[i], rings[(i + 1) % len(rings)]
        for j in range(rseg):
            bm.faces.new((a[j], a[(j + 1) % rseg], b[(j + 1) % rseg], b[j]))
    if arc < 360:
        bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bm.to_mesh(me); bm.free()
    ob = _link(bpy.data.objects.new(name, me), parent)
    ob.location = loc; ob.rotation_euler = rot
    return _finish(ob, m)


def prism_roof(name, w, d, h, loc, m, parent=None, overhang=0.25, thick=0.12):
    """Tejado a dos aguas (cumbrera a lo largo de X) con alero y grosor."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    W, D = w / 2 + overhang, d / 2 + overhang
    pts = [(-W, -D, 0), (W, -D, 0), (W, D, 0), (-W, D, 0), (-W, 0, h), (W, 0, h)]
    v = [bm.verts.new(p) for p in pts]
    for f in [(0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)]:
        bm.faces.new([v[i] for i in f])
    bm.to_mesh(me); bm.free()
    ob = _link(bpy.data.objects.new(name, me), parent)
    ob.location = loc
    s = ob.modifiers.new('sol', 'SOLIDIFY'); s.thickness = thick
    bv = ob.modifiers.new('bv', 'BEVEL'); bv.width = 0.04; bv.segments = 2; bv.limit_method = 'ANGLE'
    apply_mods(ob)
    return _finish(ob, m, smooth=False)


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    objs[0].name = name
    return objs[0]


def bake_ao(objs, samples=48, lo=0.42):
    """Hornea oclusión ambiental a un atributo de color por vértice (multiplica el color en three.js)."""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.render.bake.target = 'VERTEX_COLORS'
    if not any(o.name == '__ground' for o in sc.objects):
        g = rbox('__ground', (400, 400, 0.2), (0, 0, -0.1), r=0)
    for o in objs:
        if o.type != 'MESH' or o.name.startswith('__'):
            continue
        me = o.data
        for a in list(me.color_attributes):
            me.color_attributes.remove(a)
        ca = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
        me.color_attributes.active_color = ca
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True); bpy.context.view_layer.objects.active = o
        try:
            bpy.ops.object.bake(type='AO')
        except Exception as e:
            print('bake fallo', o.name, e); continue
        # reescala: lo..1
        for d in ca.data:
            c = d.color
            k = lo + (1 - lo) * c[0]
            d.color = (k, k, k, 1)
    g = sc.objects.get('__ground')
    if g:
        bpy.data.objects.remove(g, do_unlink=True)


def export(path, root_names=None):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True,
                              export_vertex_color='ACTIVE', export_extras=False, export_cameras=False, export_lights=False)
