# Los choques del castillo: mientras se construye la malla, se apunta dónde se pisa y qué para el paso.
# Se importa ANTES que el resto (modelo.py): envuelve funciones del kit para que, además de dibujar, apunten:
#  - suelos: rectángulos horizontales (con sus huecos) que se pisan y bajo los que se pasa (plantas, adarves, puentes);
#  - rampas: escaleras rectas (macizas: no se pasa por debajo);
#  - solidos: prismas (polígono, de y0 a y1): se pisa su cara de arriba y paran el cuerpo (peldaños del caracol, pilas,
#    rellanos, muebles);
#  - muros: segmentos de muro (con su altura), con las puertas abiertas;
#  - techos: lo que cubre (tejados): solo para la cámara (corte por plantas).
import math
import kit

COL = {'suelos': [], 'rampas': [], 'solidos': [], 'muros': [], 'techos': [], 'caracoles': []}
_callado = [0]          # > 0: dentro de algo que ya se apunta entero (no se apuntan sus piezas)
HUECO_PRISMA = [None]   # (u, w) en el marco: el lado del prisma sin tapa más cercano se deja abierto (la puerta de una caseta)

def _fr(f): return [f.o[0], f.o[1], f.a]
def _r(v): return round(float(v), 3)

def _seg(f, ua, wa, ub, wb, y0, y1):
    a = f.p2(ua, wa); b = f.p2(ub, wb)
    COL['muros'].append([_r(a[0]), _r(a[1]), _r(b[0]), _r(b[1]), _r(f.y0 + y0), _r(f.y0 + y1)])

def seg_mundo(a, b, y0, y1):
    """un segmento que para el paso, con sus puntos en el mundo (x, y, z)"""
    COL['muros'].append([_r(a[0]), _r(a[2]), _r(b[0]), _r(b[2]), _r(y0), _r(y1)])

def _caja_muro(f, u0, u1, w0, w1, y0, y1):
    _seg(f, u0, w0, u1, w0, y0, y1); _seg(f, u1, w0, u1, w1, y0, y1); _seg(f, u1, w1, u0, w1, y0, y1); _seg(f, u0, w1, u0, w0, y0, y1)

def solido(f, pts, y0, y1, mueble=False):
    e = {'f': _fr(f), 'p': [[_r(u), _r(w)] for u, w in pts], 'y0': _r(f.y0 + y0), 'y1': _r(f.y0 + y1)}
    if mueble: e['n'] = 1
    COL['solidos'].append(e)

def solido_caja(f, u0, u1, w0, w1, y0, y1, mueble=False):
    solido(f, [(u0, w0), (u1, w0), (u1, w1), (u0, w1)], y0, y1, mueble)

def suelo(f, u0, u1, w0, w1, y, huecos=()):
    COL['suelos'].append({'f': _fr(f), 'u': [_r(u0), _r(u1)], 'w': [_r(w0), _r(w1)], 'y': _r(f.y0 + y), 'h': [[_r(x) for x in hh] for hh in huecos]})

def techo(f, u0, u1, w0, w1, y):
    COL['techos'].append({'f': _fr(f), 'u': [_r(min(u0, u1)), _r(max(u0, u1))], 'w': [_r(min(w0, w1)), _r(max(w0, w1))], 'y': _r(f.y0 + y)})

