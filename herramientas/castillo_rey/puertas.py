# Las puertas: la barbacana con su entrada en recodo, el puente (tramo fijo y levadizo), la puerta principal con su rastrillo
# y buhederas, y la puerta del alcázar en el muro de separación.
from obra import *

def marco_puerta(centro, a, b):
    f, _ = marco_fuera(a, b, CEN)
    return F(centro[0], centro[1], f.a, 0)

# ======================================================================================= LA PUERTA PRINCIPAL
GPF = marco_puerta(P_PRINC, A, G)        # u a lo largo de la muralla, +w hacia el foso
PF = round(h(*P_PRINC) + 0.12, 2)          # el suelo del paso
GU, GW0, GW1 = 7.8, -5.0, 4.8              # medio largo, cara de dentro, cara de fuera
PASO = 1.8                                 # medio ancho del paso
PISO1 = PF + 5.6
BUHEDERAS = (-0.2, -1.6, -3.0)
ARRANQUE_GUARDIA = math.radians(127)   # el primer peldaño del caracol de la guardia, de cara a su cuarto

def puerta_principal(m, sentido_norte):
    f = GPF; g0 = F(f.o[0], f.o[1], f.a, 0)
    base = FOSO_FONDO - 0.5
    sur = -sentido_norte   # el lado del portero/guardia
    # ---------------- cáscara: muro de fuera (al foso), de dentro (al patio) y costados
    arco_ext = {'u': 0, 'a': 3.4, 'v0': PF, 'v1': PF + 2.6, 'arco': 'apuntado'}
    hs_front = [arco_ext]
    for s in (-1, 1):
        hs_front += [saetera(s * 4.8, PF + 1.0, 1.6, 0.12, 1.0), saetera(s * 4.8, PISO1 + 1.2, 1.6, 0.12, 1.0)]
    hs_front += [saetera(-0.9, PISO1 + 1.5, 1.2, 0.1, 0.4), saetera(0.9, PISO1 + 1.5, 1.2, 0.1, 0.4)]     # pasos de las cadenas
    muro(m, g0, -GU, GU, base, ADARVE, GW1 - 1.6, GW1, hs_front, 'silleria', PIEDRA, tapa=False, cabezas=False, suelo=FOSO_FONDO)
    # talud del frente
    for (a_, b_) in ((-GU, -1.7), (1.7, GU)):
        m.quad(g0(a_, base, GW1 + 1.1), g0(b_, base, GW1 + 1.1), g0(b_, PF - 1.5, GW1), g0(a_, PF - 1.5, GW1), esc(PIEDRA_OSC, .85))
    arco_int = {'u': 0, 'a': 3.4, 'v0': PF, 'v1': PF + 2.6, 'arco': 'apuntado'}
    hs_back = [arco_int, {'u': -4.8, 'a': 1.0, 'v0': PF, 'v1': PF + 1.9, 'arco': 'medio'}, {'u': 4.8, 'a': 1.0, 'v0': PF, 'v1': PF + 1.9, 'arco': 'medio'},
               {'u': -4.8, 'a': 1.1, 'v0': PISO1 + 1.0, 'v1': PISO1 + 2.4, 'arco': 'medio', 'derrame': 0.6},
               {'u': 4.8, 'a': 1.1, 'v0': PISO1 + 1.0, 'v1': PISO1 + 2.4, 'arco': 'medio', 'derrame': 0.6},
               {'u': 0, 'a': 1.1, 'v0': PISO1 + 1.0, 'v1': PISO1 + 2.4, 'arco': 'medio', 'derrame': 0.6}]
    muro(m, g0, -GU, GU, min(h(*f.p2(0, GW0)), PF) - 1.0, ADARVE, GW0, GW0 + 1.3, hs_back, 'silleria', PIEDRA, tapa=False, cabezas=False, suelo=PF)
    # costados (u = ±GU): de la cara de dentro a la de fuera; el adarve llega a la terraza
    for s in (-1, 1):
        pared(m, f.p2(s * GU, GW0), f.p2(s * GU, GW1), f.p2(0, 0), base, ADARVE, 1.4,
              [saetera((GW1 - GW0) / 2 + 1.2, PISO1 + 1.2, 1.6, 0.12, 1.0)], suelo=FOSO_FONDO, cabezas=False)
    # ---------------- el paso: muros del paso (con mirillas) y bóveda
    for s in (-1, 1):
        lp = (GW1 - 1.6) - (GW0 + 1.3)
        # la puerta de cada cuarto, entre las hojas de los portones abiertos (que tapan lo de junto a cada portón)
        hs = [saetera(lp / 2 + 1.5, PF + 1.0, 1.1, 0.1, 0.5), {'u': -0.5 - (GW0 + 1.3), 'a': 0.95, 'v0': PF, 'v1': PF + 1.9, 'arco': 'medio'}]
        pared(m, f.p2(s * PASO, GW0 + 1.3), f.p2(s * PASO, GW1 - 1.6), f.p2(0, 0), PF - 0.5, PISO1, 1.0, hs, suelo=PF, fuera=True)
        # rozas del rastrillo en los muros del paso
        caja(m, g0, s * PASO - 0.08, s * PASO + 0.02 if s < 0 else s * PASO + 0.08, PF, PF + 5.0, GW1 - 1.95, GW1 - 1.75, OSCURO)
    # bóveda del paso (techo de sillería) con tres buhederas
    vb = PF + 5.2
    caja(m, g0, -PASO, PASO, vb, PISO1, GW0 + 1.3, GW1 - 1.6, PIEDRA, 0.8, caras='v0')
    for k, w in enumerate(BUHEDERAS):
        caja(m, g0, -0.25, 0.25, vb - 0.01, vb + 0.01, w - 0.25, w + 0.25, OSCURO)
    # el empedrado del paso, con la losa del puente levadizo junto a la puerta
    suelo_losas(m, g0, -PASO, PASO, GW0, GW1, PF, LOSA, 0.5)
    # el rastrillo, subido (asoma por la bóveda)
    rastrillo(m, g0, -PASO + 0.05, PASO - 0.05, PISO1 - 0.7, PISO1 + 2.0, GW1 - 1.85)   # (alzado: sube por la ranura a la cámara del torno; abajo asoman las puntas)
    # portones: de fuera abiertos hacia dentro; de dentro abiertos
    for s in (-1, 1):
        u0, u1 = (0, 1.7) if s > 0 else (-1.7, 0)
        puerta_tablas(m, g0, u0 if s < 0 else 1.7 * 0, (0 if s < 0 else 1.7), PF, PF + 2.6, GW1 - 2.3, 1.45 * s * -1, None, MADERA_CL, giro_u0=(s < 0)) if False else None
    _hojas(m, g0, GW1 - 2.3, PF, 1.7, 2.6, 1.35)
    _hojas(m, g0, GW0 + 1.5, PF, 1.7, 2.6, 1.35, hacia=-1)
    # ---------------- planta 1: cámara del rastrillo (centro), cuarto del teniente (lado sur), armas (lado norte)
    hc = (-PASO - 0.3, PASO + 0.3, GW1 - 2.2, GW1 - 1.5)   # la ranura del rastrillo en el suelo
    suelo_tablas(m, g0, -GU + 1.4, GU - 1.4, GW0 + 1.3, GW1 - 1.6, PISO1, TABLA, 0.3, 0.12, [hc] + [(-0.4, 0.4, w_ - 0.35, w_ + 0.35) for w_ in BUHEDERAS] + [
                                                                                         (sur * (GU - 2.45) - 1.15, sur * (GU - 2.45) + 1.15, GW0 + 2.35 - 1.15, GW0 + 2.35 + 1.15)])
    for w in BUHEDERAS: caja(m, g0, -0.4, 0.4, PISO1, PISO1 + 0.08, w - 0.4, w + 0.4, MADERA_CL)   # trampillas de las buhederas
    # tabiques de madera que cierran la cámara del rastrillo
    for s in (-1, 1):
        for (wa, wb) in ((GW0 + 1.3, -0.5), (0.5, GW1 - 1.6)): caja(m, g0, s * (PASO + 0.6) - 0.08, s * (PASO + 0.6) + 0.08, PISO1, PISO1 + 3.2, wa, wb, MADERA, 0.8)
        caja(m, g0, s * (PASO + 0.6) - 0.08, s * (PASO + 0.6) + 0.08, PISO1 + 2.1, PISO1 + 3.2, -0.5, 0.5, MADERA, 0.8)    # el dintel de su puerta
    # el torno del rastrillo
    tg = g0.sub(0, GW1 - 3.3, 0, PISO1)
    for s in (-1, 1): caja(m, tg, s * 1.3 - 0.12, s * 1.3 + 0.12, 0, 1.3, -0.3, 0.3, MADERA, .8)
    _rodillo(m, tg, -1.3, 1.3, 1.05, 0.28)
    for s in (-1, 1):   # las aspas del torno
        for k in range(4):
            a = k * math.pi / 2
            caja(m, tg, s * 1.45 - 0.04, s * 1.45 + 0.04, 1.05 + math.sin(a) * 0.0, 1.05 + 0.06, 0, 0.9, MADERA_CL) if k == 0 else None
        caja(m, tg, s * 1.45 - 0.04, s * 1.45 + 0.04, 0.4, 1.7, -0.05, 0.05, MADERA_CL)
        caja(m, tg, s * 1.45 - 0.04, s * 1.45 + 0.04, 1.0, 1.1, -0.65, 0.65, MADERA_CL)
    for s in (-0.9, 0.9):   # cadenas: del rastrillo y del puente al rodillo del torno
        a = g0(s, PISO1 + 0.05, GW1 - 1.85); b = g0(s, PISO1 + 1.05, GW1 - 3.3 + 0.28)
        m.quad(a, b, (b[0], b[1] + 0.05, b[2]), (a[0], a[1] + 0.05, a[2]), HIERRO)
        a = g0(s, PISO1 + 1.5, GW1 - 1.6); b = g0(s, PISO1 + 1.3, GW1 - 3.3 + 0.2)
        m.quad(a, b, (b[0], b[1] + 0.05, b[2]), (a[0], a[1] + 0.05, a[2]), HIERRO)
    # cuarto del teniente (lado sur)
    ft = F(*f.p2(sur * 4.9, 0), f.a, PISO1)
    chimenea(m, F(*f.p2(sur * (GU - 1.4), 0.5), f.a + (math.pi / 2 if sur > 0 else -math.pi / 2), PISO1), 0, 1.6, 0, 2.2)
    cama(m, ft, sur * -1.0, 2.2, 0, 2.0, 1.0, TELA_AZUL)   # (lejos del caracol, que está en la esquina de dentro)
    arca(m, ft, sur * -1.6, -2.4, 0); mesa(m, ft, sur * -0.4, 0.4, 1.4, 0.7); taburete(m, ft, sur * 0.1, -0.1); taburete(m, ft, sur * -1.3, 0.4)
    tapiz(m, F(*f.p2(sur * 4.9, GW0 + 1.3), f.a, 0), -1.0, 1.0, PISO1 + 1.0, PISO1 + 3.0, 0, TELA_ROJA)
    # cuarto de armas (lado norte)
    fa = F(*f.p2(-sur * 4.9, 0), f.a, PISO1)
    armero(m, F(*f.p2(-sur * 4.9, GW0 + 1.3), f.a, PISO1), 0, 0, 2.6)
    tonel(m, fa, -0.8, 2.2); tonel(m, fa, 0.0, 2.3); arca(m, fa, 0.8, 2.1, 0, 1.2, 0.6, 0.65)
    for k in range(5): caja(m, fa, -1.4 + k * 0.6, -1.25 + k * 0.6, 0, 0.9, 0.0, 0.15, MADERA_CL)   # virotes en haces
    # ---------------- planta baja: portero (norte) y guardia (sur, con el caracol)
    fp_ = F(*f.p2(-sur * 4.9, 0), f.a, PF)
    suelo_losas(m, g0, -GU + 1.4, -PASO - 1.0, GW0 + 1.3, GW1 - 1.6, PF, LOSA, 0.5) if sur > 0 else suelo_losas(m, g0, PASO + 1.0, GU - 1.4, GW0 + 1.3, GW1 - 1.6, PF, LOSA, 0.5)
    suelo_losas(m, g0, PASO + 1.0, GU - 1.4, GW0 + 1.3, GW1 - 1.6, PF, LOSA, 0.5) if sur > 0 else suelo_losas(m, g0, -GU + 1.4, -PASO - 1.0, GW0 + 1.3, GW1 - 1.6, PF, LOSA, 0.5)
    banco(m, fp_, sur * 1.2, -1.2, 1.6, math.pi / 2); taburete(m, fp_, 0.2 * sur, 0.2); arca(m, fp_, -sur * 1.0, 1.8, 0)
    chimenea(m, F(*f.p2(-sur * (GU - 1.4), -0.5), f.a + (-math.pi / 2 if sur > 0 else math.pi / 2), PF), 0, 1.3, 0, 2.0)
    fg = F(*f.p2(sur * 4.9, 0), f.a, PF)
    mesa(m, fg, sur * -0.3, 1.5, 1.6, 0.8); banco(m, fg, sur * -0.3, 0.8, 1.5); banco(m, fg, sur * -0.3, 2.2, 1.5)
    armero(m, F(*f.p2(sur * (GU - 1.4), 0.6), f.a + (math.pi / 2 if sur > 0 else -math.pi / 2), PF), 0, 0, 2.0)
    # el caracol de la guardia: de PF a la terraza (ADARVE), en la esquina de dentro
    cu = sur * (GU - 1.4 - 1.05); cw = GW0 + 1.3 + 1.05
    caracol(m, g0, cu, cw, 0.95, PF, ADARVE, ARRANQUE_GUARDIA, 1, PIEDRA)
    # ---------------- terraza a la altura del adarve, almenada; matacán sobre el arco
    suelo_losas(m, g0, -GU, GU, GW0, GW1, ADARVE, LOSA, 0.7)
    caja(m, g0, -GU + 1.4, GU - 1.4, PISO1 + 5.4, ADARVE - 0.1, GW0 + 1.3, GW1 - 1.6, PIEDRA_OSC, .8, caras='v0')
    gf = F(*f.p2(0, GW1), f.a, 0)
    almenado(m, g0, -GU, -2.4, ADARVE, GW1 - 0.6, GW1, 1.0, 1.1, 1.8, 0.7, PIEDRA)
    almenado(m, g0, 2.4, GU, ADARVE, GW1 - 0.6, GW1, 1.0, 1.1, 1.8, 0.7, PIEDRA)
    # matacán: parapeto volado sobre ménsulas encima del arco
    for k in range(5):
        u = -2.3 + k * 1.15
        for j, (w0_, w1_, v0_, v1_) in enumerate(((GW1, GW1 + 0.35, ADARVE - 1.6, ADARVE - 1.1), (GW1, GW1 + 0.7, ADARVE - 1.1, ADARVE - 0.6), (GW1, GW1 + 1.0, ADARVE - 0.6, ADARVE))):
            caja(m, g0, u - 0.18, u + 0.18, v0_, v1_, w0_, w1_, PIEDRA_CLARA, .85)
    caja(m, g0, -2.5, 2.5, ADARVE - 0.15, ADARVE, GW1, GW1 + 1.0, PIEDRA, .8, caras='v1v0w1u0u1')
    for k in range(4): caja(m, g0, -1.8 + k * 1.15, -1.3 + k * 1.15, ADARVE - 0.16, ADARVE + 0.01, GW1 + 0.15, GW1 + 0.75, OSCURO, caras='v1')   # las bocas del matacán
    almenado(m, g0, -2.5, 2.5, ADARVE, GW1 + 0.4, GW1 + 1.0, 1.0, 1.1, 1.65, 0.6, PIEDRA)
    for s in (-1, 1): almenado(m, F(*f.p2(s * 2.5, GW1), f.a + (math.pi / 2 if s > 0 else -math.pi / 2), 0), -1.0 if s > 0 else 0, 0 if s > 0 else 1.0, ADARVE, -0.6, 0, 1.0, 1.1, 2.0, 0.5, PIEDRA, False) if False else None
    # pretil hacia el patio (en la cara de dentro)
    muro(m, g0, -GU, GU, ADARVE, ADARVE + 0.9, GW0, GW0 + 0.45, (), 'silleria', PIEDRA, tapa=True, cabezas=False, suelo=ADARVE + 50)
    # caseta del caracol en la terraza
    import choques; choques.HUECO_PRISMA[0] = (cu, cw + 1.25)
    prisma(m, g0, [(cu - 1.25, cw - 1.25), (cu + 1.25, cw - 1.25), (cu + 1.25, cw + 1.25), (cu - 1.25, cw + 1.25)], ADARVE, ADARVE + 2.5, PIEDRA, tapa=False)
    tejado_dos_aguas(m, g0, cu - 1.35, cu + 1.35, cw - 1.35, cw + 1.35, ADARVE + 2.5, 0.8, 0.15)
    caja(m, g0, cu - 0.45, cu + 0.45, ADARVE, ADARVE + 2.0, cw + 1.25, cw + 1.29, OSCURO)
    # pasos al adarve por los costados: pretil cortado (el adarve de las cortinas llega a la terraza)
    return cu, cw

