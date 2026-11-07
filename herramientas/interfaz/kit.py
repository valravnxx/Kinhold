# Kit de interfaz de Kinhold renderizado en Blender (Cycles, sin pantalla): cuero, roble, latón y hierro de verdad.
# Uso: python3 kit.py <carpeta_salida> [pieza ...]
import bpy, bmesh, math, os, sys, addon_utils
from mathutils import Vector

SAL = sys.argv[1] if len(sys.argv) > 1 else '/tmp/ui_kit/out'
SOLO = set(sys.argv[2:])
os.makedirs(SAL, exist_ok=True)
addon_utils.enable('io_curve_svg', default_set=True)

def limpiar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    try: sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception: pass
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    w = bpy.data.worlds.new('m'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.32, 0.3, 0.28, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.08
    return sc

def camara(sc, lado, px):
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = lado
    o = bpy.data.objects.new('c', cam); o.location = (0, 0, 10); sc.collection.objects.link(o); sc.camera = o
    sc.render.resolution_x = px[0]; sc.render.resolution_y = px[1]; sc.render.resolution_percentage = 100
    if px[0] != px[1]: cam.sensor_fit = 'HORIZONTAL'

def luces(sc, fuerza=1.0):
    # la luz de la interfaz: de arriba a la izquierda (convención: lo que sobresale tiene brillo arriba y sombra abajo)
    def area(nombre, loc, e, tam, col=(1, .96, .9)):
        l = bpy.data.lights.new(nombre, 'AREA'); l.energy = e * fuerza; l.size = tam; l.color = col
        o = bpy.data.objects.new(nombre, l); o.location = loc; sc.collection.objects.link(o)
        d = Vector((0, 0, 0)) - Vector(loc); o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    area('clave', (-4, 5, 7), 900, 4)
    area('relleno', (5, -3, 6), 180, 6, (.85, .9, 1))
    area('canto', (0, -6, 2.5), 160, 3, (1, .9, .75))

def nodos(nombre):
    m = bpy.data.materials.new(nombre); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    return m, nt, b

def ruido(nt, escala, detalle=6, rug=.6, dist=0.0):
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = escala
    n.inputs['Detail'].default_value = detalle; n.inputs['Roughness'].default_value = rug
    if 'Distortion' in n.inputs: n.inputs['Distortion'].default_value = dist
    return n

def rampa(nt, colores):
    r = nt.nodes.new('ShaderNodeValToRGB'); e = r.color_ramp
    e.elements[0].position = colores[0][0]; e.elements[0].color = colores[0][1]
    e.elements[1].position = colores[-1][0]; e.elements[1].color = colores[-1][1]
    for p, c in colores[1:-1]:
        x = e.elements.new(p); x.color = c
    return r

def bump(nt, entrada, fuerza, dist=.02):
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = fuerza
    bp.inputs['Distance'].default_value = dist
    nt.links.new(entrada, bp.inputs['Height']); return bp

def mat_laton(viejo=0.5, nombre='laton'):
    m, nt, b = nodos(nombre)
    n = ruido(nt, 18, 8, .65)
    r = rampa(nt, [(0, (.42, .29, .12, 1)), (.5, (.78, .58, .30, 1)), (1, (.93, .77, .47, 1))])
    nt.links.new(n.outputs['Fac'], r.inputs[0]); nt.links.new(r.outputs[0], b.inputs['Base Color'])
    b.inputs['Metallic'].default_value = 1.0
    rr = rampa(nt, [(0, (.22, .22, .22, 1)), (1, (.22 + .3 * viejo, .22 + .3 * viejo, .22 + .3 * viejo, 1))])
    n2 = ruido(nt, 60, 4, .5); nt.links.new(n2.outputs['Fac'], rr.inputs[0]); nt.links.new(rr.outputs[0], b.inputs['Roughness'])
    nt.links.new(bump(nt, n2.outputs['Fac'], .08).outputs[0], b.inputs['Normal'])
    return m

def mat_hierro():
    m, nt, b = nodos('hierro')
    n = ruido(nt, 9, 8, .7)
    r = rampa(nt, [(0, (.05, .05, .05, 1)), (.55, (.16, .15, .14, 1)), (1, (.30, .27, .24, 1))])
    nt.links.new(n.outputs['Fac'], r.inputs[0]); nt.links.new(r.outputs[0], b.inputs['Base Color'])
    b.inputs['Metallic'].default_value = .85; b.inputs['Roughness'].default_value = .55
    v = nt.nodes.new('ShaderNodeTexVoronoi'); v.inputs['Scale'].default_value = 25
    nt.links.new(bump(nt, v.outputs['Distance'], .25).outputs[0], b.inputs['Normal'])
    return m

def mat_cuero(c0=(.018, .008, .004), c1=(.075, .032, .013), nombre='cuero'):
    m, nt, b = nodos(nombre)
    v = nt.nodes.new('ShaderNodeTexVoronoi'); v.inputs['Scale'].default_value = 140
    n = ruido(nt, 6, 6, .6)
    r = rampa(nt, [(0, c0 + (1,)), (1, c1 + (1,))])
    nt.links.new(n.outputs['Fac'], r.inputs[0]); nt.links.new(r.outputs[0], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = .62
    if 'Specular IOR Level' in b.inputs: b.inputs['Specular IOR Level'].default_value = .25
    if 'Sheen Weight' in b.inputs: b.inputs['Sheen Weight'].default_value = .15
    mx = nt.nodes.new('ShaderNodeMath'); mx.operation = 'ADD'
    nt.links.new(v.outputs['Distance'], mx.inputs[0]); nt.links.new(n.outputs['Fac'], mx.inputs[1])
    nt.links.new(bump(nt, mx.outputs[0], .35, .01).outputs[0], b.inputs['Normal'])
    return m

def mat_roble(oscuro=1.0, escala=1.0):
    m, nt, b = nodos('roble')
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.0 * escala, 9.0 * escala, 1)
    if escala == 1.2: mp.inputs['Scale'].default_value = (.35, 2.6, 1)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    w = nt.nodes.new('ShaderNodeTexWave'); w.wave_type = 'BANDS'; w.bands_direction = 'Y'
    w.inputs['Scale'].default_value = 1.6; w.inputs['Distortion'].default_value = 9; w.inputs['Detail'].default_value = 6
    w.inputs['Detail Scale'].default_value = 1.4
    nt.links.new(mp.outputs[0], w.inputs['Vector'])
    n = ruido(nt, 40, 6, .6); nt.links.new(mp.outputs[0], n.inputs['Vector'])
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'FLOAT'; mx.inputs['Factor'].default_value = .12
    nt.links.new(w.outputs['Fac'], mx.inputs['A']); nt.links.new(n.outputs['Fac'], mx.inputs['B'])
    k = oscuro
    r = rampa(nt, [(0, (.018 * k, .009 * k, .004 * k, 1)), (.45, (.05 * k, .026 * k, .011 * k, 1)), (.7, (.085 * k, .047 * k, .02 * k, 1)), (1, (.13 * k, .075 * k, .033 * k, 1))])
    nt.links.new(mx.outputs['Result'], r.inputs[0]); nt.links.new(r.outputs[0], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = .7
    if 'Specular IOR Level' in b.inputs: b.inputs['Specular IOR Level'].default_value = .25
    nt.links.new(bump(nt, mx.outputs['Result'], .3).outputs[0], b.inputs['Normal'])
    return m

def mat_esmalte(c=(.06, .045, .03)):
    m, nt, b = nodos('fondo'); b.inputs['Base Color'].default_value = c + (1,); b.inputs['Roughness'].default_value = .45
    n = ruido(nt, 30, 5, .6); nt.links.new(bump(nt, n.outputs['Fac'], .1).outputs[0], b.inputs['Normal'])
    return m

def con(o, m):
    o.data.materials.clear(); o.data.materials.append(m); return o

def suave(o, n=2):
    s = o.modifiers.new('s', 'SUBSURF'); s.levels = n; s.render_levels = n
    for p in o.data.polygons: p.use_smooth = True
    return o

def toro(R, r, z=0, m=None, seg=96):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=seg, minor_segments=24, location=(0, 0, z))
    o = bpy.context.object
    for p in o.data.polygons: p.use_smooth = True
    return con(o, m) if m else o

def cilindro(r, h, z=0, m=None, seg=96, bisel=.02):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=seg, location=(0, 0, z))
    o = bpy.context.object
    bv = o.modifiers.new('b', 'BEVEL'); bv.width = bisel; bv.segments = 4; bv.limit_method = 'ANGLE'
    for p in o.data.polygons: p.use_smooth = True
    return con(o, m) if m else o

