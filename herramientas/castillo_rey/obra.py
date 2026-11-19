# Obra gruesa: cortinas con su adarve, torres de flanqueo por dentro y por fuera, foso.
from sitio import *

class Cortina:
    def __init__(self, nombre, p, q, ini, fin, centro=CEN, grueso=T_MURO, adarve=ADARVE, fuera_sign=None, foso=False, fondo=None):
        """ini/fin: (centro, lado, ángulo[, fondo]) del cuadrado donde arranca/acaba, o None"""
        self.nombre = nombre; self.T = grueso; self.adarve = adarve; self.foso = foso
        f, dado = marco_fuera(p, q, centro)
        if dado: p, q, ini, fin = q, p, fin, ini
        self.f = f; self.p, self.q = p, q
        L = math.dist(p, q)
        self.u0 = corte_cuadrado(p, q, *ini) if ini else 0.0
        self.u1 = L - (corte_cuadrado(q, p, *fin) if fin else 0.0)
        self.huecos = []        # huecos en (u, v relativo a 0 del mundo), lado: 'muro'
        self.fondo = fondo
    def p2(self, u, w): return self.f.p2(u, w)
    def suelo_en(self, u, w=0.0): return h(*self.f.p2(u, w))
    def marco_dentro(self, u, y0=0.0):
        """marco que arranca en la cara de dentro en u, con +w hacia el patio y +u en el sentido contrario a la cortina"""
        o = self.f.p2(u, -self.T / 2)
        return F(o[0], o[1], self.f.a + math.pi, y0)

def construir_cortina(m, c):
    f = c.f; T = c.T
    # la base: en el foso, desde su fondo; si no, desde el suelo más bajo
    us = [c.u0 + (c.u1 - c.u0) * i / 8 for i in range(9)]
    smin = min(min(h(*f.p2(u, T / 2 + 0.5)), h(*f.p2(u, -T / 2 - 0.5)), h(*f.p2(u, T / 2 + 2.5))) for u in us)
    base = (FOSO_FONDO - 0.5) if c.foso else smin - 1.2
    if c.fondo is not None: base = c.fondo
    top = c.adarve
    # alambor (talud) al pie, por fuera
    talud = 2.2 if c.foso else 1.2
    f0 = F(f.o[0], f.o[1], f.a, 0)
    tb = base + talud * 1.6
    m.quad(f0(c.u0, base, T / 2 + talud * 0.5), f0(c.u1, base, T / 2 + talud * 0.5), f0(c.u1, tb, T / 2), f0(c.u0, tb, T / 2), esc(PIEDRA_OSC, .85))
    hs = [dict(hh) for hh in c.huecos]
    muro(m, f0, c.u0, c.u1, base, top, -T / 2, T / 2, hs, 'mamposteria', MAMPOST, tapa=False, cabezas=False, suelo=(FOSO_FONDO if c.foso else smin))
    # el adarve: losas; parapeto almenado por fuera, pretil por dentro
    suelo_losas(m, f0, c.u0, c.u1, -T / 2, T / 2 - 0.65, top, LOSA, 0.7)
    almenado(m, f0, c.u0, c.u1, top, T / 2 - 0.65, T / 2, 1.0, 1.1, 2.1, 0.75, PIEDRA)
    muro(m, f0, c.u0, c.u1, top, top + 0.55, -T / 2, -T / 2 + 0.35, (), 'silleria', PIEDRA, tapa=True, cabezas=False, suelo=top + 50)
    # gárgolas para el agua del adarve, por fuera
    u = c.u0 + 3
    while u < c.u1 - 2:
        caja(m, f0, u - 0.12, u + 0.12, top - 0.35, top - 0.15, T / 2, T / 2 + 0.6, PIEDRA_CLARA); u += 6.5

class Torre:
    def __init__(self, nombre, c, lado, a, alto_terraza=TERRAZA, grueso=1.5, base=None):
        self.n = nombre; self.c = c; self.lado = lado; self.a = a; self.T = grueso
        self.terraza = alto_terraza
        self.esq = esquinas(c, lado, a)[::-1]       # en este orden, +w de cada cara mira hacia fuera
        self.puertas = {i: [] for i in range(4)}     # por cara: (u en la cara, v suelo, ancho, alto)
        self.saeteras = {i: [] for i in range(4)}
        self.suelo0 = max(h(*p) for p in esquinas(c, lado - 2 * grueso, a)) + 0.12
        self.base = base
    def cara(self, i):
        """marco de la cara i (de la esquina i a la i+1), +w hacia fuera"""
        p, q = self.esq[i], self.esq[(i + 1) % 4]
        return F.de_segmento(p, q, 0)
    def golpe(self, desde):
        """cara y u donde la recta desde el centro hacia 'desde' corta el contorno"""
        d = corte_cuadrado(self.c, desde, self.c, self.lado, self.a)
        L = math.dist(self.c, desde); P = (self.c[0] + (desde[0] - self.c[0]) / L * d, self.c[1] + (desde[1] - self.c[1]) / L * d)
        best = None
        for i in range(4):
            p, q = self.esq[i], self.esq[(i + 1) % 4]
            dd = dist_seg(P, p, q)
            if best is None or dd < best[0]: best = (dd, i, math.dist(p, P))
        return best[1], best[2]
    def cara_hacia(self, punto):
        best = None
        for i in range(4):
            p, q = self.esq[i], self.esq[(i + 1) % 4]; m_ = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
            d = math.dist(m_, punto)
            if best is None or d < best[0]: best = (d, i)
        return best[1]

