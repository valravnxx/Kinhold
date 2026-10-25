# Taller propio, prueba 2: vestir y acabar por código un humano de MakeHuman (MPFB2), sin paquetes de recursos.
# El cuerpo sale de MakeHuman (CC0); lo que se hace por código es la ropa y el acabado, a partir de las
# «mallas auxiliares» que trae la propia base de MakeHuman (ojos, falda y malla ceñida):
#   - piel pintada en textura (tono, rojeces, labios, cejas, sombra de barba) calculada punto a punto;
#   - ojos con iris y pupila; pestañas;
#   - pelo corto, barba y cofia como «cáscaras» sobre la piel, con el borde recortado en la textura (transparencia),
#     para que la línea del pelo y de la barba salga suave y no en escalones de polígonos;
#   - túnica (malla ceñida del torso y los brazos + falda hasta la rodilla), calzas, zapatos y cinturón; vestido largo.
# Cada pieza es un trozo de la malla de MakeHuman, así que hereda los pesos de los huesos: se mueve con el
# esqueleto «game_engine» sin pintar pesos a mano. Se quita la piel que tapa la ropa (menos triángulos).
# Las texturas se pintan rasterizando cada triángulo en su mapa UV: para cada píxel se sabe su punto 3D
# (y si es labio, oreja, uña…), y el color sale de funciones de ese punto. La misma técnica sirve luego para heridas.
# Resultado: un .glb por personaje, sus texturas y fotos de prueba (Cycles en CPU).
# Uso: python3 herramientas/taller/vestir_mpfb.py <carpeta de salida>      (FOTOS=pocas: solo cuerpos y caras)
import bpy, bmesh, addon_utils, importlib, math, os, sys
import numpy as np
from mathutils import Vector

SALIDA = sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith('.py') else '/tmp/claude-0/mh/vestir'
os.makedirs(SALIDA, exist_ok=True)
addon_utils.enable('bl_ext.user_default.mpfb', default_set=True)
M = 'bl_ext.user_default.mpfb.'
HS = importlib.import_module(M + 'services.humanservice').HumanService
TS = importlib.import_module(M + 'services.targetservice').TargetService
HOP = importlib.import_module(M + 'entities.objectproperties').HumanObjectProperties
LS = importlib.import_module(M + 'services.locationservice').LocationService
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
TROOT = LS.get_mpfb_data('targets')
DIEZMAR = float(os.environ.get('DIEZMAR', '0.5'))  # proporción de triángulos que se quedan en piel y cáscaras

def lin(c):  # color sRGB (0-255) a lineal
    return np.array([((x / 255) ** 2.2) for x in c])

# ---------- ruido y utilidades numéricas ----------
def ruido(P, escala):
    """ruido de valor 3D en [0,1]; escala puede ser número o vector (ruido estirado, para pelos)"""
    Q = P * np.asarray(escala)
    i = np.floor(Q).astype(np.int64); f = Q - i; f = f * f * (3 - 2 * f)
    def h(dx, dy, dz):
        n = (i[..., 0] + dx) * 73856093 ^ (i[..., 1] + dy) * 19349663 ^ (i[..., 2] + dz) * 83492791
        n = (n ^ (n >> 13)) * 1274126177
        return ((n ^ (n >> 16)) & 0xffff) / 65535.0
    r = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (f[..., 0] if dx else 1 - f[..., 0]) * (f[..., 1] if dy else 1 - f[..., 1]) * (f[..., 2] if dz else 1 - f[..., 2])
                r = r + w * h(dx, dy, dz)
    return r
def fbm(P, escala, oct=3):
    r, a, t = 0, 1, 0
    for k in range(oct):
        r = r + a * ruido(P, np.asarray(escala) * 2 ** k); t += a; a *= 0.5
    return r / t
def suave(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def rasterizar(ob, res, attrs):
    """para cada píxel del mapa UV: punto 3D y atributos interpolados (attrs: matriz por vértice original)"""
    me = ob.data; me.calc_loop_triangles()
    nl = len(me.loops); uv = np.zeros(nl * 2); me.uv_layers['UVMap'].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2) * res
    nv = len(me.vertices); pos = np.zeros(nv * 3); me.vertices.foreach_get('co', pos); pos = pos.reshape(-1, 3)
    orig = np.zeros(nv, dtype=np.int32); me.attributes['orig'].data.foreach_get('value', orig)
    datos = np.concatenate([pos, attrs[orig]], axis=1)
    k = datos.shape[1]
    img = np.zeros((res, res, k)); hay = np.zeros((res, res), bool)
    for t in me.loop_triangles:
        l = t.loops; a, b, c = uv[l[0]], uv[l[1]], uv[l[2]]
        x0, x1 = int(max(0, np.floor(min(a[0], b[0], c[0])))), int(min(res - 1, np.ceil(max(a[0], b[0], c[0]))))
        y0, y1 = int(max(0, np.floor(min(a[1], b[1], c[1])))), int(min(res - 1, np.ceil(max(a[1], b[1], c[1]))))
        if x1 < x0 or y1 < y0: continue
        X, Y = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(d) < 1e-12: continue
        w0 = ((b[1] - c[1]) * (X - c[0]) + (c[0] - b[0]) * (Y - c[1])) / d
        w1 = ((c[1] - a[1]) * (X - c[0]) + (a[0] - c[0]) * (Y - c[1])) / d
        w2 = 1 - w0 - w1
        dentro = (w0 > -0.02) & (w1 > -0.02) & (w2 > -0.02)
        if not dentro.any(): continue
        v = t.vertices
        val = w0[..., None] * datos[v[0]] + w1[..., None] * datos[v[1]] + w2[..., None] * datos[v[2]]
        sub = img[y0:y1 + 1, x0:x1 + 1]; sub[dentro] = val[dentro]
        hay[y0:y1 + 1, x0:x1 + 1] |= dentro
    return img, hay

