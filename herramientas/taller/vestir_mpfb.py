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
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comprobar_taller  # versiones fijadas (versiones.json): para aquí si el taller no está montado con ellas
SALIDA = sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith('.py') else '/tmp/claude-0/mh/vestir'
os.makedirs(SALIDA, exist_ok=True)
comprobar_taller.comprobar(os.path.join(SALIDA, 'taller_versiones.json'))
import bpy, bmesh, addon_utils, importlib, math
import numpy as np
from mathutils import Vector
addon_utils.enable('bl_ext.user_default.mpfb', default_set=True)
M = 'bl_ext.user_default.mpfb.'
HS = importlib.import_module(M + 'services.humanservice').HumanService
TS = importlib.import_module(M + 'services.targetservice').TargetService
HOP = importlib.import_module(M + 'entities.objectproperties').HumanObjectProperties
LS = importlib.import_module(M + 'services.locationservice').LocationService
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
TROOT = LS.get_mpfb_data('targets')
REJILLA_UV = None
UV_TROZO = np.array([0.07, 0.07])
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
def material(nombre, rugosidad=0.8, sss=0.0, imagen=None, alfa=False, brillo=0.0, metal=0.0, factor=None):
    """factor: color (lineal) que multiplica la textura o el color por vértice. Sale en el .glb como baseColorFactor:
    así el juego cambia el tono de la piel, el pelo o los ojos sin rehacer la textura (personalización)"""
    m = bpy.data.materials.new(nombre)
    nt = m.node_tree; p = nt.nodes['Principled BSDF']
    p.inputs['Roughness'].default_value = rugosidad
    p.inputs['Metallic'].default_value = metal
    if imagen is not None:
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = imagen
        fuente = tx.outputs['Color']
        if alfa: nt.links.new(tx.outputs['Alpha'], p.inputs['Alpha'])
    else:
        col = nt.nodes.new('ShaderNodeVertexColor'); col.layer_name = 'Col'
        fuente = col.outputs['Color']
    if factor is not None:  # nodo «Mezclar» en multiplicar: el exportador de glTF lo pasa a baseColorFactor
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1
        mx.inputs[7].default_value = (*[float(x) for x in factor], 1)
        nt.links.new(fuente, mx.inputs[6]); fuente = mx.outputs[2]
    nt.links.new(fuente, p.inputs['Base Color'])
    if sss:
        p.inputs['Subsurface Weight'].default_value = sss
        p.inputs['Subsurface Radius'].default_value = (1.0, 0.35, 0.2)
        p.inputs['Subsurface Scale'].default_value = 0.01
    if brillo: p.inputs['Coat Weight'].default_value = brillo
    return m

# ---------- trozos de la malla ----------
# de qué punto del cuerpo sale cada vértice de cada pieza (para pasarle las formas de MakeHuman: peso, músculo, cara…)
MAPA = {}
def mapear(ob, pos, orig):
    """para cada vértice de ob, el punto del cuerpo del vértice más cercano de (pos, orig): sirve después de diezmar"""
    from mathutils.kdtree import KDTree
    kd = KDTree(len(pos))
    for k, p in enumerate(pos): kd.insert(p, k)
    kd.balance()
    MAPA[ob.name] = np.array([orig[kd.find(v.co)[1]] for v in ob.data.vertices], dtype=np.int64)

def trozo(base, nombre, quedarse, empuje=0.0, color=None, textura=None, rugosidad=0.85, sss=0.0, subdividir=0, diezmar=1.0, brillo=0.0, ajustar_uv=False, alisar=None, colgar=None, metal=0.0, tapar=None, factor=None, tinte=None, entero=None, prenda=None):
    """copia de `base` con solo los vértices para los que quedarse(i, co) es cierto; la empuja por la normal.
    color(P, A) da el color por vértice; textura=(res, fn(P, A) → rgba) pinta una textura en su mapa UV"""
    ob = base.copy(); ob.data = base.data.copy(); ob.name = nombre
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.verts.ensure_lookup_table()
    capa = bm.verts.layers.int.new('orig')
    for v in bm.verts: v[capa] = v.index
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not quedarse(v.index, v.co)], context='VERTS')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    if tapar:  # cierra los huecos que deja lo quitado en esa zona (la base de la oreja bajo la capucha o la toca)
        borde = [e for e in bm.edges if e.is_boundary and all(tapar(v.co) for v in e.verts)]
        caras = bmesh.ops.holes_fill(bm, edges=borde, sides=0)['faces']
        uvc = bm.loops.layers.uv.active
        for cara in caras:  # cada esquina toma la UV que ya tenía ese punto en una cara vecina
            for l in cara.loops:
                otra = next((x for x in l.vert.link_loops if x.face is not cara), None)
                if otra is not None: l[uvc].uv = otra[uvc].uv.copy()
        bmesh.ops.triangulate(bm, faces=caras, quad_method='BEAUTY', ngon_method='BEAUTY')
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
        global UV_TROZO; UV_TROZO = (hi - lo) / 0.98  # cuánto del mapa original ocupa (para dibujos de tamaño fijo)
        me.uv_layers['UVMap'].data.foreach_set('uv', uv.ravel())
    if textura:
        res, fn = textura
        img, hay = rasterizar(ob, res, ATR)
        global REJILLA_UV  # coordenadas UV de cada píxel, para dibujos que van por la tela (anillas de la malla)
        REJILLA_UV = np.meshgrid((np.arange(res) + 0.5) / res, (np.arange(res) + 0.5) / res)
        rgba = dilatar(fn(img[..., :3], img[..., 3:]), hay)
        im = bpy.data.images.new(nombre, res, res, alpha=True)
        rgba = np.clip(rgba, 0, 1); rgba[..., :3] = rgba[..., :3] ** (1 / 2.2)  # la imagen se guarda en sRGB
        im.pixels.foreach_set(rgba.astype(np.float32).ravel())
        im.filepath_raw = os.path.join(SALIDA, nombre + '.png'); im.file_format = 'PNG'; im.save()
        me.materials.append(material(nombre, rugosidad, sss, im, alfa=rgba[..., 3].min() < 0.99, brillo=brillo, metal=metal, factor=factor))
    else:
        c = color(pos, ATR[orig])
        capa = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        capa.data.foreach_set('color', np.concatenate([c, np.ones((nv, 1))], 1).astype(np.float32).ravel())
        me.materials.append(material(nombre, rugosidad, sss, brillo=brillo, factor=factor))
    me.attributes.remove(me.attributes['orig'])
    if tinte:  # el juego cambia el color de esta pieza (va en los «extras» del .glb): qué color y el de referencia
        ob['tinte'], ob['ref'] = tinte
    if prenda:  # qué prenda es (tinte «ropa»: el juego le pone el color de esa prenda)
        ob['prenda'] = prenda
    if diezmar < 1.0:
        d = ob.modifiers.new('Diezmar', 'DECIMATE'); d.ratio = diezmar
        if entero:  # lo que no se diezma (la cara de la piel: los calcos de pelo van encima, a 1 mm, y si no la piel los atravesaba)
            libres = [k for k in range(nv) if not entero(orig[k])]
            g = ob.vertex_groups.new(name='diezmar'); g.add(libres, 1.0, 'REPLACE')
            d.vertex_group = 'diezmar'
            # La proporción del modificador es de toda la malla. Con la cara protegida, para llegar a ella el resto (las
            # manos y el cuello) se quedaba casi sin triángulos y las manos salían como una tira (taller-v9 y v10; lo vio
            # valravnx el 29 oct). Se calcula para que lo que sí se diezma quede en `diezmar` de lo suyo, como antes de
            # proteger la cara: triángulos protegidos + diezmar × triángulos libres, sobre el total.
            me.calc_loop_triangles(); libre = np.zeros(nv, bool); libre[libres] = True
            tris = np.zeros(len(me.loop_triangles) * 3, dtype=np.int64); me.loop_triangles.foreach_get('vertices', tris)
            sueltos = libre[tris.reshape(-1, 3)].all(1).sum(); total = len(me.loop_triangles)
            d.ratio = (total - sueltos + diezmar * sueltos) / total
        with bpy.context.temp_override(object=ob, active_object=ob):
            bpy.ops.object.modifier_apply(modifier='Diezmar')
        if 'diezmar' in ob.vertex_groups: ob.vertex_groups.remove(ob.vertex_groups['diezmar'])
    mapear(ob, pos, orig)
    mod = ob.modifiers.new('Armature', 'ARMATURE'); mod.object = RIG
    ob.parent = RIG
    return ob

def bajo_recto(ob, z_max):
    """el bajo de una pieza en línea recta: los puntos del borde de abajo (por debajo de z_max) bajan a la altura del más
    bajo de ellos. Sin esto el corte sigue los cuadros de la malla y sale en dientes de sierra (se ve al ir descalzo)"""
    bm = bmesh.new(); bm.from_mesh(ob.data)
    borde = {v for e in bm.edges if e.is_boundary for v in e.verts if v.co.z < z_max}
    if borde:
        z0 = min(v.co.z for v in borde)
        for v in borde: v.co.z = z0
    bm.to_mesh(ob.data); bm.free()

def cinturon(nombre, telas, z, color, alto=0.034, grueso=0.005, n=64):
    """tira de cuero que rodea la cintura por encima de la ropa: se mide el contorno lanzando rayos desde dentro;
    cada vértice copia los pesos del punto de tela más cercano"""
    from mathutils.bvhtree import BVHTree
    from mathutils.kdtree import KDTree
    # solo el cuerpo y la falda de la prenda: con las mangas (la cota baja hasta la mano, que cuelga a la altura de la
    # cintura) los rayos chocaban con los brazos y el cinturón se estiraba hasta ellos (visto en taller-v4 y v5)
    arboles = [BVHTree.FromObject(t, bpy.context.evaluated_depsgraph_get()) for t in telas if not t.name.endswith('_mangas')]
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
    mapa = []
    for v in me.vertices:
        _, i, _ = kd.find(v.co)
        for g in fuente.data.vertices[i].groups: ob.vertex_groups[g.group].add([v.index], g.weight, 'REPLACE')
        mapa.append(MAPA[fuente.name][i])
    MAPA[nombre] = np.array(mapa, dtype=np.int64)
    capa = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for v in me.vertices: capa.data[v.index].color = (*(color * (0.9 + 0.2 * (v.index % 3 == 0))), 1)
    me.materials.append(material(nombre, 0.5))
    ob.modifiers.new('Armature', 'ARMATURE').object = RIG; ob.parent = RIG
    return ob

