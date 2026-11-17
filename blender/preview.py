import bpy, sys, math
from mathutils import Vector
glb, out = sys.argv[sys.argv.index('--')+1:sys.argv.index('--')+3]
yaw = float(sys.argv[sys.argv.index('--')+3]) if len(sys.argv) > sys.argv.index('--')+3 else 35
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
sc = bpy.context.scene
objs = [o for o in sc.objects if o.type == 'MESH']
mn = Vector((1e9,)*3); mx = Vector((-1e9,)*3)
for o in objs:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c); mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
ctr = (mn+mx)/2; size = (mx-mn).length
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
a = math.radians(yaw)
cam.location = ctr + Vector((math.sin(a)*size*1.1, -math.cos(a)*size*1.1, size*0.45))
d = ctr - cam.location; cam.rotation_euler = d.to_track_quat('-Z','Y').to_euler(); cam.data.lens = 50
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.75,0.85,1,1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun','SUN')); sc.collection.objects.link(sun); sun.rotation_euler = (math.radians(50),0,math.radians(30)); sun.data.energy = 3.5; sun.data.angle = 0.2
bpy.ops.mesh.primitive_plane_add(size=200)
sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.device='CPU'; sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 800, 600; sc.render.filepath = out
sc.view_settings.view_transform = 'AgX'
bpy.ops.render.render(write_still=True)
