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
PIEDRA = hexc('#77726a'); PIEDRA_CLARA = hexc('#8a857a'); PIEDRA_OSC = hexc('#625d55'); MORTERO = hexc('#55504a')
MAMPOST = hexc('#716b62'); SILLAR_DOV = hexc('#8c8579')
MADERA = hexc('#4a3424'); MADERA_CL = hexc('#6e5038'); MADERA_VIEJA = hexc('#5a4a3a'); TABLA = hexc('#7a5a3c'); HIERRO = hexc('#2c2a28')
TEJA = hexc('#6a4d3b'); PAJA = hexc('#8c7a4e'); MUSGO = hexc('#56653a'); HUMEDAD = hexc('#5b5a46')
REVOCO = hexc('#cdb48a'); CAL = hexc('#d9cfb8'); TIERRA = hexc('#6f5d45'); BARRO = hexc('#5c4a36'); LOSA = hexc('#7e786c')
HENO = hexc('#b5a25c'); TELA_ROJA = hexc('#7a3328'); TELA_AZUL = hexc('#3d4c63'); LANA = hexc('#a99a7c'); OSCURO = hexc('#1a140e')
AGUA = hexc('#3e5a66'); HOJA = hexc('#4f6533'); FUEGO = hexc('#c2582c'); CENIZA = hexc('#3c3630')

class Malla:
    def __init__(self):
        self.P = []; self.C = []
    def tri(self, a, b, c, ca, cb=None, cc=None):
        self.P += [a, b, c]; self.C += [ca, cb or ca, cc or ca]
    def quad(self, a, b, c, d, ca, cb=None, cc=None, cd=None):
        cb = cb or ca; cc = cc or ca; cd = cd or ca
        self.P += [a, b, c, a, c, d]; self.C += [ca, cb, cc, ca, cc, cd]
    def anade(self, otra):
        self.P += otra.P; self.C += otra.C
    def arrays(self):
        return np.array(self.P, dtype=np.float32), np.clip(np.array(self.C, dtype=np.float32), 0, 1)
    def n(self): return len(self.P) // 3

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

def cilindro(m, f, cu, cw, r, v0, v1, col, n=10, tapa=True, r1=None):
    r1 = r if r1 is None else r1
    for i in range(n):
        a1, a2 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        p = lambda a, rr, v: f(cu + math.cos(a) * rr, v, cw + math.sin(a) * rr)
        l = 0.75 + 0.25 * (0.5 + 0.5 * math.cos(a1 - 0.8))
        m.quad(p(a2, r, v0), p(a1, r, v0), p(a1, r1, v1), p(a2, r1, v1), esc(col, l * 0.85), esc(col, l * 0.85), esc(col, l), esc(col, l))
        if tapa: m.tri(f(cu, v1, cw), p(a2, r1, v1), p(a1, r1, v1), esc(col, 1.05))

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

def _sillar(m, f, a, b, y, yt, w, d, col, tipo, signo, suelo):
    hg = y - suelo
    c = varia(col, 0.09 if tipo == 'silleria' else 0.15)
    if hg < 0.8: c = mezcla(c, MUSGO if az() < 0.4 else HUMEDAD, 0.38 * (1 - max(0, hg) / 0.8))
    if az() < 0.05: c = esc(c, 0.82)
    luz = 0.8 + 0.2 * min(1, max(0, hg) / 2.5)
    A, B, C, D = f(a, y + 0.02, w + d), f(b, y + 0.02, w + d), f(b, yt, w + d), f(a, yt, w + d)
    if signo > 0: m.quad(A, B, C, D, esc(c, luz))
    else: m.quad(B, A, D, C, esc(c, luz))

