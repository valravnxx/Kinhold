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
from puertas import BU as _BU, BW0 as _BW0, BW1 as _BW1
_calle = (217465 + 79.0, 53060 - 57.0)
patios.camino_explanada(m, [_calle, _G.p2(_BU * 0.6, _BW1 + 9.5), _G.p2(-_BU - 4.0, _BW1 + 4.5), _G.p2(-_BU - 4.0, _BW1 - 4.5), _G.p2(-_BU + 1.6, _BW1 - 4.5)])
patios.camino_explanada(m, [_G.p2(-_BU + 1.6, _BW1 - 4.5), _G.p2(-2.0, _BW0 + 4.0), _G.p2(0, _BW0 + 1.6)], 3.0)
print('suelos', m.n())
import numpy as np
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
json.dump(d, open('/tmp/castillo_colision.json', 'w'), separators=(',', ':'))
print('marcas del foso', len(marcas), 'zona', len(d['zona']))
# ---------------- para el juego: la malla (cuantizada a 1 cm, comprimida) y los choques
import gzip, os, struct
DEST = os.environ.get('DEST', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'docs', 'recursos', 'mundo', 'castillo-rey-v1'))
os.makedirs(DEST, exist_ok=True)
Pq = np.asarray(P, dtype=np.float64).reshape(-1, 3).copy()
Pq[:, 0] -= ORIGEN[0]; Pq[:, 2] -= ORIGEN[1]
q = np.round(Pq * 100).astype(np.int32)
assert np.abs(q).max() < 32767, 'fuera de rango'
cab = b'KCR1' + struct.pack('<If', len(Pq), 0.01)
cuerpo = cab + q.astype('<i2').tobytes() + (np.clip(np.asarray(Cc).reshape(-1, 3), 0, 1) * 255).round().astype(np.uint8).tobytes()
open(os.path.join(DEST, 'castillo.bin.gz'), 'wb').write(gzip.compress(cuerpo, 9, mtime=0))
open(os.path.join(DEST, 'colision.json'), 'w').write(open('/tmp/castillo_colision.json').read())
print('para el juego:', len(Pq), 'vértices,', os.path.getsize(os.path.join(DEST, 'castillo.bin.gz')) // 1024, 'KB la malla,', os.path.getsize(os.path.join(DEST, 'colision.json')) // 1024, 'KB los choques')

DATOS_JS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'logica', 'castillo_rey_datos.js')
open(DATOS_JS, 'w').write("// Kinhold — datos fijos del castillo del rey (los escribe herramientas/castillo_rey/modelo.py: no se tocan a mano).\n"
    "// ZONA: el castillo, su foso, la barbacana y la explanada, en el mundo (ahí no crece nada ni sale nada que recoger).\n"
    "// FOSO: marcas de nivelado (src/logica/nivelado.js) en el mundo: [x, z, y del fondo, radio, borde].\n"
    f"export const ZONA = {json.dumps(d['zona'], separators=(',', ':'))};\n"
    f"export const FOSO = {json.dumps(d['foso'], separators=(',', ':'))};\n")
