# Los patios: pozos, abrevadero, herrería, la vida del patio de armas; la poterna del mar con su escalera y su embarcadero.
from obra import *
import edificios as ED
import choques

def en(p, y=None):
    return F(p[0], p[1], 0.0, h(*p) if y is None else y)

def patios(m, CN, E_CUAD, E_GRAN, E_GUAR, E_COCI):
    # ---------------- patio de armas
    pz = (CEN_EXT[0] - 2.0, CEN_EXT[1] + 2.0)
    pozo(m, F(pz[0], pz[1], ang(A, G), h(*pz)), 0, 0, 1.0, True)
    g = E_CUAD.f
    for (u, w) in ((4.5, E_CUAD.Fd + 2.6), (10.5, E_CUAD.Fd + 2.6)):
        p = g.p2(u, w); abrevadero(m, F(p[0], p[1], g.a, h(*p)), 0, 0, 2.6)
        poste(m, F(p[0], p[1], g.a, h(*p)), 0, 1.4, 0, 1.3)
    # herrería, suelta, contra el muro de separación (lado del patio de armas)
    c = CN['PA-F']
    ph = c.p2((c.u0 + c.u1) / 2 + 6.0, c.T / 2 + 4.2)
    ED.herreria(m, ph, round(h(*ph) + 0.1, 2))
    # leña, carro y toneles delante del granero
    g = E_GRAN.f
    p = g.p2(2.5, E_GRAN.Fd + 3.0); carro(m, F(p[0], p[1], g.a, h(*p)), 0, 0, 0.4)
    for k in range(3):
        p = g.p2(9.5 + k * 0.75, E_GRAN.Fd + 1.0); tonel(m, F(p[0], p[1], g.a, h(*p)), 0, 0)
    # la diana de los ballesteros, contra la muralla P–A
    c = CN['P-A']; p = c.marco_dentro(c.u1 - 2.0).p2(0, 1.2)
    diana(m, F(p[0], p[1], c.f.a + math.pi, h(*p)), 0, 0)
    # el cuerpo de guardia: un banco y un brasero delante de la puerta
    g = E_GUAR.f; p = g.p2(6.0, E_GUAR.Fd + 1.0)
    banco(m, F(p[0], p[1], g.a, h(*p)), 0, 0, 1.8)
    # ---------------- patio del alcázar: pozo junto a la cocina, leña
    pz = (CEN_INT[0] + 3.0, CEN_INT[1] - 4.0)
    pozo(m, F(pz[0], pz[1], ang(B, C), h(*pz)), 0, 0, 0.9, True)
    g = E_COCI.f
    p = g.p2(2.0, E_COCI.Fd + 0.8)
    for k in range(4): caja(m, F(p[0], p[1], g.a, h(*p)), -1.0 + 0.0, 1.0, k * 0.28, k * 0.28 + 0.26, k * 0.0, 0.7, hexc('#6e4e34'), .8)
    tonel(m, F(*g.p2(4.0, E_COCI.Fd + 0.7), g.a, h(*g.p2(4.0, E_COCI.Fd + 0.7))), 0, 0)

def _peldanos(m, f, u0, u1, w0, w1, v_alto, v_bajo, col=PIEDRA):
    """tramo de escalera que baja a lo largo de +u (de v_alto en u0 a v_bajo en u1), macizo hasta el terreno"""
    n = max(2, int(round((v_alto - v_bajo) / 0.2))); du = (u1 - u0) / n; dv = (v_alto - v_bajo) / n
    for i in range(n):
        a = u0 + i * du; b = a + du; top = v_alto - i * dv
        base = min(h(*f.p2(a, w0)), h(*f.p2(b, w1)), h(*f.p2(a, w1))) - 0.6
        caja(m, f, a, b + 0.01, min(base, top - 0.3), top, w0, w1, varia(col, .07), .75)
    # pretil del lado del mar
    for i in range(n):
        a = u0 + i * du; top = v_alto - i * dv
        caja(m, f, a, a + du + 0.01, top, top + 0.8, w1, w1 + 0.3, PIEDRA, .85)