def _piedras(m, f, u0, u1, v0, v1, w, huecos, col, tipo, signo, suelo):
    """hiladas de piedra sobre la cara w (signo = +1 si mira a +w); salta los huecos y pone dovelas y jambas"""
    d = 0.03 * signo; y = v0; fila = 0
    cajas_h = [(h['u'] - h['a'] / 2 - (0.32 if h['a'] < 0.3 else 0.04), h['v0'] - (0.27 if h['a'] < 0.3 else 0.04), h['u'] + h['a'] / 2 + (0.32 if h['a'] < 0.3 else 0.04), alto_hueco(h) + (0.27 if h['a'] < 0.3 else 0.04)) for h in huecos]
    while y < v1 - 0.03:
        bh = 0.5 if tipo == 'silleria' else 0.2 + az() * 0.22
        yt = min(v1, y + bh) - 0.035
        u = u0 - (0.45 if (tipo == 'silleria' and fila % 2) else az() * 0.3)
        while u < u1:
            bw = (0.6 + 0.65 * az()) if tipo == 'silleria' else (0.25 + 0.6 * az())
            a, b = max(u0, u) + 0.035, min(u1, u + bw) - 0.035; u += bw
            if b - a < 0.07: continue
            trozos = [(a, b)]
            for hb in cajas_h:
                if yt < hb[1] or y + 0.02 > hb[3]: continue
                tr = []
                for (x0, x1) in trozos:
                    if x1 <= hb[0] or x0 >= hb[2]: tr.append((x0, x1)); continue
                    if hb[0] - x0 > 0.07: tr.append((x0, hb[0] - 0.035))
                    if x1 - hb[2] > 0.07: tr.append((hb[2] + 0.035, x1))
                trozos = tr
            if not trozos: continue
            if len(trozos) > 1 or trozos[0] != (a, b):
                for (x0, x1) in trozos:
                    _sillar(m, f, x0, x1, y, yt, w, d, col, tipo, signo, suelo)
                continue
            hg = y - suelo
            c = varia(col, 0.09 if tipo == 'silleria' else 0.15)
            if hg < 0.8: c = mezcla(c, MUSGO if az() < 0.4 else HUMEDAD, 0.38 * (1 - max(0, hg) / 0.8))
            if az() < 0.05: c = esc(c, 0.82)
            luz = 0.8 + 0.2 * min(1, max(0, hg) / 2.5)
            A, B, C, D = f(a, y + 0.02, w + d), f(b, y + 0.02, w + d), f(b, yt, w + d), f(a, yt, w + d)
            if signo > 0: m.quad(A, B, C, D, esc(c, luz))
            else: m.quad(B, A, D, C, esc(c, luz))
        y += bh; fila += 1
    # dovelas y jambas de cada hueco
    for h in huecos:
        if h.get('sin_dovelas'):
            if h['a'] < 0.3 and not h.get('sin_marco'):   # saetera: dos sillares largos a los lados, dintel y alféizar
                ux0, ux1 = h['u'] - h['a'] / 2, h['u'] + h['a'] / 2
                for (a, b, y0_, y1_) in ((ux0 - 0.3, ux0 - 0.01, h['v0'] - 0.25, h['v1'] + 0.25), (ux1 + 0.01, ux1 + 0.3, h['v0'] - 0.25, h['v1'] + 0.25),
                                         (ux0 - 0.01, ux1 + 0.01, h['v1'] + 0.01, h['v1'] + 0.25), (ux0 - 0.01, ux1 + 0.01, h['v0'] - 0.25, h['v0'] - 0.01)):
                    c = varia(SILLAR_DOV, 0.05)
                    A, B, C, D = f(a, y0_, w + d * 1.4), f(b, y0_, w + d * 1.4), f(b, y1_, w + d * 1.4), f(a, y1_, w + d * 1.4)
                    if signo > 0: m.quad(A, B, C, D, c)
                    else: m.quad(B, A, D, C, c)
            continue
        ux0, ux1 = h['u'] - h['a'] / 2, h['u'] + h['a'] / 2
        # jambas: sillares alternos a los lados
        yy = h['v0']; k = 0
        while yy < h['v1'] - 0.05:
            yt = min(h['v1'], yy + 0.42)
            ext = 0.32 if k % 2 else 0.5
            for (a, b) in ((ux0 - ext, ux0 - 0.02), (ux1 + 0.02, ux1 + ext)):
                A, B, C, D = f(a, yy + 0.02, w + d * 1.4), f(b, yy + 0.02, w + d * 1.4), f(b, yt - 0.03, w + d * 1.4), f(a, yt - 0.03, w + d * 1.4)
                c = varia(SILLAR_DOV, 0.06)
                if signo > 0: m.quad(A, B, C, D, c)
                else: m.quad(B, A, D, C, c)
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
                q = [p0, p1, fuera_(p1), fuera_(p0)]
                c = varia(SILLAR_DOV, 0.06)
                P4 = [f(q[j][0], q[j][1], w + d * 1.4) for j in range(4)]
                if signo > 0: m.quad(P4[1], P4[0], P4[3], P4[2], c)
                else: m.quad(P4[0], P4[1], P4[2], P4[3], c)
        else:   # dintel de una pieza
            A, B, C, D = f(ux0 - 0.25, h['v1'] + 0.02, w + d * 1.4), f(ux1 + 0.25, h['v1'] + 0.02, w + d * 1.4), f(ux1 + 0.25, h['v1'] + 0.4, w + d * 1.4), f(ux0 - 0.25, h['v1'] + 0.4, w + d * 1.4)
            c = varia(SILLAR_DOV, 0.05)
            if signo > 0: m.quad(A, B, C, D, c)
            else: m.quad(B, A, D, C, c)

