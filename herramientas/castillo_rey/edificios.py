# Los edificios de los patios, adosados a la muralla, con su interior y sus muebles.
# Cada uno en un marco «dentro» de su cortina: u a lo largo (0..largo), w desde la cara de dentro de la muralla (0) hacia el patio.
from obra import *

class Adosado:
    def __init__(self, cortina, u_centro, largo, fondo, pisos, alto_piso=3.0, grueso=0.75):
        self.c = cortina; self.L = largo; self.Fd = fondo; self.n = pisos; self.hp = alto_piso; self.T = grueso
        u_ini = u_centro + largo / 2            # en la cortina; el marco de dentro va al revés
        self.u_ini = u_ini
        self.f = cortina.marco_dentro(u_ini)
        pts = [self.f.p2(u, w) for u in (0, largo / 2, largo) for w in (0.2, fondo / 2, fondo)]
        self.suelo = round(max(h(*p) for p in pts) + 0.15, 2)
        self.base = min(h(*p) for p in pts) - 0.8
        self.pisos = [self.suelo + k * alto_piso for k in range(pisos)]
        self.alto = self.suelo + pisos * alto_piso
    def u_cortina(self, u): return self.u_ini - u
    def P(self, u, w): return self.f.p2(u, w)
    def marco(self, u, w, ang=0.0, piso=0): return F(*self.f.p2(u, w), self.f.a + ang, self.pisos[piso] if piso < len(self.pisos) else self.alto)

def construir_adosado(m, e, frente=(), costado0=(), costado1=(), tejado_col=TEJA, paja=False, muro_tipo='mamposteria', suelos=None, huecos_tablas=()):
    """frente/costados: listas de huecos en coordenadas (u, v absoluta); suelos: tipo por piso ('losas', 'tablas', 'tierra')"""
    f = e.f; L, Fd, T = e.L, e.Fd, e.T
    g = F(f.o[0], f.o[1], f.a, 0)
    # el frente (cara al patio): de w = Fd - T a Fd
    muro(m, g, 0, L, e.base, e.alto, Fd - T, Fd, list(frente), muro_tipo, None, tapa=True, cabezas=False, suelo=e.suelo - 0.15)
    # costados: marco con u desde la muralla hacia el patio, +w hacia fuera
    for (u_c, hs) in ((0, costado0), (L, costado1)):
        pared(m, g.p2(u_c, 0), g.p2(u_c, Fd), g.p2(L / 2, Fd / 2), e.base, e.alto, T, list(hs), muro_tipo, None, tapa=True, cabezas=True, suelo=e.suelo - 0.15)
        # el piñón del tejado de una agua (triángulo de muro bajo el faldón)
    v_alto = e.alto + Fd * 0.42; v_bajo = e.alto
    for (u_c, s) in ((0, -1), (L, 1)):
        A_, B_, C_ = g(u_c + s * -0.0, e.alto, 0), g(u_c, e.alto, Fd), g(u_c, v_alto, 0)
        uo = u_c + (-T if s > 0 else 0); ui = u_c + (0 if s > 0 else T)
        prisma(m, g, [(uo, 0), (ui, 0), (ui, Fd)], e.alto, e.alto + 0.001, MAMPOST, tapa=False) if False else None
        for (uu, sg) in ((uo, 1), (ui, -1)):
            P1, P2, P3 = g(uu, e.alto, 0), g(uu, e.alto, Fd), g(uu, v_alto, 0)
            if (s > 0) == (sg > 0): m.tri(P1, P2, P3, esc(MAMPOST, .85))
            else: m.tri(P2, P1, P3, esc(MAMPOST, .85))
        m.quad(g(uo, e.alto, Fd), g(ui, e.alto, Fd), g(ui, v_alto, 0), g(uo, v_alto, 0), esc(MAMPOST, .9))
    tejado_una_agua(m, g, -0.25, L + 0.25, 0.0, Fd, v_alto, v_bajo, 0.5, tejado_col, paja, piñones=False)
    # suelos
    suelos = suelos or ['tierra'] + ['tablas'] * (e.n - 1)
    for k, tipo in enumerate(suelos):
        v = e.pisos[k]
        if tipo == 'losas': suelo_losas(m, g, T, L - T, 0.05, Fd - T, v, LOSA, 0.55)
        elif tipo == 'tierra':
            import choques; choques.suelo(g, T, L - T, 0.05, Fd - T, v - 0.02)
            m.quad(g(T, v - 0.02, 0.05), g(T, v - 0.02, Fd - T), g(L - T, v - 0.02, Fd - T), g(L - T, v - 0.02, 0.05), varia(TIERRA, .05))
        elif tipo == 'tablas': suelo_tablas(m, g, T, L - T, 0.05, Fd - T, v, TABLA, 0.3, 0.14, list(huecos_tablas[k]) if k < len(huecos_tablas) else [])
    # vigas del techo bajo el tejado
    u = T + 0.6
    while u < L - T:
        caja(m, g, u, u + 0.2, e.alto - 0.25, e.alto, 0.0, Fd - T, MADERA, .7); u += 1.5
    return g

