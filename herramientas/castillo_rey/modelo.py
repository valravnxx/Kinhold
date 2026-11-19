# El castillo del rey, entero. Escribe la malla (castillo.bin) y el terreno (terreno.bin) para el visor y para el juego.
import time
import choques
from obra import *
t0 = time.time()
m = Malla()
GH = (P_PRINC, 15.6, ang(A, G), 9.8)          # la puerta principal (rectángulo)
GA = (P_ALC, 7.0, ang(B, Fp), 8.0)             # la puerta del alcázar
KEEP = HOMENAJE
TW = {k: Torre(k, *v) for k, v in TORRES.items()}
sq = lambda t: (t.c, t.lado, t.a)
CORT = [
    Cortina('A-AB', A, AB, sq(TW['A']), sq(TW['AB']), foso=True),
    Cortina('AB-B', AB, B, sq(TW['AB']), KEEP, foso=True),
    Cortina('B-C', B, C, KEEP, sq(TW['C']), foso=True),
    Cortina('C-D', C, D, sq(TW['C']), sq(TW['D'])),
    Cortina('D-E', D, E, sq(TW['D']), sq(TW['E'])),
    Cortina('E-F', E, Fp, sq(TW['E']), sq(TW['F'])),
    Cortina('F-G', Fp, G, sq(TW['F']), sq(TW['G'])),
    Cortina('G-P', G, P_PRINC, sq(TW['G']), GH, foso=True),
    Cortina('P-A', P_PRINC, A, GH, sq(TW['A']), foso=True),
    Cortina('B-PA', B, P_ALC, KEEP, GA, centro=CEN_INT, grueso=2.2),
    Cortina('PA-F', P_ALC, Fp, GA, sq(TW['F']), centro=CEN_INT, grueso=2.2),
]
CN = {c.nombre: c for c in CORT}
# puertas del adarve en las torres donde llega cada cortina
for c in CORT:
    for (extremo, otro) in ((c.p, c.q), (c.q, c.p)):
        for t in TW.values():
            if math.dist(t.c, extremo) < 0.5:
                i, u = t.golpe(otro); t.puertas[i].append((u, ADARVE, 1.0, 2.1))
# ---------------- los edificios de los patios (antes de las cortinas: la sala abre ventanas en la muralla del mar)
import edificios as ED
def adosado(nombre, L, Fd, pisos, alto=3.0):
    c = CN[nombre]; return ED.Adosado(c, (c.u0 + c.u1) / 2, L, Fd, pisos, alto)
E_CUAD = adosado('A-AB', 15.6, 5.6, 2)
E_GRAN = adosado('AB-B', 13.1, 5.4, 2)
E_GUAR = adosado('F-G', 9.9, 5.4, 2)
E_SALA = adosado('D-E', 17.0, 6.4, 2, 3.4)
c_bc = CN['B-C']; E_CAPI = ED.Adosado(c_bc, c_bc.u0 + 5.6, 11.2, 6.0, 1, 6.0)
c_cd = CN['C-D']; E_COCI = ED.Adosado(c_cd, c_cd.u0 + 5.2, 9.0, 5.6, 1, 4.0)
for u_ in (5.0, 9.6, 13.2):
    CN['D-E'].huecos.append({'u': E_SALA.u_cortina(u_), 'a': 0.9, 'v0': E_SALA.pisos[1] + 1.1, 'v1': E_SALA.pisos[1] + 2.7, 'arco': 'apuntado', 'derrame': 1.3})
import patios
patios.poterna(m, CN['E-F'])
for c in CORT: construir_cortina(m, c)
for k, t in TW.items():
    construir_torre(m, t, CEN_INT if k in ('C', 'D', 'E') else CEN_EXT, base_foso=k in ('A', 'AB', 'G'))
print('obra', m.n(), round(time.time() - t0, 1))
# ---------------- las puertas, la barbacana y el puente
import puertas, homenaje
NORTE = -1          # en el marco de la puerta principal, +u va hacia G (sur)
puertas.puerta_principal(m, NORTE)
puertas.puente(m)
gb_barb, top_barb = puertas.barbacana(m, NORTE)
puertas.puerta_alcazar(m)
print('puertas', m.n(), round(time.time() - t0, 1))
# ---------------- la torre del homenaje, con las puertas al adarve
tk = Torre('K', *HOMENAJE)
pk = []
for c in CORT:
    for (extremo, otro) in ((c.p, c.q), (c.q, c.p)):
        if math.dist(extremo, B) < 0.5:
            pk.append(tk.golpe(otro))