def _hojas(m, g, w, v0, ancho, alto, giro, hacia=1):
    """las dos hojas de un portón, abiertas contra los muros del paso"""
    for s in (-1, 1):
        piv = (s * PASO, w)
        a = giro * (1 if s < 0 else -1) * hacia
        n = 7
        for i in range(n):
            x0, x1 = ancho * i / n, ancho * (i + 1) / n
            P = lambda x, v, d: g(piv[0] - s * (x * math.cos(a)), v, piv[1] + d + x * math.sin(abs(a)) * (-hacia))
            c = varia(MADERA_CL, 0.08)
            top = alto + (0.6 * (1 - (abs(ancho - x1) / ancho) ** 2) if True else 0)
            m.quad(P(x0, v0, 0.05), P(x1, v0, 0.05), P(x1, v0 + top, 0.05), P(x0, v0 + top, 0.05), c)
            m.quad(P(x1, v0, -0.05), P(x0, v0, -0.05), P(x0, v0 + top, -0.05), P(x1, v0 + top, -0.05), esc(c, .8))
        for vv in (v0 + 0.4, v0 + 1.3, v0 + 2.2):
            m.quad(P(0.02, vv, 0.07), P(ancho - 0.1, vv, 0.07), P(ancho - 0.1, vv + 0.08, 0.07), P(0.02, vv + 0.08, 0.07), HIERRO)
        import choques; choques.seg_mundo(P(0, v0, 0), P(ancho, v0, 0), v0 + g.y0, v0 + alto + g.y0)   # (la hoja abierta para el paso y la cámara)