CAMINO_POTERNA = []   # (para las pruebas: el eje de la escalera de la poterna, (x, z, y) en el mundo)
RELLANO_POTERNA = [] 

def poterna(m, c):
    """c: la cortina E–F (+w hacia el mar). La puerta en el suelo del patio, un matacán encima y la escalera al embarcadero."""
    f = F(c.f.o[0], c.f.o[1], c.f.a, 0)
    up = 6.5
    v0 = round(max(c.suelo_en(up, -c.T / 2 - 0.5), c.suelo_en(up, c.T / 2 + 0.5)) + 0.1, 2)
    c.huecos.append({'u': up, 'a': 1.0, 'v0': v0, 'v1': v0 + 2.0, 'arco': 'medio', 'sin_dovelas': True})   # (en el talud de la cortina: los sillares de la jamba quedarían despegados)
    T2 = c.T / 2
    # rellano de fuera, macizo
    with con(m, 'mamp'): prisma(m, f, [(up - 1.2, T2), (up + 1.3, T2), (up + 1.3, T2 + 2.5), (up - 1.2, T2 + 2.5)], min(min(h(*f.p2(a_, b_)) for a_ in (up - 1.2, up + 1.3) for b_ in (T2, T2 + 2.5)) - 1.5, v0 - 1.0), v0, PIEDRA)
    suelo_losas(m, f, up - 1.2, up + 1.3, T2, T2 + 2.5, v0 + 0.01, LOSA, 0.5)
    # la puerta de la poterna, cerrada, y su matacán en el adarve
    puerta_tablas(m, f, up - 0.5, up + 0.5, v0, v0 + 2.0, -T2 - 0.07, -(math.pi - 0.06), 'medio', MADERA)   # (abierta hacia dentro, plegada contra la cara del patio)
    for k in range(3):
        u = up - 1.05 + k * 1.05
        caja(m, f, u - 0.16, u + 0.16, ADARVE - 1.2, ADARVE - 0.6, T2, T2 + 0.45, PIEDRA_CLARA, .85); caja(m, f, u - 0.16, u + 0.16, ADARVE - 0.6, ADARVE, T2, T2 + 0.8, PIEDRA_CLARA, .85)
    caja(m, f, up - 1.5, up + 1.5, ADARVE - 0.12, ADARVE, T2 - 0.65, T2 + 0.8, PIEDRA, .8)
    for k in range(2): caja(m, f, up - 0.75 + k * 1.05, up - 0.35 + k * 1.05, ADARVE - 0.13, ADARVE + 0.01, T2 + 0.12, T2 + 0.6, OSCURO, caras='v1')
    almenado(m, f, up - 1.5, up + 1.5, ADARVE, T2 + 0.25, T2 + 0.8, 1.0, 1.1, 1.4, 0.55, PIEDRA)
    # la escalera baja por la cara del acantilado: cada peldaño se asienta donde el terreno tiene su altura (va en diagonal)
    def w_de(u, y, w_min):
        w = w_min
        while w < 40 and h(*f.p2(u, w)) > y: w += 0.1
        return w
    def tramo(u0, sentido, v_alto, v_bajo, w_min):
        n = int(round((v_alto - v_bajo) / 0.2)); dv = (v_alto - v_bajo) / n; u = u0; pts = []
        for i in range(n):
            top = v_alto - i * dv
            w = max(w_min, w_de(u + sentido * 0.15, top - 0.15, w_min))
            ua, ub = (u, u + 0.3) if sentido > 0 else (u - 0.3, u)
            base = min(h(*f.p2(ua, w + 1.3)), h(*f.p2(ub, w + 1.3))) - 0.5
            with choques.callar():
                c_ = varia(PIEDRA, .07)
                with con(m, 'piedra'): caja(m, f, ua, ub, top - 0.2, top, w, w + 1.3, c_, .75, caras='v1u0u1')
                with con(m, 'mamp', base=min(base, top - 0.3)): caja(m, f, ua, ub, min(base, top - 0.3), top - 0.2, w, w + 1.3, esc(c_, 0.9), .75, caras='u0u1w0w1')
                with con(m, 'sillar'): caja(m, f, ua, ub, top - 0.2, top, w, w + 1.3, esc(c_, 0.9), .75, caras='w0w1')
            choques.solido_caja(f, ua, ub, w, w + 1.3, min(base, top - 0.3), top)
            pts.append((u, w, top)); CAMINO_POTERNA.append((*f.p2(u + sentido * 0.15, w + 0.65), top)); u += sentido * 0.29; w_min = w   # (no vuelve hacia la muralla: no se cruza con el tramo de arriba)
        # pretil del lado del mar: tramos inclinados que siguen la escalera
        for (ua, wa, ta), (ub, wb, tb) in zip(pts, pts[1:]):
            P_ = lambda uu, ww, yy: f(uu, yy, ww)
            for (y0_, y1_) in ((ta - 0.4, ta + 0.8),):
                pass
            with con(m, 'sillar'): m.quad(f(ua, ta - 0.3, wa + 1.3), f(ub, tb - 0.3, wb + 1.3), f(ub, tb + 0.8, wb + 1.3), f(ua, ta + 0.8, wa + 1.3), esc(PIEDRA, .9))
            with con(m, 'sillar'): m.quad(f(ua, ta - 0.3, wa + 1.55), f(ub, tb - 0.3, wb + 1.55), f(ub, tb + 0.8, wb + 1.55), f(ua, ta + 0.8, wa + 1.55), esc(PIEDRA, .8))
            choques._seg(f, ua, wa + 1.4, ub, wb + 1.4, min(ta, tb) - 0.3, max(ta, tb) + 0.8)
            m.quad(f(ua, ta + 0.8, wa + 1.25), f(ub, tb + 0.8, wb + 1.25), f(ub, tb + 0.8, wb + 1.6), f(ua, ta + 0.8, wa + 1.6), PIEDRA_CLARA)
        return u, pts
    u1_, p1 = tramo(up + 1.3, 1, v0, 7.0, T2 + 1.3)
    w_g = p1[-1][1]
    CAMINO_POTERNA.append((*f.p2(u1_ + 0.75, w_g + 0.6), 7.0)); CAMINO_POTERNA.append((*f.p2(u1_ + 0.75, w_g + 2.3), 7.0))   # (el rellano del giro)
    with con(m, 'mamp'): prisma(m, f, [(u1_, w_g - 0.6), (u1_ + 1.5, w_g - 0.6), (u1_ + 1.5, w_g + 3.2), (u1_, w_g + 3.2)], min(h(*f.p2(u1_ + 1.5, w_g + 3.2)), 7.0) - 1.0, 7.0, PIEDRA)
    u2_, p2 = tramo(u1_ - 0.0, -1, 7.0, 1.0, w_g + 1.7)
    w_f = p2[-1][1]
    u_fin = u2_
    # el muelle: rellano de piedra y pantalán de madera hacia el agua
    with con(m, 'mamp'): prisma(m, f, [(u_fin - 2.2, w_f - 0.3), (u_fin + 0.3, w_f - 0.3), (u_fin + 0.3, w_f + 3.0), (u_fin - 2.2, w_f + 3.0)], -1.5, 1.0, PIEDRA, tapa=False)
    suelo_losas(m, f, u_fin - 2.2, u_fin + 0.3, w_f - 0.3, w_f + 3.0, 1.0, LOSA)
    RELLANO_POTERNA[:] = [f.p2(up, -T2 - 1.5), f.p2(up, T2 + 1.2), f.p2(u_fin - 1.0, w_f + 1.5), f.p2(u_fin - 1.0, w_f + 9.0)]
    v_bajo = 1.0
    fm = F(*f.p2(u_fin - 1.0, w_f + 3.0), f.a + math.pi / 2, 0)    # u hacia el mar
    choques.suelo(fm, 0, 9.0, -0.9, 0.9, v_bajo)
    for k in range(int(9 / 0.3)):
        caja(m, fm, k * 0.3 + 0.01, k * 0.3 + 0.29, v_bajo - 0.12, v_bajo, -0.9, 0.9, varia(TABLA, .1), .75)
    for k in range(4):
        for s in (-1, 1): caja(m, fm, 1.5 + k * 2.4 - 0.12, 1.5 + k * 2.4 + 0.12, -2.5, v_bajo + (0.6 if k == 3 else -0.1), s * 0.85 - 0.12, s * 0.85 + 0.12, MADERA)
    # una barca amarrada
    fb = fm.sub(6.0, 2.2, 0.05, v_bajo - 1.0)
    with choques.callar(): barca(m, fb.sub(0, 0, 0.0, -0.25))   # (la quilla, bajo el agua)
    for (u_, w_) in ((0.9, -2.6), (0.9, 2.6)): pass
    # la amarra: de la proa al último poste del pantalán
    a_ = fb(2.3, 0.7, 0); b_ = fm(1.5 + 3 * 2.4, v_bajo + 0.45, 0.85)
    n_ = 10
    for k in range(n_):   # el cabo, combado
        t0, t1 = k / n_, (k + 1) / n_
        p0 = [a_[i] + (b_[i] - a_[i]) * t0 for i in range(3)]; p1 = [a_[i] + (b_[i] - a_[i]) * t1 for i in range(3)]
        p0[1] -= 0.35 * math.sin(math.pi * t0); p1[1] -= 0.35 * math.sin(math.pi * t1)
        m.quad(tuple(p0), tuple(p1), (p1[0], p1[1] + 0.035, p1[2]), (p0[0], p0[1] + 0.035, p0[2]), hexc('#8a7a5a'))
        m.quad(tuple(p0), tuple(p1), (p1[0] + 0.025, p1[1] + 0.018, p1[2] + 0.025), (p0[0] + 0.025, p0[1] + 0.018, p0[2] + 0.025), esc(hexc('#8a7a5a'), 0.8))

