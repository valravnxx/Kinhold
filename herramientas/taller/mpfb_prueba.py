# Prueba del taller propio: crea tres humanos con MakeHuman (MPFB2) dentro de Blender sin pantalla y los fotografía.
# Requisitos: pip install bpy --break-system-packages; clonar github.com/makehumancommunity/mpfb2 y enlazar src/mpfb en
# ~/.config/blender/5.2/extensions/user_default/mpfb. Sin los paquetes de MakeHuman (ojos, pieles, pelo) salen en arcilla.
# Uso: python3 herramientas/taller/mpfb_prueba.py
import bpy, addon_utils, importlib, math, os
addon_utils.enable('bl_ext.user_default.mpfb', default_set=True)
M = 'bl_ext.user_default.mpfb.'
HS = importlib.import_module(M+'services.humanservice').HumanService
TS = importlib.import_module(M+'services.targetservice').TargetService
HOP = importlib.import_module(M+'entities.objectproperties').HumanObjectProperties
ES = importlib.import_module(M+'services.exportservice').ExportService
OS_ = importlib.import_module(M+'services.objectservice').ObjectService
LS = importlib.import_module(M+'services.locationservice').LocationService
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
troot = LS.get_mpfb_data('targets')
def humano(x, macros, objetivos):
    h = HS.create_human()
    for k, v in macros.items(): HOP.set_value(k, v, entity_reference=h)
    TS.reapply_macro_details(h)
    for ruta, w in objetivos: TS.load_target(h, os.path.join(troot, ruta), weight=w)
    HS.add_builtin_rig(h, 'game_engine')
    raiz = ES.create_character_copy(h, name_suffix='_x')
    b = OS_.find_object_of_type_amongst_nearest_relatives(raiz, 'Basemesh')
    ES.bake_modifiers_remove_helpers(b, bake_masks=True, bake_subdiv=True, remove_helpers=True, also_proxy=True)
    # borra el original
    rig_o = h.parent
    for o in [h, rig_o]:
        if o: bpy.data.objects.remove(o)
    raiz.location.x = x
    tri = sum(len(p.vertices) - 2 for p in b.data.polygons)
    print('personaje', macros, 'triángulos', tri)
    return raiz, b
gente = [
  humano(-1.0, {'gender': 1.0, 'age': 0.55, 'muscle': 0.65, 'weight': 0.55, 'height': 0.5}, [('nose/nose-hump-incr.target.gz', 0.6), ('chin/chin-prominent-incr.target.gz', 0.3)]),
  humano(0.0, {'gender': 0.0, 'age': 0.45, 'muscle': 0.5, 'weight': 0.45, 'height': 0.4}, []),
  humano(1.0, {'gender': 1.0, 'age': 0.9, 'muscle': 0.4, 'weight': 0.6, 'height': 0.45}, [('nose/nose-scale-vert-incr.target.gz', 0.5)]),
]
# luz y cámara para ver el resultado (render sin tarjeta gráfica)
esc = bpy.context.scene
esc.render.engine = 'BLENDER_WORKBENCH'
esc.display.shading.light = 'STUDIO'; esc.display.shading.color_type = 'MATERIAL'
esc.display.shading.show_cavity = True
esc.render.resolution_x, esc.render.resolution_y = 1200, 900
mat = bpy.data.materials.new('arcilla'); mat.diffuse_color = (0.78, 0.62, 0.52, 1)
for raiz, b in gente:
    b.data.materials.clear(); b.data.materials.append(mat)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); esc.collection.objects.link(cam); esc.camera = cam
def foto(pos, mira, lente, ruta):
    cam.location = pos; cam.data.lens = lente
    d = (mira[0]-pos[0], mira[1]-pos[1], mira[2]-pos[2])
    import mathutils
    cam.rotation_euler = mathutils.Vector(d).to_track_quat('-Z', 'Y').to_euler()
    esc.render.filepath = ruta; bpy.ops.render.render(write_still=True)
foto((0, -6.5, 1.1), (0, 0, 0.9), 50, '/tmp/claude-0/mh/cuerpos.png')
foto((-1.0, -1.1, 1.62), (-1.0, 0, 1.58), 85, '/tmp/claude-0/mh/cara1.png')
foto((0.0, -1.1, 1.52), (0.0, 0, 1.48), 85, '/tmp/claude-0/mh/cara2.png')
foto((1.0, -1.1, 1.58), (1.0, 0, 1.54), 85, '/tmp/claude-0/mh/cara3.png')