def _rodillo(m, g, u0, u1, v, r):
    n = 8
    for i in range(n):
        a1, a2 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        P = lambda u, a: g(u, v + math.sin(a) * r, math.cos(a) * r)
        m.quad(P(u0, a1), P(u1, a1), P(u1, a2), P(u0, a2), varia(MADERA_CL, .05))

# ======================================================================================= EL PUENTE
def puente(m):
    f = GPF; g0 = F(f.o[0], f.o[1], f.a, 0)
    w_ctra = T_MURO / 2 + FOSO_ANCHO       # la contraescarpa
    w_pila = GW1 + 3.6
    # tablero levadizo (bajado), de la puerta a la pila
    _tablero(m, g0, GW1, w_pila, PF, 1.8)
    for s in (-1, 1):   # cadenas: de la punta del tablero a los pasos sobre el arco
        a = g0(s * 0.9, PF + 0.1, w_pila - 0.2); b = g0(s * 0.9, PISO1 + 1.5, GW1 + 0.02)
        n = 14
        for k in range(n):
            t0, t1 = k / n, (k + 1) / n
            p0 = [a[i] + (b[i] - a[i]) * t0 for i in range(3)]; p1 = [a[i] + (b[i] - a[i]) * t1 for i in range(3)]
            p0[1] -= 0.25 * math.sin(math.pi * t0); p1[1] -= 0.25 * math.sin(math.pi * t1)
            m.quad(tuple(p0), tuple(p1), (p1[0] + 0.04, p1[1] + 0.04, p1[2]), (p0[0] + 0.04, p0[1] + 0.04, p0[2]), HIERRO)
    # la pila de piedra en el foso
    prisma(m, g0, [(-2.0, w_pila), (2.0, w_pila), (2.0, w_pila + 1.2), (-2.0, w_pila + 1.2)], FOSO_FONDO - 0.3, PF - 0.15, PIEDRA)
    _piedras_prisma(m, g0, -2.0, 2.0, w_pila, w_pila + 1.2, FOSO_FONDO - 0.3, PF - 0.15)
    # tramo fijo de la pila a la contraescarpa, con su barandilla
    _tablero(m, g0, w_pila, w_ctra + 0.3, PF, 1.8, fijo=True)
    for s in (-1, 1):
        for w in (w_pila + 0.1, (w_pila + w_ctra) / 2, w_ctra + 0.2): caja(m, g0, s * 1.75 - 0.06, s * 1.75 + 0.06, PF, PF + 1.0, w - 0.06, w + 0.06, MADERA)
        caja(m, g0, s * 1.75 - 0.05, s * 1.75 + 0.05, PF + 0.95, PF + 1.05, w_pila, w_ctra + 0.3, MADERA_CL)
    # tornapuntas bajo el tramo fijo
    for s in (-1, 1): caja(m, g0, s * 1.5 - 0.1, s * 1.5 + 0.1, FOSO_FONDO, PF - 0.25, w_pila + 1.6, w_pila + 1.8, MADERA)