ARRANQUE_TORRE = math.radians(245)   # el primer peldaño del caracol, de cara a la sala (el caracol está en la esquina)

def construir_torre(m, t, patio, pisos_extra=(), base_foso=False):
    """torre de flanqueo: cuatro muros con sus huecos, suelos de tablas, caracol, terraza almenada"""
    L = t.lado; T = t.T
    alrededor = [t.cara(i).p2(L * k / 6, d) for i in range(4) for k in range(7) for d in (0.0, 1.5, 3.0)]
    base = (FOSO_FONDO - 0.5) if base_foso else min(h(*p) for p in alrededor) - 1.2
    if t.base is not None: base = t.base
    g0 = t.suelo0; gm = round((g0 + ADARVE) / 2, 2); gt = t.terraza
    niveles = [g0, gm, ADARVE, gt]
    cp = t.cara_hacia(patio)
    # el caracol: en la esquina del lado del patio (entre la cara del patio y la siguiente)
    ci = (cp + 1) % 4
    fcar = t.cara(cp)
    # coordenadas del caracol en el marco de la cara del patio: cerca del final de la cara, dentro
    r_c = 0.95
    cu, cw = L - T - r_c - 0.05, -T - r_c - 0.05
    for i in range(4):
        f = t.cara(i)
        hs = []
        for (u, v, a_, al) in t.puertas[i]: hs.append({'u': u, 'a': a_, 'v0': v, 'v1': v + al, 'arco': 'medio'})
        if i == cp: hs.append({'u': L * 0.38, 'a': 1.1, 'v0': g0, 'v1': g0 + 1.9, 'arco': 'medio'})       # la puerta del patio
        else:
            for v in (gm + 0.6, ADARVE + 0.5): hs.append(saetera(L / 2, v, 1.5, 0.12, 1.0))
        muro(m, f, 0, L, base, gt, -T, 0, hs, 'mamposteria', MAMPOST, tapa=False, cabezas=False, suelo=(FOSO_FONDO if base_foso else min(h(*p) for p in t.esq)))
        esquinales(m, f, 0, L, base, gt, 0.0, i)
        f2 = t.cara(i)
        talud = 1.6 if base_foso else 0.9
        m.quad(f2(0, base, talud * 0.5), f2(L, base, talud * 0.5), f2(L, base + talud * 1.6, 0), f2(0, base + talud * 1.6, 0), esc(PIEDRA_OSC, .85))
        almenado(m, f2, -0.0, L, gt, -0.6, 0.0, 1.0, 1.1, 1.75, 0.7, PIEDRA)
        # cornisa de canecillos bajo la terraza
        u = 0.3
        while u < L - 0.2:
            caja(m, f2, u, u + 0.25, gt - 0.45, gt - 0.05, 0, 0.25, PIEDRA_CLARA, .85); u += 0.85
        caja(m, f2, 0, L, gt - 0.05, gt + 0.05, 0, 0.3, PIEDRA_CLARA, .9)
    # suelos: tablas en las plantas, losas en la terraza; hueco del caracol
    hueco_c = (cu - r_c - 0.1, cu + r_c + 0.1, cw - r_c - 0.1, cw + r_c + 0.1)
    for k, v in enumerate(niveles):
        if k == 0: suelo_losas(m, fcar, T, L - T, -L + T, -T, v, LOSA, 0.55)
        elif k == 3: suelo_losas(m, fcar, 0.6, L - 0.6, -L + 0.6, -0.6, v, LOSA, 0.7); caja(m, fcar, T, L - T, v - 0.5, v - 0.05, -L + T, -T, PIEDRA_OSC, .8, caras='v0')
        else: suelo_tablas(m, fcar, T, L - T, -L + T, -T, v, TABLA, 0.3, 0.12, [hueco_c])
    # caracol de abajo a la terraza; caseta en la terraza
    caracol(m, fcar, cu, cw, r_c, g0, gt, ARRANQUE_TORRE, 1, PIEDRA)
    import choques; choques.HUECO_PRISMA[0] = (cu - 1.3, cw)
    prisma(m, fcar, [(cu - 1.3, cw - 1.3), (cu + 1.3, cw - 1.3), (cu + 1.3, cw + 1.3), (cu - 1.3, cw + 1.3)], gt, gt + 2.6, PIEDRA, tapa=False)
    tejado_dos_aguas(m, fcar, cu - 1.4, cu + 1.4, cw - 1.4, cw + 1.4, gt + 2.6, 0.8, 0.15)
    # una puerta en la caseta, hacia el centro de la terraza
    caja(m, fcar, cu - 1.32, cu - 1.28, gt, gt + 2.0, cw - 0.45, cw + 0.45, OSCURO)
    # muebles de la planta baja (almacén) y de la media (puesto de tiro)
    almacen = t.cara(cp)
    tonel(m, F(*fcar.p2(T + 0.5, -L / 2 - 0.3), 0, g0), 0, 0); tonel(m, F(*fcar.p2(T + 0.5, -L / 2 - 1.0), 0, g0), 0, 0)   # (lejos de la puerta)
    saco(m, F(*fcar.p2(T + 0.6, -L + T + 0.7), 0, g0), 0, 0); saco(m, F(*fcar.p2(T + 1.2, -L + T + 0.6), 0, g0), 0, 0)
    arca(m, F(*fcar.p2(T + 0.8, -L / 2), fcar.a + math.pi / 2, gm), 0, 0, 0, 1.0, 0.5, 0.55)
    banco(m, F(*fcar.p2(L / 2 - 0.4, -L + T + 0.4), fcar.a, ADARVE), 0, 0, 1.4)
    return niveles

