import bpy, sys, math
from mathutils import Vector
SAL = sys.argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/tmp/ui_kit/hombre.glb')
sc = bpy.context.scene
VER = {'piel', 'orejas', 'pies', 'ojo_l', 'ojo_r', 'iris_l', 'iris_r', 'cejas', 'pelo', 'barba_corta', 'capa_tunica', 'capa_tunica_falda',
       'capa_tunica_mangas', 'capa_calzas', 'cinturon_tunica'}
def mat(nombre, col, rug=.7, ruido=0.0, esc=200, sss=0.0):
    m = bpy.data.materials.new(nombre); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = col + (1,); b.inputs['Roughness'].default_value = rug
    if sss and 'Subsurface Weight' in b.inputs: b.inputs['Subsurface Weight'].default_value = sss; b.inputs['Subsurface Radius'].default_value = (1, .4, .25)
    if ruido:
        n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = esc; n.inputs['Detail'].default_value = 8
        bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = ruido
        nt.links.new(n.outputs['Fac'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m
PIEL = mat('piel', (.55, .33, .23), .55, .05, 80, .15)
COL = {'piel': PIEL, 'orejas': PIEL, 'pies': PIEL, 'ojo_l': mat('o', (.8, .78, .74), .2), 'ojo_r': mat('o2', (.8, .78, .74), .2),
       'iris_l': mat('i', (.12, .08, .04), .2), 'iris_r': mat('i2', (.12, .08, .04), .2), 'cejas': mat('c', (.05, .03, .02), .8),
       'pelo': mat('pe', (.05, .03, .018), .6, .4, 400), 'barba_corta': mat('b', (.06, .035, .02), .7, .4, 400), 'vello': mat('v', (.06, .035, .02), .8),
       'capa_tunica': mat('t', (.10, .16, .28), .9, .35, 260), 'capa_tunica_falda': mat('tf', (.10, .16, .28), .9, .35, 260),
       'capa_tunica_mangas': mat('tm', (.10, .16, .28), .9, .35, 260), 'capa_calzas': mat('ca', (.07, .05, .035), .9, .3, 260),
       'cinturon_tunica': mat('ci', (.09, .045, .02), .5, .2, 120)}
for o in bpy.data.objects:
    if o.type == 'MESH':
        base = o.name.replace('hombre_', '', 1)
        o.hide_render = base not in VER
        A = ((.16, .3, .62), .9, 1.25); P = ((.72, .4, .27), .75, .82); TINTE = {'capa_tunica': A, 'capa_tunica_falda': A, 'capa_tunica_mangas': A, 'capa_calzas': ((.3, .2, .12), .5, .9), 'piel': P, 'orejas': P, 'pies': P}
        if base in TINTE:
            for m in o.data.materials:
                nt = m.node_tree; bsdf = nt.nodes.get('Principled BSDF')
                lk = [l for l in nt.links if l.to_socket == bsdf.inputs['Base Color']]
                col, fac, val = TINTE[base]
                mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'COLOR'; mx.inputs['Factor'].default_value = fac
                mx.inputs['B'].default_value = col + (1,)
                if lk: nt.links.new(lk[0].from_socket, mx.inputs['A']); nt.links.remove(lk[0])
                else: mx.inputs['A'].default_value = tuple(bsdf.inputs['Base Color'].default_value)
                hv = nt.nodes.new('ShaderNodeHueSaturation'); hv.inputs['Value'].default_value = val
                nt.links.new(mx.outputs['Result'], hv.inputs['Color']); nt.links.new(hv.outputs['Color'], bsdf.inputs['Base Color'])
    if o.name == 'Icosphere': o.hide_render = True
arm = bpy.data.objects['hombre']
if arm.animation_data is None: arm.animation_data_create()
arm.animation_data.action = bpy.data.actions['Idle_Loop']
sc.frame_set(10)
# encuadre: el cuerpo entero
vis = [o for o in bpy.data.objects if o.type == 'MESH' and not o.hide_render]
dg = bpy.context.evaluated_depsgraph_get()
pts = []
for o in vis:
    e = o.evaluated_get(dg); me = e.to_mesh()
    pts += [e.matrix_world @ v.co for i, v in enumerate(me.vertices) if i % 7 == 0]
    e.to_mesh_clear()
mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))); mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
c = (mn + mx) / 2; alto = mx.z - mn.z
print('caja', mn, mx)
cam = bpy.data.cameras.new('c'); cam.lens = 85
co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
d = alto * 2.85
# el GLB mira a +Y o -Y: probamos con la cara hacia la cámara en -Y
co.location = c + Vector((d * .25, -d, alto * .08))
co.rotation_euler = (c + Vector((0, 0, -alto * .02)) - co.location).to_track_quat('-Z', 'Y').to_euler()
def luz(n, loc, e, tam, col):
    l = bpy.data.lights.new(n, 'AREA'); l.energy = e; l.size = tam; l.color = col
    o = bpy.data.objects.new(n, l); o.location = c + Vector(loc); sc.collection.objects.link(o)
    o.rotation_euler = (c - o.location).to_track_quat('-Z', 'Y').to_euler()
luz('clave', (-1.6, -2.2, 1.4), 170, 1.6, (1, .9, .78))
luz('relleno', (2.2, -2.0, .2), 60, 2.5, (.75, .85, 1))
luz('canto', (.8, 2.4, 1.2), 300, 1.2, (1, .85, .6))
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[1].default_value = .15
sc.render.engine = 'CYCLES'; sc.cycles.samples = 64; sc.cycles.use_denoising = True
sc.render.film_transparent = True; sc.view_settings.view_transform = 'AgX'
sc.render.resolution_x = 360; sc.render.resolution_y = 720
sc.render.filepath = SAL
bpy.ops.render.render(write_still=True); print('hecho')