def sombrero(nombre, co, cabeza, ojo_arriba, con_cofia, n=48):
    """sombrero de paja hecho por código: copa y ala anchas, todo pegado al hueso de la cabeza (no se deforma).
    La copa se ajusta al contorno de la cabeza medido a la altura de la frente; la paja va en vueltas trenzadas
    (color por vértice) con una cinta oscura en la base de la copa"""
    craneo = np.array([tuple(co[i]) for i in range(len(co)) if cabeza(i)])
    cima = craneo[:, 2].max()
    zb = ojo_arriba + 0.042
    banda = craneo[np.abs(craneo[:, 2] - zb) < 0.012]
    cx, cy = banda[:, 0].mean(), banda[:, 1].mean()
    holgura = 0.02 if con_cofia else 0.016  # por encima del pelo (o de la cofia)
    radio = []
    for k in range(n):  # contorno de la cabeza en cada dirección
        a = 2 * math.pi * k / n; d = np.array([math.cos(a), math.sin(a)])
        rel = banda[:, :2] - np.array([cx, cy])
        cerca = rel[np.abs(rel @ np.array([-d[1], d[0]])) < 0.02]
        radio.append(max(0.06, (cerca @ d).max() if len(cerca) else 0.08) + holgura)
    radio = np.array([(radio[k - 1] + 2 * radio[k] + radio[(k + 1) % n]) / 4 for k in range(n)])
    anillos = []  # (factor del radio o radio extra, altura, color)
    paja, cinta = lin((190, 164, 108)), lin((70, 50, 34))
    alto = cima - zb + 0.045
    for j in range(9):  # copa: de la base a la cima, algo cerrada arriba
        t = j / 8
        anillos.append(('copa', 1.0 - 0.12 * t ** 2 - 0.5 * max(0.0, t - 0.8) / 0.2, zb + alto * t, cinta if j < 2 else paja * (0.86 if j % 2 else 1.0)))
    vs, cols = [], []
    for tipo, f, z, c in anillos:
        for k in range(n):
            a = 2 * math.pi * k / n
            vs.append((cx + radio[k] * f * math.cos(a), cy + radio[k] * f * math.sin(a), z)); cols.append(c)
    for j in range(1, 9):  # ala: hacia fuera, cayendo un poco en el borde
        s = j / 8
        for k in range(n):
            a = 2 * math.pi * k / n; r = radio[k] + 0.115 * s
            vs.append((cx + r * math.cos(a), cy + r * math.sin(a), zb - 0.006 - 0.028 * s ** 1.6)); cols.append(paja * (0.84 if j % 2 else 1.0) * (0.92 if j == 8 else 1.0))
    caras = []
    filas = 9 + 8
    def anillo(j): return j * n
    for j in range(8):  # copa
        for k in range(n): caras.append((anillo(j) + k, anillo(j) + (k + 1) % n, anillo(j + 1) + (k + 1) % n, anillo(j + 1) + k))
    tapa = len(vs); vs.append((cx, cy, zb + alto + 0.002)); cols.append(paja)
    for k in range(n): caras.append((anillo(8) + k, anillo(8) + (k + 1) % n, tapa))
    for j in range(8):  # ala: desde la base de la copa (anillo 0) hacia fuera
        a0 = anillo(0) if j == 0 else anillo(9 + j - 1); a1 = anillo(9 + j)
        for k in range(n): caras.append((a0 + k, a1 + k, a1 + (k + 1) % n, a0 + (k + 1) % n))
    me = bpy.data.meshes.new(nombre); me.from_pydata(vs, [], caras); me.update()
    ob = bpy.data.objects.new(nombre, me); bpy.context.scene.collection.objects.link(ob)
    g = ob.vertex_groups.new(name='head'); g.add(list(range(len(vs))), 1.0, 'REPLACE')
    alto = [i for i in range(len(co)) if cabeza(i) and co[i].z > ojo_arriba]
    mapear(ob, [co[i] for i in alto], alto)
    capa = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for i, c in enumerate(cols):
        v = np.array(vs[i]); capa.data[i].color = (*(np.asarray(c) * (0.92 + 0.16 * float(ruido(v[None, :], 160)[0]))), 1)
    for p in me.polygons: p.use_smooth = False  # paja: facetas planas
    me.materials.append(material(nombre, 0.9))
    ob.modifiers.new('Armature', 'ARMATURE').object = RIG; ob.parent = RIG
    return ob

# ---------- pelo largo: melena, coleta y trenzas ----------
# Mallas propias (no trozos de la piel): la melena es una cortina que cae del cráneo, por fuera de la cáscara del pelo
# corto, y se apoya en el cuello y los hombros; la coleta y las trenzas son tubos que siguen la espalda sin tocarla.
# Llevan su mapa UV a lo largo (u alrededor, v de arriba abajo) y la textura se pinta directamente en ese mapa:
# mechones a lo largo, puntas desiguales en la transparencia. Color en gris de referencia, con el del pelo en el material.
# Pesos: la cabeza arriba, el cuello en medio y la espalda (spine_03) abajo, así al girar la cabeza no se mete en los hombros.
def fuera(origen, d):
    """punto de la piel (CUERPO) más exterior en esa dirección, entrando desde fuera; None si no hay"""
    o = Vector(origen) + Vector(d) * 0.6
    sitio, _, _, _ = CUERPO.ray_cast(o, -Vector(d), 0.6)
    return sitio

def malla_pelo(nombre, vs, caras, uv, pesos, pintar, res, ref, factor, rugosidad=0.5):
    """crea la pieza: vs (n×3), caras, uv por vértice, pesos [{hueso: peso}], pintar(U, V) → rgba en la rejilla UV"""
    me = bpy.data.meshes.new(nombre); me.from_pydata([tuple(map(float, v)) for v in vs], [], caras); me.update()
    capa_uv = me.uv_layers.new(name='UVMap')
    for l in me.loops: capa_uv.data[l.index].uv = tuple(map(float, uv[l.vertex_index]))
    ob = bpy.data.objects.new(nombre, me); bpy.context.scene.collection.objects.link(ob)
    for k, p in enumerate(pesos):
        for h, w in p.items():
            if w <= 0: continue
            g = ob.vertex_groups.get(h) or ob.vertex_groups.new(name=h)
            g.add([k], float(w), 'REPLACE')
    ancho, alto = res
    U, V = np.meshgrid((np.arange(ancho) + 0.5) / ancho, (np.arange(alto) + 0.5) / alto)
    rgba = np.clip(pintar(U, V), 0, 1); rgba[..., :3] = rgba[..., :3] ** (1 / 2.2)
    im = bpy.data.images.new(nombre, ancho, alto, alpha=True)
    im.pixels.foreach_set(rgba.astype(np.float32).ravel())
    im.filepath_raw = os.path.join(SALIDA, nombre + '.png'); im.file_format = 'PNG'; im.save()
    me.materials.append(material(nombre, rugosidad, imagen=im, alfa=True, factor=factor))
    for p in me.polygons: p.use_smooth = True
    ob['tinte'], ob['ref'] = 'pelo', REF_PELO
    mapear(ob, *ref)  # para las formas (peso, cara…): cada punto se mueve como el punto de la piel más cercano
    ob.modifiers.new('Armature', 'ARMATURE').object = RIG; ob.parent = RIG
    return ob

def tubo(camino, radios, n=12, desfase=None):
    """tubo a lo largo de `camino` (puntos) con su radio en cada punto; cerrado en la punta. Devuelve vs, caras, uv.
    desfase(j, k) → desplazamiento extra de cada punto de la sección (para las trenzas)"""
    camino = np.asarray(camino, float); m = len(camino)
    vs, uv, caras = [], [], []
    for j in range(m):
        t = camino[min(j + 1, m - 1)] - camino[max(j - 1, 0)]; t /= np.linalg.norm(t)
        lado = np.cross(t, [0, 1, 0]); lado = lado / (np.linalg.norm(lado) + 1e-9) if np.linalg.norm(lado) > 1e-6 else np.array([1.0, 0, 0])
        if lado[0] < 0: lado = -lado
        arriba = np.cross(lado, t)
        for k in range(n + 1):  # n+1: la costura repite la primera columna (con su u = 1)
            a = 2 * math.pi * k / n
            p = camino[j] + radios[j] * (math.cos(a) * lado + math.sin(a) * arriba)
            if desfase is not None: p = p + desfase(j, k, lado, arriba, t)
            vs.append(p); uv.append((k / n, 1 - j / (m - 1)))
    for j in range(m - 1):
        for k in range(n):
            a0, a1 = j * (n + 1) + k, j * (n + 1) + k + 1
            caras.append((a0, a1, a1 + n + 1, a0 + n + 1))
    punta = len(vs); vs.append(camino[-1] + (camino[-1] - camino[-2]) * 0.3); uv.append((0.5, 0.0))
    for k in range(n): caras.append(((m - 1) * (n + 1) + k + 1, (m - 1) * (n + 1) + k, punta))
    return np.array(vs), caras, np.array(uv)

