# El sitio del castillo del rey: trazado, alturas y las piezas que comparten los demás módulos.
import math, sys
import os
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
exec(open(os.path.join(AQUI, 'comun.py')).read())   # h(x, z), t(x, z), dentro, dist_linea…
from kit import *

# ---------------- trazado (mundo: x este, z sur)
A, B, C, D, E, Fp, G = (217578, 52972), (217620, 52952), (217646, 52966), (217636, 52985), (217621, 53005), (217601, 53018), (217584, 53012)
AB = (217599, 52962)                     # torre de en medio del frente norte
RECINTO = [A, AB, B, C, D, E, Fp, G]
EXTERIOR = [A, AB, B, Fp, G]          # patio de armas
INTERIOR = [B, C, D, E, Fp]           # patio del alcázar
CEN = (sum(p[0] for p in RECINTO) / len(RECINTO), sum(p[1] for p in RECINTO) / len(RECINTO))
CEN_EXT = (sum(p[0] for p in EXTERIOR) / len(EXTERIOR), sum(p[1] for p in EXTERIOR) / len(EXTERIOR))
CEN_INT = (sum(p[0] for p in INTERIOR) / len(INTERIOR), sum(p[1] for p in INTERIOR) / len(INTERIOR))

ADARVE = 26.5           # el paseo de ronda de todo el recinto (altura del mundo)
T_MURO = 2.6            # grueso de la muralla
TERRAZA = ADARVE + 4.0  # suelo de las terrazas de las torres
FOSO_FONDO = 10.0       # fondo del foso (seco)
FOSO_ANCHO = 9.0

def suelo(x, z): return h(x, z)
def suelo_max(pts): return max(h(*p) for p in pts)
def suelo_min(pts): return min(h(*p) for p in pts)

def marco_fuera(a, b, centro, y0=0.0):
    """marco con u de a a b y +w hacia fuera del recinto (lejos de centro)"""
    f = F.de_segmento(a, b, y0)
    m_ = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    w_c = (centro[0] - m_[0]) * f.ew[0] + (centro[1] - m_[1]) * f.ew[1]
    if w_c > 0:   # el centro está hacia +w: dar la vuelta
        f = F.de_segmento(b, a, y0); return f, True
    return f, False

# ---------------- torres (cuadrado: centro, lado, ángulo)
def ang(a, b): return math.atan2(b[1] - a[1], b[0] - a[0])
TORRES = {
    'A': (A, 7.0, ang(A, AB)), 'AB': (AB, 7.0, ang(A, B)), 'C': (C, 7.0, ang(B, C)), 'D': (D, 7.0, ang(C, D)),
    'E': (E, 7.0, ang(D, E)), 'F': (Fp, 7.0, ang(E, Fp)), 'G': (G, 7.0, ang(Fp, G)),
}
HOMENAJE = ((B[0] + 1.0, B[1] + 2.0), 13.0, ang(A, B))
# la puerta principal: en la muralla A–G, a media cortina
P_PRINC = ((A[0] + G[0]) / 2, (A[1] + G[1]) / 2)
# la puerta del alcázar: en el muro de separación B–F
P_ALC = (B[0] + (Fp[0] - B[0]) * 0.47, B[1] + (Fp[1] - B[1]) * 0.47)

def esquinas(c, lado, a, fondo=None):
    fondo = fondo or lado; ca, sa = math.cos(a), math.sin(a)
    return [(c[0] + x * ca - z * sa, c[1] + x * sa + z * ca) for x, z in [(-lado / 2, -fondo / 2), (lado / 2, -fondo / 2), (lado / 2, fondo / 2), (-lado / 2, fondo / 2)]]

def corte_cuadrado(p, q, c, lado, a, fondo=None):
    """distancia desde p, en la dirección de q, hasta salir del rectángulo (c, lado, a)"""
    fondo = fondo or lado
    d = (q[0] - p[0], q[1] - p[1]); L = math.hypot(*d); d = (d[0] / L, d[1] / L)
    ca, sa = math.cos(a), math.sin(a)
    rel = (p[0] - c[0], p[1] - c[1])
    lx = rel[0] * ca + rel[1] * sa; lz = -rel[0] * sa + rel[1] * ca
    dx = d[0] * ca + d[1] * sa; dz = -d[0] * sa + d[1] * ca
    best = 1e9
    for (pos, dd, half) in ((lx, dx, lado / 2), (lz, dz, fondo / 2)):
        if abs(dd) < 1e-9: continue
        for s in (-1, 1):
            tt = (s * half - pos) / dd
            if tt > 1e-6: best = min(best, tt)
    return best