def dilatar(rgba, hay, pasos=6):
    """estira el color fuera de las islas UV para que no se vean costuras al reducir la textura"""
    rgba = rgba.copy(); hay = hay.copy()
    for _ in range(pasos):
        suma = np.zeros_like(rgba); n = np.zeros(hay.shape)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            suma += np.roll(np.roll(rgba * hay[..., None], dy, 0), dx, 1); n += np.roll(np.roll(hay, dy, 0), dx, 1)
        nuevo = (~hay) & (n > 0)
        rgba[nuevo] = suma[nuevo] / n[nuevo][:, None]; hay |= nuevo
    return rgba

# ---------- materiales ----------
def material(nombre, rugosidad=0.8, sss=0.0, imagen=None, alfa=False, brillo=0.0):
    m = bpy.data.materials.new(nombre)
    nt = m.node_tree; p = nt.nodes['Principled BSDF']
    p.inputs['Roughness'].default_value = rugosidad
    if imagen is not None:
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = imagen
        nt.links.new(tx.outputs['Color'], p.inputs['Base Color'])
        if alfa: nt.links.new(tx.outputs['Alpha'], p.inputs['Alpha'])
    else:
        col = nt.nodes.new('ShaderNodeVertexColor'); col.layer_name = 'Col'
        nt.links.new(col.outputs['Color'], p.inputs['Base Color'])
    if sss:
        p.inputs['Subsurface Weight'].default_value = sss
        p.inputs['Subsurface Radius'].default_value = (1.0, 0.35, 0.2)
        p.inputs['Subsurface Scale'].default_value = 0.01
    if brillo: p.inputs['Coat Weight'].default_value = brillo
    return m

