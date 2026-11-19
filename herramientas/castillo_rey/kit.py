# Kit de modelado por código para el castillo del rey: malla con color por vértice, marcos locales, muros con huecos
# (arcos, derrames), sillería y mampostería, tejados de teja, escaleras, suelos y muebles.
# Coordenadas del mundo: x este, z sur, y arriba (metros, altura del mundo). Un marco local F: u a lo largo, v arriba,
# w hacia «fuera» (la cara delantera), con su origen en el mundo.
import math, random
import numpy as np
import mapbox_earcut as earcut

RNG = random.Random(17)
def az(): return RNG.random()

def hexc(h):
    n = int(h[1:], 16); return ((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255)
def esc(c, f): return tuple(min(1.0, v * f) for v in c)
def mezcla(a, b, t): return tuple(a[i] * (1 - t) + b[i] * t for i in range(3))
def varia(c, f=0.08): r = 1 - f + 2 * f * az(); return esc(c, r)

# ---------------- materiales (la referencia: piedra gris parda, teja parda gastada, madera oscura, revoco ocre)
PIEDRA = hexc('#8c8475'); PIEDRA_CLARA = hexc('#9e9686'); PIEDRA_OSC = hexc('#70695d'); MORTERO = hexc('#6a6357')
MAMPOST = hexc('#877e6e'); SILLAR_DOV = hexc('#8e8678')
MADERA = hexc('#46372b'); MADERA_CL = hexc('#5f4d3c'); MADERA_VIEJA = hexc('#5a4a3a'); TABLA = hexc('#6b5a48'); HIERRO = hexc('#2c2a28')
TEJA = hexc('#6e5a4b'); PAJA = hexc('#8c7a4e'); MUSGO = hexc('#56653a'); HUMEDAD = hexc('#5b5a46')
REVOCO = hexc('#cdb48a'); CAL = hexc('#d9cfb8'); TIERRA = hexc('#6f5d45'); BARRO = hexc('#5c4a36'); LOSA = hexc('#8b8475')
HENO = hexc('#b5a25c'); TELA_ROJA = hexc('#7a3328'); TELA_AZUL = hexc('#3d4c63'); LANA = hexc('#a99a7c'); OSCURO = hexc('#1a140e')
AGUA = hexc('#3e5a66'); HOJA = hexc('#4f6533'); FUEGO = hexc('#c2582c'); CENIZA = hexc('#3c3630')

# ---------------- materiales de la malla (cada uno, una textura del juego: texturas.py)
# Lo que no dice su material lo toma del color: el de la paleta con el matiz más parecido.
MATERIALES = ['sillar', 'mamp', 'piedra', 'losa', 'canto', 'tierra', 'madera', 'tabla', 'teja', 'paja', 'tela', 'liso', 'fuego']
def _croma(c):
    s = sum(c) or 1e-6; return (c[0] / s, c[1] / s, c[2] / s)
_PAL = []
def _pal(cols, mat):
    for c in cols: _PAL.append((_croma(c), sum(c) / 3, mat))
def mat_de(c):
    if sum(c) / 3 < 0.09: return 'liso'
    k = _croma(c); mejor = None
    for (kc, l, mat) in _PAL:
        d = (k[0] - kc[0]) ** 2 + (k[1] - kc[1]) ** 2 + (k[2] - kc[2]) ** 2
        if mejor is None or d < mejor[0]: mejor = (d, mat)
    return mejor[1]

_pal([PIEDRA, PIEDRA_CLARA, PIEDRA_OSC, MORTERO, MAMPOST, SILLAR_DOV, LOSA, CAL], 'piedra')
_pal([MADERA, MADERA_CL, MADERA_VIEJA, TABLA], 'madera')
_pal([TIERRA, BARRO], 'tierra'); _pal([PAJA, HENO], 'paja'); _pal([TELA_ROJA, TELA_AZUL, LANA, REVOCO], 'tela')
_pal([HIERRO, OSCURO, AGUA, HOJA, MUSGO, HUMEDAD, FUEGO, CENIZA], 'liso')

class Malla:
    def __init__(self):
        self.P = []; self.C = []; self.M = []; self.UV = []; self.B = []
        self.mat = None      # el material de lo que se dibuja ahora (None: el del color)
        self.base = None     # el suelo bajo lo que se dibuja ahora (altura del mundo; None: el terreno)
    def _meta(self, k, c, uv):
        self.M += [self.mat or mat_de(c)] * k; self.B += [self.base] * k
        self.UV += uv if uv else [None] * k
    def tri(self, a, b, c, ca, cb=None, cc=None, uv=None):
        self.P += [a, b, c]; self.C += [ca, cb or ca, cc or ca]; self._meta(3, ca, uv)
    def quad(self, a, b, c, d, ca, cb=None, cc=None, cd=None, uv=None):
        cb = cb or ca; cc = cc or ca; cd = cd or ca
        self.P += [a, b, c, a, c, d]; self.C += [ca, cb, cc, ca, cc, cd]
        self._meta(6, ca, [uv[0], uv[1], uv[2], uv[0], uv[2], uv[3]] if uv else None)
    def anade(self, otra):
        self.P += otra.P; self.C += otra.C; self.M += otra.M; self.UV += otra.UV; self.B += otra.B
    def arrays(self):
        return np.array(self.P, dtype=np.float32), np.clip(np.array(self.C, dtype=np.float32), 0, 1)
    def n(self): return len(self.P) // 3

class con:
    """with con(m, 'tabla', base=…): lo que se dibuja dentro lleva ese material (y ese suelo)"""
    _NADA = object()
    def __init__(self, m, mat=None, base=_NADA): self.m = m; self.mat = mat; self.b = base
    def __enter__(self):
        self.antes = (self.m.mat, self.m.base)
        if self.mat is not None: self.m.mat = self.mat
        if self.b is not con._NADA: self.m.base = self.b
    def __exit__(self, *e): self.m.mat, self.m.base = self.antes

class F:
    """marco local: origen (x, z) en el mundo, ángulo de u, y0 la altura base; w = u girado 90° (izquierda de u si se mira desde arriba con z hacia abajo)"""
    def __init__(self, ox, oz, ang, y0=0.0):
        self.o = (ox, oz); self.a = ang; self.y0 = y0
        self.eu = (math.cos(ang), math.sin(ang)); self.ew = (-math.sin(ang), math.cos(ang))
    def __call__(self, u, v, w):
        return (self.o[0] + self.eu[0] * u + self.ew[0] * w, self.y0 + v, self.o[1] + self.eu[1] * u + self.ew[1] * w)
    def p2(self, u, w):
        return (self.o[0] + self.eu[0] * u + self.ew[0] * w, self.o[1] + self.eu[1] * u + self.ew[1] * w)
    def sub(self, du, dw, dang=0.0, dy=0.0):
        p = self.p2(du, dw); return F(p[0], p[1], self.a + dang, self.y0 + dy)
    @staticmethod
    def de_segmento(a, b, y0=0.0):
        return F(a[0], a[1], math.atan2(b[1] - a[1], b[0] - a[0]), y0)

# ---------------- primitivas
def caja(m, f, u0, u1, v0, v1, w0, w1, col, sombra=0.78, caras='todas', var=0.0):
    c = varia(col, var) if var else col
    P = lambda u, v, w: f(u, v, w)
    cb = esc(c, sombra)   # lo de abajo, más oscuro (oclusión)
    if caras == 'todas' or 'w1' in caras: m.quad(P(u0, v0, w1), P(u1, v0, w1), P(u1, v1, w1), P(u0, v1, w1), cb, cb, c, c)
    if caras == 'todas' or 'w0' in caras: m.quad(P(u1, v0, w0), P(u0, v0, w0), P(u0, v1, w0), P(u1, v1, w0), cb, cb, c, c)
    if caras == 'todas' or 'u0' in caras: m.quad(P(u0, v0, w0), P(u0, v0, w1), P(u0, v1, w1), P(u0, v1, w0), esc(cb, .9), esc(cb, .9), esc(c, .9), esc(c, .9))
    if caras == 'todas' or 'u1' in caras: m.quad(P(u1, v0, w1), P(u1, v0, w0), P(u1, v1, w0), P(u1, v1, w1), esc(cb, .9), esc(cb, .9), esc(c, .9), esc(c, .9))
    if caras == 'todas' or 'v1' in caras: m.quad(P(u0, v1, w1), P(u1, v1, w1), P(u1, v1, w0), P(u0, v1, w0), esc(c, 1.05))
    if caras == 'todas' or 'v0' in caras: m.quad(P(u0, v0, w0), P(u1, v0, w0), P(u1, v0, w1), P(u0, v0, w1), esc(c, .5))

def prisma(m, f, pts, v0, v1, col, tapa=True, base=False, sombra=0.8):
    """pts en (u, w), en cualquier sentido; paredes y tapa"""
    n = len(pts); cb = esc(col, sombra)
    _m0 = m.mat
    if m.mat is None and v1 - v0 > 1.6 and mat_de(col) == 'piedra': m.mat = 'sillar'
    area = sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n))
    if area < 0: pts = pts[::-1]
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        l = 0.84 + 0.16 * ((i % 3) / 2)
        m.quad(f(b[0], v0, b[1]), f(a[0], v0, a[1]), f(a[0], v1, a[1]), f(b[0], v1, b[1]), esc(cb, l), esc(cb, l), esc(col, l), esc(col, l))
    if tapa or base:
        idx = earcut.triangulate_float64(np.array(pts, dtype=np.float64), np.array([n], dtype=np.uint32))
        for k in range(0, len(idx), 3):
            a, b, c = pts[idx[k]], pts[idx[k + 1]], pts[idx[k + 2]]
            if tapa: m.tri(f(a[0], v1, a[1]), f(c[0], v1, c[1]), f(b[0], v1, b[1]), esc(col, 1.05))
            if base: m.tri(f(a[0], v0, a[1]), f(b[0], v0, b[1]), f(c[0], v0, c[1]), esc(col, .5))
    m.mat = _m0

def cilindro(m, f, cu, cw, r, v0, v1, col, n=10, tapa=True, r1=None):
    r1 = r if r1 is None else r1
    for i in range(n):
        a1, a2 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        p = lambda a, rr, v: f(cu + math.cos(a) * rr, v, cw + math.sin(a) * rr)
        l = 0.75 + 0.25 * (0.5 + 0.5 * math.cos(a1 - 0.8))
        q4 = [p(a2, r, v0), p(a1, r, v0), p(a1, r1, v1), p(a2, r1, v1)]
        cc = f(cu, (v0 + v1) / 2, cw); A_, B_, C_ = q4[0], q4[1], q4[2]
        nx_ = (B_[1] - A_[1]) * (C_[2] - A_[2]) - (B_[2] - A_[2]) * (C_[1] - A_[1]); nz_ = (B_[0] - A_[0]) * (C_[1] - A_[1]) - (B_[1] - A_[1]) * (C_[0] - A_[0])
        if nx_ * (A_[0] - cc[0]) + nz_ * (A_[2] - cc[2]) < 0: q4 = q4[::-1]
        m.quad(*q4, esc(col, l * 0.85))
        if tapa:
            A_, B_, C_ = f(cu, v1, cw), p(a2, r1, v1), p(a1, r1, v1)
            ny_ = (B_[2] - A_[2]) * (C_[0] - A_[0]) - (B_[0] - A_[0]) * (C_[2] - A_[2])
            if ny_ < 0: B_, C_ = C_, B_   # (la tapa mira arriba)
            m.tri(A_, B_, C_, esc(col, 1.05))