def muro(m, f, u0, u1, v0, v1, w0, w1, huecos=(), tipo='silleria', col=None, tapa=True, cabezas=True, suelo=None, piedras_dentro=True, dentro_col=None):
    """muro de u0 a u1, de v0 a v1, de grueso w0..w1 (w1 la cara de fuera). Huecos con derrame opcional:
       h['derrame'] = ancho de más en la cara de dentro (w0); h['v0d'] = umbral por dentro."""
    col = col or (PIEDRA if tipo == 'silleria' else MAMPOST)
    mort = esc(col, 0.7)
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
            m.quad(f(a[0], a[1], w1), f(b[0], b[1], w1), f(c[0], c[1], w0), f(d[0], d[1], w0), esc(col, l))
        a, b = e[0], e[1]; c, d = i_[1], i_[0]
        m.quad(f(b[0], b[1], w1), f(a[0], a[1], w1), f(d[0], d[1], w0), f(c[0], c[1], w0), esc(SILLAR_DOV, 0.95))   # umbral / alféizar
    if tapa: m.quad(f(u0, v1, w1), f(u1, v1, w1), f(u1, v1, w0), f(u0, v1, w0), esc(col, 1.0))
    if cabezas:
        m.quad(f(u0, v0, w0), f(u0, v0, w1), f(u0, v1, w1), f(u0, v1, w0), esc(mort, .85))
        m.quad(f(u1, v0, w1), f(u1, v0, w0), f(u1, v1, w0), f(u1, v1, w1), esc(mort, .85))

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
            m.quad(f(a - .04, vt, w1 + .05), f(b + .04, vt, w1 + .05), f(b + .04, vt + .12, wm), f(a - .04, vt + .12, wm), c)
            m.quad(f(b + .04, vt, w0 - .05), f(a - .04, vt, w0 - .05), f(a - .04, vt + .12, wm), f(b + .04, vt + .12, wm), esc(c, .85))
            m.tri(f(a - .04, vt, w0 - .05), f(a - .04, vt, w1 + .05), f(a - .04, vt + .12, wm), esc(c, .8))
            m.tri(f(b + .04, vt, w1 + .05), f(b + .04, vt, w0 - .05), f(b + .04, vt + .12, wm), esc(c, .8))
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
    for i in range(n):
        t0, t1 = i / n, (i + 1) / n
        for j in range(mm):
            s0, s1 = j / mm, (j + 1) / mm
            c = varia(col, 0.05 if paja else 0.1)
            if not paja:
                if az() < (0.2 if t0 < 0.25 else 0.05): c = mezcla(c, MUSGO, 0.35 + 0.3 * az())
                if az() < 0.04: c = esc(c, 0.75)
            m.quad(P(t0, s0, lip), P(t0, s1, lip), P(t1, s1, 0), P(t1, s0, 0), esc(c, luz * (0.93 + 0.07 * t0)))
        if lip: m.quad(P(t0, 0), P(t0, 1), P(t0, 1, lip), P(t0, 0, lip), esc(col, 0.45 * luz))
    # la cara de abajo
    m.quad(P(0, 1, -0.06), P(0, 0, -0.06), P(1, 0, -0.06), P(1, 1, -0.06), esc(MADERA, 0.8))

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
            c = varia(col, 0.1)
            caja(m, f, a, b, v - grueso, v, w + 0.008, wb - 0.008, c, 0.6, caras='v1w0w1')
        w = wb
    # vigas por debajo
    u = u0 + 0.4
    while u < u1:
        caja(m, f, u, u + 0.22, v - grueso - 0.28, v - grueso, w0, w1, MADERA, 0.7, caras='w0w1u0u1v0')
        u += 1.4