print('puertas del homenaje', pk)
homenaje.homenaje(m, pk)
print('homenaje', m.n(), round(time.time() - t0, 1))
import foso
foso.foso(m)
print('foso', m.n())
ED.cuadras(m, E_CUAD); ED.granero(m, E_GRAN); ED.guardia(m, E_GUAR); ED.sala(m, E_SALA); ED.capilla(m, E_CAPI, True); ED.cocina(m, E_COCI)
print('edificios', m.n())
patios.patios(m, CN, E_CUAD, E_GRAN, E_GUAR, E_COCI)
print('patios', m.n())
from puertas import GPF as _G
_fa, _r = marco_fuera(B, Fp, CEN_INT); _ga = F(P_ALC[0], P_ALC[1], _fa.a, 0)
camino = [_G.p2(0, -5.5), _G.p2(0, -12.0), _ga.p2(0, 7.0), _ga.p2(0, 4.2)]
patios.suelos_patios(m, camino)
patios.cinta(m, camino, 3.2, 'canto', hexc('#8a8276'), 0.075, 0.25, 3)
from puertas import BU as _BU, BW0 as _BW0, BW1 as _BW1
_calle = (217465 + 79.0, 53060 - 57.0)
patios.camino_explanada(m, [_calle, _G.p2(_BU * 0.6, _BW1 + 9.5), _G.p2(-_BU - 4.0, _BW1 + 4.5), _G.p2(-_BU - 4.0, _BW1 - 4.5), _G.p2(-_BU + 1.6, _BW1 - 4.5)])
patios.camino_explanada(m, [_G.p2(-_BU + 1.6, _BW1 - 4.5), _G.p2(-2.0, _BW0 + 4.0), _G.p2(0, _BW0 + 1.6)], 3.0)
print('suelos', m.n())
import numpy as np
import kit
P, Cc = m.arrays()
np.save('/tmp/castillo_P.npy', P); np.save('/tmp/castillo_C.npy', Cc)

# ---------------- los choques, en coordenadas del castillo (origen en ORIGEN del mundo; alturas, las del mundo)
import json
ORIGEN = (217600.0, 52990.0)
C = choques.COL
def rel_f(f): return [round(f[0] - ORIGEN[0], 3), round(f[1] - ORIGEN[1], 3), round(f[2], 5)]
for k in ('suelos', 'rampas', 'solidos', 'techos', 'caracoles'):
    for e in C[k]: e['f'] = rel_f(e['f'])
C['muros'] = [[round(a - ORIGEN[0], 3), round(b - ORIGEN[1], 3), round(c - ORIGEN[0], 3), round(d - ORIGEN[1], 3), y0, y1] for a, b, c, d, y0, y1 in C['muros']]
json.dump({'origen': ORIGEN, **C}, open('/tmp/castillo_colision.json', 'w'), separators=(',', ':'))
print('choques', {k: len(v) for k, v in C.items()})
# ---------------- el foso (marcas de nivelado) y la zona que se despeja, en el mundo
import foso as FS
from shapely.geometry import Polygon
from puertas import GPF as _G2, BU as _bu, BW0 as _bw0, BW1 as _bw1
eje = FS.linea_desplazada(FS.LINEA_FOSO, 5.8)
marcas = []
for p, q in zip(eje, eje[1:]):
    L = math.dist(p, q); n = max(1, int(L / 1.5))
    for k in range(n + 1):
        x = p[0] + (q[0] - p[0]) * k / n; z = p[1] + (q[1] - p[1]) * k / n
        if x > 217648: continue
        marcas.append([round(x, 2), round(z, 2), FOSO_FONDO, 4.6, 0.6])