def pelo_largo(nombre, co, cabeza, pos, ojo_arriba, oreja_arriba, oreja_medio, cuello_z, colpelo, factor):
    craneo = np.array([tuple(co[i]) for i in range(len(co)) if cabeza(i)])
    cima = craneo[:, 2].max()
    banda = craneo[np.abs(craneo[:, 2] - (ojo_arriba + 0.03)) < 0.012]
    cx, cy = float(banda[:, 0].mean()), float(banda[:, 1].mean())  # eje de la cabeza
    cerca = [i for i in range(len(co)) if (cabeza(i) or co[i].z > cuello_z - 0.25) and abs(co[i].x) < 0.3]
    ref = ([co[i] for i in cerca], cerca)
    def pesos(z):
        arriba = float(suave(cuello_z + 0.02, oreja_medio, z)); abajo = float(suave(cuello_z - 0.01, cuello_z - 0.09, z))
        return {'head': arriba, 'neck_01': max(0.0, 1 - arriba - abajo), 'spine_03': abajo}
    def radio(th, z):
        d = (math.sin(th), math.cos(th), 0.0)  # th = 0: atrás (+y); positivo hacia +x
        s = fuera((cx, cy, z), d)
        return 0.0 if s is None else math.hypot(s.x - cx, s.y - cy)
    piezas = []

    # --- melena: cortina del cráneo a los hombros, abierta por delante (la cara) ---
    TH, NC, NF = math.radians(112), 64, 34
    z0 = cima - 0.02
    def fondo(th):  # largo: más por detrás (hasta media espalda alta), menos por los lados
        return cuello_z - 0.035 - 0.075 * math.cos(th) ** 2
    vs, uv, ps = [], [], []
    for k in range(NC + 1):
        th = -TH + 2 * TH * k / NC
        zf = fondo(th); r = None; prev = None
        for j in range(NF):
            t = j / (NF - 1); z = z0 + (zf - z0) * t
            rr = radio(th, z) + 0.006 + 0.02 * t ** 0.7  # pegada arriba (sin casco), con más volumen hacia las puntas
            # cae recta (no se mete bajo el cráneo); sobre los hombros se abre, pero poco a poco
            r = rr if r is None else min(max(rr, r), r + 1.2 * (prev - z))
            prev = z
            vs.append((cx + r * math.sin(th), cy + r * math.cos(th), z)); uv.append((k / NC, 1 - t)); ps.append(pesos(z))
    caras = [(k * NF + j, k * NF + j + 1, (k + 1) * NF + j + 1, (k + 1) * NF + j) for k in range(NC) for j in range(NF - 1)]
    def pintar_melena(U, V):
        th = (U - 0.5) * 2 * TH; largo = 1 - V
        P = np.stack([th * 0.09, largo * 0.3, np.zeros_like(U)], -1)  # en metros, más o menos: a lo ancho y a lo largo
        ond = 0.004 * np.sin(largo * 40 + th * 3)  # algo ondulado
        Q = P + np.stack([ond, 0 * ond, 0 * ond], -1)
        n = 0.45 * ruido(Q, (700, 14, 1)) + 0.35 * ruido(Q, (260, 6, 1)) + 0.2 * ruido(Q, (1600, 30, 1))
        surco = suave(0.25, 0.05, ruido(Q, (380, 9, 1)))  # surcos oscuros entre mechones
        col = colpelo * (0.5 + 0.75 * n[..., None]) * (1 - 0.45 * surco[..., None]) * (0.85 + 0.2 * fbm(P, (40, 8, 1))[..., None])
        col = col * (0.8 + 0.2 * suave(0.0, 0.12, largo))[..., None]  # algo de sombra junto al cráneo
        punta = 0.95 - 0.1 * fbm(P, (60, 1, 1)) - 0.08 * ruido(P, (900, 1, 1)) - 0.05 * ruido(P, (2500, 1, 1))  # puntas desiguales, en mechones
        a = suave(punta + 0.01, punta - 0.02, largo)
        lado = np.minimum(U, 1 - U) * 2 * TH * 0.09  # hacia la cara: borde desigual
        a = a * suave(0.0, 0.012 + 0.01 * ruido(P, (300, 5, 1)), lado)
        return np.concatenate([col, a[..., None]], -1)
    piezas.append(malla_pelo(nombre + '_pelo_melena', np.array(vs), caras, np.array(uv), ps, pintar_melena, (512, 512), ref, factor))

    # espalda: lo más atrás de la piel a cada altura (para que coleta y trenzas no la atraviesen)
    def espalda(x, z):
        s = fuera((x, cy, z), (0, 1, 0)); return cy + 0.08 if s is None else s.y
    def seguir(p0, largo, separa, n=26, abrir=0.0, salir=0.03):
        """camino que baja desde p0 por la espalda, a `separa` de la piel; `abrir`: hacia fuera en x al bajar"""
        pts = [np.array(p0, float)]
        for j in range(1, n):
            t = j / (n - 1)
            x = p0[0] + abrir * t; z = p0[2] - largo * t
            y = max(p0[1] + salir * math.sin(min(1.0, t * 3) * math.pi / 2), espalda(x, z) + separa)
            y = max(y, pts[-1][1] - 0.02)  # sin quiebros
            pts.append(np.array([x, y, z]))
        return pts

    # --- coleta: atada en la nuca, cae por la espalda ---
    zc = oreja_arriba + 0.005
    s = fuera((cx, cy, zc), (0, 1, 0))
    p0 = (cx, s.y + 0.006, zc)
    camino = seguir(p0, zc - (cuello_z - 0.13), 0.03)
    m = len(camino)
    rad = [0.012 if j < 2 else 0.021 * (1 - 0.75 * ((j - 2) / (m - 3)) ** 1.5) for j in range(m)]
    rad[0] = 0.009
    vs, caras, uv = tubo(camino, rad, n=14)
    ps = [pesos(v[2]) for v in vs]
    def pintar_coleta(U, V):
        largo = 1 - V
        P = np.stack([U * 0.12, largo * 0.3, np.zeros_like(U)], -1)
        n = 0.5 * ruido(P, (600, 12, 1)) + 0.5 * ruido(P, (250, 5, 1))
        col = colpelo * (0.6 + 0.6 * n[..., None])
        ata = suave(0.02, 0.03, largo) * suave(0.075, 0.065, largo)  # cinta de cuero en el atado
        col = col * (1 - 0.75 * ata[..., None])
        punta = 0.95 - 0.06 * ruido(P, (300, 1, 1))
        return np.concatenate([col, suave(punta + 0.01, punta - 0.02, largo)[..., None]], -1)
    piezas.append(malla_pelo(nombre + '_pelo_coleta', vs, caras, uv, ps, pintar_coleta, (128, 512), ref, factor))

    # --- trenzas: dos, de detrás de las orejas por la espalda ---
    VS, CARAS, UVS, PS = [], [], [], []
    for sg in (1, -1):
        th = sg * math.radians(58); zt = oreja_medio  # detrás de la oreja (th = 0 es la nuca)
        s = fuera((cx, cy, zt), (math.sin(th), math.cos(th), 0))
        p0 = (s.x + 0.004 * math.sin(th), s.y + 0.004 * math.cos(th), zt)
        camino = seguir(p0, zt - (cuello_z - 0.17), 0.026, n=40, abrir=sg * 0.012, salir=0.008)
        m = len(camino); vueltas = 11
        # trenza: bultos de los mechones cruzados (el radio sube y baja), más fina hacia abajo
        rad = [0.006 if j == 0 else 0.0115 * (1 - 0.35 * j / (m - 1)) * (0.82 + 0.25 * abs(math.sin(math.pi * vueltas * j / (m - 1)))) for j in range(m)]
        for j in range(m - 4, m): rad[j] = 0.009 + 0.004 * (j - (m - 4)) / 3  # mechón suelto bajo el atado
        def desfase(j, k, lado, arriba, t, m=m):
            fase = math.sin(math.pi * vueltas * j / (m - 1))
            return lado * 0.0015 * fase * (1 if j < m - 5 else 0)  # los mechones cruzados, apenas de lado a lado
        vs, caras, uv = tubo(camino, rad, n=10, desfase=desfase)
        off = len(VS); VS += list(vs); CARAS += [tuple(c + off for c in f) for f in caras]; UVS += [(u * 0.5 + (0 if sg > 0 else 0.5), v) for u, v in uv]
        PS += [pesos(v[2]) for v in vs]
    def pintar_trenzas(U, V):
        u = (U * 2) % 1; largo = 1 - V
        cruce = np.abs(np.sin(np.pi * (vueltas * largo * 1.0 + np.where(u < 0.5, u, 1 - u) * 1.6)))  # mechones cruzados
        P = np.stack([u * 0.08, largo * 0.4, np.zeros_like(U)], -1)
        col = colpelo * (0.45 + 0.55 * cruce[..., None]) * (0.85 + 0.3 * ruido(P, (500, 20, 1))[..., None])
        ata = suave(0.86, 0.87, largo) * suave(0.9, 0.89, largo)
        col = col * (1 - 0.75 * ata[..., None])
        return np.concatenate([col, np.ones(U.shape + (1,))], -1)
    piezas.append(malla_pelo(nombre + '_pelo_trenzas', np.array(VS), CARAS, np.array(UVS), PS, pintar_trenzas, (256, 512), ref, factor))
    return piezas

# ---------- formas para personalizar (morph targets) ----------
# Cada forma va de -1 a 1 en el juego (src/logica/aspecto.js): con 1 se pone la forma «_mas» entera, con -1 la «_menos».
# Peso y músculo son los ajustes generales de MakeHuman (cambian todo el cuerpo, también la cara); las de la cara son
# objetivos de MakeHuman. La altura no va aquí: el juego escala el personaje entero (decisión provisional).
FORMAS_CUERPO = {'peso': ('weight', 0.9, 0.15), 'musculo': ('muscle', 1.0, 0.2)}  # ajuste, valor con +1, valor con -1
FORMAS_CARA = {'cara': 'head/head-fat', 'nariz': 'nose/nose-scale-horiz', 'nariz_larga': 'nose/nose-scale-vert', 'menton': 'chin/chin-prominent'}
def malla_de(macros, objetivos):
    """puntos del cuerpo de MakeHuman (con las mallas auxiliares) con esos ajustes y objetivos"""
    h = HS.create_human()
    for k, v in macros.items(): HOP.set_value(k, v, entity_reference=h)
    TS.reapply_macro_details(h)
    for ruta, w in objetivos: TS.load_target(h, os.path.join(TROOT, ruta), weight=w)
    for m in h.modifiers:
        if m.name in ('Hide helpers', 'Armature'): m.show_viewport = False
    dg = bpy.context.evaluated_depsgraph_get(); ev = h.evaluated_get(dg); me = ev.to_mesh()
    P = np.zeros(len(me.vertices) * 3); me.vertices.foreach_get('co', P); ev.to_mesh_clear()
    datos = h.data; bpy.data.objects.remove(h); bpy.data.meshes.remove(datos)
    return P.reshape(-1, 3)
def variantes(macros, objetivos):
    """puntos del cuerpo con cada forma puesta del todo («peso_mas», «nariz_menos»…)"""
    V = {}
    for k, (ajuste, mas, menos) in FORMAS_CUERPO.items():
        V[k + '_mas'] = malla_de({**macros, ajuste: mas}, objetivos)
        V[k + '_menos'] = malla_de({**macros, ajuste: menos}, objetivos)
    for k, ruta in FORMAS_CARA.items():
        V[k + '_mas'] = malla_de(macros, objetivos + [(ruta + '-incr.target.gz', 1.0)])
        V[k + '_menos'] = malla_de(macros, objetivos + [(ruta + '-decr.target.gz', 1.0)])
    return V
def poner_formas(piezas, co, V):
    """una clave de forma por forma en cada pieza que se mueve con ella (más de medio milímetro): cada vértice se mueve
    lo mismo que el punto del cuerpo del que sale (MAPA). La ropa, empujada sobre la piel, se mueve con ella"""
    base = np.array([tuple(c) for c in co])
    for ob in piezas:
        idx = MAPA.get(ob.name)
        if idx is None: continue
        nv = len(ob.data.vertices); P = np.zeros(nv * 3); ob.data.vertices.foreach_get('co', P); P = P.reshape(-1, 3)
        claves = [(k, (V[k] - base)[idx]) for k in V]
        claves = [(k, d) for k, d in claves if np.abs(d).max() > 0.0005]
        if not claves: continue
        ob.shape_key_add(name='Basis', from_mix=False)
        for k, d in claves:
            sk = ob.shape_key_add(name=k, from_mix=False); sk.data.foreach_set('co', (P + d).astype(np.float32).ravel())