def _tablero(m, g, w0, w1, v, med, fijo=False):
    import choques; choques.suelo(g, -med, med, min(w0, w1), max(w0, w1), v - 0.02)
    caja(m, g, -med, med, v - 0.35, v - 0.15, w0, w1, MADERA, .7)
    w = w0
    while w < w1 - 0.01:
        wb = min(w1, w + 0.3); caja(m, g, -med, med, v - 0.15, v - 0.02, w + 0.01, wb - 0.01, varia(TABLA, .1), .75); w = wb
    for s in (-1, 1): caja(m, g, s * med - 0.15, s * med + 0.15 * (1 if s > 0 else 0) - (0 if s > 0 else -0.15) * 0, v - 0.6, v - 0.15, w0, w1, MADERA, .7) if fijo else None

def _piedras_prisma(m, g, u0, u1, w0, w1, v0, v1):
    for (a, b, w, s, dirf) in ((u0, u1, w1, 1, 0), (u1, u0, w0, -1, 0)):
        pass

# ======================================================================================= LA BARBACANA
BW0 = T_MURO / 2 + FOSO_ANCHO          # su muro de levante, sobre la contraescarpa
BW1 = BW0 + 15.0                        # su muro de poniente
BU = 9.0
def barbacana(m, sentido_norte):
    """sentido_norte: +1 si +u apunta al norte (hacia A). La entrada, en recodo, en el muro norte."""
    f = GPF; g0 = F(f.o[0], f.o[1], f.a, 0)
    s_n = sentido_norte
    sbb = [f.p2(u, w) for u in (-BU, 0, BU) for w in (BW0, (BW0 + BW1) / 2, BW1)]
    gb = min(h(*p) for p in sbb)
    top = PF + 6.5
    T = 1.6
    # muro de levante (con la puerta del puente), de poniente, sur y norte (con la puerta de la entrada)
    muro(m, g0, -BU, BU, FOSO_FONDO - 0.5, top, BW0, BW0 + T, [{'u': 0, 'a': 3.2, 'v0': PF, 'v1': PF + 2.5, 'arco': 'apuntado'}], 'silleria', PIEDRA, tapa=False, cabezas=False, suelo=FOSO_FONDO)
    almenado(m, F(f.o[0], f.o[1], f.a + math.pi, 0).sub(0, 0) if False else g0, -BU, BU, top, BW0, BW0 + 0.6, 0.9, 1.0, 1.9, 0.7, PIEDRA) if False else None
    muro(m, g0, -BU, BU, top, top + 0.9, BW0, BW0 + 0.45, (), 'silleria', PIEDRA, tapa=True, cabezas=False, suelo=top + 50)   # pretil hacia el foso (lado del castillo)
    suelo_losas(m, g0, -1.6, 1.6, BW0 - 0.05, BW0 + T + 0.05, PF - 0.02, LOSA, 0.5)   # el suelo del arco del puente
    muro(m, g0, -BU, BU, gb - 1.0, top, BW1 - T, BW1, [saetera(-4.5, PF + 1.0, 1.5), saetera(0, PF + 1.0, 1.5), saetera(4.5, PF + 1.0, 1.5)], 'silleria', PIEDRA, tapa=False, cabezas=False, suelo=gb)
    almenado(m, g0, -BU, BU, top, BW1 - 0.6, BW1, 1.0, 1.1, 1.9, 0.7, PIEDRA)
    marcos = {}
    for s in (-1, 1):
        hs = [{'u': BW1 - 4.5 - BW0, 'a': 3.0, 'v0': PF, 'v1': PF + 2.4, 'arco': 'apuntado'}] if s == s_n else [saetera((BW1 - BW0) / 2, PF + 1.0, 1.5)]
        fs, uf = pared(m, f.p2(s * BU, BW0), f.p2(s * BU, BW1), f.p2(0, (BW0 + BW1) / 2), gb - 1.0, top, T, hs, suelo=gb, cabezas=False)
        marcos[s] = (fs, uf)
        almenado(m, fs, 0, fs.L, top, -0.6, 0, 1.0, 1.1, 1.9, 0.7, PIEDRA)
        suelo_losas(m, fs, 0, fs.L, -T, -0.6, top, LOSA, 0.6)
    suelo_losas(m, g0, -BU, BU, BW1 - T, BW1 - 0.6, top, LOSA, 0.6)
    suelo_losas(m, g0, -BU, BU, BW0 + 0.45, BW0 + T, top, LOSA, 0.6)
    # torrecillas en las esquinas de poniente
    for s in (-1, 1):
        c = f.p2(s * BU, BW1)
        t = Torre('bb', c, 4.0, f.a, top + 2.5, 1.0)
        for i in range(4):
            fc = t.cara(i)
            muro(m, fc, 0, 4.0, gb - 1.0, top + 2.5, -1.0, 0, [saetera(2.0, PF + 3.5, 1.4)], 'silleria', PIEDRA, tapa=False, cabezas=False, suelo=gb)
            almenado(m, fc, 0, 4.0, top + 2.5, -0.55, 0, 0.9, 1.0, 1.4, 0.6, PIEDRA)
        suelo_losas(m, t.cara(0), 1.0, 3.0, -3.0, -1.0, top + 2.5, LOSA, 0.5)
    # la torre de la entrada: rastrillo y matacán sobre el arco de la entrada
    fs, uf = marcos[s_n]
    uu = uf(BW1 - 4.5 - BW0)
    for k in range(4):
        u = uu - 1.6 + k * 1.05
        caja(m, fs, u - 0.16, u + 0.16, top - 1.2, top - 0.6, 0, 0.45, PIEDRA_CLARA, .85); caja(m, fs, u - 0.16, u + 0.16, top - 0.6, top, 0, 0.8, PIEDRA_CLARA, .85)
    caja(m, fs, uu - 2.0, uu + 2.0, top - 0.12, top, 0, 0.8, PIEDRA, .8)
    for k in range(3): caja(m, fs, uu - 1.25 + k * 1.05, uu - 0.85 + k * 1.05, top - 0.13, top + 0.01, 0.12, 0.6, OSCURO, caras='v1')
    almenado(m, fs, uu - 2.0, uu + 2.0, top, 0.25, 0.8, 1.0, 1.1, 1.3, 0.55, PIEDRA)
    caja(m, fs, uu - 1.6, uu + 1.6, PF + 2.5, top - 0.05, -T + 0.1, -0.1, PIEDRA_OSC, .8, caras='v0')
    rastrillo(m, fs, uu - 1.45, uu + 1.45, PF + 2.0, PF + 3.0, -0.75)
    _hojas_simples(m, fs, uu, -T + 0.15, PF, 1.45, 2.4)
    # el patio de la barbacana: empedrado; escaleras al adarve
    suelo_losas(m, g0, -BU + T, BU - T, BW0 + T, BW1 - T, gb + 0.02, hexc('#8d826c'), 0.55)
    escalera(m, F(*f.p2(-s_n * (BU - T), BW1 - T - 0.8), f.a + math.pi / 2 * (1 if s_n > 0 else -1), 0), 0, 6.5, 0, 1.3, gb, top) if False else None
    _escalera_a_muro(m, g0, s_n, gb, top, T)
    # el puente fijo se apoya aquí; un banco y un tonel para la guardia de la barbacana
    banco(m, F(*f.p2(s_n * 5, BW1 - T - 0.5), f.a, gb), 0, 0, 1.6)
    tonel(m, F(*f.p2(-s_n * 6.5, BW0 + T + 0.6), f.a, gb), 0, 0)
    return gb, top