def bola(m, cx, cy, cz, r, ry, col, n=7, filas=4):
    def V(i, j):
        th = i / n * 2 * math.pi + j * 0.4; ph = -math.pi / 2 + j / filas * math.pi
        rr = r * (0.88 + 0.24 * ((math.sin(i * 3.1 + j * 1.7 + cx) + 1) / 2))
        return (cx + math.cos(th) * math.cos(ph) * rr, cy + math.sin(ph) * ry, cz + math.sin(th) * math.cos(ph) * rr)
    for j in range(filas):
        for i in range(n):
            f0 = 0.6 + 0.45 * j / filas; f1 = 0.6 + 0.45 * (j + 1) / filas; c = varia(col, 0.07)
            m.quad(V(i, j), V(i + 1, j), V(i + 1, j + 1), V(i, j + 1), esc(c, f0), esc(c, f0), esc(c, f1), esc(c, f1))

# ---------------- huecos: contorno de un hueco en (u, v)
def contorno(h, ancho_extra=0.0):
    """h: {'u': centro, 'a': ancho, 'v0': umbral, 'v1': arranque del arco (o dintel), 'arco': None|'medio'|'apuntado'|'escarzano'}"""
    a = h['a'] + ancho_extra; u0, u1 = h['u'] - a / 2, h['u'] + a / 2; v0, v1 = h['v0'] - (ancho_extra * 0.5 if h['v0'] > 0.05 else 0), h['v1']
    pts = [(u0, v0), (u1, v0), (u1, v1)]
    arco = h.get('arco'); N = 8
    if arco == 'medio':
        for i in range(1, N): t = math.pi * i / N; pts.append((h['u'] + math.cos(t) * a / 2, v1 + math.sin(t) * a / 2))
    elif arco == 'apuntado':
        R = a * 0.85; cxR, cxL = u1 - R, u0 + R
        top_u = h['u']; ac = lambda x: math.acos(max(-1.0, min(1.0, x)))
        t0_, t1_ = 0.0, ac((top_u - cxR) / R)
        for i in range(1, N // 2 + 1):   # lado derecho: centro en cxR, de u1 hacia el centro
            t = t0_ + (t1_ - t0_) * i / (N // 2)
            pts.append((cxR + R * math.cos(t), v1 + R * math.sin(t)))
        for i in range(N // 2 - 1, 0, -1):
            t = t0_ + (t1_ - t0_) * i / (N // 2)
            pts.append((2 * h['u'] - (cxR + R * math.cos(t)), v1 + R * math.sin(t)))
    elif arco == 'escarzano':
        sag = a * 0.18
        for i in range(1, N): t = i / N; pts.append((u1 - a * t, v1 + sag * math.sin(math.pi * t)))
    pts.append((u0, v1))
    return pts

def alto_hueco(h):
    a = h['a']; arco = h.get('arco')
    if arco == 'medio': return h['v1'] + a / 2
    if arco == 'apuntado': R = a * 0.85; return h['v1'] + math.sqrt(R * R - (R - a / 2) ** 2)
    if arco == 'escarzano': return h['v1'] + a * 0.18
    return h['v1']

def _cara_con_huecos(m, f, u0, u1, v0, v1, w, huecos_pts, col, normal_mas):
    """la cara de un muro con sus huecos. Se parte en columnas por los lados de los huecos (y en franjas de 1,5 m en lo
       liso) y cada trozo se triangula aparte: así no salen astillas de punta a punta del muro, que dan hilos de luz"""
    # columnas: los tramos de u que ocupan los huecos (los que se solapan, juntos) y lo que queda entre ellos
    tramos = sorted([(min(p[0] for p in hp), max(p[0] for p in hp)) for hp in huecos_pts])
    juntos = []
    for a, b in tramos:
        a, b = max(a - 0.05, u0), min(b + 0.05, u1)
        if juntos and a <= juntos[-1][1] + 0.3: juntos[-1] = (juntos[-1][0], max(juntos[-1][1], b))
        else: juntos.append((a, b))
    cortes = [u0]
    for a, b in juntos:
        if a - cortes[-1] > 1e-6: cortes.append(a)
        cortes.append(b)
    if u1 - cortes[-1] > 1e-6: cortes.append(u1)
    cortes = sorted(set(round(c, 6) for c in cortes))
    finos = []
    for a, b in zip(cortes, cortes[1:]):
        if any(ja - 1e-6 <= a and b <= jb + 1e-6 for ja, jb in juntos): finos.append((a, b)); continue
        n = max(1, int(math.ceil((b - a) / 1.5 - 1e-9)))
        finos += [(a + (b - a) * i / n, a + (b - a) * (i + 1) / n) for i in range(n)]
    for (ca, cb) in finos:
        hs = [hp for hp in huecos_pts if ca - 1e-6 <= min(p[0] for p in hp) and max(p[0] for p in hp) <= cb + 1e-6]
        _trozo_con_huecos(m, f, ca, cb, v0, v1, w, hs, col, normal_mas)

def _trozo_con_huecos(m, f, u0, u1, v0, v1, w, huecos_pts, col, normal_mas):
    outer = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    rings = [outer] + [hp[::-1] for hp in huecos_pts]   # earcut: anillo exterior y huecos
    verts = [p for r in rings for p in r]
    ends = np.cumsum([len(r) for r in rings]).astype(np.uint32)
    idx = earcut.triangulate_float64(np.array(verts, dtype=np.float64), ends)
    for k in range(0, len(idx), 3):
        a, b, c = verts[idx[k]], verts[idx[k + 1]], verts[idx[k + 2]]
        A, B, C = f(a[0], a[1], w), f(b[0], b[1], w), f(c[0], c[1], w)
        cola = lambda p: esc(col, 0.72 + 0.28 * min(1, (p[1] - v0) / 2.5))
        if normal_mas: m.tri(A, B, C, cola(a), cola(b), cola(c))
        else: m.tri(A, C, B, cola(a), cola(c), cola(b))

def _bloque(m, f, pts, w, d, col):
    """sillar que sobresale d de la cara w (d con signo: hacia donde mira la cara): cara de delante y cantos"""
    with con(m, 'piedra'):
        n = len(pts)
        A = [f(u, v, w + d) for (u, v) in pts]; Z = [f(u, v, w) for (u, v) in pts]
        area = sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n))
        orden = (area > 0) == (d > 0)
        for i in range(1, n - 1):
            if orden: m.tri(A[0], A[i], A[i + 1], col)
            else: m.tri(A[0], A[i + 1], A[i], col)
        for i in range(n):
            j = (i + 1) % n
            if orden: m.quad(Z[i], Z[j], A[j], A[i], esc(col, 0.55))
            else: m.quad(Z[j], Z[i], A[i], A[j], esc(col, 0.55))

def _piedras(m, f, u0, u1, v0, v1, w, huecos, col, tipo, signo, suelo):
    """las piedras labradas de cada hueco sobre la cara w (signo = +1 si mira a +w): jambas, dovelas, dintel, marcos"""
    d = 0.012 * signo   # (casi enrasadas: la junta la da el canto oscuro; si salen más, de cerca parecen naipes)
    # dovelas y jambas de cada hueco
    for h in huecos:
        if h.get('sin_dovelas'):
            if h['a'] < 0.3 and h.get('con_marco'):   # saetera (con marco solo si se pide; si no, el hueco y su derrame): dos sillares largos a los lados, dintel y alféizar
                ux0, ux1 = h['u'] - h['a'] / 2, h['u'] + h['a'] / 2
                for (a, b, y0_, y1_) in ((ux0 - 0.3, ux0 - 0.01, h['v0'] - 0.25, h['v1'] + 0.25), (ux1 + 0.01, ux1 + 0.3, h['v0'] - 0.25, h['v1'] + 0.25),
                                         (ux0 - 0.01, ux1 + 0.01, h['v1'] + 0.01, h['v1'] + 0.25), (ux0 - 0.01, ux1 + 0.01, h['v0'] - 0.25, h['v0'] - 0.01)):
                    _bloque(m, f, [(a, y0_), (b, y0_), (b, y1_), (a, y1_)], w, d, varia(SILLAR_DOV, 0.05))
            continue
        ux0, ux1 = h['u'] - h['a'] / 2, h['u'] + h['a'] / 2
        # jambas: sillares alternos a los lados
        yy = h['v0']; k = 0
        while yy < h['v1'] - 0.05:
            yt = min(h['v1'], yy + 0.42)
            ext = 0.32 if k % 2 else 0.5
            for (a, b) in ((ux0 - ext, ux0 - 0.01), (ux1 + 0.01, ux1 + ext)):
                _bloque(m, f, [(a, yy + 0.01), (b, yy + 0.01), (b, yt - 0.01), (a, yt - 0.01)], w, d, varia(SILLAR_DOV, 0.06))
            yy = yt; k += 1
        # el arco: dovelas en abanico
        cp = contorno(h)[2:-1]
        if h.get('arco'):
            cu = h['u']; cv = h['v1']
            for i in range(len(cp) - 1):
                p0, p1 = cp[i], cp[i + 1]
                def fuera_(p, r=0.38):
                    dx, dy = p[0] - cu, p[1] - cv + 0.15; L = math.hypot(dx, dy) or 1
                    return (p[0] + dx / L * r, p[1] + dy / L * r)
                _bloque(m, f, [p0, p1, fuera_(p1), fuera_(p0)], w, d, varia(SILLAR_DOV, 0.06))
        else:   # dintel de una pieza
            _bloque(m, f, [(ux0 - 0.25, h['v1'] + 0.01), (ux1 + 0.25, h['v1'] + 0.01), (ux1 + 0.25, h['v1'] + 0.4), (ux0 - 0.25, h['v1'] + 0.4)], w, d, varia(SILLAR_DOV, 0.05))

def esquinales(m, f, u0, u1, v0, v1, w, k0=0):
    """los sillares de las esquinas de una cara (en u0 y u1, sobre la cara w que mira a +w), alternando largo y corto"""
    y = v0; k = k0
    while y < v1 - 0.1:
        yt = min(v1, y + 0.42)
        for (u, s, par) in ((u0, 1, k), (u1, -1, k + 1)):
            l = 0.62 if par % 2 else 0.36
            a, b = (u, u + l) if s > 0 else (u - l, u)
            _bloque(m, f, [(a, y + 0.012), (b, y + 0.012), (b, yt - 0.012), (a, yt - 0.012)], w, 0.035, varia(SILLAR_DOV, 0.06))
        y = yt; k += 1

def muro(m, f, u0, u1, v0, v1, w0, w1, huecos=(), tipo='silleria', col=None, tapa=True, cabezas=True, suelo=None, piedras_dentro=True, dentro_col=None):
    """muro de u0 a u1, de v0 a v1, de grueso w0..w1 (w1 la cara de fuera). Huecos con derrame opcional:
       h['derrame'] = ancho de más en la cara de dentro (w0); h['v0d'] = umbral por dentro."""
    col = col or (PIEDRA if tipo == 'silleria' else MAMPOST)
    mort = col
    _mat_antes, _base_antes = m.mat, m.base
    m.mat = 'sillar' if tipo == 'silleria' else 'mamp'
    m.base = f.y0 + (v0 if suelo is None else suelo)
    H = [dict(h) for h in huecos]
    ext = [contorno(h) for h in H]
    inn = [contorno(h, h.get('derrame', 0.0)) for h in H]
    _cara_con_huecos(m, f, u0, u1, v0, v1, w1, ext, mort, True)
    _cara_con_huecos(m, f, u0, u1, v0, v1, w0, inn, esc(dentro_col or mort, 1.0), False)
    suelo = v0 if suelo is None else suelo
    _piedras(m, f, u0, u1, v0, v1, w1, H, col, tipo, +1, suelo)
    if piedras_dentro:
        Hd = [dict(h, a=h['a'] + h.get('derrame', 0.0)) for h in H]
        _piedras(m, f, u0, u1, v0, v1, w0, Hd, dentro_col or col, tipo, -1, suelo)
    # mochetas: unen el contorno de fuera con el de dentro
    for e, i_ in zip(ext, inn):
        n = len(e)
        for k in range(n):
            a, b = e[k], e[(k + 1) % n]; c, d = i_[(k + 1) % n], i_[k]
            if k == 0: continue   # el umbral se pone aparte
            l = 0.55 + 0.25 * (k % 2)
            with con(m, 'sillar'): m.quad(f(a[0], a[1], w1), f(b[0], b[1], w1), f(c[0], c[1], w0), f(d[0], d[1], w0), esc(col, l + 0.2))
        a, b = e[0], e[1]; c, d = i_[1], i_[0]
        es_puerta = abs(b[0] - a[0]) > 0.8
        with con(m, 'losa' if es_puerta else 'piedra'): m.quad(f(b[0], b[1], w1), f(a[0], a[1], w1), f(d[0], d[1], w0), f(c[0], c[1], w0), esc(LOSA, 0.8) if es_puerta else esc(SILLAR_DOV, 0.82))   # umbral / alféizar
    if tapa:
        with con(m, 'piedra'): m.quad(f(u0, v1, w1), f(u1, v1, w1), f(u1, v1, w0), f(u0, v1, w0), esc(col, 1.0))
    if cabezas:
        m.quad(f(u0, v0, w0), f(u0, v0, w1), f(u0, v1, w1), f(u0, v1, w0), esc(mort, .85))
        m.quad(f(u1, v0, w1), f(u1, v0, w0), f(u1, v1, w0), f(u1, v1, w1), esc(mort, .85))
    m.mat, m.base = _mat_antes, _base_antes

def almenado(m, f, u0, u1, v, w0, w1, alto_pretil=0.9, alto_merlon=1.0, paso=2.0, hueco=0.75, col=None, saeteras=True, albardilla=True):
    """pretil corrido y merlones con su albardilla; w1 la cara de fuera"""
    col = col or PIEDRA
    muro(m, f, u0, u1, v, v + alto_pretil, w0, w1, (), 'silleria', col, tapa=True, cabezas=True, suelo=v + 50)
    L = u1 - u0; n = max(1, int(round(L / paso)))
    paso = L / n
    for i in range(n):
        a = u0 + i * paso + hueco / 2; b = u0 + (i + 1) * paso - hueco / 2
        if b - a < 0.3: continue
        hs = [{'u': (a + b) / 2, 'a': 0.12, 'v0': v + alto_pretil + 0.15, 'v1': v + alto_pretil + alto_merlon - 0.2, 'derrame': 0.25, 'sin_dovelas': True}] if (saeteras and b - a > 1.0) else []
        muro(m, f, a, b, v + alto_pretil, v + alto_pretil + alto_merlon, w0, w1, hs, 'silleria', col, tapa=not albardilla, cabezas=True, suelo=v + 50)
        if albardilla:   # albardilla a dos aguas
            vt = v + alto_pretil + alto_merlon; wm = (w0 + w1) / 2
            c = varia(PIEDRA_CLARA, 0.04)
            with con(m, 'piedra'): m.quad(f(a - .04, vt, w1 + .05), f(b + .04, vt, w1 + .05), f(b + .04, vt + .12, wm), f(a - .04, vt + .12, wm), c)
            with con(m, 'piedra'): m.quad(f(b + .04, vt, w0 - .05), f(a - .04, vt, w0 - .05), f(a - .04, vt + .12, wm), f(b + .04, vt + .12, wm), esc(c, .85))
            with con(m, 'piedra'): m.tri(f(a - .04, vt, w0 - .05), f(a - .04, vt, w1 + .05), f(a - .04, vt + .12, wm), esc(c, .8))
            with con(m, 'sillar'): m.tri(f(b + .04, vt, w1 + .05), f(b + .04, vt, w0 - .05), f(b + .04, vt + .12, wm), esc(c, .8))
    # la albardilla del pretil en los huecos (cornisa)
    m.quad(f(u0, v + alto_pretil + .02, w1 + .06), f(u1, v + alto_pretil + .02, w1 + .06), f(u1, v + alto_pretil + .02, w0 - .04), f(u0, v + alto_pretil + .02, w0 - .04), esc(PIEDRA_CLARA, .95))

# ---------------- teja: faldón en hiladas escalonadas, pieza a pieza
def faldon(m, a0, a1, b0, b1, col, luz=1.0, paja=False, comba=0.06):
    """a0-a1: alero (puntos 3D), b0-b1: cumbrera (puntos 3D). Hiladas de a hacia b."""
    a0, a1, b0, b1 = map(np.array, (a0, a1, b0, b1))
    ds = a1 - a0; dt = b0 - a0
    nn = np.cross(ds, dt); nn = nn / (np.linalg.norm(nn) or 1)
    if nn[1] < 0: nn = -nn
    largo = np.linalg.norm(dt); ancho = np.linalg.norm(ds)
    n = 4 if paja else max(3, int(round(largo / 0.3))); mm = 3 if paja else max(2, int(round(ancho / 0.5)))
    lip = 0.0 if paja else 0.04
    def P(t, s, off=0.0):
        lo = a0 + (a1 - a0) * s; hi = b0 + (b1 - b0) * s; q = lo + (hi - lo) * t
        q = q + np.array([0, -comba * math.sin(math.pi * s) * t, 0]) + nn * off
        return tuple(q)
    _ma = m.mat; m.mat = 'paja' if paja else 'teja'
    for i in range(n):
        t0, t1 = i / n, (i + 1) / n
        for j in range(mm):
            s0, s1 = j / mm, (j + 1) / mm
            c = varia(col, 0.03 if paja else 0.05)
            if paja: uv = [(s0 * ancho, t0 * largo), (s1 * ancho, t0 * largo), (s1 * ancho, t1 * largo), (s0 * ancho, t1 * largo)]
            else: uv = [(s0 * ancho, i * 0.25 + 0.002), (s1 * ancho, i * 0.25 + 0.002), (s1 * ancho, (i + 1) * 0.25 - 0.002), (s0 * ancho, (i + 1) * 0.25 - 0.002)]
            m.quad(P(t0, s0, lip), P(t0, s1, lip), P(t1, s1, 0), P(t1, s0, 0), esc(c, luz * (0.93 + 0.07 * t0)), uv=uv)
        if lip: m.quad(P(t0, 0), P(t0, 1), P(t0, 1, lip), P(t0, 0, lip), esc(col, 0.45 * luz), uv=[(0, i * 0.25), (ancho, i * 0.25), (ancho, i * 0.25 + 0.01), (0, i * 0.25 + 0.01)])
    m.mat = 'madera'
    # la cara de abajo
    m.quad(P(0, 1, -0.06), P(0, 0, -0.06), P(1, 0, -0.06), P(1, 1, -0.06), esc(MADERA, 0.8))
    m.mat = _ma

def tejado_dos_aguas(m, f, u0, u1, w0, w1, v, pend=0.65, alero=0.4, col=TEJA, paja=False, hastial_col=None):
    """cumbrera a lo largo de u, en la mitad de w"""
    wc = (w0 + w1) / 2; vc = v + (w1 - w0) / 2 * pend
    al = alero * (1.5 if paja else 1)
    a = lambda u, w, vv: f(u, vv, w)
    faldon(m, a(u0 - al, w1 + al, v - al * pend), a(u1 + al, w1 + al, v - al * pend), a(u0 - al, wc, vc), a(u1 + al, wc, vc), col, 1.0, paja)
    faldon(m, a(u1 + al, w0 - al, v - al * pend), a(u0 - al, w0 - al, v - al * pend), a(u1 + al, wc, vc), a(u0 - al, wc, vc), col, 0.74, paja)
    if not paja:
        for s in (-1, 1): m.quad(a(u0 - al, wc, vc + .1), a(u1 + al, wc, vc + .1), a(u1 + al, wc + s * .2, vc - .04), a(u0 - al, wc + s * .2, vc - .04), esc(col, .7))
    hc = hastial_col or PIEDRA
    for u, s in ((u0, -1), (u1, 1)):
        A, B, C = a(u, w0, v), a(u, w1, v), a(u, wc, vc)
        with con(m, 'sillar' if mat_de(hc) == 'piedra' else None):
            if s < 0: m.tri(A, B, C, esc(hc, .85))
            else: m.tri(B, A, C, esc(hc, .85))
    return vc

def tejado_una_agua(m, f, u0, u1, w_alto, w_bajo, v_alto, v_bajo, alero=0.4, col=TEJA, paja=False, piñones=True, hastial_col=None):
    """tejado a una agua: de w_alto (contra la muralla, alto) a w_bajo (alero, bajo)"""
    s = 1 if w_bajo > w_alto else -1
    pend = (v_alto - v_bajo) / abs(w_bajo - w_alto)
    a = lambda u, w, vv: f(u, vv, w)
    wb = w_bajo + s * alero; vb = v_bajo - alero * pend
    faldon(m, a(u0 - .3, wb, vb), a(u1 + .3, wb, vb), a(u0 - .3, w_alto, v_alto), a(u1 + .3, w_alto, v_alto), col, 1.0 if s > 0 else 0.8, paja)
    if piñones:
        hc = hastial_col or PIEDRA
        for u, sg in ((u0, -1), (u1, 1)):
            A, B, C = a(u, w_alto, v_bajo), a(u, w_bajo, v_bajo), a(u, w_alto, v_alto)
            if sg * s < 0: m.tri(A, B, C, esc(hc, .85))
            else: m.tri(B, A, C, esc(hc, .85))

# ---------------- suelos
def suelo_tablas(m, f, u0, u1, w0, w1, v, col=TABLA, ancho=0.28, grueso=0.12, huecos=()):
    """tablas a lo largo de u; huecos: rectángulos (u0,u1,w0,w1) que se dejan abiertos"""
    w = w0
    while w < w1 - 0.02:
        wb = min(w1, w + ancho)
        trozos = [(u0, u1)]
        for (hu0, hu1, hw0, hw1) in huecos:
            if wb <= hw0 or w >= hw1: continue
            nuevos = []
            for a, b in trozos:
                if b <= hu0 or a >= hu1: nuevos.append((a, b)); continue
                if a < hu0: nuevos.append((a, hu0))
                if b > hu1: nuevos.append((hu1, b))
            trozos = nuevos
        for a, b in trozos:
            c = varia(col, 0.06)
            with con(m, 'tabla'):
                caja(m, f, a, b, v - grueso, v, w + 0.008, wb - 0.008, c, 0.6, caras='w0w1')
                ru = random.uniform(0, 1.7); rv = random.uniform(0, 2)   # cada tabla, su trozo de veta (a lo largo de la tabla)
                m.quad(f(a, v, w + 0.008), f(a, v, wb - 0.008), f(b, v, wb - 0.008), f(b, v, w + 0.008), c,
                       uv=[(ru, rv + a), (ru + wb - w, rv + a), (ru + wb - w, rv + b), (ru, rv + b)])
        w = wb
    # vigas por debajo
    u = u0 + 0.4
    while u < u1:
        with con(m, 'madera'): caja(m, f, u, u + 0.22, v - grueso - 0.28, v - grueso, w0, w1, MADERA, 0.7, caras='w0w1u0u1v0')
        u += 1.4

def suelo_losas(m, f, u0, u1, w0, w1, v, col=LOSA, lado=0.6, junta=0.03):
    """enlosado: una cara con la textura de losas (las losas, las juntas y el musgo los da la textura)"""
    with con(m, 'losa'):
        m.quad(f(u0, v, w0), f(u0, v, w1), f(u1, v, w1), f(u1, v, w0), varia(col, 0.04))

# ---------------- escaleras
def escalera(m, f, u0, u1, w0, w1, v0, v1, col=PIEDRA, maciza=True, huella=0.29, madera=False):
    """sube a lo largo de +u, de v0 (en u0) a v1 (en u1)"""
    n = max(2, int(round((v1 - v0) / 0.2))); dh = (v1 - v0) / n; du = (u1 - u0) / n
    for i in range(n):
        a = u0 + i * du; b = u0 + (i + 1) * du; top = v0 + (i + 1) * dh
        base = v0 - 0.4 if maciza else top - (0.08 if madera else 0.25)
        c = varia(col, 0.07)
        if madera:
            with con(m, 'tabla'): caja(m, f, a, b + 0.02, top - 0.06, top, w0 + 0.1, w1 - 0.1, c, 0.7)
        else:
            with con(m, 'piedra'): caja(m, f, a, b + 0.01, base, top, w0, w1, c, 0.75, caras='v1')
            with con(m, 'sillar'): caja(m, f, a, b + 0.01, base, top, w0, w1, esc(c, 0.62), 0.75, caras='u0')   # la tabica, en sombra
            with con(m, 'sillar'): caja(m, f, a, b + 0.01, base, top, w0, w1, esc(c, 0.92), 0.75, caras='w0w1')
            with con(m, 'piedra'): caja(m, f, a - 0.02, a + 0.03, top - 0.03, top, w0 - 0.01, w1 + 0.01, esc(c, 1.05), 0.9, caras='v1u0')   # el bocel del peldaño
    if madera:   # zancas
        for w in (w0 + 0.05, w1 - 0.15):
            p = [(u0, v0 - 0.1), (u1, v1 - 0.1), (u1, v1 + 0.15), (u0, v0 + 0.15)]
            m.quad(f(p[0][0], p[0][1], w), f(p[1][0], p[1][1], w), f(p[2][0], p[2][1], w), f(p[3][0], p[3][1], w), MADERA)
            m.quad(f(p[1][0], p[1][1], w + .1), f(p[0][0], p[0][1], w + .1), f(p[3][0], p[3][1], w + .1), f(p[2][0], p[2][1], w + .1), MADERA)

def caracol(m, f, cu, cw, r, v0, v1, ang0=0.0, sentido=1, col=PIEDRA, muro_r=None, puertas=()):
    """escalera de caracol: peldaños en abanico con machón; muro_r: cilindro de piedra que la envuelve, con huecos de puerta
       puertas: lista de (ángulo, v_suelo)"""
    n = max(4, int(round((v1 - v0) / 0.2))); dh = (v1 - v0) / n; da = math.radians(28) * sentido
    for i in range(n):
        a = ang0 + i * da; top = v0 + (i + 1) * dh
        pts = [(cu + 0.16 * math.cos(a), cw + 0.16 * math.sin(a)), (cu + r * math.cos(a), cw + r * math.sin(a)),
               (cu + r * math.cos(a + da), cw + r * math.sin(a + da)), (cu + 0.16 * math.cos(a + da), cw + 0.16 * math.sin(a + da))]
        with con(m, 'piedra'): prisma(m, f, pts, top - 0.2, top, esc(varia(col, 0.07), 0.95), sombra=0.6)
    with con(m, 'sillar'): cilindro(m, f, cu, cw, 0.17, v0, v1, esc(col, 1.0), 8)
    if muro_r:
        N = 16
        for i in range(N):
            a1, a2 = 2 * math.pi * i / N, 2 * math.pi * (i + 1) / N; am = (a1 + a2) / 2
            v_ini = v0
            tramos = [(v0, v1)]
            for (ap, vs) in puertas:
                dif = abs((am - ap + math.pi) % (2 * math.pi) - math.pi)
                if dif < 0.42:
                    tr = []
                    for (x0, x1) in tramos:
                        if vs + 2.2 <= x0 or vs >= x1: tr.append((x0, x1)); continue
                        if x0 < vs: tr.append((x0, vs))
                        if vs + 2.2 < x1: tr.append((vs + 2.2, x1))
                    tramos = tr
            for (x0, x1) in tramos:
                P = lambda a, rr, v: f(cu + math.cos(a) * rr, v, cw + math.sin(a) * rr)
                c = esc(PIEDRA, 0.8 + 0.15 * math.cos(am))
                m.quad(P(a1, r + 0.02, x0), P(a2, r + 0.02, x0), P(a2, r + 0.02, x1), P(a1, r + 0.02, x1), c)

# ---------------- puertas de tablas, rastrillo, ventanas
def puerta_tablas(m, f, u0, u1, v0, v1, w, abierta=0.0, arco=None, col=MADERA_CL, giro_u0=True):
    """hoja de tablas verticales con herrajes; abierta: ángulo en radianes (gira sobre u0 si giro_u0)"""
    ancho = u1 - u0
    piv = (u0, w) if giro_u0 else (u1, w)
    sg = 1 if giro_u0 else -1
    def P(u, v, dw):
        lu = (u - piv[0]) * sg
        x = piv[0] + sg * lu * math.cos(abierta); ww = piv[1] + dw + lu * math.sin(abierta) * 1
        return f(x, v, ww)
    n = max(3, int(ancho / 0.22))
    for i in range(n):
        a = u0 + ancho * i / n; b = u0 + ancho * (i + 1) / n
        top = v1
        if arco == 'medio':
            cm = (u0 + u1) / 2; r = ancho / 2; x = min(abs(a - cm), abs(b - cm)) if (a < cm < b) else min(abs(a - cm), abs(b - cm))
            top = v1 + math.sqrt(max(0, r * r - x * x)) * 0.95
        elif arco == 'apuntado':
            cm = (u0 + u1) / 2; x = min(abs(a - cm), abs(b - cm)); top = v1 + (ancho / 2) * 0.8 * (1 - (x / (ancho / 2)) ** 1.6)
        c = varia(col, 0.09)
        m.quad(P(a, v0, 0.04), P(b, v0, 0.04), P(b, top, 0.04), P(a, top, 0.04), c)
        m.quad(P(b, v0, -0.04), P(a, v0, -0.04), P(a, top, -0.04), P(b, top, -0.04), esc(c, .8))
    for vv in (v0 + 0.35, (v0 + v1) / 2, v1 - 0.3):   # pernios y bandas de hierro
        m.quad(P(u0 + 0.05, vv, 0.06), P(u1 - 0.1, vv, 0.06), P(u1 - 0.1, vv + 0.07, 0.06), P(u0 + 0.05, vv + 0.07, 0.06), HIERRO)
    m.quad(P(u1 - 0.25, (v0 + v1) / 2 - 0.05, 0.065), P(u1 - 0.15, (v0 + v1) / 2 - 0.05, 0.065), P(u1 - 0.15, (v0 + v1) / 2 + 0.12, 0.065), P(u1 - 0.25, (v0 + v1) / 2 + 0.12, 0.065), HIERRO)

def rastrillo(m, f, u0, u1, v0, v1, w, col=MADERA, alto_bajado=None):
    """reja de barrotes y travesaños con puntas de hierro; v0..v1 donde está ahora"""
    b = 0.11; n = max(3, int((u1 - u0) / 0.32))
    for i in range(n + 1):
        u = u0 + (u1 - u0) * i / n
        with con(m, 'madera'): caja(m, f, u - b / 2, u + b / 2, v0, v1, w - b / 2, w + b / 2, esc(col, 0.55), 0.85)
        # la punta de hierro: una pirámide que acaba en pico
        q = [(u - b / 2 - 0.01, w - b / 2 - 0.01), (u + b / 2 + 0.01, w - b / 2 - 0.01), (u + b / 2 + 0.01, w + b / 2 + 0.01), (u - b / 2 - 0.01, w + b / 2 + 0.01)]
        pico = f(u, v0 - 0.32, w)
        for k in range(4):
            (a1, b1), (a2, b2) = q[k], q[(k + 1) % 4]
            with con(m, 'liso'): m.tri(f(a2, v0, b2), f(a1, v0, b1), pico, esc(HIERRO, 0.8 + 0.1 * k))
        with con(m, 'liso'): caja(m, f, u - b / 2 - 0.012, u + b / 2 + 0.012, v0, v0 + 0.12, w - b / 2 - 0.012, w + b / 2 + 0.012, HIERRO)   # el regatón
    v = v0 + 0.4
    while v < v1 - 0.1:
        with con(m, 'madera'): caja(m, f, u0 - 0.05, u1 + 0.05, v, v + b, w - b / 2 - 0.03, w + b / 2 + 0.03, esc(col, 0.5), 0.85)
        for i in range(n + 1):   # pletinas de hierro en cada cruce
            u = u0 + (u1 - u0) * i / n
            with con(m, 'liso'): caja(m, f, u - 0.07, u + 0.07, v - 0.02, v + b + 0.02, w - b / 2 - 0.045, w + b / 2 + 0.045, HIERRO)
        v += 0.42

def ventana(m, f, u, v, ancho, alto, w, postigos=True, col=MADERA_CL, arco=None):
    """postigos abiertos sobre la cara w (hacia +w); el hueco lo hace el muro"""
    if not postigos: return
    c = varia(col, 0.1)
    for s in (-1, 1):
        a = u + s * ancho / 2; b = a + s * ancho * 0.48
        A, B = (min(a, b), max(a, b))
        caja(m, f, A, B, v, v + alto, w + 0.02, w + 0.06, c, 0.8)

def saetera(h_u, v0, alto=1.4, ancho=0.12, derrame=0.9):
    return {'u': h_u, 'a': ancho, 'v0': v0, 'v1': v0 + alto, 'derrame': derrame, 'sin_dovelas': True}

# ---------------- muebles
def mesa(m, f, u, w, largo=1.8, ancho=0.8, alto=0.76, ang=0.0, col=MADERA_CL):
    g = f.sub(u, w, ang)
    with con(m, 'tabla'):   # el tablero: tres tablas con su junta
        n = 3
        for k in range(n):
            z0 = -ancho / 2 + ancho * k / n + 0.006; z1 = -ancho / 2 + ancho * (k + 1) / n - 0.006
            caja(m, g, -largo / 2 + 0.01 * (k % 2), largo / 2 - 0.01 * ((k + 1) % 2), alto - 0.05, alto, z0, z1, varia(col, .08), .8)
    with con(m, 'madera'):
        caja(m, g, -largo / 2 + 0.12, largo / 2 - 0.12, alto - 0.11, alto - 0.05, -ancho / 2 + 0.06, -ancho / 2 + 0.12, MADERA, .7)   # los travesaños de debajo
        caja(m, g, -largo / 2 + 0.12, largo / 2 - 0.12, alto - 0.11, alto - 0.05, ancho / 2 - 0.12, ancho / 2 - 0.06, MADERA, .7)
        for s in (-1, 1):   # caballetes: dos patas abiertas en A, con su pie
            x = s * (largo / 2 - 0.28)
            for t in (-1, 1):
                a = (x - 0.035, -ancho / 2 + 0.1); b = (x + 0.035, -ancho / 2 + 0.1)
                m.quad(g(x - 0.035, 0.0, t * (ancho / 2 - 0.08)), g(x + 0.035, 0.0, t * (ancho / 2 - 0.08)), g(x + 0.035, alto - 0.11, t * 0.06), g(x - 0.035, alto - 0.11, t * 0.06), esc(MADERA, 0.9))
                m.quad(g(x + 0.035, 0.0, t * (ancho / 2 - 0.08) + 0.0001), g(x - 0.035, 0.0, t * (ancho / 2 - 0.08) + 0.0001), g(x - 0.035, alto - 0.11, t * 0.06 + 0.0001), g(x + 0.035, alto - 0.11, t * 0.06 + 0.0001), esc(MADERA, 0.7))
            caja(m, g, x - 0.05, x + 0.05, alto - 0.13, alto - 0.05, -ancho / 2 + 0.05, ancho / 2 - 0.05, MADERA, .7)
            caja(m, g, x - 0.05, x + 0.05, 0, 0.07, -ancho / 2 + 0.02, ancho / 2 - 0.02, MADERA, .7)
        caja(m, g, -largo / 2 + 0.3, largo / 2 - 0.3, 0.22, 0.28, -0.035, 0.035, MADERA, .7)

def banco(m, f, u, w, largo=1.6, ang=0.0):
    g = f.sub(u, w, ang)
    caja(m, g, -largo / 2, largo / 2, 0.4, 0.46, -0.16, 0.16, varia(MADERA_CL, .1), .8)
    for s in (-1, 1): caja(m, g, s * (largo / 2 - 0.15) - 0.04, s * (largo / 2 - 0.15) + 0.04, 0, 0.4, -0.13, 0.13, MADERA, .7)

def taburete(m, f, u, w):
    g = f.sub(u, w, az() * 3)
    cilindro(m, g, 0, 0, 0.18, 0.4, 0.45, varia(MADERA_CL, .1), 7)
    for a in (0, 2.1, 4.2): caja(m, g, math.cos(a) * 0.1 - .02, math.cos(a) * 0.1 + .02, 0, 0.4, math.sin(a) * 0.1 - .02, math.sin(a) * 0.1 + .02, MADERA)

def cama(m, f, u, w, ang=0.0, largo=2.0, ancho=1.0, colcha=TELA_ROJA, dosel=False):
    g = f.sub(u, w, ang)
    caja(m, g, -largo / 2, largo / 2, 0.15, 0.45, -ancho / 2, ancho / 2, MADERA, .7)
    for su in (-1, 1):
        for sw in (-1, 1): caja(m, g, su * largo / 2 - (0.08 if su > 0 else 0), su * largo / 2 + (0 if su > 0 else 0.08), 0, 0.55 if su < 0 else 0.5, sw * ancho / 2 - (0.08 if sw > 0 else 0), sw * ancho / 2 + (0 if sw > 0 else 0.08), MADERA)
    caja(m, g, -largo / 2 + 0.05, largo / 2 - 0.05, 0.45, 0.6, -ancho / 2 + 0.04, ancho / 2 - 0.04, LANA, .8)
    with con(m, 'tela'):
        caja(m, g, -largo / 2 + 0.55, largo / 2 + 0.02, 0.6, 0.67, -ancho / 2 - 0.02, ancho / 2 + 0.02, colcha, .8, caras='v1u0u1')
        # la colcha cae por los lados, con pliegues
        for sw in (-1, 1):
            n = 9
            for k in range(n):
                a_ = -largo / 2 + 0.55 + (largo - 0.53) * k / n; b_ = -largo / 2 + 0.55 + (largo - 0.53) * (k + 1) / n
                o1 = 0.03 * math.sin(k * 1.9); o2 = 0.03 * math.sin((k + 1) * 1.9)
                P1, P2 = g(a_, 0.67, sw * (ancho / 2 + 0.02)), g(b_, 0.67, sw * (ancho / 2 + 0.02))
                P3, P4 = g(b_, 0.3 + o2, sw * (ancho / 2 + 0.05 + o2)), g(a_, 0.3 + o1, sw * (ancho / 2 + 0.05 + o1))
                if sw > 0: m.quad(P2, P1, P4, P3, esc(colcha, 0.85 + 0.1 * (k % 2)))
                else: m.quad(P1, P2, P3, P4, esc(colcha, 0.85 + 0.1 * (k % 2)))
        # la vuelta de la sábana y la almohada
        caja(m, g, -largo / 2 + 0.5, -largo / 2 + 0.62, 0.6, 0.69, -ancho / 2 + 0.01, ancho / 2 - 0.01, CAL, .85, caras='v1u0u1')
    with con(m, 'tela'): bola(m, *g(-largo / 2 + 0.28, 0.68, 0), 0.22, 0.07, CAL, 8, 3)
    caja(m, g, -largo / 2 - 0.02, -largo / 2 + 0.06, 0.55, 1.0, -ancho / 2, ancho / 2, MADERA, .7)
    if dosel:
        for su in (-1, 1):
            for sw in (-1, 1):
                with con(m, 'madera'): cilindro(m, g, su * (largo / 2 - 0.04), sw * (ancho / 2 - 0.04), 0.035, 0.0, 2.15, MADERA, 6, True)
        with con(m, 'madera'):   # el bastidor del dosel, de postes a postes
            caja(m, g, -largo / 2, largo / 2, 2.12, 2.2, -ancho / 2 - 0.02, -ancho / 2 + 0.05, MADERA)
            caja(m, g, -largo / 2, largo / 2, 2.12, 2.2, ancho / 2 - 0.05, ancho / 2 + 0.02, MADERA)
            caja(m, g, -largo / 2 - 0.02, -largo / 2 + 0.05, 2.12, 2.2, -ancho / 2, ancho / 2, MADERA)
            caja(m, g, largo / 2 - 0.05, largo / 2 + 0.02, 2.12, 2.2, -ancho / 2, ancho / 2, MADERA)
        with con(m, 'tela'):
            # el cielo, fino, y la cenefa que cuelga con pliegues por los cuatro lados
            m.quad(g(-largo / 2, 2.15, ancho / 2), g(largo / 2, 2.15, ancho / 2), g(largo / 2, 2.15, -ancho / 2), g(-largo / 2, 2.15, -ancho / 2), esc(colcha, 0.95))
            lados = [((-largo / 2, -ancho / 2), (largo / 2, -ancho / 2)), ((largo / 2, -ancho / 2), (largo / 2, ancho / 2)), ((largo / 2, ancho / 2), (-largo / 2, ancho / 2)), ((-largo / 2, ancho / 2), (-largo / 2, -ancho / 2))]
            for (p0, p1) in lados:
                n = 10
                for k in range(n):
                    t0, t1 = k / n, (k + 1) / n
                    ofs = lambda t: 0.035 * math.sin(t * n * math.pi)
                    q = lambda t: (p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t)
                    (x0, z0), (x1, z1) = q(t0), q(t1)
                    m.quad(g(x0, 1.85, z0), g(x1, 1.85, z1), g(x1, 2.15, z1), g(x0, 2.15, z0), esc(colcha, 0.78 + 0.14 * (k % 2)))
            # la cortina de la cabecera, recogida
            for k in range(8):
                z0 = -ancho / 2 + ancho * k / 8; z1 = -ancho / 2 + ancho * (k + 1) / 8
                m.quad(g(-largo / 2 - 0.01 - 0.03 * (k % 2), 0.7, z0), g(-largo / 2 - 0.01 - 0.03 * ((k + 1) % 2), 0.7, z1), g(-largo / 2 - 0.01 - 0.03 * ((k + 1) % 2), 2.1, z1), g(-largo / 2 - 0.01 - 0.03 * (k % 2), 2.1, z0), esc(colcha, 0.7 + 0.15 * (k % 2)))

def jergon(m, f, u, w, ang=0.0):
    g = f.sub(u, w, ang)
    caja(m, g, -0.95, 0.95, 0, 0.16, -0.38, 0.38, varia(HENO, .08), .75)
    caja(m, g, -0.5, 0.95, 0.16, 0.2, -0.36, 0.36, varia(LANA, .1), .8)

def arca(m, f, u, w, ang=0.0, largo=1.1, ancho=0.55, alto=0.6):
    g = f.sub(u, w, ang)
    c = varia(MADERA_CL, .1)
    with con(m, 'madera'):
        for s in (-1, 1): caja(m, g, s * largo / 2 - (0.07 if s > 0 else 0), s * largo / 2 + (0 if s > 0 else 0.07), 0, 0.08, -ancho / 2, ancho / 2, MADERA, .7)   # los pies
        caja(m, g, -largo / 2, largo / 2, 0.06, alto - 0.14, -ancho / 2, ancho / 2, c, .75)   # la caja
        caja(m, g, -largo / 2 - 0.015, largo / 2 + 0.015, alto - 0.14, alto - 0.09, -ancho / 2 - 0.015, ancho / 2 + 0.015, esc(c, 0.9), .75)   # la tapa, con su moldura
        n = 6   # y abombada
        for k in range(n):
            a1, a2 = math.pi * k / n, math.pi * (k + 1) / n
            P = lambda x, a: g(x, alto - 0.09 + 0.09 * math.sin(a), -math.cos(a) * (ancho / 2 + 0.015))
            m.quad(P(-largo / 2 - 0.015, a1), P(-largo / 2 - 0.015, a2), P(largo / 2 + 0.015, a2), P(largo / 2 + 0.015, a1), esc(c, 0.8 + 0.25 * math.sin((a1 + a2) / 2)))
        for s in (-1, 1):
            m.quad(*[g(s * (largo / 2 + 0.015), alto - 0.09 + 0.09 * math.sin(math.pi * k / n), -math.cos(math.pi * k / n) * (ancho / 2 + 0.015)) for k in (0, 2, 4, 6)][::s], esc(c, 0.7))
    for x in (-largo / 2 + 0.1, 0, largo / 2 - 0.14):   # flejes de hierro que abrazan la tapa
        caja(m, g, x, x + 0.045, 0.06, alto - 0.09, -ancho / 2 - 0.012, ancho / 2 + 0.012, HIERRO)
        for k in range(n):
            a1, a2 = math.pi * k / n, math.pi * (k + 1) / n
            P = lambda xx, a: g(xx, alto - 0.09 + 0.1 * math.sin(a), -math.cos(a) * (ancho / 2 + 0.025))
            m.quad(P(x, a1), P(x, a2), P(x + 0.045, a2), P(x + 0.045, a1), HIERRO)
    caja(m, g, -0.07, 0.07, alto - 0.3, alto - 0.12, ancho / 2, ancho / 2 + 0.02, HIERRO)   # la cerradura
    for s in (-1, 1): caja(m, g, s * largo / 2 - 0.01 * (1 - s), s * largo / 2 + 0.01 * (1 + s), alto - 0.3, alto - 0.26, -0.1, 0.1, HIERRO)   # las asas

def tonel(m, f, u, w, tumbado=False, r=0.32, alto=0.85, ang=0.0):
    g = f.sub(u, w, ang)
    if not tumbado:
        cilindro(m, g, 0, 0, r * 0.88, 0, alto / 2, varia(MADERA_CL, .1), 10, False, r)
        cilindro(m, g, 0, 0, r, alto / 2, alto, varia(MADERA_CL, .1), 10, True, r * 0.88)
        for v in (0.1, alto / 2, alto - 0.12): cilindro(m, g, 0, 0, r * 0.97 + 0.012 * (v == alto / 2), v, v + 0.05, HIERRO, 10, False)
    else:   # tumbado sobre su eje u
        n = 10
        for i in range(n):
            a1, a2 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            P = lambda x, a, rr: g(x, r + math.sin(a) * rr, math.cos(a) * rr)
            c = varia(MADERA_CL, .08)
            m.quad(P(-alto / 2, a1, r * .88), P(0, a1, r), P(0, a2, r), P(-alto / 2, a2, r * .88), c)
            m.quad(P(0, a1, r), P(alto / 2, a1, r * .88), P(alto / 2, a2, r * .88), P(0, a2, r), c)
            for x in (-alto / 2, alto / 2): m.tri(g(x, r, 0), P(x, a1, r * .88), P(x, a2, r * .88), esc(MADERA_CL, .7))

def saco(m, f, u, w):
    bola(m, *f(u, 0.28, w), 0.3, 0.3, varia(hexc('#a89670'), .08), 6, 3)

def estante(m, f, u, w, largo=1.6, alto=1.8, fondo=0.35, ang=0.0, cosas=True):
    g = f.sub(u, w, ang)
    for x in (-largo / 2, largo / 2 - 0.05): caja(m, g, x, x + 0.05, 0, alto, 0, fondo, MADERA)
    for v in (0.3, 0.8, 1.3, alto - 0.04):
        caja(m, g, -largo / 2, largo / 2, v, v + 0.04, 0, fondo, MADERA_CL, .8)
        if cosas and v < alto - 0.1:
            x = -largo / 2 + 0.15
            while x < largo / 2 - 0.2:
                k = az()
                if k < 0.4: cilindro(m, g, x + 0.08, fondo / 2, 0.08, v + 0.04, v + 0.28, varia(hexc('#8a6a4a'), .15), 6)
                elif k < 0.7: caja(m, g, x, x + 0.22, v + 0.04, v + 0.2, 0.05, fondo - 0.05, varia(hexc('#9a8460'), .1))
                x += 0.25 + az() * 0.15

def armero(m, f, u, w, largo=2.0, ang=0.0):
    """armero contra la pared: lanzas en pie, ballestas colgadas y escudos"""
    g = f.sub(u, w, ang)
    caja(m, g, -largo / 2, largo / 2, 0.3, 0.38, 0, 0.3, MADERA); caja(m, g, -largo / 2, largo / 2, 1.5, 1.58, 0, 0.12, MADERA)
    x = -largo / 2 + 0.12
    while x < largo / 2 - 0.1:
        caja(m, g, x - .02, x + .02, 0.05, 2.6, 0.12, 0.16, MADERA_CL)
        prisma(m, g, [(x - .04, 0.1), (x + .04, 0.1), (x, 0.18)], 2.6, 2.85, HIERRO)
        x += 0.16
    for k in range(3):   # escudos colgados
        cx = -largo / 2 + 0.4 + k * (largo - 0.8) / 2
        pts = [(cx - 0.3, 0.02), (cx + 0.3, 0.02), (cx + 0.3, 0.02)]
        g2 = g
        for s, (c1, c2) in enumerate([(TELA_ROJA, CAL), (TELA_AZUL, CAL), (TELA_ROJA, HENO)]):
            pass
        col = [TELA_ROJA, TELA_AZUL, hexc('#5d6a3a')][k]
        P = [g(cx - 0.28, 1.95, 0.02), g(cx + 0.28, 1.95, 0.02), g(cx + 0.28, 1.6, 0.02), g(cx, 1.3, 0.02), g(cx - 0.28, 1.6, 0.02)]
        m.quad(P[0], P[1], P[2], P[4], col); m.tri(P[4], P[2], P[3], col)

def chimenea(m, f, u, ancho=1.8, v_suelo=0.0, alto_campana=2.2, w=0.0, col=PIEDRA_CLARA, fuego=True):
    """hogar y campana contra la pared (cara w, hacia +w)"""
    g = f.sub(u, w)
    _mc = m.mat; m.mat = 'sillar'
    caja(m, g, -ancho / 2, ancho / 2, v_suelo, v_suelo + 0.15, 0, 0.9, LOSA, .8)
    for s in (-1, 1): caja(m, g, s * ancho / 2 - (0.25 if s > 0 else 0), s * ancho / 2 + (0 if s > 0 else 0.25), v_suelo, v_suelo + 1.3, 0, 0.75, varia(col, .05), .8)
    pts_c = [(-ancho / 2 - 0.1, 0), (ancho / 2 + 0.1, 0), (ancho / 2 + 0.1, 0.85), (-ancho / 2 - 0.1, 0.85)]
    prisma(m, g, pts_c, v_suelo + 1.3, v_suelo + 1.55, varia(col, .05))
    # campana que se estrecha hacia arriba
    a0 = ancho / 2 + 0.1; a1 = ancho / 2 - 0.4
    P = lambda x, v, ww: g(x, v, ww)
    m.quad(P(-a0, v_suelo + 1.55, 0.85), P(a0, v_suelo + 1.55, 0.85), P(a1, v_suelo + alto_campana + 1.3, 0.3), P(-a1, v_suelo + alto_campana + 1.3, 0.3), esc(col, .9))
    m.quad(P(a0, v_suelo + 1.55, 0.85), P(a0, v_suelo + 1.55, 0), P(a1, v_suelo + alto_campana + 1.3, 0), P(a1, v_suelo + alto_campana + 1.3, 0.3), esc(col, .75))
    m.quad(P(-a0, v_suelo + 1.55, 0), P(-a0, v_suelo + 1.55, 0.85), P(-a1, v_suelo + alto_campana + 1.3, 0.3), P(-a1, v_suelo + alto_campana + 1.3, 0), esc(col, .75))
    m.mat = _mc
    if fuego:   # el fondo, ahumado arriba y encendido por el fuego abajo
        with con(m, 'fuego'): m.quad(g(-ancho / 2 + 0.25, v_suelo + 0.15, 0.045), g(ancho / 2 - 0.25, v_suelo + 0.15, 0.045), g(ancho / 2 - 0.25, v_suelo + 1.3, 0.045), g(-ancho / 2 + 0.25, v_suelo + 1.3, 0.045), hexc('#a8481c'), hexc('#a8481c'), hexc('#1c120c'), hexc('#1c120c'))
    else: caja(m, g, -ancho / 2 + 0.25, ancho / 2 - 0.25, v_suelo + 0.15, v_suelo + 1.3, 0, 0.04, OSCURO)   # el fondo ahumado
    if fuego:
        for k in range(3): caja(m, g.sub(0, 0.4, 0.4 + k * 0.5), -0.35, 0.35, v_suelo + 0.15 + k * 0.05, v_suelo + 0.25 + k * 0.05, -0.06, 0.06, MADERA)
        llamas(m, g, 0, v_suelo + 0.18, 0.4, 0.55, 0.5)
        m.quad(g(-0.5, v_suelo + 0.13, 0.05), g(0.5, v_suelo + 0.13, 0.05), g(0.5, v_suelo + 0.13, 0.75), g(-0.5, v_suelo + 0.13, 0.75), hexc('#7a3a1c'))

def caldero(m, f, u, w, r=0.32, v=0.0):
    cilindro(m, f, u, w, r * 0.8, v, v + 0.12, HIERRO, 10, False, r)
    cilindro(m, f, u, w, r, v + 0.12, v + 0.45, HIERRO, 10, False, r * 0.95)
    cilindro(m, f, u, w, r * 0.9, v + 0.4, v + 0.42, esc(hexc('#6a5a3a'), .8), 10, True)

def heno(m, f, u, w, r=0.9):
    bola(m, *f(u, r * 0.45, w), r, r * 0.55, varia(HENO, .06), 7, 3)

def llamas(m, f, u, v, w, alto, ancho):
    """lenguas de fuego: planos cruzados en abanico, de la brasa (abajo, amarillo) a la punta (rojo oscuro)"""
    base_c = hexc('#ffe2a0'); medio_c = hexc('#ff9a3a'); punta_c = hexc('#c8461e')
    _mf = m.mat; m.mat = 'fuego'
    # las brasas: un lecho que brilla debajo
    for k in range(6):
        a = k * math.pi / 3; b = (k + 1) * math.pi / 3
        m.tri(f(u, v + 0.01, w), f(u + math.cos(b) * ancho * 0.4, v + 0.005, w + math.sin(b) * ancho * 0.4), f(u + math.cos(a) * ancho * 0.4, v + 0.005, w + math.sin(a) * ancho * 0.4), hexc('#e07a30'), hexc('#3a1a10'), hexc('#3a1a10'))
    for k in range(9):
        a = k * math.pi / 9 + 0.3; r = ancho * (0.55 + 0.45 * ((k * 37) % 5) / 4); hh = alto * (0.6 + 0.4 * ((k * 53) % 5) / 4)
        dx, dw = math.cos(a) * r / 2, math.sin(a) * r / 2
        ox, ow = math.cos(a + 1.7) * r * 0.15, math.sin(a + 1.7) * r * 0.15
        m.tri(f(u - dx + ox, v, w - dw + ow), f(u + dx + ox, v, w + dw + ow), f(u + ox * 0.3, v + hh * 0.55, w + ow * 0.3), base_c, base_c, medio_c)
        m.tri(f(u - dx * 0.6 + ox, v + hh * 0.3, w - dw * 0.6 + ow), f(u + dx * 0.6 + ox, v + hh * 0.3, w + dw * 0.6 + ow), f(u + ox * 1.6, v + hh, w + ow * 1.6), medio_c, medio_c, punta_c)
    m.mat = _mf

def silla(m, f, u, w, ang=0.0, alta=False, col=MADERA_CL):
    """silla de tijera / sitial: asiento, patas, respaldo con travesaños; alta = sitial con brazos y respaldo alto"""
    g = f.sub(u, w, ang)
    a = 0.3 if not alta else 0.38
    caja(m, g, -a, a, 0.42, 0.47, -a, a, col, .8)
    for su in (-1, 1):
        for sw in (-1, 1): caja(m, g, su * a - 0.04 * su - 0.03, su * a - 0.04 * su + 0.03, 0, 0.42, sw * a - 0.04 * sw - 0.03, sw * a - 0.04 * sw + 0.03, MADERA, .8)
    alto = 1.0 if not alta else 1.55
    for su in (-1, 1): caja(m, g, su * a - 0.04 * su - 0.035, su * a - 0.04 * su + 0.035, 0.47, alto, a - 0.07, a, MADERA, .8)
    for k in range(3 if not alta else 4): caja(m, g, -a + 0.04, a - 0.04, 0.6 + k * 0.17, 0.66 + k * 0.17, a - 0.06, a - 0.02, col, .8)
    if alta:
        caja(m, g, -a + 0.05, a - 0.05, 1.32, 1.55, a - 0.06, a - 0.01, TELA_ROJA, .9)
        for su in (-1, 1): caja(m, g, su * a - 0.05 * su - 0.04, su * a - 0.05 * su + 0.04, 0.47, 0.75, -a, a, MADERA, .8)

def antorcha(m, f, u, v, w):
    caja(m, f, u - .03, u + .03, v, v + 0.06, w, w + 0.2, HIERRO)
    caja(m, f, u - .03, u + .03, v, v + 0.4, w + 0.17, w + 0.22, MADERA)
    llamas(m, f, u, v + 0.4, w + 0.2, 0.32, 0.14)

def tapiz(m, f, u0, u1, v0, v1, w, col):
    """paño colgado de su vara, con pliegues verticales, cenefa clara arriba y abajo y rombos bordados"""
    n = max(6, int((u1 - u0) / 0.18))
    prof = lambda k: w + 0.035 + 0.045 * (k % 2)
    c2 = esc(col, 1.45); c3 = hexc('#b89a52')
    with con(m, 'tela'):
        for k in range(n):
            a = u0 + (u1 - u0) * k / n; b = u0 + (u1 - u0) * (k + 1) / n
            l0 = 0.8 if k % 2 else 1.0; l1 = 1.0 if k % 2 else 0.8
            for (y0, y1, c) in ((v0, v0 + 0.25, c2), (v0 + 0.25, v1 - 0.25, col), (v1 - 0.25, v1, c2)):
                m.quad(f(a, y0, prof(k)), f(b, y0, prof(k + 1)), f(b, y1, prof(k + 1)), f(a, y1, prof(k)), esc(c, l0), esc(c, l1), esc(c, l1), esc(c, l0))
        # rombos bordados en el paño
        filas = max(1, int((v1 - v0 - 0.6) / 0.55)); cols = max(1, int((u1 - u0) / 0.6))
        for i in range(cols):
            for j in range(filas):
                cu = u0 + (u1 - u0) * (i + 0.5) / cols; cv = v0 + 0.3 + (v1 - v0 - 0.6) * (j + 0.5) / filas; r = 0.13
                ww = w + 0.09
                m.quad(f(cu, cv - r, ww), f(cu + r * 0.75, cv, ww), f(cu, cv + r, ww), f(cu - r * 0.75, cv, ww), c3)
    caja(m, f, u0 - .1, u1 + .1, v1, v1 + 0.05, w + 0.01, w + 0.08, MADERA)
    for s in (u0 - 0.1, u1 + 0.05): caja(m, f, s, s + 0.05, v1 - 0.02, v1 + 0.08, w, w + 0.1, HIERRO)

def alfombra(m, f, u, w, largo, ancho, col, ang=0.0, v=0.0):
    """estera tejida en el suelo, con cenefa y flecos"""
    g = f.sub(u, w, ang)
    with con(m, 'tela'):
        m.quad(g(-largo / 2, v + 0.012, ancho / 2), g(largo / 2, v + 0.012, ancho / 2), g(largo / 2, v + 0.012, -ancho / 2), g(-largo / 2, v + 0.012, -ancho / 2), col)
        c2 = esc(col, 1.5)
        for (a, b, c, d) in ((-largo / 2 + 0.1, largo / 2 - 0.1, ancho / 2 - 0.2, ancho / 2 - 0.1), (-largo / 2 + 0.1, largo / 2 - 0.1, -ancho / 2 + 0.1, -ancho / 2 + 0.2),
                             (-largo / 2 + 0.1, -largo / 2 + 0.2, -ancho / 2 + 0.1, ancho / 2 - 0.1), (largo / 2 - 0.2, largo / 2 - 0.1, -ancho / 2 + 0.1, ancho / 2 - 0.1)):
            m.quad(g(a, v + 0.016, d), g(b, v + 0.016, d), g(b, v + 0.016, c), g(a, v + 0.016, c), c2)
        for s in (-1, 1):   # flecos
            m.quad(g(s * largo / 2, v + 0.01, ancho / 2), g(s * (largo / 2 + 0.07), v + 0.006, ancho / 2), g(s * (largo / 2 + 0.07), v + 0.006, -ancho / 2), g(s * largo / 2, v + 0.01, -ancho / 2), esc(col, 1.25))

def candelabro(m, f, u, w, v=0.0, alto=1.5):
    """candelero de pie, de hierro, con tres velas encendidas"""
    cilindro(m, f, u, w, 0.18, v, v + 0.04, HIERRO, 8)
    for a in (0, 2.1, 4.2): caja(m, f, u + math.cos(a) * 0.12 - 0.015, u + math.cos(a) * 0.12 + 0.015, v, v + 0.12, w + math.sin(a) * 0.12 - 0.015, w + math.sin(a) * 0.12 + 0.015, HIERRO)
    cilindro(m, f, u, w, 0.022, v, v + alto, HIERRO, 6)
    caja(m, f, u - 0.25, u + 0.25, v + alto - 0.02, v + alto + 0.02, w - 0.02, w + 0.02, HIERRO)
    for du in (-0.24, 0.0, 0.24):
        cilindro(m, f, u + du, w, 0.045, v + alto + 0.02, v + alto + 0.05, HIERRO, 6)
        cilindro(m, f, u + du, w, 0.022, v + alto + 0.05, v + alto + 0.2 - abs(du) * 0.2, hexc('#e8dcc0'), 6)
        llamas(m, f, u + du, v + alto + 0.2 - abs(du) * 0.2, w, 0.07, 0.03)

def vajilla(m, f, u, w, v, largo=1.6):
    """en la mesa: platos, cuencos, una jarra, una hogaza y un candil"""
    for k in range(int(largo / 0.45)):
        x = u - largo / 2 + 0.25 + k * 0.45
        for s in (-1, 1):
            cilindro(m, f, x, w + s * 0.22, 0.11, v, v + 0.015, hexc('#8a7f6e'), 8)   # plato de peltre
            if (k + (s > 0)) % 2: cilindro(m, f, x + 0.1, w + s * 0.12, 0.05, v, v + 0.06, hexc('#7a5a3c'), 7, True, 0.06)   # cuenco
    cilindro(m, f, u, w, 0.07, v, v + 0.16, hexc('#8a6a48'), 8, True, 0.05); cilindro(m, f, u, w, 0.05, v + 0.16, v + 0.24, hexc('#8a6a48'), 8, True, 0.06)   # jarra
    bola(m, *f(u + 0.3, v + 0.05, w + 0.02), 0.11, 0.06, hexc('#a07a46'), 7, 3)   # hogaza
    cilindro(m, f, u - 0.35, w, 0.04, v, v + 0.06, HIERRO, 6); llamas(m, f, u - 0.35, v + 0.06, w, 0.06, 0.03)

def carro(m, f, u, w, ang=0.0):
    g = f.sub(u, w, ang)
    caja(m, g, -1.2, 1.2, 0.6, 0.7, -0.65, 0.65, varia(TABLA, .1), .75)
    for s in (-1, 1): caja(m, g, -1.2, 1.2, 0.7, 1.05, s * 0.65 - .04, s * 0.65 + .04, varia(TABLA, .1), .75)
    caja(m, g, -1.2, -1.15, 0.7, 1.05, -0.65, 0.65, TABLA)
    for s in (-1, 1):   # ruedas
        n = 10
        for i in range(n):
            a1, a2 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            P = lambda a, r, ww: g(math.cos(a) * r, 0.5 + math.sin(a) * r, ww)
            ww = s * 0.75
            m.quad(P(a1, 0.5, ww - .05), P(a2, 0.5, ww - .05), P(a2, 0.5, ww + .05), P(a1, 0.5, ww + .05), MADERA)
            m.quad(P(a1, 0.42, ww + s * .05), P(a2, 0.42, ww + s * .05), P(a2, 0.5, ww + s * .05), P(a1, 0.5, ww + s * .05), MADERA)
        for k in range(4):
            a = k * math.pi / 4
            m.quad(g(math.cos(a) * -0.45, 0.5 + math.sin(a) * -0.45, s * 0.76), g(math.cos(a) * 0.45, 0.5 + math.sin(a) * 0.45, s * 0.76), g(math.cos(a) * 0.45 + .04, 0.5 + math.sin(a) * 0.45 + .04, s * 0.76), g(math.cos(a) * -0.45 + .04, 0.5 + math.sin(a) * -0.45 + .04, s * 0.76), MADERA)
    caja(m, g, -0.05, 0.05, 0.45, 0.55, -0.8, 0.8, MADERA)
    for s in (-1, 1): caja(m, g, 1.2, 2.8, 0.55, 0.62, s * 0.35 - .03, s * 0.35 + .03, MADERA)   # varas

def pozo(m, f, u, w, r=0.9, tejadillo=True):
    cilindro(m, f, u, w, r, -0.2, 0.85, PIEDRA, 12, False)
    cilindro(m, f, u, w, r - 0.25, -0.2, 0.86, esc(PIEDRA, .7), 12, False)
    n = 12
    for i in range(n):   # brocal
        a1, a2 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        P = lambda a, rr: f(u + math.cos(a) * rr, 0.86, w + math.sin(a) * rr)
        m.quad(P(a1, r), P(a2, r), P(a2, r - 0.25), P(a1, r - 0.25), varia(PIEDRA_CLARA, .05))
    prisma(m, f, [(u + math.cos(2 * math.pi * i / n) * (r - 0.26), w + math.sin(2 * math.pi * i / n) * (r - 0.26)) for i in range(n)], 0.3, 0.32, AGUA, True)
    for s in (-1, 1): caja(m, f, u + s * (r - 0.05) - .07, u + s * (r - 0.05) + .07, 0.8, 2.4, w - .07, w + .07, MADERA)
    cilindro(m, f.sub(u, w, math.pi / 2), 0, 0, 0.1, 0, 0, MADERA, 6)
    caja(m, f, u - r, u + r, 1.75, 1.85, w - .06, w + .06, MADERA)
    caja(m, f, u - .02, u + .02, 0.9, 1.75, w - .02, w + .02, HIERRO)
    caja(m, f, u - .15, u + .15, 0.9, 1.15, w - .15, w + .15, MADERA_CL)
    if tejadillo: tejado_dos_aguas(m, f, u - r - 0.1, u + r + 0.1, w - 0.8, w + 0.8, 2.4, 0.7, 0.2)

def abrevadero(m, f, u, w, largo=2.4, ang=0.0):
    g = f.sub(u, w, ang)
    caja(m, g, -largo / 2, largo / 2, 0, 0.6, -0.4, 0.4, PIEDRA, .8)
    caja(m, g, -largo / 2 + 0.1, largo / 2 - 0.1, 0.45, 0.62, -0.3, 0.3, AGUA, 1)

def yunque(m, f, u, w):
    g = f.sub(u, w, 0.3)
    cilindro(m, g, 0, 0, 0.28, 0, 0.55, MADERA, 8)
    caja(m, g, -0.2, 0.2, 0.55, 0.7, -0.12, 0.12, HIERRO); caja(m, g, -0.35, 0.3, 0.7, 0.85, -0.1, 0.1, HIERRO)
    prisma(m, g, [(0.3, -0.06), (0.3, 0.06), (0.5, 0)], 0.75, 0.85, HIERRO)

def fragua(m, f, u, w):
    g = f.sub(u, w)
    caja(m, g, -0.8, 0.8, 0, 0.85, 0, 1.2, PIEDRA, .8)
    caja(m, g, -0.5, 0.5, 0.85, 0.9, 0.2, 1.0, CENIZA)
    bola(m, *g(0, 0.95, 0.6), 0.25, 0.1, FUEGO, 6, 2)
    m.quad(g(-0.9, 1.6, 1.3), g(0.9, 1.6, 1.3), g(0.4, 2.8, 0.2), g(-0.4, 2.8, 0.2), esc(PIEDRA_CLARA, .85))
    m.quad(g(0.9, 1.6, 1.3), g(0.9, 1.6, 0), g(0.4, 2.8, 0), g(0.4, 2.8, 0.2), esc(PIEDRA_CLARA, .7))
    m.quad(g(-0.9, 1.6, 0), g(-0.9, 1.6, 1.3), g(-0.4, 2.8, 0.2), g(-0.4, 2.8, 0), esc(PIEDRA_CLARA, .7))
    for s in (-1, 1): caja(m, g, s * 0.85 - .08, s * 0.85 + .08, 0.85, 1.6, 1.15, 1.3, MADERA)
    # fuelle
    gb = g.sub(1.25, 0.6, 0.0)
    prisma(m, gb, [(-0.1, -0.3), (0.6, -0.4), (0.6, 0.4), (-0.1, 0.3)], 0.9, 1.15, hexc('#5a3e2a'))
    caja(m, gb, 0.6, 1.0, 1.0, 1.06, -0.05, 0.05, MADERA)

def altar(m, f, u, w, ang=0.0):
    g = f.sub(u, w, ang)
    caja(m, g, -0.9, 0.9, 0, 1.0, -0.45, 0.45, PIEDRA_CLARA, .8)
    caja(m, g, -1.0, 1.0, 1.0, 1.1, -0.5, 0.5, PIEDRA_CLARA, .9)
    caja(m, g, -0.95, 0.95, 0.4, 1.02, 0.45, 0.47, hexc('#e4dcc8'))
    caja(m, g, -0.95, 0.95, 0.75, 1.02, 0.47, 0.48, TELA_ROJA)
    caja(m, g, -0.03, 0.03, 1.1, 1.6, -0.15, -0.1, hexc('#b0904a')); caja(m, g, -0.18, 0.18, 1.42, 1.48, -0.15, -0.1, hexc('#b0904a'))
    for s in (-1, 1):
        cilindro(m, g, s * 0.6, -0.2, 0.05, 1.1, 1.3, hexc('#b0904a'), 6); cilindro(m, g, s * 0.6, -0.2, 0.03, 1.3, 1.5, hexc('#e8e0cc'), 6)

def poste(m, f, u, w, v0, v1, r=0.1, col=MADERA):
    caja(m, f, u - r, u + r, v0, v1, w - r, w + r, col)

def pesebre(m, f, u0, u1, w, v=0.0):
    caja(m, f, u0, u1, v + 0.5, v + 0.9, w, w + 0.55, MADERA, .7)
    caja(m, f, u0 + 0.05, u1 - 0.05, v + 0.85, v + 0.92, w + 0.05, w + 0.5, HENO)
    caja(m, f, u0, u1, v, v + 0.5, w, w + 0.08, MADERA, .7)
    # pesebrera (rejilla para el heno) encima
    u = u0 + 0.1
    while u < u1 - 0.05:
        caja(m, f, u, u + 0.04, v + 1.0, v + 1.9, w + 0.02, w + 0.06, MADERA_CL); u += 0.18
    caja(m, f, u0, u1, v + 1.0, v + 1.05, w, w + 0.4, MADERA); caja(m, f, u0, u1, v + 1.85, v + 1.9, w + 0.02, w + 0.06, MADERA)

def diana(m, f, u, w):
    g = f.sub(u, w)
    for k, c in enumerate([hexc('#d8cfa8'), TELA_ROJA, hexc('#d8cfa8'), TELA_ROJA]):
        n = 10; r = 0.6 - k * 0.15
        for i in range(n):
            a1, a2 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            m.tri(g(0, 1.3, 0.02 + k * 0.01), g(math.cos(a1) * r, 1.3 + math.sin(a1) * r, 0.02 + k * 0.01), g(math.cos(a2) * r, 1.3 + math.sin(a2) * r, 0.02 + k * 0.01), c)
    caja(m, g, -0.65, 0.65, 0, 2.0, -0.15, 0.0, HENO, .8)
    for s in (-1, 1): caja(m, g, s * 0.5 - .04, s * 0.5 + .04, 0, 1.4, -0.5, -0.4, MADERA)

def barca(m, f, largo=4.6, manga=1.5, puntal=0.62):
    """barca de remos de tingladillo: casco de tablas solapadas (tracas) que se cierran en proa y popa, bancadas y remos.
       u a lo largo (proa en +u), w de babor a estribor, v arriba (0: la quilla)"""
    with con(m, 'madera'):
        L2 = largo / 2; NS = 16; NT = 5           # secciones a lo largo, tracas por banda
        def sec(i):
            x = -L2 + largo * i / NS; t = x / L2
            b = manga / 2 * max(0.0, 1 - abs(t) ** 2.6) ** 0.55          # media manga
            alza = 0.18 * max(0, abs(t) - 0.5) ** 2 * 4                  # el arrufo: sube en proa y popa
            return x, b, alza
        def punto(i, k, s, dentro=0.0):
            x, b, alza = sec(i); a = k / NT                              # a: 0 la quilla, 1 la borda
            ang = a * math.pi / 2
            w = s * (b - dentro) * math.sin(ang) ** 0.8
            v = (puntal + alza) * (1 - math.cos(ang)) ** 0.9 + dentro * 0.5
            return f(x, v, w)
        for s in (-1, 1):
            for k in range(NT):
                c = varia(MADERA_CL, 0.08)
                for i in range(NS):
                    A, B, C, D = punto(i, k, s), punto(i + 1, k, s), punto(i + 1, k + 1, s), punto(i, k + 1, s)
                    if s > 0: m.quad(A, B, C, D, esc(c, 0.8 + 0.06 * k))
                    else: m.quad(B, A, D, C, esc(c, 0.8 + 0.06 * k))
                    Ai, Bi, Ci, Di = punto(i, k, s, 0.04), punto(i + 1, k, s, 0.04), punto(i + 1, k + 1, s, 0.04), punto(i, k + 1, s, 0.04)
                    if s > 0: m.quad(Bi, Ai, Di, Ci, esc(c, 0.62))
                    else: m.quad(Ai, Bi, Ci, Di, esc(c, 0.62))
                # el canto de la traca (solape): una línea oscura
                for i in range(NS):
                    A, B = punto(i, k + 1, s), punto(i + 1, k + 1, s)
                    m.quad(A, B, (B[0], B[1] - 0.025, B[2]), (A[0], A[1] - 0.025, A[2]), esc(MADERA, 0.8))
            # la regala (borda)
            for i in range(NS):
                A, B = punto(i, NT, s), punto(i + 1, NT, s)
                m.quad(A, B, (B[0], B[1] + 0.05, B[2]), (A[0], A[1] + 0.05, A[2]), MADERA)
        # bancadas y remos
        for x in (-0.7, 0.6):
            caja(m, f, x - 0.13, x + 0.13, puntal - 0.2, puntal - 0.15, -manga / 2 + 0.1, manga / 2 - 0.1, TABLA, 0.75)
        for s in (-1, 1):
            caja(m, f, -1.6, 1.5, puntal + 0.06, puntal + 0.11, s * 0.35 - 0.04, s * 0.35 + 0.04, MADERA_CL, 0.8)
            caja(m, f, 1.1, 1.7, puntal + 0.04, puntal + 0.12, s * 0.35 - 0.09, s * 0.35 + 0.09, MADERA_CL, 0.8)   # la pala
        # el plan: tablas del fondo por encima del agua (si no, el agua del mar se ve dentro del casco)
        vp = 0.32
        with con(m, 'tabla'):
            for i in range(NS):
                x0, b0, _ = sec(i); x1, b1, _ = sec(i + 1)
                k0, k1 = 0.86 * b0 - 0.05, 0.86 * b1 - 0.05
                if k0 <= 0.02 and k1 <= 0.02: continue
                m.quad(f(x0, vp, -max(k0, 0.0)), f(x0, vp, max(k0, 0.0)), f(x1, vp, max(k1, 0.0)), f(x1, vp, -max(k1, 0.0)), esc(TABLA, 0.75))