rec = Polygon(RECINTO)
barb = Polygon([_G2.p2(u, w) for u, w in ((-_bu - 14, _bw0 - 1), (_bu + 6, _bw0 - 1), (_bu + 6, _bw1 + 16), (-_bu - 14, _bw1 + 16))])
zona = rec.buffer(FS.D_CTRA + 3.0).union(barb).simplify(1.0)
d = json.load(open('/tmp/castillo_colision.json'))
d['foso'] = marcas; d['zona'] = [[round(x, 1), round(z, 1)] for x, z in zona.exterior.coords][:-1]
# donde no crece la hierba (el recinto, el patio de la barbacana y los caminos): en el foso y la explanada, sí
from shapely.geometry import LineString
_sinh = Polygon(RECINTO).buffer(T_MURO / 2 + 0.4).union(Polygon([_G2.p2(u, w) for u, w in ((-_bu, _bw0), (_bu, _bw0), (_bu, _bw1), (-_bu, _bw1))]).buffer(0.3))
_sinh = _sinh.union(LineString([_calle, _G.p2(_BU * 0.6, _BW1 + 9.5), _G.p2(-_BU - 4.0, _BW1 + 4.5), _G.p2(-_BU - 4.0, _BW1 - 4.5), _G.p2(-_BU + 1.6, _BW1 - 4.5)]).buffer(3.2))
_sinh = _sinh.union(LineString([_G.p2(-_BU + 1.6, _BW1 - 4.5), _G.p2(-2.0, _BW0 + 4.0), _G.p2(0, _BW0 + 1.6)]).buffer(2.6)).simplify(0.4)
d['sin_hierba'] = [[[round(x, 1), round(z, 1)] for x, z in g.exterior.coords][:-1] for g in getattr(_sinh, 'geoms', [_sinh])]
_pa = Polygon(EXTERIOR)
_franja = _pa.buffer(-T_MURO / 2 - 0.1).difference(_pa.buffer(-T_MURO / 2 - 2.6))
for E_ in (E_CUAD, E_GRAN, E_GUAR):
    _franja = _franja.difference(Polygon([E_.P(0, 0), E_.P(E_.L, 0), E_.P(E_.L, E_.Fd), E_.P(0, E_.Fd)]).buffer(1.2))
_franja = _franja.difference(LineString(camino).buffer(2.4))
for tw in TW.values(): _franja = _franja.difference(Polygon(esquinas(tw.c, tw.lado, tw.a)).buffer(1.0))
from puertas import GPF as _GP, GU as _GU, GW0 as _GW0, GW1 as _GW1
_franja = _franja.difference(Polygon([_GP.p2(-_GU, _GW0), _GP.p2(_GU, _GW0), _GP.p2(_GU, _GW1), _GP.p2(-_GU, _GW1)]).buffer(2.0)).simplify(0.3)
d['hierba_dentro'] = [[[[round(x, 1), round(z, 1)] for x, z in g.exterior.coords][:-1]] + [[[round(x, 1), round(z, 1)] for x, z in r.coords][:-1] for r in g.interiors] for g in getattr(_franja, 'geoms', [_franja]) if g.area > 1.0]
json.dump(d, open('/tmp/castillo_colision.json', 'w'), separators=(',', ':'))
print('marcas del foso', len(marcas), 'zona', len(d['zona']))
# ---------------- para el juego: la malla (cuantizada a 1 cm, comprimida) y los choques
import gzip, os, struct
DEST = os.environ.get('DEST', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'docs', 'recursos', 'mundo', 'castillo-rey-v1'))
os.makedirs(DEST, exist_ok=True)
# v2: por material (cada uno, su textura): posición (cm), color, UV (en metros × 100) y la altura sobre su suelo (dm)
Pq = np.asarray(P, dtype=np.float64).reshape(-1, 3).copy()
Pq[:, 0] -= ORIGEN[0]; Pq[:, 2] -= ORIGEN[1]
nv = len(Pq)
MAT = np.array([kit.MATERIALES.index(x) for x in m.M], dtype=np.int32)
# UV: las dadas (teja, paja) o proyectadas en el plano de cada triángulo (u en horizontal a lo largo de la cara, v hacia arriba)
T = Pq.reshape(-1, 3, 3)
nrm = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); nrm /= (np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12)
tg = np.stack([-nrm[:, 2], np.zeros(len(nrm)), nrm[:, 0]], 1); tl = np.linalg.norm(tg, axis=1, keepdims=True)
_suelo = np.isin(MAT.reshape(-1, 3)[:, 0], [kit.MATERIALES.index(x) for x in ('tierra', 'canto', 'losa')])
plano = (np.abs(nrm[:, 1]) > np.where(_suelo, 0.5, 0.9))[:, None] | (tl < 1e-6)
tg = np.where(plano, np.array([[1.0, 0, 0]]), tg / np.maximum(tl, 1e-9))
# el sentido de u, fijo (no según el giro de cada triángulo): si no, dos triángulos de la misma cara con distinto giro
# llevan la textura en espejo y se ve la costura en diagonal
# (el corte, en el ángulo de cara por el que casi no pasa ningún muro: así ninguna cara queda partida)
_th = np.arctan2(nrm[:, 2], nrm[:, 0])
_ar = 0.5 * np.linalg.norm(np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]), axis=1) * (~plano[:, 0])
_hist = np.histogram(np.mod(_th, np.pi), bins=360, range=(0, np.pi), weights=_ar)[0]
_hist = _hist + np.roll(_hist, 1) + np.roll(_hist, -1) + np.roll(_hist, 2) + np.roll(_hist, -2)
_thw = (np.argmin(_hist) + 0.5) * np.pi / 360
tg = np.where(((np.mod(_th - _thw, 2 * np.pi) >= np.pi) & ~plano[:, 0])[:, None], -tg, tg)
bt = np.array([[0, 1.0, 0]]) - nrm * nrm[:, 1:2]; bl = np.linalg.norm(bt, axis=1, keepdims=True)
bt = np.where(plano, np.array([[0, 0, 1.0]]), bt / np.maximum(bl, 1e-9))
# los triángulos muy finos (astillas de la triangulación alrededor de los huecos) tienen la normal poco precisa y, a
# 80 m del origen, un error de medio grado corre la textura varios centímetros: se ve la costura. Toman el plano del
# vecino bueno con el que comparten su lado más largo.
_lados = np.stack([np.linalg.norm(T[:, 1] - T[:, 0], axis=1), np.linalg.norm(T[:, 2] - T[:, 1], axis=1), np.linalg.norm(T[:, 0] - T[:, 2], axis=1)], 1)
_area = 0.5 * np.linalg.norm(np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]), axis=1)
_cal = _area / (_lados.max(1) ** 2 + 1e-12)
_clave = lambda p: (round(p[0] * 50), round(p[1] * 50), round(p[2] * 50))
_por_lado = {}
for i in range(len(T)):
    for k in range(3):
        a_, b_ = _clave(T[i, k]), _clave(T[i, (k + 1) % 3])
        _por_lado.setdefault((min(a_, b_), max(a_, b_)), []).append(i)