def _hojas_simples(m, g, uc, w, v0, ancho, alto):
    for s in (-1, 1):
        a = s * 1.3
        for i in range(6):
            x0, x1 = ancho * i / 6, ancho * (i + 1) / 6
            P = lambda x, v: g(uc + s * ancho - s * x * math.cos(1.3), v, w - x * math.sin(1.3))
            c = varia(MADERA_CL, .08)
            m.quad(P(x0, v0), P(x1, v0), P(x1, v0 + alto), P(x0, v0 + alto), c)
        import choques; choques.seg_mundo(P(0, v0), P(ancho, v0), v0 + g.y0, v0 + alto + g.y0)   # (la hoja abierta)

def _escalera_a_muro(m, g0, s_n, gb, top, T):
    """escalera de piedra pegada al muro de poniente de la barbacana, de sur a norte"""
    largo = (top - gb) / 0.2 * 0.29
    fe = F(*g0.p2(-s_n * (BU - T - 0.3), BW1 - T), g0.a + (0 if s_n > 0 else math.pi), 0)
    # en fe, u va hacia el norte (hacia la entrada), w hacia el muro de poniente?: escalera de w -1.3 a 0
    fe = F(*g0.p2(-s_n * (BU - T - 0.3), BW1 - T - 0.05), g0.a + (0 if s_n > 0 else math.pi), 0)
    wr = (-1.3, 0) if s_n < 0 else (0, 1.3)
    if s_n > 0: fe = F(*g0.p2(-s_n * (BU - T - 0.3), BW1 - T - 1.35), g0.a, 0)
    L_ = min(largo, 2 * BU - 2 * T - 1.0)
    escalera(m, fe, 0, L_, wr[0], wr[1], gb, top, PIEDRA, True)
    for k in range(int(L_ / (L_ / ((top - gb) / 0.2)))):
        pass