def caja(sx, sy, sz, loc=(0, 0, 0), m=None, bisel=.03, seg=4):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.object; o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    bv = o.modifiers.new('b', 'BEVEL'); bv.width = bisel; bv.segments = seg; bv.limit_method = 'ANGLE'
    return con(o, m) if m else o

def remache(x, y, z, r=.05, m=None):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(x, y, z), segments=24, ring_count=12)
    o = bpy.context.object; o.scale.z = .55
    for p in o.data.polygons: p.use_smooth = True
    return con(o, m) if m else o

def render(sc, nombre):
    sc.render.filepath = os.path.join(SAL, nombre + '.png')
    bpy.ops.render.render(write_still=True)
    print('hecho', nombre)

# ---------------- piezas ----------------
def p_boton(pulsado=False):
    sc = limpiar(); camara(sc, 2.2, (256, 256)); luces(sc, .8 if pulsado else 1)
    lat, cu = mat_laton(.4), mat_cuero()
    toro(.93, .085, 0, lat)                      # el aro de latón
    toro(.80, .03, .02, lat)                     # el filete de dentro
    bpy.ops.mesh.primitive_uv_sphere_add(radius=.80, segments=64, ring_count=32, location=(0, 0, -.03 if pulsado else 0))
    d = bpy.context.object; d.scale.z = .12 if pulsado else .2
    for p in d.data.polygons: p.use_smooth = True
    con(d, cu)
    cilindro(1.0, .05, -.12, mat_hierro(), bisel=.02)   # la base de hierro que asoma
    render(sc, 'boton_pulsado' if pulsado else 'boton')

