"""Hoja de revisión: importa un GLB, reparte cada raíz en una rejilla y renderiza con Cycles.
python3 sheet.py in.glb out.png [cols] [gap]"""
import bpy, sys, math
from mathutils import Vector
a = sys.argv[1:]
glb, out = a[0], a[1]
cols = int(a[2]) if len(a) > 2 else 5
gap = float(a[3]) if len(a) > 3 else 6
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
sc = bpy.context.scene
roots = [o for o in sc.objects if o.parent is None]
def bbox(o):
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for c in [o] + list(o.children_recursive):
        if c.type != 'MESH': continue
        for v in c.bound_box:
            w = c.matrix_world @ Vector(v); mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
    return mn, mx
bpy.context.view_layer.update()
sizes = [bbox(r) for r in roots]
cell = max(max(mx.x - mn.x, mx.y - mn.y) for mn, mx in sizes) + gap
for i, r in enumerate(roots):
    r.location.x += (i % cols) * cell
    r.location.y -= (i // cols) * cell
bpy.context.view_layer.update()
mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
for r in roots:
    a_, b_ = bbox(r); mn = Vector(map(min, mn, a_)); mx = Vector(map(max, mx, b_))
ctr = (mn + mx) / 2; size = (mx - mn).length
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.location = ctr + Vector((size * 0.35, -size * 0.75, size * 0.55))
cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = 40
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.75, 0.85, 1, 1)
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), 0, math.radians(30)); sun.data.energy = 3.5; sun.data.angle = 0.2
bpy.ops.mesh.primitive_plane_add(size=2000, location=(ctr.x, ctr.y, 0))
sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 1400, 900; sc.render.filepath = out
sc.view_settings.view_transform = 'AgX'
bpy.ops.render.render(write_still=True)
print('OK', len(roots), [r.name for r in roots])