# ---------------- envolturas del kit
_muro = kit.muro
def muro(m, f, u0, u1, v0, v1, w0, w1, huecos=(), *a, **k):
    _muro(m, f, u0, u1, v0, v1, w0, w1, huecos, *a, **k)
    if _callado[0]: return
    # las puertas (huecos de 1,7 m de alto y 0,75 de ancho o más) se abren; lo demás (ventanas, saeteras) para el paso
    puertas = []
    for h in huecos:
        alto = h['v1'] - h['v0']; ancho = h['a']
        if alto >= 1.7 and ancho >= 0.75:
            puertas.append((h['u'] - ancho / 2, h['u'] + ancho / 2, h['v0'], h['v0'] + alto))
            # el umbral: se pisa de una cara a la otra del muro
            suelo(f, h['u'] - ancho / 2, h['u'] + ancho / 2, min(w0, w1) - 0.05, max(w0, w1) + 0.05, h['v0'])
    cortes = sorted({u0, u1, *[max(u0, min(u1, x)) for p in puertas for x in p[:2]]})
    for a_, b_ in zip(cortes, cortes[1:]):
        if b_ - a_ < 0.01: continue
        um = (a_ + b_) / 2
        tramos = [(v0, v1)]
        for (pa, pb, pv0, pv1) in puertas:
            if not (pa <= um <= pb): continue
            nt = []
            for (x0, x1) in tramos:
                if pv1 <= x0 or pv0 >= x1: nt.append((x0, x1)); continue
                if x0 < pv0: nt.append((x0, pv0))
                if pv1 < x1: nt.append((pv1, x1))
            tramos = nt
        umbrales = [pv0 for (pa, pb, pv0, pv1) in puertas if pa <= um <= pb]
        for (x0, x1) in tramos:
            if x1 - x0 <= 0.05: continue
            # lo de debajo de una puerta (su umbral) es macizo: se sube si es un paso, y si no, para (como un muro)
            if any(abs(x1 - u_) < 1e-6 for u_ in umbrales): solido_caja(f, a_, b_, min(w0, w1), max(w0, w1), x0, x1)
            else: _caja_muro(f, a_, b_, min(w0, w1), max(w0, w1), x0, x1)
kit.muro = muro

_suelo_tablas = kit.suelo_tablas
def suelo_tablas(m, f, u0, u1, w0, w1, v, *a, huecos=(), **k):
    if len(a) >= 4: huecos = a[3]; a = a[:3]
    _callado[0] += 1
    try: _suelo_tablas(m, f, u0, u1, w0, w1, v, *a, huecos=huecos, **k)
    finally: _callado[0] -= 1
    if not _callado[0]: suelo(f, u0, u1, w0, w1, v, huecos)
kit.suelo_tablas = suelo_tablas

_suelo_losas = kit.suelo_losas
def suelo_losas(m, f, u0, u1, w0, w1, v, *a, **k):
    _suelo_losas(m, f, u0, u1, w0, w1, v, *a, **k)
    if not _callado[0]: suelo(f, u0, u1, w0, w1, v)
kit.suelo_losas = suelo_losas

_escalera = kit.escalera
def escalera(m, f, u0, u1, w0, w1, v0, v1, col=kit.PIEDRA, maciza=True, *a, **k):
    _callado[0] += 1
    try: _escalera(m, f, u0, u1, w0, w1, v0, v1, col, maciza, *a, **k)
    finally: _callado[0] -= 1
    if not _callado[0]:
        COL['rampas'].append({'f': _fr(f), 'u': [_r(u0), _r(u1)], 'w': [_r(min(w0, w1)), _r(max(w0, w1))], 'y': [_r(f.y0 + v0), _r(f.y0 + v1)], 'm': 1 if maciza else 0})
kit.escalera = escalera

_prisma = kit.prisma
def prisma(m, f, pts, v0, v1, col, tapa=True, *a, **k):
    _prisma(m, f, pts, v0, v1, col, tapa, *a, **k)
    if _callado[0]: return
    if tapa: solido(f, pts, v0, v1); return
    # sin tapa: una caseta (paredes); el lado de la puerta se deja abierto
    n = len(pts); abierto = None
    if HUECO_PRISMA[0]:
        pu, pw = HUECO_PRISMA[0]
        abierto = min(range(n), key=lambda i: math.hypot((pts[i][0] + pts[(i + 1) % n][0]) / 2 - pu, (pts[i][1] + pts[(i + 1) % n][1]) / 2 - pw))
    for i in range(n):
        if i == abierto: continue
        a_, b_ = pts[i], pts[(i + 1) % n]
        _seg(f, a_[0], a_[1], b_[0], b_[1], v0, v1)
    HUECO_PRISMA[0] = None