# ---------- trozos de la malla ----------
def trozo(base, nombre, quedarse, empuje=0.0, color=None, textura=None, rugosidad=0.85, sss=0.0, subdividir=0, diezmar=1.0, brillo=0.0, ajustar_uv=False, alisar=None, colgar=None):
    """copia de `base` con solo los vértices para los que quedarse(i, co) es cierto; la empuja por la normal.
    color(P, A) da el color por vértice; textura=(res, fn(P, A) → rgba) pinta una textura en su mapa UV"""
    ob = base.copy(); ob.data = base.data.copy(); ob.name = nombre
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.verts.ensure_lookup_table()
    capa = bm.verts.layers.int.new('orig')
    for v in bm.verts: v[capa] = v.index
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not quedarse(v.index, v.co)], context='VERTS')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    if subdividir: bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=subdividir, use_grid_fill=True, smooth=1.0)
    bm.normal_update()
    if empuje:
        e = empuje if callable(empuje) else (lambda co, i, _e=empuje: _e)
        nuevas = []
        for v in bm.verts:
            c = v.co.copy(); d = e(c, v[capa])  # e puede mover también el punto (c)
            nuevas.append((v, c + v.normal * d))
        for v, c in nuevas: v.co = c
    if colgar:  # la tela cae recta desde lo más saliente del pecho hasta el cinturón, sin meterse por debajo del pecho
        z_cinto, z_arriba, ancho = colgar
        delante = [v for v in bm.verts if v.co.y < -0.03 and abs(v.co.x) < ancho and z_cinto - 0.01 < v.co.z < z_arriba]
        columnas = {}
        for v in delante: columnas.setdefault(round(v.co.x / 0.012), []).append(v)
        for vs in columnas.values():
            apice = min(vs, key=lambda v: v.co.y)  # lo más adelantado (y negativo = delante)
            abajo = min(vs, key=lambda v: abs(v.co.z - z_cinto))
            if apice.co.z - abajo.co.z < 0.03: continue
            for v in vs:
                if abajo.co.z < v.co.z < apice.co.z:
                    t = (v.co.z - abajo.co.z) / (apice.co.z - abajo.co.z)
                    v.co.y = min(v.co.y, abajo.co.y * (1 - t) + apice.co.y * t)
    if alisar:  # la tela pasa por encima como una membrana: se suavizan esos puntos con sus vecinos
        cuales, veces = alisar[:2]
        holgura = alisar[2] if len(alisar) > 2 else None  # distancia mínima a la piel (la tela no se mete dentro)
        zona = [v for v in bm.verts if cuales(v.co, v[capa])]
        for _ in range(veces):
            nuevos = [sum((e.other_vert(v).co for e in v.link_edges), Vector()) / len(v.link_edges) for v in zona]
            for v, c in zip(zona, nuevos):
                if holgura:
                    sitio, normal, _, _ = CUERPO.find_nearest(c)
                    if sitio is not None and (c - sitio).dot(normal) < holgura: c = sitio + normal * holgura
                v.co = c
    bm.to_mesh(ob.data); bm.free()
    for p in ob.data.polygons: p.use_smooth = True
    me = ob.data
    nv = len(me.vertices); pos = np.zeros(nv * 3); me.vertices.foreach_get('co', pos); pos = pos.reshape(-1, 3)
    orig = np.zeros(nv, dtype=np.int32); me.attributes['orig'].data.foreach_get('value', orig)
    me.materials.clear()
    if ajustar_uv:  # las mallas auxiliares ocupan un rincón del mapa UV: se estira su trozo para que use toda la textura
        uv = np.zeros(len(me.loops) * 2); me.uv_layers['UVMap'].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
        lo, hi = uv.min(0), uv.max(0); uv = 0.01 + 0.98 * (uv - lo) / (hi - lo)
        me.uv_layers['UVMap'].data.foreach_set('uv', uv.ravel())
    if textura:
        res, fn = textura
        img, hay = rasterizar(ob, res, ATR)
        rgba = dilatar(fn(img[..., :3], img[..., 3:]), hay)
        im = bpy.data.images.new(nombre, res, res, alpha=True)
        rgba = np.clip(rgba, 0, 1); rgba[..., :3] = rgba[..., :3] ** (1 / 2.2)  # la imagen se guarda en sRGB
        im.pixels.foreach_set(rgba.astype(np.float32).ravel())
        im.filepath_raw = os.path.join(SALIDA, nombre + '.png'); im.file_format = 'PNG'; im.save()
        me.materials.append(material(nombre, rugosidad, sss, im, alfa=rgba[..., 3].min() < 0.99, brillo=brillo))
    else:
        c = color(pos, ATR[orig])
        capa = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        capa.data.foreach_set('color', np.concatenate([c, np.ones((nv, 1))], 1).astype(np.float32).ravel())
        me.materials.append(material(nombre, rugosidad, sss, brillo=brillo))
    me.attributes.remove(me.attributes['orig'])
    if diezmar < 1.0:
        d = ob.modifiers.new('Diezmar', 'DECIMATE'); d.ratio = diezmar
        with bpy.context.temp_override(object=ob, active_object=ob):
            bpy.ops.object.modifier_apply(modifier='Diezmar')
    mod = ob.modifiers.new('Armature', 'ARMATURE'); mod.object = RIG
    ob.parent = RIG
    return ob

def cinturon(nombre, telas, z, color, alto=0.034, grueso=0.005, n=64):
    """tira de cuero que rodea la cintura por encima de la ropa: se mide el contorno lanzando rayos desde dentro;
    cada vértice copia los pesos del punto de tela más cercano"""
    from mathutils.bvhtree import BVHTree
    from mathutils.kdtree import KDTree
    arboles = [BVHTree.FromObject(t, bpy.context.evaluated_depsgraph_get()) for t in telas]
    cerca = [v.co for v in telas[0].data.vertices if abs(v.co.z - z) < 0.04]
    centro = sum(cerca, Vector()) / len(cerca); centro.z = z
    radio = []
    for k in range(n):
        a = 2 * math.pi * k / n; d = Vector((math.cos(a), math.sin(a), 0))
        r = max([(h[0] - centro).length for t in arboles for h in [t.ray_cast(centro, d)] if h[0] is not None] or [0.15])
        radio.append(r)
    radio = [(radio[k - 1] + 2 * radio[k] + radio[(k + 1) % n]) / 4 for k in range(n)]  # sin picos
    anillos = [(-alto / 2, 0.0), (-alto / 2, grueso), (alto / 2, grueso), (alto / 2, 0.0)]
    vs, caras = [], []
    for k in range(n):
        a = 2 * math.pi * k / n
        for dz, dr in anillos:
            r = radio[k] + 0.002 + dr
            vs.append((centro.x + r * math.cos(a), centro.y + r * math.sin(a), z + dz))
    for k in range(n):
        for j in range(4):
            a0, a1 = k * 4 + j, k * 4 + (j + 1) % 4
            b0, b1 = ((k + 1) % n) * 4 + j, ((k + 1) % n) * 4 + (j + 1) % 4
            caras.append((a0, b0, b1, a1))
    me = bpy.data.meshes.new(nombre); me.from_pydata(vs, [], caras); me.update()
    ob = bpy.data.objects.new(nombre, me); bpy.context.scene.collection.objects.link(ob)
    fuente = telas[0]; kd = KDTree(len(fuente.data.vertices))
    for v in fuente.data.vertices: kd.insert(v.co, v.index)
    kd.balance()
    for g in fuente.vertex_groups: ob.vertex_groups.new(name=g.name)
    for v in me.vertices:
        _, i, _ = kd.find(v.co)
        for g in fuente.data.vertices[i].groups: ob.vertex_groups[g.group].add([v.index], g.weight, 'REPLACE')
    capa = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for v in me.vertices: capa.data[v.index].color = (*(color * (0.9 + 0.2 * (v.index % 3 == 0))), 1)
    me.materials.append(material(nombre, 0.5))
    ob.modifiers.new('Armature', 'ARMATURE').object = RIG; ob.parent = RIG
    return ob

