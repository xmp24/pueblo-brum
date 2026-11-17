import bpy, sys, math
from mathutils import Vector
a=sys.argv[sys.argv.index('--')+1:]
glb,out,names=a[0],a[1],a[2].split(',')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
sc=bpy.context.scene
for o in [o for o in sc.objects if o.parent is None and o.name not in names]:
    for c in [o]+list(o.children_recursive): bpy.data.objects.remove(c, do_unlink=True)
roots=[o for o in sc.objects if o.parent is None]
for i,r in enumerate(roots): r.location.x += i*7.5
bpy.context.view_layer.update()
mn=Vector((1e9,)*3); mx=Vector((-1e9,)*3)
for o in sc.objects:
    if o.type!='MESH': continue
    for v in o.bound_box:
        w=o.matrix_world@Vector(v); mn=Vector(map(min,mn,w)); mx=Vector(map(max,mx,w))
ctr=(mn+mx)/2; size=(mx-mn).length
cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera=cam
cam.location=ctr+Vector((size*0.35,-size*0.8,size*0.3)); cam.rotation_euler=(ctr-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.lens=40
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(0.6,0.7,0.85,1)
sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN')); sc.collection.objects.link(sun); sun.rotation_euler=(math.radians(50),0,math.radians(30)); sun.data.energy=3
bpy.ops.mesh.primitive_plane_add(size=300)
sc.render.engine='CYCLES'; sc.cycles.samples=16; sc.cycles.use_denoising=True
sc.render.resolution_x,sc.render.resolution_y=1400,600; sc.render.filepath=out; sc.view_settings.view_transform='AgX'
bpy.ops.render.render(write_still=True)