def _dentro_enc(p, pol, margen):
    if not dentro(p, pol): return False
    return all(dist_seg(p, a, b) > margen for a, b in zip(pol, pol[1:] + pol[:1]))

def suelos_patios(m, camino):
    """patio de armas de tierra apisonada con un camino empedrado de la puerta a la del alcázar; patio del alcázar empedrado.
       camino: lista de puntos del eje del camino"""
    TIERRA_P = hexc('#7a6b56'); CANTO = hexc('#8a8276'); HIERBA_P = hexc('#5b6338')
    paso = 0.5
    for pol, empedrado in ((EXTERIOR, False), (INTERIOR, True)):
        xs = [p[0] for p in pol]; zs = [p[1] for p in pol]
        x = min(xs)
        while x < max(xs):
            z = min(zs)
            while z < max(zs):
                c = (x + paso / 2, z + paso / 2)
                if _dentro_enc(c, pol, T_MURO / 2 - 0.05):
                    en_camino = False   # (el camino va encima, en cinta: cinta())
                    if empedrado or en_camino:
                        borde = min(dist_seg(c, a, b) for a, b in zip(pol, pol[1:] + pol[:1]))
                        col = mezcla(varia(CANTO, 0.03), hexc('#5b6338'), 0.35 if borde < 2.2 else 0.0)
                        with con(m, 'losa'): m.quad(*[(px, h(px, pz) + 0.06, pz) for px, pz in ((x, z), (x + paso, z), (x + paso, z + paso), (x, z + paso))], col)   # (el patio del alcázar, enlosado)
                    elif (int(x / paso) + int(z / paso)) % 2 == 0:
                        # tierra apisonada, en losetas de 1 m con matices; algo de hierba junto a los muros
                        borde = min(dist_seg(c, a, b) for a, b in zip(pol, pol[1:] + pol[:1]))
                        col = None
                        q = [(x, z), (x + 2 * paso, z), (x + 2 * paso, z + 2 * paso), (x, z + 2 * paso)] if False else [(x, z), (x + paso, z), (x + paso, z + paso), (x, z + paso)]
                        esq = ((x, z), (x + paso * 2, z), (x + paso * 2, z + paso * 2), (x, z + paso * 2))
                        cs = [mezcla(TIERRA_P, HIERBA_P, max(0.0, min(0.6, 0.5 * math.sin(px * 0.37 + pz * 0.23) + 0.3 * math.sin(px * 0.11 - pz * 0.19)))) for px, pz in esq]
                        with con(m, 'tierra'): m.quad(*[(px, h(px, pz) + 0.05, pz) for px, pz in esq], *cs)
                z += paso
            x += paso