def p_accion():
    sc = limpiar(); camara(sc, 2.4, (320, 320)); luces(sc)
    lat, hi, cu = mat_laton(.5), mat_hierro(), mat_cuero()
    cilindro(1.1, .1, -.08, hi, bisel=.04)
    toro(1.02, .07, 0, hi)
    for i in range(10):
        a = i / 10 * math.tau; remache(math.cos(a) * 1.02, math.sin(a) * 1.02, .07, .05, lat)
    toro(.88, .07, .02, lat)
    cilindro(.84, .1, 0, cu, bisel=.05)
    render(sc, 'accion')

def p_medallon():
    sc = limpiar(); camara(sc, 2.2, (192, 192)); luces(sc)
    lat = mat_laton(.45)
    toro(.95, .07, 0, lat)
    cilindro(.92, .04, -.06, mat_esmalte((.035, .025, .018)), bisel=.01)   # la ranura oscura del arco
    toro(.66, .045, 0, lat)
    cilindro(.64, .08, -.01, mat_cuero((.014, .007, .004), (.06, .028, .012)), bisel=.03)
    render(sc, 'medallon')

def p_hueco():
    sc = limpiar(); camara(sc, 2.2, (256, 256)); luces(sc)
    lat = mat_laton(.5)
    # marco de latón fino y la placa de cuero hundida
    for (sx, sy, x, y) in [(2.0, .07, 0, .965), (2.0, .07, 0, -.965), (.07, 2.0, .965, 0), (.07, 2.0, -.965, 0)]:
        caja(sx, sy, .08, (x, y, 0), lat, .025)
    caja(1.93, 1.93, .06, (0, 0, -.05), mat_cuero((.012, .007, .004), (.05, .025, .012)), .02)
    for x in (-.88, .88):
        for y in (-.88, .88): remache(x, y, .04, .035, lat)
    render(sc, 'hueco')

