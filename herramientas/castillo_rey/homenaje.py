# La torre del homenaje: sótano con el aljibe, sala de la entrada en alto, cámara del alcaide (con las puertas al adarve),
# cámara de la familia y terraza con garitas y matacanes. Escalera de fuera con el último tramo de madera.
from obra import *

KC, KL, KA = HOMENAJE
KT = 3.0
K0 = round(max(h(*p) for p in esquinas(KC, KL - 2 * KT, KA)) + 0.12, 2)   # suelo del sótano
K1 = K0 + 5.0          # la entrada
K2 = ADARVE            # cámara del alcaide, a la altura del adarve
K3 = K2 + 5.0
KTE = K3 + 5.0         # terraza
ARRANQUE = math.radians(245)   # el primer peldaño del caracol, de cara a la sala

def homenaje(m, puertas_adarve):
    """puertas_adarve: lista de (cara, u) donde llegan los adarves"""
    t = Torre('K', KC, KL, KA, KTE, KT)
    L = KL; T = KT
    balcones = []
    for (i, u) in puertas_adarve:
        un = min(max(u, T + 0.75), L - T - 0.75)
        t.puertas[i].append((un, K2, 1.1, 2.2))
        if abs(un - u) > 0.3: balcones.append((i, un, u))
    base = FOSO_FONDO - 0.5
    ci = t.cara_hacia(CEN_INT)          # la cara del patio del alcázar: la de la entrada
    # huecos por cara y planta
    for i in range(4):
        f = t.cara(i)
        hs = [{'u': u, 'a': a_, 'v0': v, 'v1': v + al, 'arco': 'medio', 'derrame': 0.3} for (u, v, a_, al) in t.puertas[i]]
        if i == ci:
            hs.append({'u': L * 0.485, 'a': 1.3, 'v0': K1, 'v1': K1 + 2.2, 'arco': 'medio'})                                   # la puerta en alto
            hs.append({'u': L * 0.3, 'a': 0.9, 'v0': K1 + 1.2, 'v1': K1 + 2.6, 'arco': 'medio', 'derrame': 1.2})                # ventana de la sala
            hs.append({'u': L * 0.45, 'a': 1.0, 'v0': K2 + 1.0, 'v1': K2 + 2.6, 'arco': 'apuntado', 'derrame': 1.4})            # ventana de la cámara, con poyos
            hs.append({'u': L * 0.5, 'a': 0.9, 'v0': K3 + 1.0, 'v1': K3 + 2.4, 'arco': 'medio', 'derrame': 1.2})
            hs.append(saetera(L * 0.3, K0 + 2.0, 0.6, 0.15, 0.3))
        else:
            for v in (K1 + 1.0, K3 + 1.0): hs.append(saetera(L * 0.5, v, 1.6, 0.13, 1.2))
            if not any(abs(u - L * 0.5) < 1.5 for (u, *_r) in t.puertas[i]): hs.append(saetera(L * 0.5, K2 + 1.0, 1.6, 0.13, 1.2))
            hs.append(saetera(L * 0.25, K0 + 2.5, 0.5, 0.15, 0.3))
        muro(m, f, 0, L, base, KTE, -T, 0, hs, 'silleria', PIEDRA, tapa=False, cabezas=False, suelo=FOSO_FONDO)
        esquinales(m, f, 0, L, base, KTE - 1.6, 0.0, i)
        m.quad(f(0, base, 1.2), f(L, base, 1.2), f(L, base + 3.5, 0), f(0, base + 3.5, 0), esc(PIEDRA_OSC, .85))   # alambor
        # cornisa y matacanes corridos en lo alto, con su parapeto almenado volado
        for k in range(int(L / 1.1)):
            u = 0.35 + k * 1.1
            caja(m, f, u - 0.17, u + 0.17, KTE - 1.6, KTE - 1.0, 0, 0.35, PIEDRA_CLARA, .85)
            caja(m, f, u - 0.17, u + 0.17, KTE - 1.0, KTE - 0.4, 0, 0.7, PIEDRA_CLARA, .85)
        caja(m, f, -0.7, L + 0.7, KTE - 0.4, KTE, 0, 0.75, PIEDRA, .8, caras='v0w1u0u1')
        for k in range(int(L / 1.1) - 1): caja(m, f, 0.75 + k * 1.1, 1.15 + k * 1.1, KTE - 0.41, KTE - 0.39, 0.12, 0.6, OSCURO, caras='v0')
        almenado(m, f, -0.7, L + 0.7, KTE, 0.2, 0.75, 1.0, 1.2, 1.9, 0.7, PIEDRA)
    fi = t.cara(ci)
    # balcones volados que llevan el adarve hasta la puerta cuando la cortina llega a la esquina
    for (i, un, u) in balcones:
        f = t.cara(i)
        a, b = min(un - 0.8, u - 1.4), max(un + 0.8, u + 1.4)
        a, b = max(a, -0.5), min(b, L + 0.5)
        suelo_losas(f.sub(0, 0), a, b, 0.0, 2.0, K2, LOSA, 0.6) if False else suelo_losas(m, f, a, b, 0.0, 2.0, K2, LOSA, 0.6)
        caja(m, f, a, b, K2 - 0.35, K2 - 0.02, 0.0, 2.0, PIEDRA, .8, caras='v0w1u0u1')
        k = a + 0.4
        while k < b - 0.2:
            caja(m, f, k - 0.15, k + 0.15, K2 - 1.2, K2 - 0.35, 0.0, 1.0 + 0.0, PIEDRA_CLARA, .85); caja(m, f, k - 0.15, k + 0.15, K2 - 0.75, K2 - 0.35, 1.0, 1.8, PIEDRA_CLARA, .85); k += 0.9
        muro(m, f, a, b, K2, K2 + 1.0, 1.65, 2.0, (), 'silleria', PIEDRA, tapa=True, cabezas=True, suelo=K2 + 50)
    # ---------------- suelos
    inner = (T, L - T, -L + T, -T)
    r_c = 1.0; cu, cw = L - T - r_c - 0.1, -T - r_c - 0.1           # el caracol, en la esquina de la cara del patio
    hueco_c = (cu - r_c - 0.1, cu + r_c + 0.1, cw - r_c - 0.1, cw + r_c + 0.1)
    trampa = (T + 0.6, T + 1.6, -L + T + 0.6, -L + T + 1.6)
    suelo_losas(m, fi, *inner, K0, LOSA, 0.6)
    suelo_tablas(m, fi, *inner, K1, TABLA, 0.3, 0.14, [trampa])   # (el caracol arranca en esta planta: aquí no hay hueco)
    suelo_tablas(m, fi, *inner, K2, TABLA, 0.3, 0.14, [hueco_c])
    suelo_tablas(m, fi, *inner, K3, TABLA, 0.3, 0.14, [hueco_c])
    suelo_losas(m, fi, 0.75, L - 0.75, -L + 0.75, -0.75, KTE, LOSA, 0.7)
    caja(m, fi, T, L - T, KTE - 0.6, KTE - 0.05, -L + T, -T, PIEDRA_OSC, .8, caras='v0')
    # caracol de la planta 1 a la terraza; escala de mano al sótano por la trampilla
    caracol(m, fi, cu, cw, r_c, K1, KTE, ARRANQUE, 1, PIEDRA)
    for s in (-1, 1): caja(m, fi, T + 1.1 + s * 0.25 - 0.04, T + 1.1 + s * 0.25 + 0.04, K0, K1 + 0.9, -L + T + 0.75, -L + T + 0.83, MADERA)
    v = K0 + 0.3
    while v < K1 + 0.8: caja(m, fi, T + 0.85, T + 1.35, v, v + 0.05, -L + T + 0.76, -L + T + 0.82, MADERA_CL); v += 0.32
    caja(m, fi, trampa[0], trampa[1], K1 + 0.0, K1 + 0.06, trampa[2] - 1.0, trampa[2], MADERA_CL)   # la trampilla, abierta contra el suelo
    # ---------------- sótano: aljibe, toneles, sacos, leña
    al = (T + 3.6, -L + T + 2.2)
    cilindro(m, fi, al[0], al[1], 1.3, K0 - 0.2, K0 + 0.7, PIEDRA, 12, False)
    prisma(m, fi, [(al[0] + 1.05 * math.cos(2 * math.pi * k / 12), al[1] + 1.05 * math.sin(2 * math.pi * k / 12)) for k in range(12)], K0 - 0.4, K0 + 0.3, AGUA)
    for k in range(4): tonel(m, F(*fi.p2(T + 0.6 + k * 0.75, -T - 0.6), fi.a, K0), 0, 0)
    for k in range(3): tonel(m, F(*fi.p2(T + 0.7, -T - 1.6 - k * 0.8), fi.a, K0), 0, 0, True, 0.32, 0.85, math.pi / 2)
    for k in range(6): saco(m, F(*fi.p2(L - T - 0.6 - (k % 3) * 0.55, -L + T + 0.6 + (k // 3) * 0.55), fi.a, K0), 0, 0)
    caja(m, fi, L - T - 2.6, L - T - 0.2, K0, K0 + 0.9, -L + T + 2.2, -L + T + 3.0, hexc('#6e4e34'), .8)
    # ---------------- planta 1: la sala de la torre
    f1 = F(*fi.p2(L / 2, -L / 2), fi.a, K1)
    chimenea(m, F(*fi.p2(T, -L / 2), fi.a - math.pi / 2, K1), 0, 1.8, 0, 2.6)
    mesa(m, f1, -1.0, -1.1, 2.4, 0.9, 0.76, 0); banco(m, f1, -1.0, -0.4, 2.2); banco(m, f1, -1.0, -1.8, 2.2)
    silla(m, f1, 0.6, -1.1, -math.pi / 2, True)    # el sitial del alcaide, a la cabecera
    arca(m, f1, -1.8, -2.4, 0); armero(m, F(*fi.p2(L / 2 + 0.5, -L + T), fi.a + math.pi, K1), 0, 0, 2.4)
    vajilla(m, f1, -1.0, -1.1, 0.76, 2.0)
    alfombra(m, f1, -1.0, -1.1, 3.6, 2.4, hexc('#6a3a2a'))
    candelabro(m, f1, 1.3, -2.3); candelabro(m, f1, -0.5, -2.6)
    tapiz(m, F(*fi.p2(L / 2, -L + T), fi.a + math.pi, K1), -1.8, 1.8, 1.0, 3.4, 0, TELA_AZUL)
    for (u_, w_) in ((T + 0.05, -T - 1.5), (L - T - 0.05, -L + T + 1.5)): antorcha(m, F(*fi.p2(u_, w_), fi.a + (-math.pi / 2 if u_ < L / 2 else math.pi / 2), 0), 0, K1 + 1.8, 0)
    # ---------------- planta 2: la cámara del alcaide (aquí se aloja el rey cuando viene)
    f2 = F(*fi.p2(L / 2, -L / 2), fi.a, K2)
    chimenea(m, F(*fi.p2(T, -L / 2), fi.a - math.pi / 2, K2), 0, 1.6, 0, 2.4)
    cama(m, f2, 0.8, -2.0, 0, 2.2, 1.5, TELA_ROJA, True)
    arca(m, f2, -1.0, -2.6, 0, 1.2, 0.6, 0.65); arca(m, f2, 2.6, -0.6, math.pi / 2, 1.0, 0.5, 0.6)
    mesa(m, f2, -0.6, 1.4, 1.4, 0.7); taburete(m, f2, -0.6, 0.75); silla(m, f2, -1.95, 1.4, 0.0)
    vajilla(m, f2, -0.6, 1.4, 0.76, 1.0)
    alfombra(m, f2, 0.8, -0.5, 2.0, 1.2, hexc('#4a5a6a'))
    candelabro(m, f2, -0.3, -2.6)
    tapiz(m, F(*fi.p2(L / 2, -L + T), fi.a + math.pi, 0), -1.8, 1.8, K2 + 1.0, K2 + 3.2, 0, TELA_ROJA)
    # la letrina: un nicho en el grueso del muro de fuera, con su asiento de madera
    fo = t.cara((ci + 2) % 4)
    caja(m, fo, L * 0.78 - 0.5, L * 0.78 + 0.5, K2, K2 + 2.2, -T - 0.02, -T + 1.3, OSCURO, 1.0, caras='w0')
    caja(m, fo, L * 0.78 - 0.55, L * 0.78 + 0.55, K2, K2 + 0.45, -T - 0.4, -T + 0.2, MADERA_CL, .8)
    for k in range(3): caja(m, fo, L * 0.78 - 0.35 + k * 0.0, L * 0.78 + 0.35, K2 - 1.0 + k * 0.33, K2 - 0.7 + k * 0.33, 0, 0.35 + k * 0.25, PIEDRA_CLARA, .85)
    # ---------------- planta 3: la cámara de la familia
    f3 = F(*fi.p2(L / 2, -L / 2), fi.a, K3)
    chimenea(m, F(*fi.p2(T, -L / 2), fi.a - math.pi / 2, K3), 0, 1.4, 0, 2.2)
    cama(m, f3, 0.8, -2.2, 0, 2.0, 1.3, TELA_AZUL); cama(m, f3, -1.6, 1.6, math.pi / 2, 1.8, 0.9, hexc('#5d6a3a'))
    alfombra(m, f3, 0.0, 0.0, 2.2, 1.4, hexc('#6a5a3a')); candelabro(m, f3, -1.6, -2.5)
    arca(m, f3, 1.6, 1.8, 0); estante(m, F(*fi.p2(L / 2 + 1.0, -L + T), fi.a + math.pi, K3), 0, 0, 1.6, 1.8)
    # ---------------- terraza: caseta del caracol, garitas en las esquinas, brasero de señales, el pendón
    import choques; choques.HUECO_PRISMA[0] = (cu - 1.35, cw)
    prisma(m, fi, [(cu - 1.35, cw - 1.35), (cu + 1.35, cw - 1.35), (cu + 1.35, cw + 1.35), (cu - 1.35, cw + 1.35)], KTE, KTE + 2.7, PIEDRA, tapa=False)
    tejado_dos_aguas(m, fi, cu - 1.45, cu + 1.45, cw - 1.45, cw + 1.45, KTE + 2.7, 0.85, 0.15)
    caja(m, fi, cu - 1.39, cu - 1.33, KTE, KTE + 2.1, cw - 0.45, cw + 0.45, OSCURO)
    for i in range(4):
        fc = t.cara(i)
        g = F(*fc.p2(0, 0), fc.a, 0)
        cilindro(m, g, 0.2, 0.2, 1.4, KTE - 3.2, KTE + 0.6, PIEDRA, 10, False, 1.4)
        for k in range(4): cilindro(m, g, 0.2, 0.2, 1.4 - k * 0.32, KTE - 3.2 - (k + 1) * 0.35, KTE - 3.2 - k * 0.35, PIEDRA_CLARA, 10, False, 1.4 - k * 0.32 + 0.0)
        n = 10
        for k in range(n):
            if k % 2: continue
            a1, a2 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
            prisma(m, g, [(0.2 + math.cos(a1) * 1.4, 0.2 + math.sin(a1) * 1.4), (0.2 + math.cos(a2) * 1.4, 0.2 + math.sin(a2) * 1.4),
                          (0.2 + math.cos(a2) * 1.0, 0.2 + math.sin(a2) * 1.0), (0.2 + math.cos(a1) * 1.0, 0.2 + math.sin(a1) * 1.0)], KTE + 0.6, KTE + 1.6, PIEDRA)
    fb = F(*fi.p2(L * 0.35, -L * 0.6), fi.a, KTE)
    cilindro(m, fb, 0, 0, 0.45, 0.6, 0.85, HIERRO, 8, False, 0.6); caja(m, fb, -0.05, 0.05, 0, 0.6, -0.05, 0.05, HIERRO); bola(m, *fb(0, 0.85, 0), 0.4, 0.15, CENIZA, 6, 2)
    fm = F(*fi.p2(L * 0.65, -L * 0.35), fi.a, KTE)
    caja(m, fm, -0.07, 0.07, 0, 7.5, -0.07, 0.07, MADERA)
    m.quad(fm(0.07, 7.3, 0), fm(2.4, 7.1, 0.1), fm(2.4, 5.9, 0.1), fm(0.07, 6.0, 0), TELA_ROJA)
    m.quad(fm(0.07, 6.65, 0.01), fm(2.4, 6.5, 0.11), fm(2.4, 6.3, 0.11), fm(0.07, 6.45, 0.01), hexc('#c9a64a'))
    # ---------------- la escalera de fuera: de piedra perpendicular a la cara del patio, y el último tramo de madera
    fd = F(*fi.p2(L * 0.485, 0), fi.a + math.pi / 2, 0)      # u hacia fuera de la cara (hacia el patio)
    g_pie = h(*fd.p2(9.5, 0))
    largo = (K1 - g_pie) / 0.2 * 0.29
    u_ini = 1.8 + largo
    # en fd, la escalera sube desde u_ini (suelo del patio) hasta u = 1.8 (el rellano), luego 1.8 m de madera hasta la puerta
    fe = F(*fd.p2(u_ini, 0), fd.a + math.pi, 0)
    escalera(m, fe, 0, largo, -0.8, 0.8, g_pie, K1 - 0.02, PIEDRA, True)
    for s in (-1, 1): muro(m, fe, 0, largo + 0.2, g_pie - 0.3, K1 + 0.05, s * 0.8 - (0.4 if s > 0 else 0), s * 0.8 + (0 if s > 0 else 0.4), (), 'silleria', PIEDRA, tapa=False, cabezas=True, suelo=g_pie) if False else None
    prisma(m, fe, [(largo - 0.05, -1.0), (largo + 0.4, -1.0), (largo + 0.4, 1.0), (largo - 0.05, 1.0)], g_pie, K1 - 0.02, PIEDRA)
    # pretil del lado de fuera de la escalera: muro inclinado y continuo con su albardilla
    pretil_inclinado(m, fe, 0.0, largo + 0.4, 0.8, 1.05, g_pie, K1, 0.9)
    # el tramo de madera (puentecillo que se retira)
    fw = F(*fd.p2(1.8, 0), fd.a + math.pi, K1)
    _tablas_puente(m, fw, 0, 1.8, -0.75, 0.75)
    for s in (-1, 1): caja(m, fw, 1.75, 1.85, -0.0, 1.0, s * 0.72 - 0.04, s * 0.72 + 0.04, MADERA)
    puerta_tablas(m, fi, L * 0.485 - 0.65, L * 0.485 + 0.65, K1, K1 + 2.2, -T + 0.6, 1.3, 'medio', MADERA_CL)
    return t, fi, (cu, cw), u_ini

def _tablas_puente(m, f, u0, u1, w0, w1):
    import choques; choques.suelo(f, u0, u1, w0, w1, 0.0)
    caja(m, f, u0, u1, -0.3, -0.12, w0 + 0.1, w0 + 0.25, MADERA); caja(m, f, u0, u1, -0.3, -0.12, w1 - 0.25, w1 - 0.1, MADERA)
    u = u0
    while u < u1 - 0.01:
        caja(m, f, u + 0.01, min(u1, u + 0.28) - 0.01, -0.12, 0.0, w0, w1, varia(TABLA, .1), .75); u += 0.28