# ======================================================================================= LA PUERTA DEL ALCÁZAR (en el muro de separación)
def puerta_alcazar(m):
    f, _ = marco_fuera(B, Fp, CEN_INT)       # +w hacia el patio de armas (de donde vendría el enemigo)
    g0 = F(P_ALC[0], P_ALC[1], f.a, 0)
    pf = round(max(h(*g0.p2(0, -4)), h(*g0.p2(0, 4))) + 0.12, 2)
    L2, W2 = 3.5, 4.0
    p1 = pf + 5.0
    base = min(h(*g0.p2(u, w)) for u in (-L2, L2) for w in (-W2, W2)) - 1.0
    for (w0, w1, sgn) in ((W2 - 1.4, W2, 1), (-W2, -W2 + 1.2, -1)):
        hs = [{'u': 0, 'a': 3.0, 'v0': pf, 'v1': pf + 2.4, 'arco': 'apuntado'}, {'u': 0, 'a': 1.0, 'v0': p1 + 1.0, 'v1': p1 + 2.3, 'arco': 'medio', 'derrame': 0.5}] if sgn < 0 else \
             [{'u': 0, 'a': 3.0, 'v0': pf, 'v1': pf + 2.4, 'arco': 'apuntado'}, saetera(-2.2, p1 + 1.0, 1.5), saetera(2.2, p1 + 1.0, 1.5)]
        muro(m, g0, -L2, L2, base, ADARVE, w0, w1, hs, 'silleria', PIEDRA, tapa=False, cabezas=False, suelo=pf)
    for s in (-1, 1):
        pared(m, g0.p2(s * L2, -W2), g0.p2(s * L2, W2), g0.p2(0, 0), base, ADARVE, 1.2, (), suelo=pf, cabezas=False)
    suelo_losas(m, g0, -L2, L2, -W2, W2, pf, LOSA, 0.5)
    caja(m, g0, -1.5, 1.5, pf + 4.6, p1, -W2 + 1.2, W2 - 1.4, PIEDRA, .8, caras='v0')
    rastrillo(m, g0, -1.45, 1.45, p1 - 0.6, p1 + 1.6, W2 - 1.8)   # (alzado, en la planta de arriba)
    for s in (-1, 1): caja(m, g0, s * 1.5 - (0.06 if s > 0 else 0), s * 1.5 + (0 if s > 0 else 0.06), pf, pf + 4.6, W2 - 1.95, W2 - 1.65, OSCURO)
    _hojas_simples(m, g0, 0, -W2 + 1.4, pf, 1.45, 2.4)
    # planta alta: torno, banco; terraza
    suelo_tablas(m, g0, -L2 + 1.2, L2 - 1.2, -W2 + 1.2, W2 - 1.4, p1, TABLA, 0.3, 0.12, [(-1.6, 1.6, W2 - 2.1, W2 - 1.5)])
    tg = g0.sub(0, W2 - 2.7, 0, p1)
    for s in (-1, 1): caja(m, tg, s * 1.2 - 0.1, s * 1.2 + 0.1, 0, 1.2, -0.25, 0.25, MADERA, .8)
    _rodillo(m, tg, -1.2, 1.2, 1.0, 0.25)
    banco(m, g0.sub(0, -W2 + 1.6, 0, p1), 0, 0, 1.8)
    # una escalera de mano de la planta alta a la terraza, por una trampilla
    _escala(m, g0.sub(-1.6, -W2 + 1.6, 0, p1), ADARVE - p1)
    suelo_losas(m, g0, -L2, L2, -W2, W2, ADARVE, LOSA, 0.7)
    almenado(m, g0, -L2, L2, ADARVE, W2 - 0.6, W2, 1.0, 1.1, 1.75, 0.7, PIEDRA)
    caja(m, g0, -L2 + 1.2, L2 - 1.2, p1 + 5.0, ADARVE - 0.1, -W2 + 1.2, W2 - 1.4, PIEDRA_OSC, .8, caras='v0') if p1 + 5.0 < ADARVE - 0.1 else None
    caja(m, g0, -2.1, -1.1, ADARVE, ADARVE + 0.06, -W2 + 1.3, -W2 + 2.1, MADERA_CL)
    # la planta baja del alcázar no tiene cuartos: el caracol está en el homenaje. El acceso a la planta alta: desde el adarve del muro de separación
    return pf, p1

def _escala(m, g, alto):
    for s in (-1, 1): caja(m, g, s * 0.25 - 0.04, s * 0.25 + 0.04, 0, alto, 0, 0.08, MADERA)
    v = 0.3
    while v < alto: caja(m, g, -0.25, 0.25, v, v + 0.05, 0.01, 0.07, MADERA_CL); v += 0.32