def p_marco():
    # marco de tablero para 9 trozos: cantos de roble y esquinas de hierro con clavos; el centro, transparente
    sc = limpiar(); camara(sc, 4.0, (512, 512)); luces(sc)
    rob, hi, lat = mat_roble(1.1, 2.5), mat_hierro(), mat_laton(.5)
    a = .46   # ancho del canto
    caja(4, a, .14, (0, 2 - a / 2, 0), rob, .03); caja(4, a, .14, (0, -2 + a / 2, 0), rob, .03)
    o = caja(a, 4 - 2 * a, .14, (2 - a / 2, 0, 0), rob, .03); o.rotation_euler.z = 0
    caja(a, 4 - 2 * a, .14, (-2 + a / 2, 0, 0), rob, .03)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * (2 - .3), sy * (2 - .3)
            ex, ey = sx * (2 - .23), sy * (2 - .23)
            caja(.72, .3, .05, (ex - sx * .21, ey, .095), hi, .015)
            caja(.3, .42, .05, (ex, ey - sy * .36, .095), hi, .015)
            for (dx, dy) in [(-.4, 0), (0, 0), (0, -.4)]:
                remache(ex + sx * dx, ey + sy * dy, .13, .04, lat)
    render(sc, 'marco')

def p_tablero():
    sc = limpiar(); camara(sc, 4, (768, 768)); luces(sc, .9)
    rob = mat_roble(1.5, 1.2)
    for i in range(8):   # ocho tablas a lo ancho, con su junta fina
        caja(4.2, .485, .1, (0, -1.75 + i * .5, 0), rob, .012)
    render(sc, 'tablero')

def p_cuero():
    sc = limpiar(); camara(sc, 2, (512, 512)); luces(sc, .9)
    caja(2.2, 2.2, .05, (0, 0, 0), mat_cuero(), .0)
    render(sc, 'cuero')

def p_correa():
    # una correa de cuero cosida, para pestañas y tiras (9 trozos a lo ancho)
    sc = limpiar(); camara(sc, 4, (512, 128)); luces(sc)
    cu = mat_cuero((.03, .014, .006), (.1, .05, .022))
    caja(3.9, .9, .1, (0, 0, 0), cu, .08, 6)
    lat = mat_laton(.4)
    for x in (-1.75, 1.75): remache(x, 0, .07, .07, lat)
    hilo = mat_esmalte((.42, .33, .2))
    for y in (.33, -.33):
        for i in range(30):
            caja(.07, .022, .015, (-1.6 + i * .11, y, .055), hilo, .005, 1)
    render(sc, 'correa')

