# Los recorridos de prueba por el castillo (en el mundo): {nombre: [[x, z, altura esperada o null, nombre], ...]}.
# Los anda pruebas/prueba_castillo_rey.mjs (con la lógica) y pruebas/prueba_castillo_rey_navegador.py (en el juego).
# Un punto «~» es de un caracol: se anda despacio.
import sys, json, math, os
AQUI = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, AQUI)
src = open(os.path.join(AQUI, 'modelo.py')).read(); exec(src.split("for u_ in (5.0, 9.6, 13.2)")[0])
from puertas import GPF, PF, BU, BW0, BW1, GW1, GW0, GU, PASO, ARRANQUE_GUARDIA
from homenaje import KC, KL, KA, KT, K1, K2, ARRANQUE
from obra import ARRANQUE_TORRE
from sitio import P_ALC
import patios
RUTAS = {}
def pt(R, xz, y=None, n=''): R.append([round(xz[0], 2), round(xz[1], 2), None if y is None else round(y, 2), n])
def espiral(R, f, cu, cw, r, ang0, v0, hasta, sala, salida=None):
    """sube un caracol: desde 'sala' (u, w en el marco), al primer peldaño (que mira a la sala) y girando hasta 'hasta'"""
    pt(R, f.p2(*sala), v0)
    a = ang0 - 0.45; pt(R, f.p2(cu + 0.62 * math.cos(a), cw + 0.62 * math.sin(a)), v0, '~')
    tot = int(round((hasta - v0) / 0.2)) * 28
    for g in range(0, tot + 1, 10):
        a = ang0 + math.radians(g); pt(R, f.p2(cu + 0.62 * math.cos(a), cw + 0.62 * math.sin(a)), None, '~')
    if salida:   # (sale por una puerta: la de la caseta de la terraza)
        for q in salida: pt(R, f.p2(*q), hasta, 'saliendo del caracol')
        return
    a = ang0 + math.radians(tot - 14); pt(R, f.p2(cu + 1.3 * math.cos(a), cw + 1.3 * math.sin(a)), hasta, 'saliendo del caracol')