_malos = np.where(_cal < 0.08)[0]
for _ in range(3):
    for i in _malos:
        mejor_j, mejor_c = -1, _cal[i]
        for k in range(3):
            a_, b_ = _clave(T[i, k]), _clave(T[i, (k + 1) % 3])
            for j in _por_lado.get((min(a_, b_), max(a_, b_)), ()):
                if j != i and _cal[j] > mejor_c and abs((nrm[i] * nrm[j]).sum()) > 0.995: mejor_j, mejor_c = j, _cal[j]
        if mejor_j >= 0:
            tg[i] = tg[mejor_j]; bt[i] = bt[mejor_j]; _cal[i] = _cal[mejor_j]
if os.environ.get('DIAG'):
    _uv = lambda i, p: np.array([(p * tg[i]).sum(), (p * bt[i]).sum()])
    malas = []
    for (ka, kb), lst in _por_lado.items():
        if len(lst) != 2: continue
        i, j = lst
        if (nrm[i] * nrm[j]).sum() < 0.999 or MAT[i * 3] != MAT[j * 3] or kit.MATERIALES[MAT[i * 3]] not in ('sillar', 'mamp', 'piedra'): continue
        p = np.array(ka) / 50.0
        d = np.abs(_uv(i, p) - _uv(j, p)).max()
        if d > 0.01: malas.append((d, i, j))
    malas.sort(reverse=True)
    import collections; print('por material:', collections.Counter(kit.MATERIALES[MAT[i * 3]] for d, i, j in malas))
    print('costuras >1 cm:', len(malas), 'peores:', [(kit.MATERIALES[MAT[i * 3]], [round(float(x), 1) for x in T[i, 0]], round(d, 3), round(float(_cal[i]), 4), round(float(_cal[j]), 4), [round(float(x), 3) for x in nrm[i]], [round(float(x), 3) for x in nrm[j]]) for d, i, j in malas[:6]])