REF_PIEL, REF_PELO = 0.85, 0.6  # colores de referencia (lineales) en los que se pintan la piel y el pelo
# Ropa teñible (desde taller-v13): la tela y el cuero se pintan en este gris (lineal) y el color de cada prenda va en el
# material (factor = color / REF_ROPA), así el juego la tiñe sin rehacer el modelo. Con el color por defecto se ve igual
# que antes. La cota de malla, el sombrero de paja y los cinturones no se tiñen.
REF_ROPA = 0.8
def tenida(capa, color):
    return dict(factor=lin(color) / REF_ROPA, tinte=('ropa', REF_ROPA), prenda=capa)
GRIS_ROPA = np.full(3, REF_ROPA)

def separar_iris(ojo, c0, nombre, iris):
    """saca el iris (y la pupila) del ojo a una pieza aparte, en gris, con su color en el material: el juego cambia el
    color de los ojos sin tocar el blanco. Las caras se reparten por el ángulo de su centro con la mirada (hacia -y)"""
    ang = lambda p: np.degrees(np.arccos(np.clip(-((np.asarray(p) - c0) / np.linalg.norm(np.asarray(p) - c0))[1], -1, 1)))
    pos_ojo = [v.co.copy() for v in ojo.data.vertices]; mapa_ojo = MAPA[ojo.name]
    ir = ojo.copy(); ir.data = ojo.data.copy(); ir.name = nombre; bpy.context.scene.collection.objects.link(ir)
    for ob, quitar in ((ojo, lambda a: a < 24), (ir, lambda a: a >= 24)):
        bm = bmesh.new(); bm.from_mesh(ob.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if quitar(ang(f.calc_center_median()))], context='FACES')
        bm.to_mesh(ob.data); bm.free()
        mapear(ob, pos_ojo, mapa_ojo)
    for ob, color in ((ojo, lambda a: (0.035, 0.03, 0.025) if a < 27 else (0.70, 0.66, 0.62)),  # el blanco, con el borde oscuro del iris
                      (ir, lambda a: (0.12,) * 3 if a < 11 else (0.4,) * 3)):  # pupila y anillo; entre medias, el dibujo del iris (abajo)
        capa = ob.data.color_attributes['Col']
        for v in ob.data.vertices:
            a = ang(v.co)
            if ob is ir and 11 <= a < 22: capa.data[v.index].color = (*[0.75 + 0.25 * float(ruido(np.array(tuple(v.co))[None, :], 900)[0])] * 3, 1)
            else: capa.data[v.index].color = (*color(a), 1)
    ir.data.materials.clear(); ir.data.materials.append(material(nombre, 0.1, brillo=0.6, factor=iris))
    ir['tinte'], ir['ref'] = 'ojos', 1.0
    return ir