# ---------- un personaje ----------
def personaje(nombre, macros, objetivos, ropa):
    global RIG, ATR
    h = HS.create_human()
    for k, v in macros.items(): HOP.set_value(k, v, entity_reference=h)
    TS.reapply_macro_details(h)
    for ruta, w in objetivos: TS.load_target(h, os.path.join(TROOT, ruta), weight=w)
    HS.add_builtin_rig(h, 'game_engine')
    RIG = h.parent; RIG.name = nombre
    HUESOS = set(b.name for b in RIG.data.bones)
    pos = {b.name: (RIG.matrix_world @ b.head_local) for b in RIG.data.bones}
    # malla con la forma ya aplicada y con las auxiliares
    h.modifiers['Hide helpers'].show_viewport = False; h.modifiers['Armature'].show_viewport = False
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(h.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    base = bpy.data.objects.new(nombre + '_base', me)
    for g in h.vertex_groups: base.vertex_groups.new(name=g.name)
    bpy.data.objects.remove(h)
    # superficie de la piel, para que la ropa alisada no se meta dentro del cuerpo
    global CUERPO
    from mathutils.bvhtree import BVHTree
    bmc = bmesh.new(); bmc.from_mesh(me); grupo = base.vertex_groups['body'].index; deform = bmc.verts.layers.deform.active
    bmesh.ops.delete(bmc, geom=[v for v in bmc.verts if v[deform].get(grupo, 0) < 0.5], context='VERTS')
    CUERPO = BVHTree.FromBMesh(bmc); bmc.free()
    nombres = {g.index: g.name for g in base.vertex_groups}
    W = [{nombres[g.group]: g.weight for g in v.groups} for v in base.data.vertices]
    co = [v.co.copy() for v in base.data.vertices]
    en = lambda i, g, u=0.5: W[i].get(g, 0) > u
    def principal(i):
        m, pm = None, 0
        for n, p in W[i].items():
            if n in HUESOS and p > pm: m, pm = n, p
        return m
    PR = [principal(i) for i in range(len(co))]
    # atributos por vértice para pintar: labios, orejas, uñas
    ATR = np.array([[W[i].get('lips', 0), W[i].get('ears', 0), max(W[i].get('fingernails', 0), W[i].get('toenails', 0))] for i in range(len(co))])

    # puntos de referencia de la cabeza
    puntos = lambda g: np.array([tuple(co[i]) for i in range(len(co)) if en(i, g)])
    cuello_z = pos['neck_01'].z
    cintura_z = pos['spine_01'].z + 0.02
    rodilla_z = (pos['calf_l'].z + pos['calf_r'].z) / 2
    tobillo_z = (pos['foot_l'].z + pos['foot_r'].z) / 2
    muneca = [np.array(pos['hand_l']), np.array(pos['hand_r'])]
    labios = puntos('lips'); boca_z = labios[:, 2].mean()
    ojos = {s: puntos(f'helper-{s}-eye') for s in 'lr'}
    ojo_c = {s: ojos[s].mean(0) for s in 'lr'}
    ojo_arriba = max(ojos['l'][:, 2].max(), ojos['r'][:, 2].max())
    orejas = puntos('ears'); oreja_arriba = orejas[:, 2].max(); oreja_medio = orejas[:, 2].mean()
    oreja_delante = orejas[:, 1].min()
    # medio ancho del cráneo a la altura de las orejas (sin contarlas): ahí se aplastan bajo la cofia
    craneo = [abs(co[i].x) for i in range(len(co)) if PR[i] == 'head' and en(i, 'body') and W[i].get('ears', 0) < 0.01
              and orejas[:, 2].min() < co[i].z < oreja_arriba and orejas[:, 1].min() < co[i].y < orejas[:, 1].max()]
    from mathutils.kdtree import KDTree
    sin_oreja = [i for i in range(len(co)) if PR[i] == 'head' and en(i, 'body') and W[i].get('ears', 0) == 0]
    kd_craneo = KDTree(len(sin_oreja))
    for k, i in enumerate(sin_oreja): kd_craneo.insert(co[i], k)
    kd_craneo.balance()
    cara = [co[i] for i in range(len(co)) if PR[i] == 'head' and en(i, 'body') and abs(co[i].x) < 0.008]
    nariz = min(cara, key=lambda c: c.y)
    mujer = macros['gender'] < 0.5
    cerca_muneca = lambda c, r: min(np.linalg.norm(np.array(c) - m) for m in muneca) < r
    MANO = ('hand', 'index', 'middle', 'ring', 'pinky', 'thumb')
    mano = lambda i: PR[i] is not None and PR[i].startswith(MANO)
    cabeza = lambda i: PR[i] in ('head', 'neck_01') and en(i, 'body')

    # ---- zonas (funciones de punto 3D, vectorizadas) ----
    def zona_cejas(P):
        x, y, z = np.abs(P[..., 0]), P[..., 1], P[..., 2]
        u = np.clip((x - 0.012) / 0.05, 0, 1)
        zb = ojo_arriba + 0.011 + 0.006 * np.sin(np.pi * np.clip(u * 1.1, 0, 1)) - 0.004 * u
        grosor = (0.0036 if mujer else 0.0048) * (1 - 0.55 * u)
        m = suave(grosor, grosor * 0.35, np.abs(z - zb + 0.0015 * (ruido(P, 300) - 0.5)))
        m *= suave(0.008, 0.015, x) * suave(0.064, 0.054, x) * suave(-0.085, -0.10, y)
        pelos = ruido(P, (90, 90, 1400))
        return m * (0.45 + 0.55 * pelos)
    def zona_pelo(P):
        x, y, z = np.abs(P[..., 0]), P[..., 1], P[..., 2]
        t = suave(-0.10, -0.03, y)
        zf = ojo_arriba + 0.047 + 0.012 * np.clip(x / 0.06, 0, 1) ** 2
        zl = zf * (1 - t) + (boca_z - 0.012) * t
        borde = 0.004 * (fbm(P, 120) - 0.5)
        return suave(-0.003, 0.003, z - zl + borde)
    def zona_barba(P, A):
        """barba corta pintada: bordes difusos y con pelillos; el bigote baja por las comisuras y se une a la barba"""
        x, y, z = np.abs(P[..., 0]), P[..., 1], P[..., 2]
        t = suave(-0.14, -0.06, y)
        zc = (boca_z + 0.012) * (1 - t) + (oreja_medio - 0.004) * t  # línea de la mejilla, en diagonal
        centro = suave(0.044, 0.026, x) * suave(-0.10, -0.12, y)  # bajo el labio
        zc = zc * (1 - centro) + (boca_z - 0.008 + 0.3 * x * x * 10) * centro
        borde = 0.009 * (fbm(P, 70) - 0.5) + 0.003 * (ruido(P, 400) - 0.5)
        arriba = suave(-0.006, 0.006, zc - z + borde)
        abajo = suave(-0.012, 0.01, z - (cuello_z + 0.03) + borde)  # en el cuello se va aclarando, sin corte
        m = arriba * abajo * (0.9 + 0.1 * suave(boca_z, boca_z - 0.04, z))  # más poblada en la barbilla
        frente = suave(-0.11, -0.125, y)
        bigote = suave(0.034, 0.026, x) * suave(-0.003, 0.002, z - (boca_z + 0.004)) * suave(0.003, -0.002, z - (boca_z + 0.016 - 0.1 * x * x * 10)) * frente
        comisura = suave(0.019, 0.025, x) * suave(0.038, 0.031, x) * suave(-0.004, 0.002, z - (boca_z - 0.014)) * suave(0.004, -0.002, z - (boca_z + 0.012)) * suave(-0.10, -0.115, y)
        m = np.maximum(m, 0.85 * np.maximum(bigote, comisura))
        m *= suave(-0.01, -0.03, y) * (1 - suave(0.1, 0.35, A[..., 1])) * (1 - suave(0.3, 0.6, A[..., 0]))
        return m
    def zona_cofia(P):
        x, y, z = P[..., 0], P[..., 1], P[..., 2]
        arriba, abajo = ojo_arriba + 0.032, boca_z - 0.048
        zc, hz, hx = (arriba + abajo) / 2, (arriba - abajo) / 2, 0.064
        e = (x / hx) ** 2 + ((z - zc) / hz) ** 2
        return 1 - (1 - suave(0.94, 1.0, e)) * suave(-0.055, -0.08, y)  # hueco de la cara (por delante de las orejas)

    def mechones(P, color):
        n = 0.5 * ruido(P, (420, 60, 420)) + 0.5 * ruido(P, (420, 420, 70))
        return color[None, None, :] * (0.7 + 0.55 * n[..., None]) * (0.9 + 0.2 * fbm(P, 30)[..., None])

    tono, colpelo, iris = lin(ropa['piel']), lin(ropa['pelo']), lin(ropa['ojos'])
    def gauss(P, c, r): return np.exp(-np.sum((P - np.asarray(c)) ** 2, -1) / (r * r))
    def pintar_piel(P, A):
        col = tono[None, None, :] * (0.93 + 0.12 * fbm(P, 45)[..., None])
        rojo = np.zeros(P.shape[:2])
        for s in (-1, 1):
            rojo += 0.7 * gauss(P, (s * 0.045, nariz.y + 0.05, boca_z + 0.035), 0.022)
        rojo += 0.6 * gauss(P, (0, nariz.y, nariz.z), 0.012) + 0.6 * suave(0.2, 0.7, A[..., 1])
        rojizo = tono * np.array([1.0, 0.82, 0.8])
        col = col * (1 - 0.45 * rojo[..., None]) + rojizo * 0.45 * rojo[..., None]
        for s in 'lr':  # párpados y ojeras algo más oscuros y rosados
            o = gauss(P, ojo_c[s] + np.array([0, -0.004, 0]), 0.018)
            col *= (1 - 0.1 * o[..., None] * np.array([0.8, 1.0, 1.0]))
        lab = suave(0.45, 0.85, A[..., 0])[..., None]  # solo el labio, sin comerse la piel de alrededor
        col = col * (1 - lab) + (tono * np.array([0.86, 0.66, 0.64]))[None, None, :] * lab
        un = suave(0.2, 0.6, A[..., 2])[..., None]
        col = col * (1 - 0.5 * un) + np.array([0.7, 0.6, 0.56]) * 0.5 * un
        for s in 'lr':  # línea de las pestañas en el borde de los párpados
            d = np.linalg.norm((P - ojo_c[s]) * np.array([1, 1, 1.6]), axis=-1)
            col *= (1 - 0.55 * (suave(0.0125, 0.0145, d) * suave(0.0175, 0.0150, d) * (P[..., 1] < ojo_c[s][1] - 0.004))[..., None])
        ceja = zona_cejas(P)[..., None]
        col = col * (1 - 0.85 * ceja) + colpelo * 0.85 * ceja
        if ropa.get('barba'):  # barba pintada en la piel (Pedro: la cáscara dejaba mal la barbilla), con pelillos
            b = zona_barba(P, A)[..., None]
            pelillos = 0.7 + 0.45 * ruido(P, (900, 900, 500))[..., None]
            col = col * (1 - 0.92 * b) + colpelo * pelillos * 0.92 * b
        if not ropa.get('cofia'):
            p = zona_pelo(P)[..., None] * (1 - suave(0.1, 0.35, A[..., 1]))[..., None]
            col = col * (1 - 0.7 * p) + colpelo * 0.7 * p
        return np.concatenate([col, np.ones(P.shape[:2] + (1,))], -1)

    # --- piel: solo lo que se ve (cabeza, cuello, manos y un poco de muñeca) ---
    visible = lambda i, c: en(i, 'body') and not (ropa.get('cofia') and en(i, 'ears', 0.3)) and (PR[i] in ('head', 'neck_01') or mano(i) or cerca_muneca(c, 0.07) or c.z > cuello_z - (0.05 if c.y < -0.03 else 0.02))  # el escote baja por delante
    piezas = [trozo(base, nombre + '_piel', visible, textura=(2048, pintar_piel), rugosidad=0.62, sss=0.2, diezmar=DIEZMAR)]

    # --- ojos y pestañas (color por vértice: el ojo tiene muy poco sitio en el mapa UV) ---
    for s in 'lr':
        c0 = ojo_c[s]
        def color_ojo(P, A, c0=c0):
            d = P - c0; d /= np.linalg.norm(d, axis=1, keepdims=True); a = np.degrees(np.arccos(np.clip(-d[:, 1], -1, 1)))
            n = 0.75 + 0.25 * ruido(P, 900)
            col = np.where((a < 25)[:, None], iris[None, :] * n[:, None], np.array([0.70, 0.66, 0.62]))
            col = np.where((a < 11)[:, None], 0.02, col)
            return np.where(((a >= 22) & (a < 27))[:, None], iris * 0.4, col)
        piezas.append(trozo(base, f'{nombre}_ojo_{s}', lambda i, c, s=s: en(i, f'helper-{s}-eye'), color=color_ojo, rugosidad=0.1, subdividir=2, brillo=0.6))

    # --- pelo corto o cofia; barba ---
    if ropa.get('cofia'):
        lino = lin(ropa['cofia'])
        def pintar_cofia(P, A):
            col = lino[None, None, :] * (0.88 + 0.12 * fbm(P, 60)[..., None]) * (0.96 + 0.04 * ruido(P, 700)[..., None])
            borde = suave(-0.002, 0.002, P[..., 2] - (cuello_z + 0.006))  # bajo de la toca recto y limpio, sin dientes
            return np.concatenate([col, (zona_cofia(P) * borde)[..., None]], -1)
        cof = lambda i, c: cabeza(i) and c.z > cuello_z - 0.035
        def empuje(c, i):  # las orejas quedan aplastadas bajo el lino (si no, la cofia sale arrugada)
            if ATR[i, 1] > 0.0: c[:] = kd_craneo.find(c)[0]  # la oreja se pega al cráneo; luego se alisa como una membrana
            return 0.005 + 0.004 * max(0.0, c.y + 0.03) / 0.1
        oreja_c = [orejas[orejas[:, 0] * sg > 0].mean(0) for sg in (1, -1)]
        sobre_oreja = lambda c, i: min(np.linalg.norm(np.array(c) - o) for o in oreja_c) < 0.04
        piezas.append(trozo(base, nombre + '_cofia', cof, empuje=empuje, alisar=(sobre_oreja, 40), textura=(1024, pintar_cofia), rugosidad=0.9, diezmar=DIEZMAR))
    else:
        def pintar_pelo(P, A):
            a = zona_pelo(P) * (1 - suave(0.1, 0.35, A[..., 1]))
            return np.concatenate([mechones(P, colpelo), a[..., None]], -1)
        cab = lambda i, c: cabeza(i) and not en(i, 'ears', 0.3) and not (c.y < -0.09 and c.z < ojo_arriba + 0.035) and c.z > boca_z - 0.03
        empuje = lambda c, i: 0.003 + 0.007 * min(1.0, max(0.0, c.z - ojo_arriba) / 0.1)
        piezas.append(trozo(base, nombre + '_pelo', cab, empuje=empuje, textura=(1024, pintar_pelo), rugosidad=0.55, diezmar=DIEZMAR))

    # --- ropa: túnica (o vestido), calzas, zapatos, cinturón (color por vértice; el tejido se añade en el juego) ---
    def tela(c):
        c = lin(c); return lambda P, A: c[None, :] * (0.88 + 0.16 * fbm(P, 25)[:, None])
    # túnica: se coge de más y el escote y el final de las mangas se recortan en la textura (borde suave, sin escalones)
    arriba = lambda i, c: en(i, 'helper-tights') and cintura_z - 0.06 < c.z < cuello_z + 0.03 and not cerca_muneca(c, 0.015) and not mano(i)
    colt = lin(ropa['tunica'])
    def pintar_tunica(P, A):
        x, y, z = np.abs(P[..., 0]), P[..., 1], P[..., 2]
        corte = cuello_z - 0.004 - 0.02 * suave(-0.03, -0.09, y) * suave(0.075, 0.03, x)
        a = suave(0.0015, -0.0015, z - corte)
        d = np.minimum(*[np.linalg.norm(P - m, axis=-1) for m in muneca])
        a = a * suave(0.041, 0.045, d)
        col = colt[None, None, :] * (0.88 + 0.16 * fbm(P, 25)[..., None]) * (0.95 + 0.05 * ruido(P, 900)[..., None])
        return np.concatenate([col, a[..., None]], -1)
    # el tronco de la túnica se alisa como tela que cuelga de los hombros (si no, marca el pecho: Pedro, «el hombre tiene tetas»);
    # en el vestido de mujer, menos (va más ajustado)
    tronco = lambda c, i: abs(c.x) < 0.15 and cintura_z - 0.05 < c.z < cuello_z - 0.05
    tunica = trozo(base, nombre + '_tunica', arriba, empuje=lambda c, i: 0.012 if abs(c.x) < 0.17 else 0.007, textura=(1024, pintar_tunica),
                   rugosidad=0.95, ajustar_uv=True, colgar=None if mujer else (cintura_z, cuello_z - 0.03, 0.16), alisar=(tronco, 8 if mujer else 25, 0.008))
    piezas.append(tunica)
    largo = tobillo_z + 0.03 if ropa.get('vestido') else rodilla_z - 0.03
    falda = trozo(base, nombre + '_falda', lambda i, c: en(i, 'helper-skirt') and largo < c.z < cintura_z + 0.06,
                  empuje=0.012, color=tela(ropa['tunica']), rugosidad=0.95)
    piezas.append(falda)
    if not ropa.get('vestido'):
        piezas.append(trozo(base, nombre + '_calzas', lambda i, c: en(i, 'helper-tights') and tobillo_z + 0.03 < c.z < cintura_z + 0.02,
                            empuje=0.003, color=tela(ropa['calzas']), rugosidad=0.95))
    piezas.append(trozo(base, nombre + '_zapatos', lambda i, c: en(i, 'helper-tights') and c.z < tobillo_z + 0.05,
                        empuje=0.006, color=tela((52, 34, 22)), rugosidad=0.55))
    piezas.append(cinturon(nombre + '_cinturon', [tunica, falda], cintura_z, lin((40, 26, 17))))
    bpy.data.objects.remove(base)
    tri = 0
    for ob in piezas:
        n = sum(len(p.vertices) - 2 for p in ob.data.polygons); tri += n
        print(f'  {ob.name:28s} {n:6d} triángulos')
    print(nombre, 'TOTAL', tri, 'triángulos')
    return RIG, piezas, pos

# la base trae labios muy gruesos (medido: el volumen apenas cambia; lo que los afina es la altura y la profundidad)
LABIOS = [('mouth/mouth-lowerlip-volume-decr.target.gz', 1.0), ('mouth/mouth-upperlip-volume-decr.target.gz', 1.0),
          ('mouth/mouth-lowerlip-height-decr.target.gz', 1.5), ('mouth/mouth-upperlip-height-decr.target.gz', 1.3),
          ('mouth/mouth-scale-depth-decr.target.gz', 1.5), ('mouth/mouth-scale-horiz-decr.target.gz', 0.4),
          ('mouth/mouth-trans-backward.target.gz', 0.4)]
gente = [
    personaje('hombre', {'gender': 1.0, 'age': 0.55, 'muscle': 0.6, 'weight': 0.5, 'height': 0.5}, [('nose/nose-hump-incr.target.gz', 0.4)] + LABIOS,
              {'piel': (224, 180, 152), 'ojos': (92, 70, 48), 'pelo': (62, 44, 30), 'barba': True, 'tunica': (96, 72, 52), 'calzas': (70, 62, 54)}),
    personaje('mujer', {'gender': 0.0, 'age': 0.45, 'muscle': 0.45, 'weight': 0.45, 'height': 0.4}, LABIOS,
              {'piel': (230, 190, 165), 'ojos': (80, 96, 104), 'pelo': (60, 40, 28), 'cofia': (214, 204, 182), 'vestido': True, 'tunica': (70, 84, 98)}),
]

# ---------- exportar un .glb por personaje ----------
for rig, piezas, pos in gente:
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    for ob in piezas: ob.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=os.path.join(SALIDA, rig.name + '.glb'), export_format='GLB', use_selection=True,
                              export_skins=True, export_animations=False, export_vertex_color='ACTIVE', export_image_format='AUTO')