# glifos de latón repujado a partir de las siluetas
GLIFOS = {
  'menu': '<rect x="3" y="5" width="18" height="2.8" rx="1.4"/><rect x="3" y="10.6" width="18" height="2.8" rx="1.4"/><rect x="3" y="16.2" width="18" height="2.8" rx="1.4"/>',
  'hablar': '<path d="M4 3.5h16a2 2 0 012 2v9a2 2 0 01-2 2h-8l-5.5 4.2v-4.2H4a2 2 0 01-2-2v-9a2 2 0 012-2z"/>',
  'equipo': '<path d="M9 2.5h6l-1.2 3.2c3.6 1.3 6.7 4.6 6.7 9.3 0 4.2-3.4 6.5-8.5 6.5S3.5 19.2 3.5 15c0-4.7 3.1-8 6.7-9.3z"/>',
  'fabricar': '<path d="M13 2.8l7.2 7.2-2.6 2.6-2-2-8.8 8.8a1.8 1.8 0 01-2.6-2.6l8.8-8.8-2.6-2.6z"/>',
  'construir': '<path d="M12 2.5l10 8.2h-2.8V21h-4.7v-6.2h-5V21H4.8V10.7H2z"/>',
  'mapa': '<path d="M2.5 5.5l6.3-2.3 6.4 2.3 6.3-2.3v15.3l-6.3 2.3-6.4-2.3-6.3 2.3z"/>',
  'hambre': '<path d="M2 13.5C2 9 6.5 6 12 6s10 3 10 7.5c0 2.2-1.4 3.5-3.6 3.5H5.6C3.4 17 2 15.7 2 13.5z"/>',
  'sed': '<path d="M12 2.5c3.3 4.4 6.6 8.2 6.6 12a6.6 6.6 0 01-13.2 0c0-3.8 3.3-7.6 6.6-12z"/>',
  'calor': '<path d="M12 2c1 4.5 6.3 6.6 6.3 12.3a6.3 6.3 0 01-12.6 0c0-3.3 2-5.4 3.2-7.4.2 2.2 1.2 3.4 2.3 3.6-.3-3-.2-5.6.8-8.5z"/>',
  'frio': '<path d="M11 2h2v20h-2z"/><path d="M2 11h20v2H2z"/><path d="M4.6 5.9L6 4.5 19.4 17.9 18 19.3z"/><path d="M18 4.5l1.4 1.4L6 19.3l-1.4-1.4z"/>',
  'cansancio': '<path d="M14 2.5A9.5 9.5 0 1021.5 15 7.6 7.6 0 0114 2.5z"/>',
  'herida': '<path d="M12 3c2.8 3.8 5.5 7 5.5 10.2a5.5 5.5 0 01-11 0C6.5 10 9.2 6.8 12 3z"/>',
  'guardia': '<path d="M12 2.5l8 3v5.8c0 5.3-3.4 9-8 10.7-4.6-1.7-8-5.4-8-10.7V5.5z"/>',
  'girar': '<path d="M12 4a8 8 0 017.7 5.8l1.8-1v6l-5.2-3 1.6-.9A5.5 5.5 0 1017.5 15l2.3 1A8 8 0 1112 4z"/>',
  'deshacer': '<path d="M9 4.5L3 10l6 5.5V12c4.5 0 7.5 1.5 9.5 6 0-6-3-10-9.5-10.5z"/>',
  'cerrar': '<path d="M5 7.5L7.5 5 12 9.5 16.5 5 19 7.5 14.5 12l4.5 4.5-2.5 2.5-4.5-4.5L7.5 19 5 16.5 9.5 12z"/>',
  'mojon': '<path d="M8 22V8.5L12 3l4 5.5V22z"/><path d="M5 22h14v-1.5H5z"/>',
  'quitar': '<path d="M3.5 18.5l9-9 2 2-9 9z"/><path d="M12 3l9 9-3 1-7-7z"/>',
  'colocar': '<path d="M4 12.5l2.4-2.4 3.6 3.6 7.6-7.6 2.4 2.4L10 18.5z"/>',
  'soltar': '<path d="M10.3 2.5h3.4v8.2h4.1L12 17 6.2 10.7h4.1z"/><rect x="3.5" y="18.6" width="17" height="2.9" rx="1.4"/>',
  'amanos': '<path d="M10.3 2.5h3.4v6.2h3.6L12 14 6.7 8.7h3.6z"/><path d="M3 13.5h3a6 6 0 0012 0h3a9 9 0 01-18 0z"/>',
  'alhombro': '<path d="M10.3 21.5h3.4v-8.2h4.1L12 7l-5.8 6.3h4.1z"/><rect x="3.5" y="2.5" width="17" height="2.9" rx="1.4"/>',
}