def suelo_losas(m, f, u0, u1, w0, w1, v, col=LOSA, lado=0.6, junta=0.03):
    m.quad(f(u0, v - 0.01, w0), f(u0, v - 0.01, w1), f(u1, v - 0.01, w1), f(u1, v - 0.01, w0), esc(col, 0.55))
    u = u0; fila = 0
    while u < u1 - 0.01:
        ub = min(u1, u + lado * (0.8 + 0.4 * az()))
        w = w0 - (lado / 2 if fila % 2 else 0)
        while w < w1 - 0.01:
            wb = min(w1, w + lado * (0.8 + 0.5 * az()))
            a, b = max(w0, w) + junta, wb - junta
            if b - a > 0.05:
                c = varia(col, 0.12)
                m.quad(f(u + junta, v, a), f(u + junta, v, b), f(ub - junta, v, b), f(ub - junta, v, a), c)
            w = wb
        u = ub; fila += 1

# ---------------- escaleras
def escalera(m, f, u0, u1, w0, w1, v0, v1, col=PIEDRA, maciza=True, huella=0.29, madera=False):
    """sube a lo largo de +u, de v0 (en u0) a v1 (en u1)"""
    n = max(2, int(round((v1 - v0) / 0.2))); dh = (v1 - v0) / n; du = (u1 - u0) / n
    for i in range(n):
        a = u0 + i * du; b = u0 + (i + 1) * du; top = v0 + (i + 1) * dh
        base = v0 - 0.4 if maciza else top - (0.08 if madera else 0.25)
        c = varia(col, 0.07)
        if madera:
            caja(m, f, a, b + 0.02, top - 0.06, top, w0 + 0.1, w1 - 0.1, c, 0.7)
        else:
            caja(m, f, a, b + 0.01, base, top, w0, w1, c, 0.75, caras='v1u0w0w1')
            m.quad(f(a, top, w1 + .005), f(a + 0.04, top, w1 + .005), f(a + 0.04, top - dh, w1 + .005), f(a, top - dh, w1 + .005), esc(c, .6))
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
        prisma(m, f, pts, top - 0.2, top, varia(col, 0.07))
    cilindro(m, f, cu, cw, 0.17, v0, v1, esc(col, 0.95), 8)
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
        caja(m, f, u - b / 2, u + b / 2, v0, v1, w - b / 2, w + b / 2, col, 0.85)
        prisma(m, f, [(u - b / 2, w - b / 2), (u + b / 2, w - b / 2), (u + b / 2, w + b / 2), (u - b / 2, w + b / 2)], v0 - 0.18, v0, HIERRO, tapa=False)
    v = v0 + 0.4
    while v < v1 - 0.1:
        caja(m, f, u0 - 0.05, u1 + 0.05, v, v + b, w - b / 2 - 0.03, w + b / 2 + 0.03, esc(col, 0.9), 0.85); v += 0.42

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
    caja(m, g, -largo / 2, largo / 2, alto - 0.06, alto, -ancho / 2, ancho / 2, varia(col, .08), .8)
    for s in (-1, 1):   # caballetes
        caja(m, g, s * (largo / 2 - 0.25) - 0.04, s * (largo / 2 - 0.25) + 0.04, 0, alto - 0.06, -ancho / 2 + 0.05, ancho / 2 - 0.05, MADERA, .7)
        caja(m, g, s * (largo / 2 - 0.25) - 0.05, s * (largo / 2 - 0.25) + 0.05, 0, 0.08, -ancho / 2, ancho / 2, MADERA, .7)
    caja(m, g, -largo / 2 + 0.3, largo / 2 - 0.3, 0.25, 0.32, -0.04, 0.04, MADERA, .7)

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
    caja(m, g, -largo / 2 + 0.6, largo / 2 - 0.02, 0.6, 0.66, -ancho / 2 + 0.02, ancho / 2 - 0.02, colcha, .8)
    caja(m, g, -largo / 2 + 0.08, -largo / 2 + 0.45, 0.6, 0.7, -ancho / 2 + 0.12, ancho / 2 - 0.12, CAL, .85)
    caja(m, g, -largo / 2 - 0.02, -largo / 2 + 0.06, 0.55, 1.0, -ancho / 2, ancho / 2, MADERA, .7)
    if dosel:
        for su in (-1, 1):
            for sw in (-1, 1): caja(m, g, su * (largo / 2) - 0.04, su * (largo / 2) + 0.04, 0, 2.1, sw * ancho / 2 - 0.04, sw * ancho / 2 + 0.04, MADERA)
        caja(m, g, -largo / 2, largo / 2, 2.1, 2.2, -ancho / 2, ancho / 2, colcha, .8)
        caja(m, g, -largo / 2 - 0.02, -largo / 2 + 0.01, 0.7, 2.1, -ancho / 2, ancho / 2, colcha, .8)