gente[0][0].location.x, gente[1][0].location.x = -0.55, 0.55

# ---------- fotos (Cycles en CPU) ----------
esc = bpy.context.scene
esc.render.engine = 'CYCLES'; esc.cycles.device = 'CPU'; esc.cycles.samples = 48; esc.cycles.use_denoising = True
esc.view_settings.view_transform = 'AgX'; esc.view_settings.look = 'AgX - Base Contrast'
mundo = bpy.data.worlds.new('mundo'); esc.world = mundo
mundo.node_tree.nodes['Background'].inputs['Color'].default_value = (0.32, 0.34, 0.36, 1)
mundo.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
sol = bpy.data.objects.new('sol', bpy.data.lights.new('sol', 'SUN')); esc.collection.objects.link(sol)
sol.data.energy = 3.2; sol.data.angle = math.radians(8); sol.rotation_euler = (math.radians(52), 0, math.radians(-35))
suelo = bpy.data.meshes.new('suelo'); suelo.from_pydata([(-5, -5, 0), (5, -5, 0), (5, 5, 0), (-5, 5, 0)], [], [(0, 1, 2, 3)])
so = bpy.data.objects.new('suelo', suelo); esc.collection.objects.link(so)
ms = bpy.data.materials.new('suelo'); ms.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*lin((110, 100, 82)), 1)
suelo.materials.append(ms)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); esc.collection.objects.link(cam); esc.camera = cam
def foto(posc, mira, lente, ruta, ancho=1000, alto=1000):
    esc.render.resolution_x, esc.render.resolution_y = ancho, alto
    cam.location = posc; cam.data.lens = lente
    cam.rotation_euler = (Vector(mira) - Vector(posc)).to_track_quat('-Z', 'Y').to_euler()
    esc.render.filepath = ruta; bpy.ops.render.render(write_still=True)