# ---------------- el que ataca: de la calle a la cámara del alcaide
R = []
pt(R, (217465 + 79.0, 53060 - 57.0), None, 'calle')
pt(R, GPF.p2(BU * 0.6, BW1 + 9.5)); pt(R, GPF.p2(-BU - 4, BW1 + 4.5)); pt(R, GPF.p2(-BU - 4, BW1 - 4.5), None, 'ante la puerta de la barbacana')
pt(R, GPF.p2(-BU + 2.5, BW1 - 4.5), None, 'dentro de la barbacana'); pt(R, GPF.p2(0, BW0 + 3)); pt(R, GPF.p2(0, BW0 - 1.0), PF - 0.02, 'en el puente')
pt(R, GPF.p2(0, GW1 + 1.0), PF - 0.02, 'en el levadizo'); pt(R, GPF.p2(0, 0), PF, 'en el paso de la puerta'); pt(R, GPF.p2(0, -7), None, 'en el patio de armas')
f_, _r = marco_fuera(B, Fp, CEN_INT); ga = F(P_ALC[0], P_ALC[1], f_.a, 0)
pt(R, ga.p2(0, 6)); pt(R, ga.p2(0, 0), None, 'en la puerta del alcázar'); pt(R, ga.p2(0, -6), None, 'en el patio del alcázar')
t = Torre('K', KC, KL, KA, 1, KT); fi = t.cara(t.cara_hacia(CEN_INT))
pt(R, fi.p2(KL * 0.485, 12.5), None, 'al pie de la escalera del homenaje'); pt(R, fi.p2(KL * 0.485, 2.0), K1, 'en lo alto de la escalera')
pt(R, fi.p2(KL * 0.485, -1.5), K1, 'en la puerta del homenaje'); pt(R, fi.p2(KL * 0.485, -3.5), K1, 'en la sala del homenaje')
cu, cw = KL - KT - 1.0 - 0.1, -KT - 1.0 - 0.1
espiral(R, fi, cu, cw, 1.0, ARRANQUE, K1, K2, (KL / 2, -KL / 2))
pt(R, fi.p2(KL / 2, -KL / 2 + 0.6), K2, 'en la cámara del alcaide')
RUTAS['atacante'] = R
# ---------------- la guardia: del patio de armas a la torre AB, su caracol hasta el adarve y por el adarve hasta la torre A
G = []
tAB = TW['AB']; cp = tAB.cara_hacia(CEN_EXT); fc = tAB.cara(cp); L_, T_ = tAB.lado, tAB.T
pt(G, fc.p2(L_ * 0.38, 4.0), None, 'en el patio, ante la torre AB'); pt(G, fc.p2(L_ * 0.38, -0.7), None, 'en la puerta de la torre')
pt(G, fc.p2(L_ * 0.38, -T_ - 0.6), None, 'dentro de la torre')
espiral(G, fc, L_ - T_ - 0.95 - 0.05, -T_ - 0.95 - 0.05, 0.95, ARRANQUE_TORRE, tAB.suelo0, ADARVE, (L_ / 2 - 0.3, -L_ / 2))
pt(G, fc.p2(L_ / 2 - 0.3, -L_ / 2), ADARVE)
i_, u_ = tAB.golpe(A); fa = tAB.cara(i_)
pt(G, fa.p2(u_, -T_ - 0.6), ADARVE, 'ante la puerta del adarve'); pt(G, fa.p2(u_, 1.2), ADARVE, 'en el adarve')
cA = CN['A-AB']; pt(G, cA.p2((cA.u0 + cA.u1) / 2, -0.3), ADARVE, 'a media cortina')
tA = TW['A']; iA, uA = tA.golpe(AB); fA = tA.cara(iA)
pt(G, fA.p2(uA, 1.0), ADARVE, 'ante la torre A'); pt(G, fA.p2(uA, -T_ - 0.7), ADARVE, 'dentro de la torre A, en el adarve')
RUTAS['guardia'] = G
# ---------------- la puerta principal: del paso al cuarto de la guardia, su caracol a la terraza y al adarve
P_ = []
g0 = F(GPF.o[0], GPF.o[1], GPF.a, 0)
pt(P_, g0.p2(0, -1.0), PF, 'en el paso'); pt(P_, g0.p2(PASO - 0.6, GW0 + 2.2), PF); pt(P_, g0.p2(PASO + 1.4, GW0 + 2.2), PF, 'en el cuarto de la guardia')
cuG, cwG = (GU - 1.4 - 1.05), GW0 + 1.3 + 1.05
espiral(P_, g0, cuG, cwG, 0.95, ARRANQUE_GUARDIA, PF, ADARVE, (4.1, -0.6), [(cuG, cwG + 0.7), (cuG, cwG + 1.8)])
pt(P_, g0.p2(cuG - 1.2, cwG + 2.0), ADARVE, 'en la terraza de la puerta'); pt(P_, g0.p2(-GU - 2.0, -0.3), ADARVE, 'en el adarve de la cortina')
RUTAS['puerta'] = P_
# ---------------- la poterna: del patio del alcázar, por su puerta y su escalera, al embarcadero
patios.poterna(Malla(), CN['E-F'])
Q = []
r0, r1, r2, r3 = patios.RELLANO_POTERNA
pt(Q, r0, None, 'en el patio, ante la poterna'); pt(Q, r1, None, 'en el rellano de fuera')
for k, (x, z, y) in enumerate(patios.CAMINO_POTERNA):
    if k % 3 == 2 or abs(y - 7.0) < 0.05: pt(Q, (x, z), None, '')
pt(Q, r2, 1.0, 'en el muelle'); pt(Q, r3, 1.0, 'al final del pantalán')
RUTAS['poterna'] = Q
json.dump(RUTAS, open(os.path.join(AQUI, '..', '..', 'pruebas', 'datos', 'recorrido_castillo_rey.json'), 'w'))
print({k: len(v) for k, v in RUTAS.items()}, 'puntos')