def hueco_p(u, v0, alto, ancho, arco=None, derrame=0.5):
    return {'u': u, 'a': ancho, 'v0': v0, 'v1': v0 + alto, 'arco': arco, 'derrame': derrame}

# ======================================================================================= CUADRAS Y PAJAR
def cuadras(m, e):
    L, Fd = e.L, e.Fd; s0, s1 = e.pisos[0], e.pisos[1]
    frente = [hueco_p(3.6, s0, 2.4, 1.8, 'escarzano', 0), hueco_p(10.4, s0, 2.4, 1.8, 'escarzano', 0), hueco_p(7.0, s0 + 1.3, 0.8, 0.7, None),
              hueco_p(14.2, s0, 2.0, 1.0, 'medio'), hueco_p(7.0, s1 + 0.1, 1.9, 1.6, None, 0), hueco_p(3.0, s1 + 1.0, 0.7, 0.6), hueco_p(12.0, s1 + 1.0, 0.7, 0.6)]
    g = construir_adosado(m, e, frente, (), (), TEJA, False, 'mamposteria', ['tierra', 'tablas'], [[], [(13.0, 15.2, 0.3, 3.4)]])
    # siete plazas: pesebres contra la muralla, mamparas entre caballos, la reguera
    for k in range(8):
        u = 0.8 + 1.75 * k
        if k < 7: pesebre(m, g, u + 0.05, u + 1.7, 0.1, s0)
        caja(m, g, u - 0.05, u + 0.05, s0, s0 + 1.4, 0.1, 2.9, MADERA, .75)
        caja(m, g, u - 0.07, u + 0.07, s0, s0 + 1.9, 2.8, 2.95, MADERA, .75)
    caja(m, g, 0.8, 13.0, s0 - 0.01, s0 + 0.0, 3.6, 3.85, BARRO)
    # el tabique de la guarnicionería y su escalera al pajar
    caja(m, g, 13.0, 13.12, s0, s1, 0.05, 2.8, MADERA, .8)
    sillas = g.sub(14.6, 0.4, 0, s0)
    for k in range(3):
        caja(m, sillas, -0.9 + k * 0.6, -0.5 + k * 0.6, 1.2, 1.25, 0.0, 0.4, MADERA)
        caja(m, sillas, -0.95 + k * 0.6, -0.45 + k * 0.6, 1.25, 1.45, 0.05, 0.4, hexc('#5a3a26'), .8)
    escalera(m, F(*g.p2(13.4, 3.6), g.a - math.pi / 2, 0), 0, 3.0, -0.7, 0.0, s0, s1, MADERA_CL, False, 0.29, True) if False else None
    _escala_inclinada(m, g, 14.2, 0.6, 14.2, 3.2, s0, s1)
    # pajar: heno, paja, trampillas sobre cada pesebre, jergones de los mozos
    for k in range(7): caja(m, g, 1.2 + 1.75 * k, 2.0 + 1.75 * k, s1 + 0.0, s1 + 0.05, 0.3, 0.9, MADERA_CL)
    for k in range(5): heno(m, g.sub(0, 0, 0, s1), 2.0 + k * 2.4, 2.2 + (k % 2) * 0.8, 1.1)
    jergon(m, F(*g.p2(14.3, 4.2), g.a, s1), 0, 0, math.pi / 2); jergon(m, F(*g.p2(13.3, 4.4), g.a, s1), 0, 0, math.pi / 2)
    # la viga de la polea sobre la puerta de carga, por fuera
    caja(m, g, 6.9, 7.1, s1 + 2.2, s1 + 2.4, Fd - 0.2, Fd + 1.2, MADERA)
    caja(m, g, 6.97, 7.03, s1 + 0.6, s1 + 2.2, Fd + 1.0, Fd + 1.06, hexc('#8a7a5a'))
    return g