todas = os.environ.get('FOTOS', 'todas') == 'todas'
foto((0, -4.6, 1.0), (0, 0, 0.85), 50, os.path.join(SALIDA, 'cuerpos.png'), 1200, 900)
for rig, piezas, pos in gente:
    for otro, op, _ in gente:
        for ob in [otro] + op: ob.hide_render = otro is not rig
    x = rig.location.x; cz = pos['head'].z + 0.07
    # encuadre de toda la cabeza, de la coronilla al cuello (antes cortaba la barbilla: Pedro)
    cz = pos['head'].z + 0.04
    foto((x, -0.95, cz + 0.01), (x, 0, cz - 0.01), 85, os.path.join(SALIDA, rig.name + '_cara.png'))
    foto((x - 0.78, -0.56, cz + 0.01), (x, 0, cz - 0.01), 85, os.path.join(SALIDA, rig.name + '_cara34.png'))
    if todas:
        foto((x + 2.6, 0.0, 1.0), (x, 0, 0.85), 50, os.path.join(SALIDA, rig.name + '_perfil.png'), 800, 1000)
        foto((x, 2.6, 1.0), (x, 0, 0.85), 50, os.path.join(SALIDA, rig.name + '_espalda.png'), 800, 1000)
print('listo', SALIDA)