def construir_foso(m, tramos):
    """tramos: lista de (Cortina) del frente con foso; el foso va de la cara de fuera hasta FOSO_ANCHO más allá.
       Contraescarpa de mampostería; fondo de tierra; devuelve el polígono del foso para cavar el terreno."""
    contorno_in, contorno_out = [], []
    for c in tramos:
        for u in (c.u0 - 4, c.u1 + 4):
            contorno_in.append(c.f.p2(u, c.T / 2)); contorno_out.append(c.f.p2(u, c.T / 2 + FOSO_ANCHO))
    return contorno_in, contorno_out

def pared(m, p, q, centro, v0, v1, grueso, huecos=(), tipo='silleria', col=None, tapa=False, cabezas=True, suelo=None, fuera=False, dentro_col=None):
    """muro recto de p a q con el grueso hacia centro (o hacia fuera si fuera=True), +w del marco hacia fuera de centro.
       Los huecos llevan 'u' medida desde p. Devuelve (marco, uf) con uf(u desde p) -> u del marco."""
    f, rev = marco_fuera(p, q, centro)
    L = math.dist(p, q)
    uf = (lambda u: L - u) if rev else (lambda u: u)
    hs = [dict(hh, u=uf(hh['u'])) for hh in huecos]
    w0, w1 = (-grueso, 0.0) if not fuera else (0.0, grueso)
    if fuera: w0, w1 = 0.0, grueso
    muro(m, f, 0, L, v0, v1, w0, w1, hs, tipo, col, tapa=tapa, cabezas=cabezas, suelo=suelo, dentro_col=dentro_col)
    f.L = L
    return f, uf

def pretil_inclinado(m, f, u0, u1, w0, w1, v_bajo, v_alto, alto=0.9, col=None):
    """pretil de escalera: muro inclinado de u0 (en v_bajo) a u1 (en v_alto), de grueso w0..w1, con albardilla"""
    col = col or PIEDRA
    _m0 = m.mat; m.mat = 'sillar'
    n = max(1, int((u1 - u0) / 0.9))
    for i in range(n):
        a = u0 + (u1 - u0) * i / n; b = u0 + (u1 - u0) * (i + 1) / n
        ya = v_bajo + (v_alto - v_bajo) * (a - u0) / (u1 - u0); yb = v_bajo + (v_alto - v_bajo) * (b - u0) / (u1 - u0)
        c = varia(col, 0.06)
        import choques; choques._caja_muro(f, a, b, w0, w1, min(ya, yb) - 0.5, max(ya, yb) + alto)
        for w, sg in ((w0, -1), (w1, 1)):
            m.quad(f(a, ya - 0.5, w), f(b, yb - 0.5, w), f(b, yb + alto, w), f(a, ya + alto, w), esc(c, 0.86 if sg < 0 else 0.95))
            for k in range(1, 3):   # hiladas
                yk = alto * k / 3
                m.quad(f(a, ya + yk - 0.02, w + 0.004 * sg), f(b, yb + yk - 0.02, w + 0.004 * sg), f(b, yb + yk + 0.02, w + 0.004 * sg), f(a, ya + yk + 0.02, w + 0.004 * sg), esc(c, 0.65))
        m.quad(f(a, ya + alto + 0.08, w0 - 0.04), f(b, yb + alto + 0.08, w0 - 0.04), f(b, yb + alto + 0.08, w1 + 0.04), f(a, ya + alto + 0.08, w1 + 0.04), varia(PIEDRA_CLARA, .04))
        for w in (w0 - 0.04, w1 + 0.04): m.quad(f(a, ya + alto, w), f(b, yb + alto, w), f(b, yb + alto + 0.08, w), f(a, ya + alto + 0.08, w), esc(PIEDRA_CLARA, .85))
    m.quad(f(u1, v_alto - 0.5, w0), f(u1, v_alto - 0.5, w1), f(u1, v_alto + alto, w1), f(u1, v_alto + alto, w0), esc(col, .8))
    m.quad(f(u0, v_bajo - 0.5, w0), f(u0, v_bajo - 0.5, w1), f(u0, v_bajo + alto, w1), f(u0, v_bajo + alto, w0), esc(col, .8))
    m.mat = _m0
