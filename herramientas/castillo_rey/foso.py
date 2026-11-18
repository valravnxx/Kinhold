# El foso seco: contraescarpa revestida de piedra con su albardilla, y los cierres de los extremos.
from obra import *
LINEA_FOSO = [G, P_PRINC, A, AB, B, C]
D_CTRA = T_MURO / 2 + FOSO_ANCHO       # la cara de la contraescarpa
G_CTRA = 1.2                            # su grueso (hacia el terreno)

def _normal_fuera(p, q):
    f, rev = marco_fuera(p, q, CEN)
    return f.ew                         # +w hacia fuera

def linea_desplazada(linea, d):
    segs = []
    for p, q in zip(linea, linea[1:]):
        n = _normal_fuera(p, q)
        segs.append(((p[0] + n[0] * d, p[1] + n[1] * d), (q[0] + n[0] * d, q[1] + n[1] * d)))
    pts = [segs[0][0]]
    for (a, b), (c, e) in zip(segs, segs[1:]):
        # intersección de las dos rectas
        d1 = (b[0] - a[0], b[1] - a[1]); d2 = (e[0] - c[0], e[1] - c[1])
        den = d1[0] * d2[1] - d1[1] * d2[0]
        if abs(den) < 1e-9: pts.append(b); continue
        t_ = ((c[0] - a[0]) * d2[1] - (c[1] - a[1]) * d2[0]) / den
        pts.append((a[0] + d1[0] * t_, a[1] + d1[1] * t_))
    pts.append(segs[-1][1])
    return pts

def en_barbacana(p):
    from puertas import GPF, BU, BW0, BW1
    o = GPF.o; du = (p[0] - o[0]) * GPF.eu[0] + (p[1] - o[1]) * GPF.eu[1]; dw = (p[0] - o[0]) * GPF.ew[0] + (p[1] - o[1]) * GPF.ew[1]
    return abs(du) < BU + 0.3 and BW0 - 1.0 < dw < BW1

def foso(m):
    pts = linea_desplazada(LINEA_FOSO, D_CTRA)
    for p, q in zip(pts, pts[1:]):
        L = math.dist(p, q); n = max(1, int(L / 3.0))
        top_seg = max(h(p[0] + (q[0] - p[0]) * k / 10, p[1] + (q[1] - p[1]) * k / 10) for k in range(11)) + 0.35
        for k in range(n):
            a = (p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n)
            b = (p[0] + (q[0] - p[0]) * (k + 1) / n, p[1] + (q[1] - p[1]) * (k + 1) / n)
            mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            if en_barbacana(mid) or mid[0] > 217650: continue
            top = top_seg
            if top < FOSO_FONDO + 1.0: continue
            f, uf = pared(m, a, b, CEN, FOSO_FONDO - 0.3, top, G_CTRA, (), 'mamposteria', None, tapa=False, cabezas=False, suelo=FOSO_FONDO, fuera=True)
            caja(m, f, -0.02, f.L + 0.02, top, top + 0.16, -0.12, 0.55, PIEDRA_CLARA, .85)       # albardilla
    # el fondo: tierra apisonada con una cuneta en medio y algo de hierba en los bordes (lo pone el terreno)
    # el cierre del extremo sur (junto a la torre G): un muro de cabeza de la cortina a la contraescarpa
    g0 = G; n = _normal_fuera(G, P_PRINC)
    a = (g0[0] + n[0] * (T_MURO / 2), g0[1] + n[1] * (T_MURO / 2)); b = pts[0]
    top = h(*b) + 0.3
    pared(m, a, b, (G[0] + 3 * (P_PRINC[0] - G[0]) / math.dist(G, P_PRINC), G[1] + 3 * (P_PRINC[1] - G[1]) / math.dist(G, P_PRINC)), FOSO_FONDO - 0.3, top, 1.6, (), 'mamposteria', None, tapa=True, cabezas=True, suelo=FOSO_FONDO, fuera=True)
    return pts