def cinta(m, pts, ancho, mat, col, alto, borde=0.35, sem=0, paso=0.4, n_trav=6):
    """una franja que sigue la polilínea pts (en el mundo), pegada al terreno (a 'alto' sobre él), con los bordes
       irregulares (ruido de ±borde); para caminos (empedrado encima de una de tierra más ancha)"""
    # muestreo a lo largo
    S = [pts[0]]; L = 0.0; largos = [0.0]
    for p, q in zip(pts, pts[1:]):
        d = math.dist(p, q); n = max(1, int(d / paso))
        for k in range(1, n + 1):
            S.append((p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n)); L += d / n; largos.append(L)
    # normales (suavizadas en los codos)
    N = []
    for i in range(len(S)):
        a = S[max(0, i - 1)]; b = S[min(len(S) - 1, i + 1)]
        dx, dz = b[0] - a[0], b[1] - a[1]; l = math.hypot(dx, dz) or 1
        N.append((-dz / l, dx / l))
    ruido = lambda t, k: borde * (0.55 * math.sin(t * 0.9 + k * 1.7 + sem) + 0.3 * math.sin(t * 2.3 + k * 0.6 + sem * 2) + 0.2 * math.sin(t * 6.1 + k * 2.9 + sem * 3))
    # el borde se funde con lo de al lado: la tierra se vuelve verdosa hacia la hierba; el empedrado, terroso
    junto = hexc('#56603a') if mat == 'tierra' else hexc('#6a5a44')
    def tono(k):
        e = min(k, n_trav - k) / max(1, n_trav)
        f_ = 0.3 if e == 0 else (0.1 if e <= 1 / n_trav + 1e-9 else 0.0)
        return [col[i] * (1 - f_) + junto[i] * f_ for i in range(3)]
    with con(m, mat):
        for i in range(len(S) - 1):
            filas = []
            for j in (i, i + 1):
                wl = ancho / 2 + ruido(largos[j], 0); wr = ancho / 2 + ruido(largos[j], 5)
                fila = []
                for k in range(n_trav + 1):
                    t = -wl + (wl + wr) * k / n_trav
                    x, z = S[j][0] + N[j][0] * t, S[j][1] + N[j][1] * t
                    fila.append((x, h(x, z) + alto, z))
                filas.append(fila)
            for k in range(n_trav):
                ca, cb = tono(k), tono(k + 1)
                m.quad(filas[0][k], filas[1][k], filas[1][k + 1], filas[0][k + 1], ca, ca, cb, cb)

def camino_explanada(m, pts, ancho=3.6):
    """el camino de la explanada: empedrado en medio y tierra pisada a los lados"""
    cinta(m, pts, ancho, 'canto', hexc('#8a8276'), 0.07, 0.3, 2)