def jergon(m, f, u, w, ang=0.0):
    g = f.sub(u, w, ang)
    caja(m, g, -0.95, 0.95, 0, 0.16, -0.38, 0.38, varia(HENO, .08), .75)
    caja(m, g, -0.5, 0.95, 0.16, 0.2, -0.36, 0.36, varia(LANA, .1), .8)

def arca(m, f, u, w, ang=0.0, largo=1.1, ancho=0.55, alto=0.6):
    g = f.sub(u, w, ang)
    caja(m, g, -largo / 2, largo / 2, 0.05, alto, -ancho / 2, ancho / 2, varia(MADERA_CL, .1), .75)
    for x in (-largo / 2 + 0.1, largo / 2 - 0.14): caja(m, g, x, x + 0.04, 0.05, alto + 0.01, -ancho / 2 - 0.01, ancho / 2 + 0.01, HIERRO)
    caja(m, g, -0.05, 0.05, alto - 0.2, alto - 0.05, ancho / 2, ancho / 2 + 0.02, HIERRO)

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
    caja(m, g, -ancho / 2 + 0.25, ancho / 2 - 0.25, v_suelo + 0.15, v_suelo + 1.3, 0, 0.04, OSCURO)   # el fondo ahumado
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
    base_c = hexc('#ffd27a'); medio_c = hexc('#f08a2c'); punta_c = hexc('#a8321a')
    for k in range(5):
        a = k * math.pi / 5 + 0.3; r = ancho * (0.55 + 0.45 * ((k * 37) % 5) / 4); hh = alto * (0.6 + 0.4 * ((k * 53) % 5) / 4)
        dx, dw = math.cos(a) * r / 2, math.sin(a) * r / 2
        ox, ow = math.cos(a + 1.7) * r * 0.15, math.sin(a + 1.7) * r * 0.15
        m.tri(f(u - dx + ox, v, w - dw + ow), f(u + dx + ox, v, w + dw + ow), f(u + ox * 0.3, v + hh * 0.55, w + ow * 0.3), base_c, base_c, medio_c)
        m.tri(f(u - dx * 0.6 + ox, v + hh * 0.3, w - dw * 0.6 + ow), f(u + dx * 0.6 + ox, v + hh * 0.3, w + dw * 0.6 + ow), f(u + ox * 1.6, v + hh, w + ow * 1.6), medio_c, medio_c, punta_c)

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
    m.quad(f(u0, v0, w + 0.03), f(u1, v0, w + 0.03), f(u1, v1, w + 0.03), f(u0, v1, w + 0.03), col)
    c2 = esc(col, 1.4)
    m.quad(f(u0 + .15, v0 + .15, w + 0.035), f(u1 - .15, v0 + .15, w + 0.035), f(u1 - .15, v0 + .3, w + 0.035), f(u0 + .15, v0 + .3, w + 0.035), c2)
    m.quad(f(u0 + .15, v1 - .3, w + 0.035), f(u1 - .15, v1 - .3, w + 0.035), f(u1 - .15, v1 - .15, w + 0.035), f(u0 + .15, v1 - .15, w + 0.035), c2)
    caja(m, f, u0 - .1, u1 + .1, v1, v1 + 0.05, w + 0.01, w + 0.06, MADERA)

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