def _escala_inclinada(m, g, u0, w0, u1, w1, v0, v1):
    """escalera de mano, apoyada"""
    n = int((v1 - v0) / 0.3)
    for s in (-0.25, 0.25):
        a = g(u0 + s, v0, w0); b = g(u1 + s, v1 + 0.6, w1)
        m.quad(a, b, (b[0], b[1], b[2] + 0.06), (a[0], a[1], a[2] + 0.06), MADERA)
        m.quad((a[0] + 0.05, a[1], a[2]), (b[0] + 0.05, b[1], b[2]), b, a, MADERA)
    for k in range(1, n + 1):
        t = k / (n + 1); w = w0 + (w1 - w0) * t; v = v0 + (v1 + 0.6 - v0) * t
        caja(m, g, u0 - 0.25, u0 + 0.25, v, v + 0.05, w, w + 0.05, MADERA_CL)

# ======================================================================================= CUERPO DE GUARDIA
def guardia(m, e):
    L, Fd = e.L, e.Fd; s0, s1 = e.pisos
    frente = [hueco_p(8.4, s0, 2.1, 1.1, 'medio'), hueco_p(2.6, s0 + 1.2, 1.0, 0.7), hueco_p(5.4, s0 + 1.2, 1.0, 0.7),
              hueco_p(3.2, s1 + 1.0, 1.1, 0.75, 'medio'), hueco_p(6.4, s1 + 1.0, 1.1, 0.75, 'medio')]
    g = construir_adosado(m, e, frente, (), (), TEJA, False, 'mamposteria', ['losas', 'tablas'], [[], [(7.2, 10.2, 0.2, 1.6)]])
    # armería abajo
    armero(m, F(*g.p2(3.6, 0.05), g.a, s0), 0, 0, 4.4)
    for k in range(2): arca(m, g.sub(1.8 + k * 1.4, 3.6, 0, s0), 0, 0, 0, 1.1, 0.55, 0.6)
    mesa(m, g.sub(4.6, 2.7, 0, s0), 0, 0, 1.8, 0.8)
    tonel(m, g.sub(6.3, 4.4, 0, s0), 0, 0)
    caja(m, g, 7.0, 7.12, s0, s1, 1.6, 2.9, MADERA, .8); caja(m, g, 7.0, 7.12, s0, s1, 3.9, Fd - 0.75, MADERA, .8)        # el tabique del zaguán, con su puerta
    caja(m, g, 7.0, 7.12, s0 + 2.1, s1, 2.9, 3.9, MADERA, .8)
    escalera(m, F(*g.p2(7.2, 1.5), g.a + 0, 0), 0, 3.0, -1.4, 0.0, s0, s1, PIEDRA, True)
    # dormitorio arriba: doce jergones, hogar, mesa, letrina en el muro
    for k in range(6): jergon(m, g.sub(1.4 + k * 1.0, 1.2, math.pi / 2, s1), 0, 0)
    for k in range(5): jergon(m, g.sub(2.4 + k * 1.0, 4.0, math.pi / 2, s1), 0, 0)
    chimenea(m, F(*g.p2(0.75, Fd / 2 - 0.4), g.a + math.pi / 2 * -1 + math.pi, s1), 0, 1.3, 0, 2.0) if False else _hogar(m, g, 0.75, 2.6, s1)
    mesa(m, g.sub(8.6, 3.0, 0, s1), 0, 0, 1.4, 0.7); banco(m, g.sub(8.6, 3.7, 0, s1), 0, 0, 1.3)
    for k in range(4): caja(m, g, 1.0 + k * 1.4, 1.1 + k * 1.4, s1 + 1.5, s1 + 1.6, 0.0, 0.25, MADERA)    # perchas
    return g