kit.prisma = prisma

_caja = kit.caja
def caja(m, f, u0, u1, v0, v1, w0, w1, col, *a, **k):
    _caja(m, f, u0, u1, v0, v1, w0, w1, col, *a, **k)
    # las cajas altas (tabiques, pilares, postes) paran el paso; las pintadas de oscuro son huecos fingidos
    if _callado[0] or col == kit.OSCURO or abs(v1 - v0) < 1.5: return
    solido_caja(f, min(u0, u1), max(u0, u1), min(w0, w1), max(w0, w1), min(v0, v1), max(v0, v1))
kit.caja = caja

for nombre in ('tejado_dos_aguas', 'tejado_una_agua'):
    orig = getattr(kit, nombre)
    def envuelto(m, f, u0, u1, w0, w1, *a, _o=orig, _n=nombre, **k):
        _callado[0] += 1
        try: r = _o(m, f, u0, u1, w0, w1, *a, **k)
        finally: _callado[0] -= 1
        v = a[0] if _n == 'tejado_dos_aguas' else min(a[0], a[1])
        techo(f, u0, u1, w0, w1, v)
        return r
    setattr(kit, nombre, envuelto)

# los muebles: su caja en su marco, entera, como un sólido
def _mueble(nombre):
    orig = getattr(kit, nombre)
    def envuelto(m, f, *a, **k):
        n0 = len(m.P)
        _callado[0] += 1
        try: r = orig(m, f, *a, **k)
        finally: _callado[0] -= 1
        if _callado[0] or len(m.P) == n0: return r
        us, ws, ys = [], [], []
        for (x, y, z) in m.P[n0:]:
            dx, dz = x - f.o[0], z - f.o[1]
            us.append(dx * f.eu[0] + dz * f.eu[1]); ws.append(dx * f.ew[0] + dz * f.ew[1]); ys.append(y - f.y0)
        solido_caja(f, min(us), max(us), min(ws), max(ws), min(ys), max(ys), True)
        return r
    setattr(kit, nombre, envuelto)
for n in ('mesa', 'banco', 'cama', 'arca', 'tonel', 'estante', 'armero', 'chimenea', 'carro', 'pozo', 'abrevadero', 'yunque', 'fragua', 'altar', 'pesebre', 'heno', 'diana', 'llamas', 'rastrillo', 'puerta_tablas', 'tapiz', 'antorcha', 'saco', 'jergon', 'silla', 'taburete', 'caldero', 'ventana'):
    if n in ('llamas', 'rastrillo', 'puerta_tablas', 'tapiz', 'antorcha', 'saco', 'jergon', 'silla', 'taburete', 'caldero', 'ventana'):
        # (no paran el paso: se callan sus cajas)
        orig = getattr(kit, n)
        def callado(*a, _o=orig, **k):
            _callado[0] += 1
            try: return _o(*a, **k)
            finally: _callado[0] -= 1
        setattr(kit, n, callado)
    else: _mueble(n)

def callar():
    """con callar(): lo que se dibuje dentro no se apunta"""
    class _C:
        def __enter__(s): _callado[0] += 1
        def __exit__(s, *e): _callado[0] -= 1
    return _C()

_caracol = kit.caracol
def caracol(m, f, cu, cw, r, v0, v1, *a, **k):
    _caracol(m, f, cu, cw, r, v0, v1, *a, **k)
    if not _callado[0]: COL['caracoles'].append({'f': _fr(f), 'c': [_r(cu), _r(cw)], 'r': _r(r), 'y': [_r(f.y0 + v0), _r(f.y0 + v1)]})
kit.caracol = caracol