def p_glifo(n, tono='laton'):
    # repujado: una lámina de latón con la silueta (máscara) y su relieve (altura con el bisel redondeado), con luz de verdad
    sc = limpiar(); camara(sc, 1.0, (128, 128)); luces(sc, 1.1)
    # un cielo de taller: claro arriba (en la pantalla) y oscuro abajo, para que el bisel del metal brille arriba
    wn = sc.world.node_tree; bg = wn.nodes['Background']
    tcw = wn.nodes.new('ShaderNodeTexCoord'); sx = wn.nodes.new('ShaderNodeSeparateXYZ')
    wn.links.new(tcw.outputs['Generated'], sx.inputs[0])
    mp = wn.nodes.new('ShaderNodeMapRange'); mp.inputs['From Min'].default_value = -1; mp.inputs['From Max'].default_value = 1
    wn.links.new(sx.outputs['Y'], mp.inputs['Value'])
    rw = wn.nodes.new('ShaderNodeValToRGB'); e = rw.color_ramp
    e.elements[0].position = .35; e.elements[0].color = (.02, .015, .01, 1); e.elements[1].position = .8; e.elements[1].color = (1.4, 1.25, 1.0, 1)
    wn.links.new(mp.outputs['Result'], rw.inputs[0]); wn.links.new(rw.outputs[0], bg.inputs[0]); bg.inputs[1].default_value = 1.0
    bpy.ops.mesh.primitive_plane_add(size=1.0); o = bpy.context.object
    sub = o.modifiers.new('s', 'SUBSURF'); sub.subdivision_type = 'SIMPLE'; sub.levels = sub.render_levels = 8
    tx = bpy.data.textures.new('alt', 'IMAGE'); tx.image = bpy.data.images.load(f'/tmp/ui_kit/mask/alt_{n}.png'); tx.extension = 'CLIP'
    tx.image.colorspace_settings.name = 'Non-Color'
    dp = o.modifiers.new('d', 'DISPLACE'); dp.texture = tx; dp.texture_coords = 'UV'; dp.mid_level = 0; dp.strength = .035
    for p in o.data.polygons: p.use_smooth = True
    m = mat_laton(.15, 'g') if tono == 'laton' else mat_hueso()
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    im = nt.nodes.new('ShaderNodeTexImage'); im.image = bpy.data.images.load(f'/tmp/ui_kit/mask/alt_{n}.png')
    im.image.colorspace_settings.name = 'Non-Color'; im.interpolation = 'Cubic'
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.0; bp.inputs['Distance'].default_value = .1
    nt.links.new(im.outputs['Color'], bp.inputs['Height'])
    viejo = [l for l in nt.links if l.to_socket == b.inputs['Normal']]
    if viejo:
        nb = viejo[0].from_node; nt.links.remove(viejo[0])
        nt.links.new(bp.outputs['Normal'], nb.inputs['Normal']) if 'Normal' in nb.inputs else None
        nt.links.new(nb.outputs[0], b.inputs['Normal'])
    else: nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    nt.links.new(im.outputs['Alpha'], b.inputs['Alpha'])
    con(o, m)
    render(sc, ('g_' if tono == 'laton' else 'h_') + n)

def mat_hueso():
    m, nt, b = nodos('hueso'); b.inputs['Base Color'].default_value = (.86, .80, .66, 1); b.inputs['Roughness'].default_value = .5
    n = ruido(nt, 50, 5, .6); nt.links.new(bump(nt, n.outputs['Fac'], .15).outputs[0], b.inputs['Normal'])
    return m

PIEZAS = {'boton': p_boton, 'boton_pulsado': lambda: p_boton(True), 'accion': p_accion, 'medallon': p_medallon, 'hueco': p_hueco,
          'marco': p_marco, 'tablero': p_tablero, 'cuero': p_cuero, 'correa': p_correa}
for k, f in PIEZAS.items():
    if not SOLO or k in SOLO: f()
for n in GLIFOS:
    if not SOLO or ('g_' + n) in SOLO or 'glifos' in SOLO: p_glifo(n)