# ---------- un personaje ----------
def personaje(nombre, macros, objetivos, ropa):
    global RIG, ATR
    V = variantes(macros, objetivos)
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
    igual = np.abs(malla_de(macros, objetivos) - np.array([tuple(c) for c in co])).max()
    print(f'{nombre}: la base de las formas se aparta {igual * 1000:.3f} mm de la del personaje')
    assert igual < 1e-4, 'las formas no salen de la misma base que el personaje'
    en = lambda i, g, u=0.5: W[i].get(g, 0) > u
    def principal(i):
        m, pm = None, 0
        for n, p in W[i].items():
            if n in HUESOS and p > pm: m, pm = n, p
        return m
    PR = [principal(i) for i in range(len(co))]
    # atributos por vértice para pintar: labios, orejas, uñas
    ATR = np.array([[W[i].get('lips', 0), W[i].get('ears', 0), max(W[i].get('fingernails', 0), W[i].get('toenails', 0)), co[i].x, co[i].y, co[i].z] for i in range(len(co))])

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
    NORMAL = [v.normal.copy() for v in base.data.vertices]
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
    def zona_barba(P, A, tipo='corta'):
        """barba pintada (corta, bigote o perilla): bordes difusos y con pelillos; el bigote baja por las comisuras y se une
        a la barba"""
        x, y, z = np.abs(P[..., 0]), P[..., 1], P[..., 2]
        t = suave(-0.14, -0.06, y)
        zc = (boca_z + 0.012) * (1 - t) + (oreja_medio - 0.004) * t  # línea de la mejilla, en diagonal
        centro = suave(0.044, 0.026, x) * suave(-0.10, -0.12, y)  # bajo el labio
        zc = zc * (1 - centro) + (boca_z - 0.008 + 0.3 * x * x * 10) * centro
        borde = 0.009 * (fbm(P, 70) - 0.5) + 0.003 * (ruido(P, 400) - 0.5)
        arriba = suave(-0.009, 0.005, zc - z + borde)  # en el borde los pelos se van espaciando (pelos_barba)
        # en el cuello se va aclarando, sin corte. Por delante, bajo la barbilla, baja más: antes se aclaraba ya en la
        # barbilla (lo vio valravnx: «una claridad en la barbilla»)
        z_cuello = cuello_z + 0.03 - 0.04 * suave(-0.02, -0.07, y)
        abajo = suave(-0.02, 0.012, z - z_cuello + borde)
        m = arriba * abajo * (0.9 + 0.1 * suave(boca_z, boca_z - 0.04, z))  # más poblada en la barbilla
        frente = suave(-0.11, -0.125, y)
        bigote = suave(0.034, 0.026, x) * suave(-0.003, 0.002, z - (boca_z + 0.004)) * suave(0.003, -0.002, z - (boca_z + 0.016 - 0.1 * x * x * 10)) * frente
        comisura = suave(0.019, 0.025, x) * suave(0.038, 0.031, x) * suave(-0.004, 0.002, z - (boca_z - 0.014)) * suave(0.004, -0.002, z - (boca_z + 0.012)) * suave(-0.10, -0.115, y)
        if tipo == 'perilla':  # solo la barbilla, del labio de abajo a debajo del mentón, con el bigote unido
            m = suave(0.027, 0.019, x + 0.004 * (fbm(P, 90) - 0.5)) * suave(-0.07, -0.09, y) * suave(-0.004, 0.004, (boca_z - 0.006) - z) * abajo
            m = np.maximum(m, 0.85 * np.maximum(bigote, comisura))
        elif tipo == 'bigote': m = 0.85 * np.maximum(bigote, comisura)
        else: m = np.maximum(m, 0.85 * np.maximum(bigote, comisura))
        if A is not None: m *= (1 - suave(0.1, 0.35, A[..., 1])) * (1 - suave(0.3, 0.6, A[..., 0]))
        m *= suave(-0.01, -0.03, y)
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

    # piel y pelo se pintan en un color de referencia (gris claro) y su color va aparte, en el material (factor): así el
    # juego los cambia sin rehacer la textura. Las cejas, la barba y el pelo pintado van en calcos encima de la piel
    tono, colpelo = np.full(3, REF_PIEL), np.full(3, REF_PELO)
    tono_real, colpelo_real, iris = lin(ropa['piel']), lin(ropa['pelo']), lin(ropa['ojos'])
    f_piel, f_pelo = dict(factor=tono_real / REF_PIEL, tinte=('piel', REF_PIEL)), dict(factor=colpelo_real / REF_PELO, tinte=('pelo', REF_PELO))
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
        return np.concatenate([col, np.ones(P.shape[:2] + (1,))], -1)
    # calcos de pelo sobre la piel (cejas y pelo pintado; barba corta o bigote): la misma malla de la piel, sin diezmar,
    # despegada 1 mm y con la transparencia de la textura (el juego los dibuja encima de la piel). Barba pintada y no
    # cáscara: valravnx vio que la cáscara dejaba mal la barbilla
    pelillos = lambda P: colpelo * (0.7 + 0.45 * ruido(P, (900, 900, 500))[..., None])
    def pintar_vello(P, A):
        a = 0.85 * zona_cejas(P)
        a = np.maximum(a, 0.7 * zona_pelo(P) * (1 - suave(0.1, 0.35, A[..., 1])))  # pelo rapado (bajo la cofia no se ve)
        return np.concatenate([colpelo * (0.9 + 0.2 * ruido(P, (90, 90, 1400))[..., None]), a[..., None]], -1)
    def pelos_barba(P, m):
        """barba pintada (antes una mancha lisa con el borde duro: valravnx, «horribles»). Dentro, tupida y casi del
        todo opaca, con un grano fino de pelos a lo largo de la caída (arriba-abajo) que solo cambia el tono; en el borde,
        el grano fino deshace la línea en pelos sueltos en unos milímetros (no manchas grandes: con grano grueso parecía
        suciedad). Devuelve color y transparencia"""
        g = ruido(P, (2600, 2600, 420))  # grano de pelo, menos de medio milímetro
        raya = 0.6 * ruido(P + 0.37, (1500, 1500, 140)) + 0.4 * ruido(P + 0.71, (800, 800, 70))  # pelos a lo largo
        a = suave(0.0, 1.0, 1.25 * m + 0.7 * (g - 0.5) - 0.1)
        claro = 0.62 + 0.42 * raya + 0.18 * (g - 0.5) + 0.1 * (fbm(P, 35) - 0.5)
        return colpelo * claro[..., None], a
    def pintar_barba(tipo):
        def f(P, A):
            col, a = pelos_barba(P, zona_barba(P, A, tipo))
            return np.concatenate([col, (0.95 * a)[..., None]], -1)
        return f
    def donde(fn, margen=0.015):
        """vértices de la piel donde el calco pinta algo, mirando también alrededor (las cejas son más finas que los cuadros
        de la malla: con poco margen quedaban cuadros sin calco y la ceja salía a trozos)"""
        P = np.array([tuple(c) for c in co]); A = ATR
        m = np.zeros(len(P))
        for d in [(x, y, z) for x in (-margen, 0, margen) for y in (-margen, 0, margen) for z in (-margen, 0, margen)]:
            m = np.maximum(m, fn(P + np.array(d), A)[..., 3])
        return m > 0.01

    # --- piel: solo lo que se ve (cabeza, cuello, manos y un poco de muñeca) ---
    visible = lambda i, c: en(i, 'body') and not (ropa.get('cofia') and en(i, 'ears', 0.3)) and (PR[i] in ('head', 'neck_01') or mano(i) or cerca_muneca(c, 0.07) or c.z > cuello_z - (0.05 if c.y < -0.03 else 0.02))  # el escote baja por delante
    sin_orejas = lambda i, c: visible(i, c) and not en(i, 'ears', 0.3)
    piezas = [trozo(base, nombre + '_piel', sin_orejas, textura=(2048, pintar_piel), rugosidad=0.62, sss=0.2, diezmar=DIEZMAR,
                    entero=lambda i: cabeza(i) and co[i].z > cuello_z - 0.02, **f_piel)]
    if True:  # las orejas van aparte: en el juego se esconden bajo la capucha, la toca o la cofia (si no, asoman)
        piezas.append(trozo(base, nombre + '_orejas', lambda i, c: en(i, 'body') and en(i, 'ears', 0.1), textura=(512, pintar_piel),
                            rugosidad=0.62, sss=0.2, ajustar_uv=True, **f_piel))
    calcos = [('vello', pintar_vello)] + ([('barba_corta', pintar_barba('corta')), ('barba_bigote', pintar_barba('bigote')), ('barba_perilla', pintar_barba('perilla'))] if ropa.get('barba') else [])
    for n_, fn in calcos:
        sel = donde(fn)
        piezas.append(trozo(base, f'{nombre}_{n_}', lambda i, c, sel=sel: sel[i] and sin_orejas(i, c), empuje=0.001, textura=(1024, fn),
                            rugosidad=0.7, ajustar_uv=True, **f_pelo))

    # --- barba larga: una malla propia con volumen (antes era la piel estirada: de perfil salía como una lámina hueca, y
    # valravnx la vio «horrible»). Como la melena: columnas alrededor de la cara, de la patilla a la otra patilla; cada
    # una baja pegada a la cara (a 2-12 mm de la piel, medido con rayos desde fuera) y, bajo el mentón, cae recta en vez
    # de meterse hacia el cuello; luego vuelve por dentro, pegada al cuello, hasta debajo de la mandíbula. Así de perfil
    # es una cuña maciza bajo la barbilla, como una barba de verdad. Se recoge hacia la punta (más estrecha) y la punta y
    # los bordes van desiguales, mechón a mechón, en la transparencia (el juego la recorta: alphaTest). Va con la corta
    # pintada debajo ---
    if ropa.get('barba'):
        frente_cara = [c for c in cara if c.z < boca_z - 0.02]
        mz = min(frente_cara, key=lambda c: c.y).z  # lo más saliente del mentón
        cab = np.array([tuple(co[i]) for i in range(len(co)) if cabeza(i)])
        banda = cab[np.abs(cab[:, 2] - (ojo_arriba + 0.03)) < 0.012]
        ax, ay = float(banda[:, 0].mean()), float(banda[:, 1].mean())  # eje de la cabeza
        def piel_r(th, z):  # th = 0: delante (-y); positivo hacia +x
            s_ = fuera((ax, ay, z), (math.sin(th), -math.cos(th), 0.0))
            return None if s_ is None else math.hypot(s_.x - ax, s_.y - ay)
        TH, NC, NO, NI = math.radians(80), 48, 24, 10
        LARGO = 0.10  # cuánto cuelga bajo el mentón, en el centro
        def raiz(a):  # bajo el labio por delante; sube por la mejilla hasta la patilla
            w = float(suave(math.radians(16), math.radians(70), a)); return (boca_z - 0.013) * (1 - w) + (oreja_medio - 0.004) * w
        def punta(a):
            w = float(suave(math.radians(78), math.radians(12), a)); return (mz - LARGO) * w + (boca_z - 0.05) * (1 - w)
        vs, uv, caras = [], [], []
        for k in range(NC + 1):
            th = -TH + 2 * TH * k / NC; a = abs(th)
            zr, zt = raiz(a), punta(a)
            col_ = []
            r = None; zprev = None; r_menton = None
            lado_w = float(suave(math.radians(25), math.radians(60), a))  # a los lados sigue la mandíbula hacia dentro
            for j in range(NO):
                t = j / (NO - 1); z = zr + (zt - zr) * t
                s_ = float(suave(mz, zt, z)) if zt < mz else 0.0  # 0 hasta el mentón, 1 en la punta
                te = th * (1 - 0.35 * s_ ** 1.2)  # se recoge hacia la punta
                rr = piel_r(te, z)
                if rr is None: rr = r if r is not None else 0.08
                rr += 0.002 + 0.011 * float(suave(0.0, 0.3, t))  # grosor sobre la cara
                # bajo el mentón cae recta (no se mete hacia el cuello), salvo a los lados, que siguen la mandíbula
                r = rr if r is None else min(max(rr, r - 1.6 * lado_w * (zprev - z)), r + 1.2 * (zprev - z))
                if z <= mz and r_menton is None: r_menton = r
                if r_menton is not None: r = min(r, r_menton)  # bajo el mentón, ni un milímetro hacia delante
                zprev = z
                rf = r - 0.014 * s_ ** 2  # la punta, algo vuelta hacia dentro
                col_.append((te, rf, z, 0.7 * t))
            te_t, r_t, z_t, _ = col_[-1]
            z_alto = min(zr - 0.004, max(z_t + 0.02, mz - 0.022))  # hasta dónde sube por dentro
            s_a = float(suave(mz, zt, z_alto)) if zt < mz else 0.0
            r_alto = piel_r(th * (1 - 0.35 * s_a ** 1.2), z_alto); r_alto = (r_alto if r_alto is not None else r_t - 0.01) + 0.003
            for i in range(1, NI + 1):  # por debajo: en línea recta de la punta a la garganta, sin meterse en la piel
                u = i / NI; z = z_t + (z_alto - z_t) * u
                s_ = float(suave(mz, zt, z)) if zt < mz else 0.0
                te = th * (1 - 0.35 * s_ ** 1.2)
                rin = piel_r(te, z); rin = (rin if rin is not None else r_alto - 0.003) + 0.003
                col_.append((te, min(r_t, max(r_t + (r_alto - r_t) * u, rin)), z, 0.7 + 0.3 * u))
            for te, rf, z, vv in col_:
                vs.append((ax + rf * math.sin(te), ay - rf * math.cos(te), z)); uv.append((k / NC, 1 - vv))
        NF = NO + NI
        if os.environ.get('VOLCAR_BARBA'): np.save(os.environ['VOLCAR_BARBA'], np.array(vs)); np.save(os.environ['VOLCAR_BARBA'] + '_piel.npy', np.array([tuple(c) for c in co])); print('BARBA', mz, boca_z, cuello_z, oreja_medio, ax, ay)
        if os.environ.get('VOLCAR_BARBA') and os.environ.get('SOLO_VOLCAR'): sys.exit(0)
        caras = [(k * NF + j, (k + 1) * NF + j, (k + 1) * NF + j + 1, k * NF + j + 1) for k in range(NC) for j in range(NF - 1)]
        V_PUNTA = 0.3  # v de la punta (el pliegue entre la cara de fuera y la de dentro)
        def pintar_larga(U, V):
            Q = np.stack([U * 0.26, (1 - V) * 0.16, np.zeros_like(U)], -1)  # en metros, más o menos: a lo ancho y a lo largo
            ond = 0.0012 * np.sin((1 - V) * 60 + U * 9) + 0.002 * (fbm(Q, (30, 6, 1)) - 0.5)  # apenas ondulada
            Qo = Q + np.stack([ond, 0 * ond, 0 * ond], -1)
            n = 0.45 * ruido(Qo, (900, 14, 1)) + 0.35 * ruido(Qo, (380, 7, 1)) + 0.2 * ruido(Qo, (2200, 30, 1))
            surco = suave(0.3, 0.08, ruido(Qo, (240, 5, 1)))  # surcos oscuros entre mechones
            col = colpelo * (0.5 + 0.75 * n[..., None]) * (1 - 0.4 * surco[..., None]) * (0.88 + 0.2 * fbm(Q, (40, 8, 1))[..., None])
            col = col * np.where(V < V_PUNTA, 0.55, 1.0)[..., None]  # la cara de dentro, en sombra
            # punta desigual, mechón a mechón: cada mechón (a lo ancho) se corta a su altura
            mech = 0.6 * ruido(Qo, (160, 0.5, 1)) + 0.4 * ruido(Qo, (520, 1, 1))
            corte = 0.015 + 0.11 * mech ** 1.5
            a = suave(corte, corte + 0.012, np.abs(V - V_PUNTA))
            # arriba (en la cara) se funde con la corta pintada: pelos que se espacian
            arriba = 0.975 - 0.05 * ruido(Qo, (700, 2, 1))
            a = a * suave(arriba, arriba - 0.03, V)
            lado = np.minimum(U, 1 - U)
            a = a * suave(0.0, 0.05 + 0.04 * ruido(Qo, (300, 3, 1)), lado)
            return np.concatenate([col, a[..., None]], -1)
        cerca = [i for i in range(len(co)) if cabeza(i)]
        ob_l = malla_pelo(nombre + '_barba_larga', np.array(vs), caras, np.array(uv), [{'head': 1.0}] * len(vs), pintar_larga,
                          (1024, 512), ([co[i] for i in cerca], cerca), f_pelo['factor'], rugosidad=0.6)
        piezas.append(ob_l)

    # --- ojos y pestañas (color por vértice: el ojo tiene muy poco sitio en el mapa UV) ---
    for s in 'lr':
        c0 = ojo_c[s]
        def color_ojo(P, A, c0=c0):
            d = P - c0; d /= np.linalg.norm(d, axis=1, keepdims=True); a = np.degrees(np.arccos(np.clip(-d[:, 1], -1, 1)))
            n = 0.75 + 0.25 * ruido(P, 900)
            col = np.where((a < 25)[:, None], iris[None, :] * n[:, None], np.array([0.70, 0.66, 0.62]))
            col = np.where((a < 11)[:, None], 0.02, col)
            return np.where(((a >= 22) & (a < 27))[:, None], iris * 0.4, col)
        ojo = trozo(base, f'{nombre}_ojo_{s}', lambda i, c, s=s: en(i, f'helper-{s}-eye'), color=color_ojo, rugosidad=0.1, subdividir=2, brillo=0.6)
        piezas += [ojo, separar_iris(ojo, c0, f'{nombre}_iris_{s}', iris)]

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
    # el pelo corto (cáscara sobre el cráneo) va en todos: es la base de la melena, la coleta y las trenzas, y en la mujer
    # se ve cuando no lleva la cofia (el juego enseña una cosa u otra según el peinado)
    if True:
        def pintar_pelo(P, A):
            a = zona_pelo(P) * (1 - suave(0.1, 0.35, A[..., 1]))
            return np.concatenate([mechones(P, colpelo), a[..., None]], -1)
        cab = lambda i, c: cabeza(i) and not en(i, 'ears', 0.3) and not (c.y < -0.09 and c.z < ojo_arriba + 0.035) and c.z > boca_z - 0.03
        empuje = lambda c, i: 0.003 + 0.007 * min(1.0, max(0.0, c.z - ojo_arriba) / 0.1)
        piezas.append(trozo(base, nombre + '_pelo', cab, empuje=empuje, textura=(1024, pintar_pelo), rugosidad=0.55, diezmar=DIEZMAR, **f_pelo))
    # --- pelo largo: melena, coleta y trenzas (mallas propias sobre la cáscara del pelo corto) ---
    piezas += pelo_largo(nombre, co, cabeza, pos, ojo_arriba, oreja_arriba, oreja_medio, cuello_z, colpelo, f_pelo['factor'])

    # --- ropa por capas (color o textura por código). Cada prenda se llama <nombre>_capa_<capa>[_falda]: en el juego
    # se enseñan las capas puestas. Las de base (camisa, calzas, zapatos) van siempre; encima, túnica o vestido, gambesón…
    # Cada capa va más separada de la piel que la de debajo, así no se atraviesan.
    def tela(c):
        c = lin(c); return lambda P, A: c[None, :] * (0.88 + 0.16 * fbm(P, 25)[:, None])
    tela_gris = lambda P, A: GRIS_ROPA[None, :] * (0.88 + 0.16 * fbm(P, 25)[:, None])
    def corte_cuello_mangas(P, alto_cuello, hueco_muneca, escote):
        """transparencia del borde: escote (más bajo por delante) y final de las mangas, sin escalones"""
        x, y, z = np.abs(P[..., 0]), P[..., 1], P[..., 2]
        corte = cuello_z + alto_cuello - escote * suave(-0.03, -0.09, y) * suave(0.075, 0.03, x)
        a = suave(0.0015, -0.0015, z - corte)
        a = np.maximum(a, suave(0.068, 0.082, x))  # el escote solo alrededor del cuello: si no, con cuello alto cortaba lo alto de los hombros
        d = np.minimum(*[np.linalg.norm(P - m, axis=-1) for m in muneca])
        return a * suave(hueco_muneca - 0.002, hueco_muneca + 0.002, d)
    def acolchado(P):
        """canales del acolchado del gambesón: costuras verticales en el cuerpo y en anillos en las mangas"""
        x, y, z = P[..., 0], P[..., 1], P[..., 2]
        arco = np.arctan2(x, -y) * 0.15  # distancia alrededor del tronco
        canal_tronco = np.abs(np.sin(np.pi * arco / 0.038))
        canal_manga = np.abs(np.sin(np.pi * (np.sqrt(x * x + (z - cuello_z) ** 2)) / 0.045))
        manga = suave(0.15, 0.19, np.abs(x)) * (z > cintura_z)
        c = canal_tronco * (1 - manga) + canal_manga * manga
        return 0.72 + 0.28 * np.sqrt(c)  # oscuro en la costura, claro en el centro del canal (bulto)
    arriba = lambda alto: (lambda i, c: en(i, 'helper-tights') and cintura_z - 0.06 < c.z < cuello_z + alto and not cerca_muneca(c, 0.015) and not mano(i))
    tronco = lambda c, i: abs(c.x) < 0.15 and cintura_z - 0.05 < c.z < cuello_z - 0.05
    def prenda(capa, color, empuje_tronco, empuje_manga, largo, alto_cuello=-0.004, escote=0.02, muneca_hueco=0.043,
               alisado=None, colgar_pecho=False, dibujo=None, rugosidad=0.95, metal=0.0, sin_mangas=False, manga_hasta=None, res=1024, tenir=True):
        """una prenda: cuerpo (malla ceñida de la base) + falda (malla de falda de la base). Bordes por transparencia.
        dibujo(P) multiplica el color (acolchado, anillas…); sin_mangas recorta la sisa; manga_hasta: distancia de la muñeca
        a la que acaba la manga (más corta que la camisa)"""
        colp = GRIS_ROPA if tenir else lin(color)  # teñible: en gris, con su color en el material
        tn = tenida(capa, color) if tenir else {}
        hueco = manga_hasta or muneca_hueco
        def separacion(c):  # de la piel: más en el tronco que en las mangas, con paso suave en el hombro (un escalón se veía como mancha oscura)
            t = min(1.0, max(0.0, (abs(c.x) - 0.15) / 0.05)); t = t * t * (3 - 2 * t)
            return empuje_tronco * (1 - t) + empuje_manga * t
        def alfa(P):
            a = corte_cuello_mangas(P, alto_cuello, hueco, escote)
            if sin_mangas:  # sisa: sin mangas, desde el hombro
                a = a * suave(0.165, 0.150, np.abs(P[..., 0]))
            return a
        def pintar(P, A):
            col = colp[None, None, :] * (0.88 + 0.16 * fbm(P, 25)[..., None]) * (0.95 + 0.05 * ruido(P, 900)[..., None])
            if dibujo: col = col * dibujo(P)[..., None]
            return np.concatenate([col, alfa(P)[..., None]], -1)
        def pintar_falda(P, A):
            col = colp[None, None, :] * (0.88 + 0.16 * fbm(P, 25)[..., None])
            if dibujo: col = col * dibujo(P)[..., None]
            return np.concatenate([col, np.ones(P.shape[:2] + (1,))], -1)
        # cuerpo y mangas por separado: en el juego, una capa sin mangas (sobreveste) no esconde las mangas de debajo
        HOMBRO = 0.185
        cuerpo_sel = (lambda i, c: arriba(alto_cuello + 0.03)(i, c) and abs(c.x) < (0.19 if sin_mangas else HOMBRO + 0.035))
        cuerpo_ = trozo(base, f'{nombre}_capa_{capa}', cuerpo_sel, empuje=lambda c, i: separacion(c),
                        textura=(res, pintar), rugosidad=rugosidad, ajustar_uv=True, metal=metal,
                        colgar=(cintura_z, cuello_z - 0.03, 0.16) if colgar_pecho else None, alisar=alisado, **tn)
        piezas_ = [cuerpo_]
        if not sin_mangas:  # las mangas montan sobre el cuerpo para que no quede raja
            piezas_.append(trozo(base, f'{nombre}_capa_{capa}_mangas', lambda i, c: arriba(alto_cuello + 0.03)(i, c) and abs(c.x) > HOMBRO - 0.035,  # solape ancho: los cuadros del hombro miden unos 3 cm y, si no, quedaba alguno sin nadie (agujero)
                                
                                 empuje=lambda c, i: separacion(c) + 0.002,  # +2 mm: donde montan, sin parpadeo
                                 textura=(res // 2, pintar), rugosidad=rugosidad, ajustar_uv=True, metal=metal, **tn))
        falda_ = trozo(base, f'{nombre}_capa_{capa}_falda', lambda i, c: en(i, 'helper-skirt') and largo < c.z < cintura_z + 0.012,  # el empalme queda bajo el cinturón
                       empuje=empuje_tronco, textura=(res // 2, pintar_falda), ajustar_uv=True, rugosidad=rugosidad, metal=metal, **tn)
        return piezas_ + [falda_]
    def anillas(P):
        """cota de malla: filas de anillas cruzadas (dibujo por la tela, en UV), con brillo arriba y hueco oscuro"""
        U, V = REJILLA_UV
        if U.shape != P.shape[:2]: return np.ones(P.shape[:2])
        n = 1600 * UV_TROZO  # anillas por unidad del mapa original: mismo tamaño en el cuerpo, las mangas y la falda
        su, sv = U * n[0], V * n[1] * 1.25
        fila = np.floor(sv)
        lu = (su + 0.5 * (fila % 2)) % 1 - 0.5; lv = sv % 1 - 0.5
        r = np.sqrt(lu * lu + (lv * 0.8) ** 2)
        aro = suave(0.16, 0.24, r) * suave(0.48, 0.38, r)  # el alambre de la anilla
        brillo = 0.75 + 0.5 * suave(0.2, -0.3, lv)  # la parte de arriba de cada anilla coge luz
        return 0.42 + 0.7 * aro * brillo  # el hueco no es negro: donde el mapa se estira, las anillas se funden en gris y no en manchas oscuras
    # base: camisa de lino (más larga en la mujer: camisa hasta los tobillos)
    largo_camisa = tobillo_z + 0.05 if mujer else rodilla_z + 0.12
    piezas += prenda('camisa', ropa.get('camisa', (206, 196, 172)), 0.006, 0.003, largo_camisa, alto_cuello=0.0, escote=0.012, muneca_hueco=0.041)
    # túnica (hombre, hasta la rodilla) o vestido (mujer, hasta los tobillos): alisada en el pecho (valravnx: «el hombre tiene tetas»)
    capa_media = 'vestido' if ropa.get('vestido') else 'tunica'
    largo = tobillo_z + 0.03 if ropa.get('vestido') else rodilla_z - 0.03
    media = prenda(capa_media, ropa['tunica'], 0.012, 0.007, largo, colgar_pecho=not mujer, alisado=(tronco, 8 if mujer else 25, 0.008))
    piezas += media
    piezas.append(cinturon(f'{nombre}_cinturon_{capa_media}', media, cintura_z, lin((40, 26, 17))))
    # gambesón acolchado encima, hasta medio muslo, con cuello alto
    gambeson = prenda('gambeson', ropa.get('gambeson', (172, 156, 122)), 0.026, 0.017, cintura_z - 0.33, alto_cuello=0.022, escote=0.0,
                      muneca_hueco=0.04, alisado=(tronco, 25, 0.024), colgar_pecho=True, dibujo=acolchado)
    piezas += gambeson
    piezas.append(cinturon(f'{nombre}_cinturon_gambeson', gambeson, cintura_z, lin((40, 26, 17))))
    # cota de malla sobre el gambesón: hasta la rodilla, mangas hasta media mano del antebrazo; metal gris
    # (metal a medias: sin reflejos del entorno en el juego, el metal puro sale negro)
    cota = prenda('cota', (176, 176, 170), 0.034, 0.023, rodilla_z + 0.02, alto_cuello=0.026, escote=0.0, manga_hasta=0.09,
                  alisado=(tronco, 25, 0.032), colgar_pecho=True, dibujo=anillas, rugosidad=0.5, metal=0.45, tenir=False)
    piezas += cota
    piezas.append(cinturon(f'{nombre}_cinturon_cota', cota, cintura_z, lin((40, 26, 17))))
    # sobreveste encima de todo: sin mangas, hasta media pierna, de lana teñida
    sobreveste = prenda('sobreveste', ropa.get('sobreveste', (118, 46, 38)), 0.042, 0.03, rodilla_z - 0.16 if not mujer else tobillo_z + 0.06,
                        alto_cuello=-0.006, escote=0.018, sin_mangas=True, alisado=(tronco, 25, 0.04), colgar_pecho=True)
    piezas += sobreveste
    piezas.append(cinturon(f'{nombre}_cinturon_sobreveste', sobreveste, cintura_z, lin((40, 26, 17))))
    if not mujer:
        piezas.append(trozo(base, nombre + '_capa_calzas', lambda i, c: en(i, 'helper-tights') and tobillo_z + 0.03 < c.z < largo_camisa + 0.10,  # bajo la camisa no hacen falta (se atravesaban)
                           
                            empuje=0.003, color=tela_gris, rugosidad=0.95, **tenida('calzas', ropa['calzas'])))
        bajo_recto(piezas[-1], tobillo_z + 0.08)  # descalzo se ve el bajo: recto, no en dientes de sierra
    piezas.append(trozo(base, nombre + '_capa_zapatos', lambda i, c: en(i, 'helper-tights') and c.z < tobillo_z + 0.05,
                        empuje=0.006, color=tela_gris, rugosidad=0.55, **tenida('zapatos', (52, 34, 22))))
    # ---- pies descalzos: la piel de los pies, para cuando no lleva zapatos ni botas (el GDD empieza descalzo) ----
    # La piel del cuerpo solo tiene cabeza, cuello y manos; sin esto, al quitar los zapatos no había pies. Sube un poco
    # por encima de donde empiezan las calzas (tobillo + 3 cm), que la tapan, para que no quede hueco entre las dos.
    # En la mujer sube hasta donde las botas bajas (la falda larga se abre al andar y no debe verse hueco por debajo).
    # Uñas como en las manos; la planta y el borde de abajo, algo más oscuros (polvo del suelo).
    def pintar_pies(P, A):
        c = pintar_piel(P, A)
        polvo = suave(0.03, 0.004, P[..., 2])[..., None] * (0.75 + 0.25 * fbm(P, 60)[..., None])
        c[..., :3] = c[..., :3] * (1 - 0.3 * polvo) + np.array([0.42, 0.34, 0.27]) * 0.3 * polvo
        return c
    piezas.append(trozo(base, nombre + '_pies', lambda i, c: en(i, 'body') and c.z < tobillo_z + (0.10 if mujer else 0.06), textura=(512, pintar_pies),
                        rugosidad=0.62, sss=0.2, ajustar_uv=True, **f_piel))
    # ---- capa (manto) abierta por delante, encima de todo, hasta debajo de la rodilla ----
    # Se llama «manto» en el modelo (<nombre>_capa_manto) para no chocar con la palabra «capa» de las capas de ropa.
    colm = GRIS_ROPA; tn_manto = tenida('manto', ropa.get('manto', (78, 70, 58)))
    def abertura(P, z_yugo):  # por delante queda abierta salvo un poco bajo el cuello, donde se cierra con un broche
        x, y, z = np.abs(P[..., 0]), P[..., 1], P[..., 2]
        return 1 - suave(-0.02, -0.045, y) * suave(0.15, 0.115, x) * suave(z_yugo + 0.01, z_yugo - 0.01, z)
    def pintar_manto(P, A, cuello=True):
        col = colm[None, None, :] * (0.86 + 0.18 * fbm(P, 22)[..., None]) * (0.95 + 0.05 * ruido(P, 800)[..., None])
        O = A[..., 3:6]
        a = abertura(P, cuello_z - 0.055)
        if cuello:
            a = a * suave(0.0015, -0.0015, P[..., 2] - (cuello_z + 0.012))
            hombro = suave(cuello_z - 0.17, cuello_z - 0.12, O[..., 2])  # sobre el hombro acaba en línea, no en los escalones de la malla
            a = a * (1 - hombro * suave(0.198, 0.21, np.abs(O[..., 0])))
        return np.concatenate([col, a[..., None]], -1)
    sel_manto = lambda i, c: en(i, 'helper-tights') and cintura_z - 0.06 < c.z < cuello_z + 0.045 and abs(c.x) < 0.215 and not mano(i)
    piezas.append(trozo(base, f'{nombre}_capa_manto', sel_manto, empuje=0.056, textura=(1024, pintar_manto), rugosidad=0.95,
                        ajustar_uv=True, alisar=(tronco, 25, 0.054), **tn_manto))
    piezas.append(trozo(base, f'{nombre}_capa_manto_falda', lambda i, c: en(i, 'helper-skirt') and rodilla_z - 0.12 < c.z < cintura_z + 0.03,
                        empuje=0.062, textura=(512, lambda P, A: pintar_manto(P, A, cuello=False)), rugosidad=0.95, ajustar_uv=True, **tn_manto))

    # ---- calzado: botas de cuero (en vez de los zapatos) ----
    # El hombre, hasta debajo de la rodilla. La mujer lleva siempre falda hasta el tobillo (camisa, vestido), que sale de
    # la malla de ayuda de la falda y sigue a los muslos; la caña alta seguía a la pantorrilla y, al doblar la rodilla, se
    # salía por detrás de la falda (lo vio valravnx el 29 oct). Sus botas suben solo un poco por encima del bajo de la
    # falda: nunca se ven por encima y no llegan a la pantorrilla.
    alto_bota = tobillo_z + 0.10 if mujer else rodilla_z - 0.06
    cuero = GRIS_ROPA  # teñible, como la tela: el color del cuero va en el material
    def color_botas(P, A):
        z = P[:, 2]
        c = cuero[None, :] * (0.85 + 0.2 * fbm(P, 30)[:, None])
        vuelta = suave(alto_bota - 0.05, alto_bota - 0.04, z)[:, None]  # caña vuelta arriba, algo más clara
        suela = suave(0.025, 0.015, z)[:, None]
        return c * (1 + 0.25 * vuelta) * (1 - 0.5 * suela)
    piezas.append(trozo(base, nombre + '_capa_botas', lambda i, c: en(i, 'helper-tights') and c.z < alto_bota,
                        empuje=lambda c, i: 0.009 + (0.004 if c.z > alto_bota - 0.05 else 0.0), color=color_botas, rugosidad=0.6, **tenida('botas', (60, 42, 28))))

    # ---- tocados (uno cada vez): capucha suelta con esclavina, sombrero de paja y, en la mujer, toca ----
    oreja_c = [orejas[orejas[:, 0] * sg > 0].mean(0) for sg in (1, -1)]
    sobre_oreja = lambda c, i: min(np.linalg.norm(np.array(c) - o) for o in oreja_c) < 0.04
    def hueco_cara(P, arriba, abajo, hx):  # óvalo de la cara (transparente) por delante
        x, y, z = P[..., 0], P[..., 1], P[..., 2]
        zc, hz = (arriba + abajo) / 2, (arriba - abajo) / 2
        e = (x / hx) ** 2 + ((z - zc) / hz) ** 2
        return 1 - (1 - suave(0.92, 1.0, e)) * suave(-0.04, -0.07, y)
    def cubre(z_bajo, arriba, abajo, hx):  # cabeza, cuello y hombros hasta z_bajo (sin brazos ni manos)
        # sin los puntos de dentro del hueco de la cara (labios, párpados): empujados hacia fuera salían como pinchos
        zc, hz = (arriba + abajo) / 2, (arriba - abajo) / 2
        cara_ = lambda c: c.y < -0.085 and (c.x / hx) ** 2 + ((c.z - zc) / hz) ** 2 < 0.45  # bien dentro del hueco: el borde lo hace la transparencia
        return lambda i, c: en(i, 'body') and not mano(i) and not cara_(c) and not en(i, 'ears', 0.0) and (cabeza(i) or (c.z > z_bajo - 0.02 and abs(c.x) < 0.27))
    def separacion_tocado(cabeza_e, hombro_e, pico=0.0):
        def e(c, i):
            d = min(np.linalg.norm(np.array(c) - o) for o in oreja_c)
            t = suave(cuello_z + 0.06, cuello_z - 0.005, c.z)  # del cuello para abajo, por encima de la ropa
            atras = pico * max(0.0, c.y) / 0.1 * max(0.0, c.z - ojo_arriba) / 0.06  # la capucha acaba en punta atrás
            return cabeza_e * (1 - t) + hombro_e * t + atras + 0.008 * float(suave(0.055, 0.025, d))  # algo de bulto sobre la oreja
        return e
    def pintar_tocado(color, arriba, abajo, hx, z_bajo, lana=True):
        c0 = GRIS_ROPA  # teñible: el color (color) va en el material
        def f(P, A):
            col = c0[None, None, :] * (0.86 + 0.18 * fbm(P, 40 if lana else 60)[..., None]) * (0.95 + 0.05 * ruido(P, 700)[..., None])
            O = A[..., 3:6]  # el sitio de cada punto antes de empujar la tela: los bordes no se mueven con el empuje
            orilla = suave(z_bajo + 0.012, z_bajo + 0.004, O[..., 2])  # dobladillo un poco más oscuro
            col = col * (1 - 0.15 * orilla[..., None])
            a = hueco_cara(O, arriba, abajo, hx) * suave(-0.002, 0.002, O[..., 2] - z_bajo - 0.004 * (ruido(O, 40) - 0.5))
            a = a * suave(0.255, 0.245, np.abs(O[..., 0]))  # sobre el brazo acaba en curva, no en los escalones de la malla
            return np.concatenate([col, a[..., None]], -1)
        return f
    zc_bajo = cuello_z - 0.13
    piezas.append(trozo(base, nombre + '_capa_capucha', cubre(zc_bajo, ojo_arriba + 0.05, boca_z - 0.055, 0.063), empuje=separacion_tocado(0.026, 0.09, pico=0.05),
                        alisar=(sobre_oreja, 12), tapar=lambda c: min(np.linalg.norm(np.array(c) - o) for o in oreja_c) < 0.065,
                        textura=(1024, pintar_tocado(ropa.get("capucha", (92, 76, 58)), ojo_arriba + 0.05, boca_z - 0.055, 0.063, zc_bajo)),
                        rugosidad=0.95, diezmar=DIEZMAR, **tenida('capucha', ropa.get("capucha", (92, 76, 58)))))
    if mujer:
        zt_bajo = cuello_z - 0.075
        piezas.append(trozo(base, nombre + '_capa_toca', cubre(zt_bajo, ojo_arriba + 0.028, boca_z - 0.028, 0.058), empuje=separacion_tocado(0.013, 0.08),
                            alisar=(sobre_oreja, 12), tapar=lambda c: min(np.linalg.norm(np.array(c) - o) for o in oreja_c) < 0.065,
                            textura=(1024, pintar_tocado((226, 220, 204), ojo_arriba + 0.028, boca_z - 0.028, 0.058, zt_bajo, lana=False)),
                            rugosidad=0.9, diezmar=DIEZMAR, **tenida('toca', (226, 220, 204))))
    piezas.append(sombrero(f'{nombre}_capa_sombrero', co, cabeza, ojo_arriba, ropa.get('cofia') is not None))

    bpy.data.objects.remove(base)
    poner_formas(piezas, co, V)
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
] + ([] if os.environ.get('SOLO') == 'hombre' else [  # SOLO=hombre: solo el hombre, para probar barbas más deprisa (nunca se publica así)
    personaje('mujer', {'gender': 0.0, 'age': 0.45, 'muscle': 0.45, 'weight': 0.45, 'height': 0.4}, LABIOS,
              {'piel': (230, 190, 165), 'ojos': (80, 96, 104), 'pelo': (60, 40, 28), 'cofia': (214, 204, 182), 'vestido': True, 'tunica': (70, 84, 98)}),
])

# ---------- exportar un .glb por personaje ----------
for rig, piezas, pos in gente:
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    for ob in piezas: ob.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=os.path.join(SALIDA, rig.name + '.glb'), export_format='GLB', use_selection=True,
                              export_skins=True, export_animations=False, export_vertex_color='ACTIVE', export_image_format='AUTO',
                              export_morph=True, export_morph_normal=False, export_extras=True)
gente[0][0].location.x = -0.55
if len(gente) > 1: gente[1][0].location.x = 0.55

# ---------- fotos (Cycles en CPU) ----------
if os.environ.get('FOTOS') == 'ninguna':
    print('listo', SALIDA); sys.exit(0)
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
NUEVAS = ('_pies', '_capa_manto', '_capa_botas', '_capa_capucha', '_capa_toca', '_capa_sombrero', '_pelo_', '_barba_larga', '_barba_perilla', '_barba_bigote')
def cabeza_como(rig, piezas, peinado, barba):
    """enseña el peinado y la barba como el juego (src/personajes/makehuman.js)"""
    for ob in piezas:
        n = ob.name[len(rig.name):]
        if n == '_pelo': ob.hide_render = peinado in ('rapado', 'cofia')
        elif n.startswith('_pelo_'): ob.hide_render = n != '_pelo_' + peinado
        elif n == '_cofia': ob.hide_render = peinado != 'cofia'
        elif n == '_orejas': ob.hide_render = peinado == 'cofia'
        elif n.startswith('_barba_'): ob.hide_render = not (n == '_barba_' + barba or (barba == 'larga' and n == '_barba_corta'))
        elif any(k in n for k in NUEVAS): ob.hide_render = True
if os.environ.get('FOTOS') == 'peinados':  # de cerca, cada peinado y cada barba nuevos
    esc.cycles.samples = 24
    PRUEBAS = {'hombre': [('corto', 'corta'), ('corto', 'larga'), ('rapado', 'perilla'), ('melena', 'ninguna'), ('coleta', 'corta'), ('trenzas', 'bigote')],
               'mujer': [('melena', 'ninguna'), ('coleta', 'ninguna'), ('trenzas', 'ninguna'), ('cofia', 'ninguna')]}
    for rig, piezas, pos in gente:
        for otro, op, _ in gente:
            for ob in [otro] + op: ob.hide_render = otro is not rig
        x = rig.location.x; cz = pos['head'].z + 0.0
        for peinado, barba in PRUEBAS[rig.name]:
            cabeza_como(rig, piezas, peinado, barba)
            for ob in piezas:  # con la ropa de diario (túnica o vestido), como sale en el juego por defecto
                if '_capa_' in ob.name and not any(k in ob.name for k in ('tunica', 'vestido', 'calzas', 'zapatos')): ob.hide_render = True
                if '_cinturon_' in ob.name and 'tunica' not in ob.name and 'vestido' not in ob.name: ob.hide_render = True
            base_ = os.path.join(SALIDA, f'{rig.name}_{peinado}_{barba}')
            foto((x - 0.95, -0.75, cz + 0.02), (x, 0, cz - 0.06), 60, base_ + '_34.png', 640, 640)
            foto((x + 0.9, 0.85, cz + 0.06), (x, 0, cz - 0.08), 60, base_ + '_atras.png', 640, 640)
            foto((x + 1.3, -0.1, cz + 0.0), (x, 0, cz - 0.06), 60, base_ + '_perfil.png', 640, 640)
    print('listo', SALIDA); sys.exit(0)
if os.environ.get('FOTOS') == 'barbas':  # muy de cerca, cada barba: de frente, de tres cuartos, de perfil y desde abajo
    esc.cycles.samples = 32
    for rig, piezas, pos in gente:
        if rig.name != 'hombre': continue
        for otro, op, _ in gente:
            for ob in [otro] + op: ob.hide_render = otro is not rig
        x = rig.location.x; cz = pos['head'].z - 0.02
        for barba in os.environ.get('BARBAS', 'corta,larga,perilla,bigote').split(','):
            cabeza_como(rig, piezas, 'corto', barba)
            for ob in piezas:
                if '_capa_' in ob.name and not any(k in ob.name for k in ('tunica', 'calzas', 'zapatos')): ob.hide_render = True
                if '_cinturon_' in ob.name and 'tunica' not in ob.name: ob.hide_render = True
            b_ = os.path.join(SALIDA, f'barba_{barba}')
            foto((x, -0.75, cz + 0.02), (x, 0, cz), 85, b_ + '_frente.png', 700, 700)
            foto((x - 0.6, -0.48, cz + 0.02), (x, 0, cz), 85, b_ + '_34.png', 700, 700)
            foto((x + 0.78, -0.02, cz + 0.0), (x, 0, cz), 85, b_ + '_perfil.png', 700, 700)
    print('listo', SALIDA); sys.exit(0)
if os.environ.get('FOTOS') == 'pies':  # de cerca, descalzo (sin zapatos ni botas) con la ropa de diario
    esc.cycles.samples = 24
    for rig, piezas, pos in gente:
        for otro, op, _ in gente:
            for ob in [otro] + op: ob.hide_render = otro is not rig
        cabeza_como(rig, piezas, 'cofia' if rig.name == 'mujer' else 'corto', 'ninguna' if rig.name == 'mujer' else 'corta')
        for ob in piezas:
            if '_capa_' in ob.name and not any(k in ob.name for k in ('tunica', 'vestido', 'calzas', 'camisa')): ob.hide_render = True
            if '_cinturon_' in ob.name and 'tunica' not in ob.name and 'vestido' not in ob.name: ob.hide_render = True
            if ob.name.endswith('_pies'): ob.hide_render = False
        x = rig.location.x
        foto((x + 0.5, -1.2, 0.35), (x, 0, 0.12), 50, os.path.join(SALIDA, f'{rig.name}_pies_34.png'), 800, 800)
        foto((x - 0.2, 1.1, 0.3), (x, 0, 0.1), 50, os.path.join(SALIDA, f'{rig.name}_pies_atras.png'), 800, 800)
        foto((x + 0.9, -0.1, 0.12), (x, 0, 0.08), 50, os.path.join(SALIDA, f'{rig.name}_pies_lado.png'), 800, 800)
    print('listo', SALIDA); sys.exit(0)
if os.environ.get('FOTOS') == 'prendas':  # de cerca, una pieza nueva cada vez (capa, botas y cada tocado)
    esc.cycles.samples = 24
    for rig, piezas, pos in gente:
        for otro, op, _ in gente:
            for ob in [otro] + op: ob.hide_render = otro is not rig
        x = rig.location.x; cz = pos['head'].z + 0.04
        for puesta in ('_capa_capucha', '_capa_toca', '_capa_sombrero', ('_capa_manto', '_capa_botas')):
            pp = puesta if isinstance(puesta, tuple) else (puesta,)
            if not any(ob.name.startswith(rig.name + p) for ob in piezas for p in pp): continue
            for ob in piezas:
                nueva = any(k in ob.name for k in NUEVAS)
                ob.hide_render = (nueva and not any(ob.name.startswith(rig.name + p) for p in pp)) or (('_capa_botas' in pp) and '_capa_zapatos' in ob.name) \
                    or (ob.name.endswith('_orejas') and pp[0] in ('_capa_capucha', '_capa_toca'))  # como en el juego
            n = pp[0].replace('_capa_', '')
            if n == 'manto':
                foto((x + 1.9, -2.0, 1.1), (x, 0, 0.85), 50, os.path.join(SALIDA, f'{rig.name}_{n}_34.png'), 800, 1000)
                foto((x - 1.0, 2.5, 1.1), (x, 0, 0.85), 50, os.path.join(SALIDA, f'{rig.name}_{n}_espalda.png'), 800, 1000)
                foto((x + 0.5, -1.2, 0.35), (x, 0, 0.25), 50, os.path.join(SALIDA, f'{rig.name}_botas.png'), 800, 800)
            else:
                foto((x - 0.78, -0.56, cz + 0.01), (x, 0, cz - 0.01), 70, os.path.join(SALIDA, f'{rig.name}_{n}_34.png'))
                foto((x + 0.75, 0.6, cz + 0.05), (x, 0, cz - 0.03), 70, os.path.join(SALIDA, f'{rig.name}_{n}_atras.png'))
    print('listo', SALIDA); sys.exit(0)
for rig, piezas, pos in gente:  # en las fotos de siempre, sin las piezas nuevas (tocados, capa, botas, pelo largo…)
    cabeza_como(rig, piezas, 'cofia' if rig.name == 'mujer' else 'corto', 'ninguna' if rig.name == 'mujer' else 'corta')
foto((0, -4.6, 1.0), (0, 0, 0.85), 50, os.path.join(SALIDA, 'cuerpos.png'), 1200, 900)
for rig, piezas, pos in gente:
    for otro, op, _ in gente:
        for ob in [otro] + op: ob.hide_render = otro is not rig
    x = rig.location.x; cz = pos['head'].z + 0.07
    # encuadre de toda la cabeza, de la coronilla al cuello (antes cortaba la barbilla: valravnx)
    cz = pos['head'].z + 0.04
    foto((x, -0.95, cz + 0.01), (x, 0, cz - 0.01), 85, os.path.join(SALIDA, rig.name + '_cara.png'))
    foto((x - 0.78, -0.56, cz + 0.01), (x, 0, cz - 0.01), 85, os.path.join(SALIDA, rig.name + '_cara34.png'))
    if todas:
        foto((x + 2.6, 0.0, 1.0), (x, 0, 0.85), 50, os.path.join(SALIDA, rig.name + '_perfil.png'), 800, 1000)
        foto((x, 2.6, 1.0), (x, 0, 0.85), 50, os.path.join(SALIDA, rig.name + '_espalda.png'), 800, 1000)
print('listo', SALIDA)