def _hogar(m, g, u, w, v):
    """hogar en el costado (u pequeño), con su campana"""
    chimenea(m, F(*g.p2(u, w), g.a, v), 0, 1.4, 0, 2.0)

# ======================================================================================= GRANERO (sobre el cobertizo de carros)
def granero(m, e):
    L, Fd = e.L, e.Fd; s0, s1 = e.pisos
    frente = [hueco_p(3.6, s0, 2.6, 2.6, 'escarzano', 0), hueco_p(7.6, s0, 2.6, 2.6, 'escarzano', 0), hueco_p(11.0, s0, 2.0, 1.1, None, 0),
              hueco_p(1.6, s1, 2.0, 1.0, None, 0)] + [hueco_p(u, s1 + 1.2, 0.5, 0.25, None, 0.2) for u in (4.2, 6.4, 8.6, 10.8)]
    g = construir_adosado(m, e, frente, (), (), TEJA, False, 'mamposteria', ['tierra', 'tablas'])
    carro(m, g.sub(0, 0, 0, s0), 3.6, 2.6, math.pi / 2); carro(m, g.sub(0, 0, 0, s0), 7.6, 2.4, math.pi / 2 + 0.1)
    for k in range(4): caja(m, g, 9.6, 12.2, s0 + k * 0.3, s0 + k * 0.3 + 0.28, 0.1 + (k % 2) * 0.1, 2.2, hexc('#6e4e34'), .8)     # leña
    caja(m, g, 9.4, 9.52, s0, s1, 0.05, Fd - 0.75, MADERA, .8)
    for k in range(5):     # trojes del grano
        u0 = 0.9 + k * 2.3
        for (a, b, w0, w1) in ((u0, u0 + 0.08, 0.1, 2.0), (u0 + 2.1, u0 + 2.18, 0.1, 2.0), (u0, u0 + 2.18, 1.92, 2.0)):
            caja(m, g, a, b, s1, s1 + 1.0, w0, w1, MADERA_CL, .8)
        caja(m, g, u0 + 0.08, u0 + 2.1, s1, s1 + 0.7, 0.1, 1.92, hexc('#c9b06a'), .9)
    for k in range(6): saco(m, g.sub(7.5 + (k % 3) * 0.6, 3.8 + (k // 3) * 0.6, 0, s1), 0, 0)
    caja(m, g, 4.5, 5.6, s1, s1 + 0.12, 3.2, 4.2, hexc('#9a8460'))   # la medida (fanega)
    # escalera de piedra por fuera, con el último peldaño de madera
    fe = F(*g.p2(7.2, Fd + 0.05), g.a + math.pi, 0)
    escalera(m, fe, 0, 4.6, -1.2, 0.0, s0, s1 - 0.25, PIEDRA, True)
    caja(m, g, 1.2, 2.6, s1 - 0.3, s1 - 0.05, Fd, Fd + 1.2, MADERA_CL, .8)
    return g

# ======================================================================================= HERRERÍA (suelta)
def herreria(m, c, piso):
    """c: centro; piso: suelo"""
    g = F(c[0], c[1], math.atan2(A[1] - G[1], A[0] - G[0]) + math.pi / 2, 0)
    L2, W2 = 3.2, 2.6
    base = min(h(*g.p2(u, w)) for u in (-L2, L2) for w in (-W2, W2)) - 0.6
    muro(m, g, -L2, L2, base, piso + 3.0, -W2, -W2 + 0.6, [], 'mamposteria', None, tapa=True, cabezas=True, suelo=piso)
    for s in (-1, 1):
        fs = F(*g.p2(s * L2, 0), g.a + (math.pi / 2 if s > 0 else -math.pi / 2), 0)
        muro(m, fs, -W2, W2 - 1.2, base, piso + 3.0, -0.6, 0, [], 'mamposteria', None, tapa=True, cabezas=True, suelo=piso)
    for s in (-1, 1): caja(m, g, s * L2 - 0.6 * (s > 0) - 0.0, s * L2 + 0.6 * (s < 0), base, piso + 3.0, W2 - 0.6, W2, PIEDRA, .8)   # los pilares del soportal
    caja(m, g, -L2, L2, piso + 2.6, piso + 3.0, W2 - 0.6, W2, MADERA, .8)
    tejado_dos_aguas(m, g, -L2 - 0.2, L2 + 0.2, -W2, W2, piso + 3.0, 0.55, 0.4, TEJA)
    m.quad(g(-L2 + 0.6, piso - 0.02, -W2 + 0.6), g(L2 - 0.6, piso - 0.02, -W2 + 0.6), g(L2 - 0.6, piso - 0.02, W2), g(-L2 + 0.6, piso - 0.02, W2), CENIZA)
    fragua(m, F(*g.p2(-1.0, -W2 + 0.6), g.a, piso), 0, 0)
    yunque(m, F(*g.p2(0.4, 0.6), g.a, piso), 0, 0)
    caja(m, g, 1.4, 2.4, piso, piso + 0.7, -0.2, 0.4, MADERA, .8); caja(m, g, 1.45, 2.35, piso + 0.55, piso + 0.71, -0.15, 0.35, AGUA)
    caja(m, g, 1.8, 2.6, piso, piso + 0.6, -W2 + 0.65, -W2 + 1.5, hexc('#2e2a26'), .8)
    caja(m, g, -2.6, -2.56, piso + 1.2, piso + 2.2, -1.2, 1.0, MADERA, .8)
    for k in range(5): caja(m, g, -2.55, -2.5, piso + 1.3, piso + 2.0, -1.0 + k * 0.4, -0.95 + k * 0.4, HIERRO)    # tenazas y martillos colgados
    # el potro de herrar, fuera
    fp = g.sub(0, W2 + 2.0, 0, piso)
    for su in (-1, 1):
        for sw in (-1, 1): caja(m, fp, su * 1.2 - 0.08, su * 1.2 + 0.08, 0, 1.9, sw * 0.5 - 0.08, sw * 0.5 + 0.08, MADERA)
        caja(m, fp, -1.3, 1.3, 1.8, 1.92, su * 0.5 - 0.06, su * 0.5 + 0.06, MADERA)
    return g

# ======================================================================================= SALA GRANDE (sobre bodegas), a la mar
def sala(m, e):
    L, Fd = e.L, e.Fd; s0, s1 = e.pisos
    # u = 0: el extremo de servicio (lado de la cocina); u = L: el estrado
    frente = [hueco_p(3.0, s0, 2.0, 1.2, 'medio'), hueco_p(9.0, s0, 2.0, 1.2, 'medio'),
              hueco_p(2.0, s1, 2.3, 1.3, 'apuntado', 0.3), hueco_p(6.5, s1 + 1.2, 1.9, 1.0, 'apuntado'), hueco_p(10.5, s1 + 1.2, 1.9, 1.0, 'apuntado')]
    costado0 = [hueco_p(Fd / 2, s0, 2.0, 1.1, 'medio')]   # la puerta del paso cubierto de la cocina
    g = construir_adosado(m, e, frente, costado0, (), TEJA, False, 'silleria', ['losas', 'tablas'], [[], [(0.9, 3.4, 0.3, 2.6)]])
    # bodegas: el cillero con las cubas, la despensa
    for k in range(5):
        tonel(m, g.sub(5.2 + k * 1.1, 0.8, 0, s0), 0, 0, True, 0.5, 1.2, math.pi / 2)
    for k in range(4): tonel(m, g.sub(5.2 + k * 1.1, 2.2, 0, s0), 0, 0)
    estante(m, F(*g.p2(10.6, 0.05), g.a, s0), 0, 0, 2.0, 1.8)
    for k in range(6): saco(m, g.sub(11.4 + (k % 3) * 0.6, 3.6 + (k // 3) * 0.6, 0, s0), 0, 0)
    caja(m, g, 4.4, 4.52, s0, s1, 0.05, Fd - 0.75, PIEDRA, .8)
    # escalera de servicio, junto al extremo de la cocina
    escalera(m, F(*g.p2(0.9, 2.6), g.a + 0, 0), 0, 3.6, -1.6, 0.0, s0, s1, PIEDRA, True) if False else escalera(m, F(*g.p2(0.9, 0.9), g.a, 0), 0, min(3.0, (s1 - s0) / 0.2 * 0.24), 0, 1.4, s0, s1, PIEDRA, True)
    # planta alta: la sala. Mamparas en el extremo de servicio, estrado y mesa alta en el otro
    caja(m, g, 3.6, 3.72, s1, s1 + 2.6, 0.2, Fd - 2.6, MADERA, .8); caja(m, g, 3.6, 3.72, s1, s1 + 2.6, Fd - 1.4, Fd - 0.75, MADERA, .8)
    caja(m, g, 3.62, 3.7, s1 + 2.6, s1 + 3.0, 0.2, Fd - 0.75, MADERA_CL, .8)
    caja(m, g, L - 3.2, L - 0.75, s1, s1 + 0.25, 0.05, Fd - 0.75, MADERA_CL, .8)            # el estrado
    mesa(m, g.sub(L - 2.0, Fd / 2 - 0.4, math.pi / 2, s1 + 0.25), 0, 0, 3.2, 0.9)
    silla(m, g.sub(L - 1.25, Fd / 2 - 0.4, 0, s1 + 0.25), 0, 0, math.pi / 2, True)          # el sitial
    for (w_, ang_) in ((1.4, 0), (Fd - 2.0, 0)):
        mesa(m, g.sub(L / 2 + 0.6, w_, 0, s1), 0, 0, 5.0, 0.8); banco(m, g.sub(L / 2 + 0.6, w_ + (0.6 if w_ < 3 else -0.6), 0, s1), 0, 0, 4.6)
    chimenea(m, F(*g.p2(L / 2 + 0.4, 0.05), g.a, s1), 0, 2.2, 0, 2.8)
    tapiz(m, F(*g.p2(L - 0.76, Fd / 2), g.a - math.pi / 2, 0), -1.8, 1.8, s1 + 1.2, s1 + 3.4, 0, TELA_ROJA)
    for u_ in (5.0, 9.6): antorcha(m, F(*g.p2(u_, Fd - 0.76), g.a + math.pi, 0), 0, s1 + 1.9, 0)
    # botillería y despensa del pan tras las mamparas
    estante(m, F(*g.p2(1.6, 0.05), g.a, s1), 0, 0, 1.6, 1.8); tonel(m, g.sub(2.8, 0.5, 0, s1), 0, 0)
    # escalera de piedra del patio a la puerta de la sala (patín)
    fe = F(*g.p2(2.0 + 1.2, Fd + 0.05), g.a, 0)
    largo = (s1 - e.suelo) / 0.2 * 0.29
    escalera(m, F(*g.p2(2.0 + 0.65 + largo + 0.9, Fd + 0.05), g.a + math.pi, 0), 0, largo, -1.25, 0.0, h(*g.p2(2.0 + largo + 1.5, Fd + 0.6)), s1 - 0.25, PIEDRA, True)
    prisma(m, g, [(1.2, Fd), (2.8 + 0.05, Fd), (2.8 + 0.05, Fd + 1.3), (1.2, Fd + 1.3)], e.suelo - 0.5, s1 - 0.02, PIEDRA)
    return g

# ======================================================================================= COCINA
def cocina(m, e):
    L, Fd = e.L, e.Fd; s0 = e.pisos[0]
    frente = [hueco_p(L - 1.8, s0, 2.0, 1.2, 'medio'), hueco_p(3.6, s0 + 1.4, 1.0, 0.8, None, 0.4)]
    g = construir_adosado(m, e, frente, (), (), TEJA, False, 'mamposteria', ['losas'])
    chimenea(m, F(*g.p2(2.0, 0.05), g.a, s0), 0, 2.2, 0, 2.6)
    chimenea(m, F(*g.p2(4.9, 0.05), g.a, s0), 0, 2.0, 0, 2.6)
    caldero(m, g, 4.9, 0.55, 0.35, s0 + 0.15)
    for s in (-1, 1): caja(m, g, 2.0 + s * 0.9 - 0.04, 2.0 + s * 0.9 + 0.04, s0, s0 + 0.9, 0.5, 0.58, HIERRO)
    caja(m, g, 1.1, 2.9, s0 + 0.85, s0 + 0.9, 0.52, 0.56, HIERRO)    # el asador
    # el horno de pan: cúpula en un cuerpo de piedra
    fo = g.sub(L - 1.3, 1.0, 0, s0)
    caja(m, fo, -0.9, 0.9, 0, 1.0, -0.95, 0.95, PIEDRA, .8)
    bola(m, *fo(0, 1.0, 0), 0.85, 0.7, esc(PIEDRA_CLARA, .9), 8, 3)
    caja(m, fo, -0.25, 0.25, 0.75, 1.3, 0.9, 0.97, OSCURO)
    mesa(m, g.sub(3.4, 3.4, 0, s0), 0, 0, 2.4, 0.9)
    caja(m, g, 0.75, 1.5, s0, s0 + 0.85, 2.6, 4.0, PIEDRA, .8); caja(m, g, 0.8, 1.45, s0 + 0.7, s0 + 0.86, 2.7, 3.9, AGUA)    # la pila
    for k in range(3): tonel(m, g.sub(6.4 + k * 0.7, Fd - 1.3, 0, s0), 0, 0)
    for k in range(3): caja(m, g, 1.3 + k * 0.5, 1.5 + k * 0.5, s0 + 1.6, s0 + 2.1, 0.0, 0.08, esc(HIERRO, 1.4))      # sartenes colgadas
    caja(m, g, 5.8, 7.4, s0, s0 + 0.8, 0.1, 0.9, hexc('#6e4e34'), .8)   # leña
    estante(m, F(*g.p2(7.4, 0.05), g.a, s0), 0, 0, 1.0, 1.8)
    return g

# ======================================================================================= CAPILLA
def capilla(m, e, altar_en_u_alto=True):
    L, Fd = e.L, e.Fd; s0 = e.pisos[0]; s1 = e.pisos[0] + 3.2
    ua = L - 1.6 if altar_en_u_alto else 1.6
    frente = [hueco_p(L * 0.42, s0, 2.4, 1.3, 'apuntado'), hueco_p(L * 0.66, s0 + 2.6, 1.8, 0.6, 'apuntado', 0.6), hueco_p(L * 0.88 if altar_en_u_alto else L * 0.12, s0 + 2.4, 2.0, 0.6, 'apuntado', 0.6)]
    cost = [hueco_p(Fd / 2, s0 + 2.8, 1.4, 0.5, 'apuntado', 0.5)]
    g = construir_adosado(m, e, frente, cost if not altar_en_u_alto else (), cost if altar_en_u_alto else (), TEJA, False, 'silleria', ['losas'])
    # presbiterio un peldaño más alto, altar a levante
    up0, up1 = (L - 3.4, L - 0.75) if altar_en_u_alto else (0.75, 3.4)
    caja(m, g, up0, up1, s0, s0 + 0.2, 0.05, Fd - 0.75, PIEDRA_CLARA, .85)
    altar(m, g.sub(ua, Fd / 2 - 0.35, math.pi / 2, s0 + 0.2), 0, 0)
    caja(m, g, up0 + 0.3, up0 + 0.8, s0 + 0.2, s0 + 1.0, 0.05, 0.4, PIEDRA_CLARA, .85)   # la piscina
    # tribuna de madera en el otro extremo, con su escalera, y la sacristía debajo
    ut0, ut1 = (0.75, 3.0) if altar_en_u_alto else (L - 3.0, L - 0.75)
    caja(m, g, ut0, ut1, s1 - 0.15, s1, 0.05, Fd - 0.75, TABLA, .8)
    for k in range(4): caja(m, g, ut0, ut1, s1, s1 + 1.0, Fd - 0.85 if k == 0 else 0, 0, MADERA) if k == 0 else None
    caja(m, g, ut1 - 0.08, ut1, s0, s1 + 1.0, 0.05, 0.9, MADERA, .8); caja(m, g, ut1 - 0.08, ut1, s0, s1 + 1.0, 1.9, Fd - 0.75, MADERA, .8)
    caja(m, g, ut1 - 0.08, ut1, s0 + 2.1, s1 + 1.0, 0.9, 1.9, MADERA, .8)
    cama(m, g.sub((ut0 + ut1) / 2, 0.6, 0, s0), 0, 0, 0, 1.9, 0.8, LANA)
    arca(m, g.sub((ut0 + ut1) / 2, 2.0, 0, s0), 0, 0)
    _escala_inclinada(m, g, ut0 + 0.5, Fd - 1.0, ut0 + 0.5, Fd - 2.6, s0, s1)
    # bancos para la familia del alcaide y un reclinatorio
    for k in range(2): banco(m, g.sub(L / 2 + (k - 0.5) * 2.2 * (1 if altar_en_u_alto else -1), Fd / 2 - 0.4, math.pi / 2, s0), 0, 0, 2.6)
    for u_ in (L * 0.3, L * 0.55): antorcha(m, F(*g.p2(u_, 0.05), g.a, 0), 0, s0 + 1.9, 0)
    # espadaña sobre el hastial de poniente
    fe = g.sub(ut0 - 0.75, Fd / 2, 0, 0)
    vt = e.alto + Fd * 0.42
    muro(m, fe, -0.35, 0.35, e.alto, vt + 2.6, -1.2, 1.2, [{'u': 0, 'a': 0.0, 'v0': 0, 'v1': 0}] * 0, 'silleria', PIEDRA, True, True, suelo=vt + 50) if False else None
    fe = g.sub(ut0 - 0.75, 0, 0, 0)
    caja(m, fe, 0.0, 0.75, e.alto - 0.2, vt + 2.4, 0.3, 2.5, PIEDRA, .85)
    m.tri(fe(0.0, vt + 2.4, 0.3), fe(0.0, vt + 2.4, 2.5), fe(0.0, vt + 3.1, 1.4), PIEDRA)
    m.tri(fe(0.75, vt + 2.4, 2.5), fe(0.75, vt + 2.4, 0.3), fe(0.75, vt + 3.1, 1.4), PIEDRA)
    m.quad(fe(0.0, vt + 2.4, 0.3), fe(0.0, vt + 3.1, 1.4), fe(0.75, vt + 3.1, 1.4), fe(0.75, vt + 2.4, 0.3), esc(PIEDRA, .9))
    m.quad(fe(0.0, vt + 3.1, 1.4), fe(0.0, vt + 2.4, 2.5), fe(0.75, vt + 2.4, 2.5), fe(0.75, vt + 3.1, 1.4), esc(PIEDRA, .9))
    caja(m, fe, -0.02, 0.77, vt + 0.7, vt + 1.9, 0.95, 1.85, OSCURO)
    cilindro(m, F(*fe.p2(0.375, 1.4), fe.a, vt + 0.85), 0, 0, 0.25, 0.0, 0.55, hexc('#7a6a3a'), 8, True, 0.1)
    return g

# ======================================================================================= ESCALERAS AL ADARVE (pegadas a la muralla)
def escalera_adarve(m, c, u_ini, sube_hacia_u_mas=True, ancho=1.4):
    """escalera de piedra pegada a la cara de dentro de la cortina c, desde el suelo hasta ADARVE"""
    f = c.f
    s = 1 if sube_hacia_u_mas else -1
    g_pie = c.suelo_en(u_ini, -c.T / 2 - ancho / 2)
    largo = (ADARVE - g_pie) / 0.2 * 0.27
    # marco: u a lo largo de la escalera (en el sentido de subida), w hacia el patio desde la muralla
    fe = F(*f.p2(u_ini, -c.T / 2), f.a if s > 0 else f.a + math.pi, 0)
    wsign = -1 if s > 0 else 1     # en fe, el patio queda hacia -w (s>0) o +w (s<0)
    w0, w1 = (-ancho, 0) if s > 0 else (0, ancho)
    escalera(m, fe, 0, largo, w0, w1, g_pie, ADARVE, PIEDRA, True)
    # pretil por el lado del patio
    for k in range(int(largo / 0.27)):
        u0 = k * 0.27; v = g_pie + (k + 1) * 0.2
        wa, wb = (w0 - 0.25, w0) if s > 0 else (w1, w1 + 0.25)
        caja(m, fe, u0, u0 + 0.28, v, v + 0.85, wa, wb, PIEDRA, .85)
    return largo