print('astillas con el plano del vecino:', int((_cal[_malos] >= 0.08).sum()), 'de', len(_malos))
tgv = np.repeat(tg, 3, 0); btv = np.repeat(bt, 3, 0)
UV = np.stack([(Pq * tgv).sum(1), (Pq * btv).sum(1)], 1)
dadas = np.array([uv is not None for uv in m.UV])
if dadas.any(): UV[dadas] = np.array([uv for uv in m.UV if uv is not None], dtype=np.float64)
# la altura sobre su suelo: el de su muro o, si no, el terreno
base = np.array([b if b is not None else np.nan for b in m.B], dtype=np.float64)
sin = np.isnan(base)
if sin.any():
    base[sin] = [h(x, z) for x, z in zip(P[sin, 0].astype(np.float64), P[sin, 2].astype(np.float64))]
HS = np.clip((P[:, 1] - base) * 10, 0, 255).round().astype(np.uint8)
orden = np.argsort(MAT, kind='stable')
q = np.round(Pq * 100).astype(np.int32)
assert np.abs(q).max() < 32767, 'fuera de rango'
# las astillas que al redondear al centímetro se quedan sin área o se dan la vuelta: fuera (dejaban rendijas de luz
# a lo largo de las diagonales de la triangulación)
_Tq = q.reshape(-1, 3, 3).astype(np.float64)
_nq = np.cross(_Tq[:, 1] - _Tq[:, 0], _Tq[:, 2] - _Tq[:, 0])
_aq = np.linalg.norm(_nq, axis=1)
_dot = (_nq * nrm).sum(1) / np.maximum(_aq, 1e-9)
_vale = (_aq > 0.5) & (_dot > 0.2)
print('astillas quitadas al redondear:', int((~_vale).sum()))
orden = orden[_vale[orden // 3]]
nv = len(orden)
UVq = np.round(UV * 100)
UVq = (UVq - np.floor(UVq.reshape(-1, 3, 2).min(1) / 40000 + 0).repeat(3, 0) * 0).astype(np.int64)
assert np.abs(UVq).max() < 32767, 'UV fuera de rango'
cuentas = [(nm, int((MAT[orden] == i).sum())) for i, nm in enumerate(kit.MATERIALES) if (MAT[orden] == i).any()]
cab = b'KCR2' + struct.pack('<If', nv, 0.01) + struct.pack('<I', len(cuentas))
for nm, k in cuentas: cab += struct.pack('<B', len(nm)) + nm.encode() + struct.pack('<I', k)
C8 = (np.clip(np.asarray(Cc).reshape(-1, 3), 0, 1) * 255).round().astype(np.uint8)
cuerpo = cab + q[orden].astype('<i2').tobytes() + C8[orden].tobytes() + UVq[orden].astype('<i2').tobytes() + HS[orden].tobytes()
DEST = DEST.replace('castillo-rey-v1', 'castillo-rey-v2'); os.makedirs(DEST, exist_ok=True)
open(os.path.join(DEST, 'castillo.bin.gz'), 'wb').write(gzip.compress(cuerpo, 9, mtime=0))
print('materiales', dict(cuentas))
open(os.path.join(DEST, 'colision.json'), 'w').write(open('/tmp/castillo_colision.json').read())
print('para el juego:', len(Pq), 'vértices,', os.path.getsize(os.path.join(DEST, 'castillo.bin.gz')) // 1024, 'KB la malla,', os.path.getsize(os.path.join(DEST, 'colision.json')) // 1024, 'KB los choques')

DATOS_JS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'logica', 'castillo_rey_datos.js')
open(DATOS_JS, 'w').write("// Kinhold — datos fijos del castillo del rey (los escribe herramientas/castillo_rey/modelo.py: no se tocan a mano).\n"
    "// ZONA: el castillo, su foso, la barbacana y la explanada, en el mundo (ahí no crece nada ni sale nada que recoger).\n"
    "// FOSO: marcas de nivelado (src/logica/nivelado.js) en el mundo: [x, z, y del fondo, radio, borde].\n"
    f"export const ZONA = {json.dumps(d['zona'], separators=(',', ':'))};\n"
    f"export const FOSO = {json.dumps(d['foso'], separators=(',', ':'))};\n"
    "// SIN_HIERBA: polígonos (en el mundo) donde no crece la hierba ni las matas: el recinto, la barbacana y los caminos.\n"
    f"export const SIN_HIERBA = {json.dumps(d['sin_hierba'], separators=(',', ':'))};\n"
    "// HIERBA_DENTRO: dentro del recinto, al pie de los muros del patio de armas, sí crece: polígonos [anillo, ...huecos].\n"
    f"export const HIERBA_DENTRO = {json.dumps(d['hierba_dentro'], separators=(',', ':'))};\n")
